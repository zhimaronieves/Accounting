import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace } from '../../accounting.js';
import { upgradeConfiguration,reduceConfiguration } from './configuration.js';
import { blankMaster,upgradeMasterfile } from './masterfile.js';
import { CONFIG,refRows,refName,suggestedDueDate,validateMasterRefs,activePaymentTerm } from './configuration-data.js';
import { createDirectory,validateDirectory,assertActionAllowed,canPage } from './permissions.js';
const fresh=()=>upgradeConfiguration(createWorkspace());
const save=(s,key,record)=>reduceConfiguration(s,{type:'v2/configuration',key,record});
test('configuration migration is additive and idempotent with stable links and untouched books',()=>{
 const base=upgradeMasterfile(createWorkspace()),s=upgradeConfiguration(base),again=upgradeConfiguration(s);
 assert.deepEqual(again,s);assert.deepEqual(s.entries,base.entries);assert.deepEqual(s.accounts,base.accounts);assert.deepEqual(s.invoices,base.invoices);assert.deepEqual(s.bills,base.bills);
 assert.deepEqual(again.invoices,s.invoices);assert.deepEqual(again.bills,s.bills);
 for(const key of Object.keys(CONFIG))assert.ok(refRows(s,key).length);
 for(const i of s.v2.items){assert.ok(refName(s,'categories',i.categoryId));assert.ok(refName(s,'uoms',i.uomId));}
 for(const e of s.v2.employees)validateMasterRefs(s,'Employees',e,e);
});
test('all configuration types create and update same identifier without journal effects',()=>{
 for(const key of Object.keys(CONFIG)){
  const s=fresh(),before=s.entries,first=refRows(s,key)[0],input={...first,id:undefined,code:undefined,name:'QA '+key};
  let next=save(s,key,input),created=refRows(next,key).at(-1);const count=refRows(next,key).length;
  next=save(next,key,{...created,description:'Updated reference',active:false});
  assert.equal(refRows(next,key).length,count);assert.equal(refRows(next,key).at(-1).id,created.id);assert.equal(refRows(next,key).at(-1).active,false);assert.deepEqual(next.entries,before);
 }
});
test('configuration rejects invalid codes, duplicate names, rule values and missing requirements',()=>{
 const s=fresh(),r=s.v2.configuration.uoms[0];
 assert.throws(()=>save(s,'uoms',{...r,code:'forged'}),/codes/);
 assert.throws(()=>save(s,'uoms',{name:r.name,abbreviation:'x',active:true}),/name already/);
 assert.throws(()=>save(s,'uoms',{...r,abbreviation:''}),/abbreviation/);
 assert.throws(()=>save(s,'terms',{...s.v2.configuration.terms[0],days:1.5}),/whole number/);
 assert.throws(()=>save(s,'departments',{...s.v2.configuration.departments[0],branchId:'bogus'}),/active branch/);
 assert.throws(()=>reduceConfiguration(s,{type:'v2/deleteConfiguration',key:'uoms',id:r.id}));
});
test('inactive references survive edits and renames resolve by ID, new arbitrary selections fail',()=>{
 let s=fresh();const item=s.v2.items[0],cat=s.v2.configuration.categories.find(r=>r.id===item.categoryId);
 s=save(s,'categories',{...cat,name:'Renamed services',active:false});
 assert.equal(refName(s,'categories',item.categoryId),'Renamed services');
 s=reduceConfiguration(s,{type:'v2/master',page:'Items',record:{...item,description:'Updated existing'}});
 assert.equal(s.v2.items[0].category,'Renamed services');
 assert.throws(()=>reduceConfiguration(s,{type:'v2/master',page:'Items',record:{...blankMaster(s,'Items'),name:'New',categoryId:cat.id}}),/active category/);
 assert.throws(()=>reduceConfiguration(s,{type:'v2/master',page:'Items',record:{...item,uomId:'made-up'}}),/active unit/);
});
test('employee department belongs to selected branch, positions are independent',()=>{
 const s=fresh(),r=s.v2.employees[0],wrong=s.v2.configuration.departments.find(d=>d.branchId!==r.branchId);
 assert.throws(()=>reduceConfiguration(s,{type:'v2/master',page:'Employees',record:{...r,departmentId:wrong.id}}),/selected branch/);
 const next=reduceConfiguration(s,{type:'v2/master',page:'Employees',record:{...r,positionId:s.v2.configuration.positions[1].id}});
 assert.equal(next.v2.employees[0].positionId,s.v2.configuration.positions[1].id);
});
test('payment rules use stored days across month/year boundaries instead of the term name',()=>{
 let s=fresh(),r=s.v2.configuration.terms.find(t=>t.days===30);
 assert.equal(suggestedDueDate(s,r.id,'2026-12-20'),'2027-01-19');
 s=save(s,'terms',{...r,name:'Custom collection terms',days:17});assert.equal(suggestedDueDate(s,r.id,'2026-02-20'),'2026-03-09');
});
test('catalog documents snapshot selected references and accept explicit due date overrides',()=>{
 let s=fresh(),p=s.v2.customers[0],item=s.v2.items[0],term=s.v2.configuration.terms.find(t=>t.days===15);
 const document={partyId:p.id,paymentTermId:term.id,issueDate:'2026-10-26',dueDate:'2026-12-01',reference:'QA',status:'Sent',items:[{lineId:'qa-line',itemId:item.id,uomId:item.uomId,uom:item.uom,description:item.name,quantity:1,rate:10000,taxRate:0,accountId:'4000'}]};
 s=reduceConfiguration(s,{type:'v2/invoice',document});const posted=structuredClone(s.invoices.at(-1)),entries=structuredClone(s.entries);
 s=save(s,'terms',{...term,days:45,name:'Updated term'});s=save(s,'uoms',{...s.v2.configuration.uoms.find(u=>u.id===item.uomId),name:'Updated unit',active:false});
 assert.deepEqual(s.invoices.at(-1),posted);assert.deepEqual(s.entries,entries);
 assert.throws(()=>reduceConfiguration(s,{type:'v2/invoice',document:{...document,paymentTermId:'free-text'}}),/payment term/);
});
test('bank references attach metadata to existing actual accounts without changing balances',()=>{
 const s=fresh(),account=s.accounts.find(a=>a.group==='Cash & bank');
 const next=reduceConfiguration(s,{type:'v2/bankReference',accountId:account.id,bankId:s.v2.configuration.banks[0].id,accountNumber:'001-000-000'});
 assert.equal(next.v2.bankAccountReferences[account.id].accountNumber,'001-000-000');assert.deepEqual(next.accounts,s.accounts);assert.deepEqual(next.entries,s.entries);
 assert.throws(()=>reduceConfiguration(s,{type:'v2/bankReference',accountId:'4000',bankId:''}),/cash or bank/);
});
test('configuration permission migration preserves restrictive assignments and enforces mutations',()=>{
 const s=fresh(),dir=createDirectory();for(const u of dir.users)delete u.permissions.Configuration;
 validateDirectory(dir);const manager=dir.users[1],ar=dir.users[3],viewer=dir.users[5];
 assert.ok(canPage(manager,'Payment Terms'));assert.ok(canPage(viewer,'Banks'));assert.ok(!canPage(ar,'Payment Terms'));
 const action={type:'v2/configuration',key:'terms',record:{...s.v2.configuration.terms[0],days:12}};
 assert.doesNotThrow(()=>assertActionAllowed(manager,action,s));assert.throws(()=>assertActionAllowed(viewer,action,s),/permission/);assert.throws(()=>assertActionAllowed(ar,action,s),/permission/);
 manager.permissions.Configuration.edit=false;assert.throws(()=>assertActionAllowed(manager,action,s),/permission/);
 validateDirectory(dir);assert.equal(manager.permissions.Configuration.edit,false);
});

