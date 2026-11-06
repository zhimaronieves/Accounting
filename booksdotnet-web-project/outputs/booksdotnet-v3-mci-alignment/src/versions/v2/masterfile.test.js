import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace, accountBalance, outstanding } from '../../accounting.js';
import { upgradeMasterfile, reduceMasterfile, blankMaster, documentTotals, partySummary } from './masterfile.js';
import { upgradeTransactions } from './transactions.js';
import { financialStatements } from './statements.js';
import { createDirectory, validateDirectory, canMaster, canPage, assertActionAllowed } from './permissions.js';
const range={start:'2026-10-01',end:'2026-10-26'}, fresh=()=>upgradeMasterfile(createWorkspace());
const master=(s,page,patch)=>({type:'v2/master',page,record:{...blankMaster(s,page),...patch}});
function balanced(s) { for(const e of s.entries.filter(e=>e.status==='Posted')) assert.equal(e.lines.reduce((x,l)=>x+l.debit-l.credit,0),0); const r=financialStatements(s,range);assert.equal(r.balanceDifference,0);assert.equal(r.equity.difference,0);assert.equal(r.equity.profit,r.report.profit);assert.equal(r.cash.difference,0); }
function document(s,kind,items,patch={}) {return {type:kind==='invoice'?'v2/invoice':'v2/bill',document:{partyId:s.v2[kind==='invoice'?'customers':'suppliers'][0].id,issueDate:range.end,dueDate:'2026-11-26',reference:'NEW-'+kind,items,status:kind==='invoice'?'Sent':'Unpaid',...patch}};}
const itemLine=(item,purchase=false)=>({itemId:item.id,itemCode:item.code,description:item.description,uom:item.uom,quantity:2,rate:purchase?item.purchasePrice:item.salesPrice,taxRate:purchase?item.purchaseTax:item.salesTax,accountId:purchase?item.purchaseAccountId:item.incomeAccountId});
test('Masterfile upgrade is additive and idempotent, preserving all original accounting records',()=>{
 const original=upgradeTransactions(createWorkspace()),s=upgradeMasterfile(original);assert.deepEqual(s.entries,original.entries);assert.deepEqual(s.invoices,original.invoices);assert.deepEqual(s.bills,original.bills);assert.deepEqual(upgradeMasterfile(JSON.parse(JSON.stringify(s))),s);
 assert.equal(s.v2.customers.length,new Set(s.invoices.map(d=>d.partyId)).size);assert.equal(s.v2.items.length,6);assert.equal(s.v2.employees.length,4);balanced(s);
});
test('Customer edits retain identity and source snapshots, enforce a single primary contact, and synchronize addresses',()=>{
 const s=fresh(),p=s.v2.customers[0],oldInvoice=structuredClone(s.invoices[0]);
 const next=reduceMasterfile(s,master(s,'Customers',{...p,registeredName:'Mercado Foods Inc.',sameName:true,billing:{...p.billing,line1:'123 Ayala Avenue'},sameAddress:true,contacts:[{id:'c1',name:'Ana Reyes',email:'ana@example.test',primary:true,phone:'+63 917 123 4567'}],creditLimit:10000000}));
 assert.equal(next.v2.customers[0].id,p.id);assert.equal(next.v2.customers[0].name,'Mercado Foods Inc.');assert.deepEqual(next.v2.customers[0].billing,next.v2.customers[0].shipping);assert.deepEqual(next.invoices[0],oldInvoice);assert.deepEqual(next.entries,s.entries);assert.equal(partySummary(next,'Customers',p.id,range.end).outstanding,partySummary(s,'Customers',p.id,range.end).outstanding);
 assert.throws(()=>reduceMasterfile(s,master(s,'Customers',{...p,contacts:[{id:'1',name:'A',primary:true},{id:'2',name:'B',primary:true}]})),/primary/);assert.throws(()=>reduceMasterfile(s,master(s,'Customers',{...p,code:'OTHER'})),/codes/);
});
test('Employee and item CRUD generate stable unique codes and never create journal entries',()=>{
 let s=fresh();const entries=structuredClone(s.entries);
 s=reduceMasterfile(s,master(s,'Employees',{firstName:'Lea',lastName:'Santos',email:'lea@example.test',branch:'Makati',department:'Finance',position:'Bookkeeper'}));const p=s.v2.employees.at(-1);assert.equal(p.code,'EMP-0005');
 s=reduceMasterfile(s,master(s,'Employees',{...p,active:false}));assert.equal(s.v2.employees.at(-1).active,false);assert.equal(s.v2.employees.at(-1).code,p.code);
 s=reduceMasterfile(s,master(s,'Items',{name:'Consulting service',salesPrice:100000}));assert.equal(s.v2.items.at(-1).code,'ITM-0007');assert.deepEqual(s.entries,entries);
 assert.throws(()=>reduceMasterfile(s,master(s,'Employees',{firstName:'Invalid'})),/required/);assert.throws(()=>reduceMasterfile(s,master(s,'Items',{id:'missing',name:'Bad'})),/no longer exists/);
});
test('Shared items snapshot transaction prices and post multi-account invoices without changing old documents',()=>{
 let s=fresh();s.accounts.push({id:'4100',code:'4100',name:'Product revenue',type:'Revenue',group:'Revenue',active:true});
 const product={...s.v2.items[2],incomeAccountId:'4100',salesTax:12};s=reduceMasterfile(s,master(s,'Items',product));
 const old=structuredClone(s.invoices),a=document(s,'invoice',[itemLine(s.v2.items[0]),itemLine(s.v2.items[2])]);s=reduceMasterfile(s,a);const doc=structuredClone(s.invoices.at(-1)),entry=structuredClone(s.entries.at(-1));
 assert.equal(doc.items[1].itemCode,product.code);assert.equal(doc.tax,6720);assert.equal(entry.lines.find(l=>l.accountId==='4100').credit,56000);assert.deepEqual(s.invoices.slice(0,-1),old);
 s=reduceMasterfile(s,master(s,'Items',{...s.v2.items[2],salesPrice:99000,active:false}));assert.deepEqual(s.invoices.at(-1),doc);assert.deepEqual(s.entries.find(e=>e.id===entry.id),entry);assert.throws(()=>reduceMasterfile(s,{...a,document:{...a.document,reference:'NEXT'}}),/active item/);balanced(s);
});
test('Configured control overrides, credits, multi-account allocations and advance applications reconcile',()=>{
 let s=fresh();s.accounts.push({id:'1110',code:'1110',name:'Trade receivables',type:'Asset',group:'Current assets',active:true});s=reduceMasterfile(s,master(s,'Customers',{...s.v2.customers[0],controlAccountId:'1110'}));
 s=reduceMasterfile(s,document(s,'invoice',[itemLine(s.v2.items[2])]));const doc=s.invoices.at(-1);
 s=reduceMasterfile(s,{type:'v2/note',kind:'invoice',note:{partyId:doc.partyId,docId:doc.id,type:'Credit Note',status:'Posted',date:range.end,reason:'Allowance',amount:1000,tax:0}});assert.equal(accountBalance(s,'1110'),doc.total-1000);
 s=reduceMasterfile(s,{type:'v2/payment',kind:'invoice',payment:{partyId:doc.partyId,date:range.end,method:'Bank transfer',requestId:'master-payment',amount:5000,allocations:[{docId:doc.id,amount:4000}]}});const payment=s.v2.payments.at(-1);
 assert.equal(accountBalance(s,'1110'),doc.total-5000);
 s=reduceMasterfile(s,{type:'v2/applyPayment',kind:'invoice',id:payment.id,date:range.end,requestId:'master-apply',allocations:[{docId:doc.id,amount:1000}]});assert.equal(accountBalance(s,'1110'),outstanding(s.invoices.at(-1)));
 const manager=createDirectory().users[1];assert.throws(()=>assertActionAllowed(manager,{type:'journal',entry:{status:'Draft',lines:[{accountId:'1110',debit:1000,credit:0}]}},s),/controlled/);balanced(s);
});
test('Product purchase respects asset treatment and AP credits follow original cost accounts',()=>{
 let s=fresh();const laptop=s.v2.items.find(i=>i.code==='ITM-0004');s=reduceMasterfile(s,document(s,'bill',[itemLine(laptop,true)]));const doc=s.bills.at(-1);
 assert.equal(s.entries.at(-1).lines.find(l=>l.accountId==='1200').debit,laptop.purchasePrice*2);
 s=reduceMasterfile(s,{type:'v2/note',kind:'bill',note:{partyId:doc.partyId,docId:doc.id,type:'Credit Note',status:'Posted',date:range.end,reason:'Supplier allowance',amount:10000,tax:0}});assert.equal(s.entries.at(-1).lines.find(l=>l.accountId==='1200').credit,10000);balanced(s);
});
test('Account defaults affect future documents only and invalid financial values are rejected',()=>{
 let s=fresh();s.accounts.push({id:'2010',code:'2010',name:'Trade payables',type:'Liability',group:'Current liabilities',active:true});const old=structuredClone(s.bills);
 s=reduceMasterfile(s,{type:'v2/accountingDefaults',defaults:{receivableAccountId:'1100',payableAccountId:'2010'}});s=reduceMasterfile(s,document(s,'bill',[itemLine(s.v2.items[2],true)]));assert.equal(s.bills.at(-1).controlAccountId,'2010');assert.deepEqual(s.bills.slice(0,-1),old);assert.throws(()=>documentTotals([{description:'bad',quantity:1,rate:100,taxRate:NaN}]),/tax rate/);balanced(s);
});
test('Role migration retains customer/supplier scopes and requires explicit configured Banking rights',()=>{
 const d=createDirectory();for(const u of d.users){delete u.permissions.Masterfile;delete u.masterfilePermissions;} const next=validateDirectory(structuredClone(d));const [admin,manager,accountant,ar,ap,viewer]=next.users;
 assert.equal(canMaster(ar,'Customers','edit'),true);assert.equal(canPage(ar,'Suppliers'),false);assert.equal(canMaster(ap,'Suppliers','create'),true);assert.equal(canPage(ap,'Customers'),false);assert.equal(canMaster(viewer,'Items','edit'),false);assert.equal(canMaster(viewer,'Items','view'),true);assert.equal(canMaster(admin,'Employees','create'),true);
 let s=fresh();const action={type:'v2/bankJournal',entry:{date:range.end,status:'Draft',memo:'Bank fee',lines:[{accountId:'5200',debit:1000,credit:0},{accountId:'1000',debit:0,credit:1000}]}};
 assert.throws(()=>assertActionAllowed(manager,action,s),/Access denied/);manager.permissions.Banking.create=true;manager.permissions.Banking.post=true;assert.doesNotThrow(()=>assertActionAllowed(manager,action,s));s=reduceMasterfile(s,action);const e=s.entries.at(-1);assert.equal(e.bankTransaction,true);assert.equal(e.status,'Draft');s=reduceMasterfile(s,{type:'postJournal',id:e.id});assert.equal(s.entries.at(-1).status,'Posted');balanced(s);
});