test('inactive document units remain tied to original line identities after reordering',()=>{
 let s=fresh(),item=s.v2.items[0],p=s.v2.customers[0];
 const d={partyId:p.id,paymentTermId:p.paymentTermId,issueDate:'2026-10-26',dueDate:'2026-11-25',status:'Draft',items:[{lineId:'original-line',uomId:item.uomId,uom:item.uom,description:'Service',quantity:1,rate:10000,taxRate:0,accountId:'4000'}]};
 s=reduceConfiguration(s,{type:'v2/invoice',document:d});const saved=s.invoices.at(-1);
 s=save(s,'uoms',{...s.v2.configuration.uoms.find(u=>u.id===item.uomId),active:false});
 assert.doesNotThrow(()=>reduceConfiguration(s,{type:'v2/invoice',document:{...saved,notes:'Updated draft'}}));
 assert.throws(()=>reduceConfiguration(s,{type:'v2/invoice',document:{...saved,items:[{...saved.items[0],lineId:'new-line'}]}}),/active unit/);
});

test('new document defaults skip inactive payment terms',()=>{
 let s=fresh(),r=s.v2.configuration.terms.find(t=>t.days===30);s=save(s,'terms',{...r,active:false});
 assert.notEqual(activePaymentTerm(s,r.id),r.id);assert.ok(s.v2.configuration.terms.find(t=>t.id===activePaymentTerm(s,r.id)).active);
});
