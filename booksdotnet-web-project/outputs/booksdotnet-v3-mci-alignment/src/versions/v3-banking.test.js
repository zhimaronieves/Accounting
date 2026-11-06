import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { withBankingSamples } from './v3-banking-samples.js';
import { upgradeBanking,reduceBanking,bankBookBalance,bankMovements,reconciliationSummary,completedMovementIds } from './v2/banking.js';
import { createDirectory,validateDirectory,can,assertActionAllowed } from './v2/permissions.js';
import { validateEntry } from '../accounting.js';
import { isPostableAccount } from '../account-hierarchy.js';
const snapshot=JSON.parse(fs.readFileSync(new URL('../v3-initial-snapshot.json',import.meta.url)));
const base=upgradeBanking(snapshot.workspace), sample=withBankingSamples(base), ids=sample.v2.bankingSample.bankIds;

test('Banking sample migration is additive, immutable and refresh-idempotent',()=>{
 const before=structuredClone(base),s=withBankingSamples(base);
 assert.deepEqual(base,before);
 for(const key of ['entries','accounts','invoices','bills'])assert.deepEqual(s[key].slice(0,base[key].length),base[key],key);
 assert.deepEqual(s.v2.payments.slice(0,base.v2.payments.length),base.v2.payments);
 assert.deepEqual(s.v2.bankMappings,base.v2.bankMappings);
 assert.equal(withBankingSamples(s),s);
 const restored=JSON.parse(JSON.stringify(s));assert.equal(JSON.stringify(withBankingSamples(restored)),JSON.stringify(s));
 // Existing bank accounts and code collisions remain intact; samples get their own identities.
 const existing=structuredClone(base);existing.accounts.push({id:'1040',code:'1040',name:'Existing cash',type:'Asset',group:'Cash & bank',active:true});
 existing.v2.bankAccounts.push({id:'BANK-0010',name:'Existing bank',bankId:existing.v2.configuration.banks[0].id,glAccountId:'1040',accountNumber:'9990-0000-0101',active:true,currency:'PHP'});
 const added=withBankingSamples(existing);assert.deepEqual(added.v2.bankAccounts[0],existing.v2.bankAccounts[0]);assert.deepEqual(added.accounts.find(a=>a.id==='1040'),existing.accounts.at(-1));
});

test('Three sample balances derive from distinct eligible GLs and balanced posted journals',()=>{
 assert.deepEqual(ids.map(id=>bankBookBalance(sample,id)),[48525000,32000000,75000000]);
 const banks=ids.map(id=>sample.v2.bankAccounts.find(b=>b.id===id));assert.equal(new Set(banks.map(b=>b.glAccountId)).size,3);
 for(const b of banks){const gl=sample.accounts.find(a=>a.id===b.glAccountId);assert.equal(gl.group,'Cash & bank');assert.ok(isPostableAccount(sample.accounts,gl));}
 for(const id of sample.v2.bankingSample.entryIds){const e=sample.entries.find(e=>e.id===id);const totals=validateEntry(e,sample.accounts,true);assert.equal(totals.debit,totals.credit);}
 const movements=bankMovements(sample),sourcePayments=sample.v2.payments.filter(p=>p.demo&&p.reference?.startsWith('V3-SAMPLE'));
 assert.equal(sourcePayments.length,2);
 for(const p of sourcePayments){assert.equal(movements.filter(m=>m.journalId===p.entryId&&m.bankAccountId===ids[0]).length,1);assert.equal(sample.v2.bankTransactions.filter(t=>t.entryId===p.entryId).length,0);}
 const transfer=sample.v2.bankTransactions.find(t=>t.reference==='V3-SAMPLE-TRANSFER'),legs=movements.filter(m=>m.journalId===transfer.entryId);assert.equal(legs.length,2);assert.equal(legs.reduce((n,m)=>n+m.amount,0),0);
 for(const m of bankMovements(base).filter(m=>m.glAccountId==='1000'))assert.equal(movements.find(n=>n.id===m.id).bankAccountId,m.bankAccountId);
 assert.ok(movements.some(m=>m.mappingStatus==='Nonbank cash'&&m.reference==='V3-SAMPLE-WITHDRAWAL'));
});

test('Accounting Manager can perform banking actions; other roles retain restrictions',()=>{
 const directory=createDirectory(),manager=directory.users.find(u=>u.role==='Accounting Manager');
 for(const r of ['view','create','edit','post','approve','export'])assert.equal(can(manager,'Banking',r),true,r);
 for(const action of [{type:'v2/bankAccount',record:{}},{type:'v2/bankTransaction',record:{requestId:'QA',status:'Posted'}},{type:'v2/reconciliation',record:{},complete:true}])assert.doesNotThrow(()=>assertActionAllowed(manager,action,sample));
 const accountant=directory.users.find(u=>u.role==='Accountant');assert.equal(can(accountant,'Banking','create'),false);
 const imported=structuredClone(snapshot.directory||directory),others=structuredClone(imported.users.filter(u=>u.role!=='Accounting Manager').map(u=>u.permissions.Banking));
 validateDirectory(imported);assert.deepEqual(imported.users.filter(u=>u.role!=='Accounting Manager').map(u=>u.permissions.Banking),others);
 assert.equal(can(imported.users.find(u=>u.role==='Accounting Manager'),'Banking','create'),true);
});

test('Bank account saving and transaction draft/post workflows retain dependencies and idempotence',()=>{
 const petty=sample.accounts.find(a=>a.name==='Petty Cash — Counter Withdrawals');
 assert.throws(()=>reduceBanking(sample,{type:'v2/bankAccount',record:{name:'Invalid cash linkage',bankId:sample.v2.configuration.banks[0].id,accountNumber:'123123123',glAccountId:petty.id,currency:'PHP',active:true}}),/Cash in Bank/);
 const available=sample.accounts.find(a=>a.name==='Cash in Bank — Additional Company Account');
 let s=reduceBanking(sample,{type:'v2/bankAccount',record:{name:'QA Extra Account',bankId:sample.v2.configuration.banks[0].id,accountNumber:'999888777666',currency:'PHP',glAccountId:available.id,active:true}});
 assert.equal(s.v2.bankAccounts.length,sample.v2.bankAccounts.length+1);assert.deepEqual(s.entries,sample.entries);
 const record={requestId:'QA-BANK-DRAFT',bankAccountId:ids[1],type:'Direct Deposit',date:'2026-10-25',amount:100000,offsetAccountId:'booksdotnet-opening-balance-equity',description:'QA multiline\nDeposit',status:'Draft'};
 s=reduceBanking(s,{type:'v2/bankTransaction',record});const draft=s.v2.bankTransactions.at(-1);assert.equal(s.entries.length,sample.entries.length);
 s=reduceBanking(s,{type:'v2/bankTransaction',record:{...draft,status:'Posted'}});assert.equal(s.entries.length,sample.entries.length+1);assert.equal(bankBookBalance(s,ids[1]),32100000);
 const posted=s.v2.bankTransactions.at(-1);assert.equal(reduceBanking(s,{type:'v2/bankTransaction',record:posted}).entries.length,s.entries.length);
 assert.throws(()=>reduceBanking(s,{type:'v2/bankTransaction',record:{...record,requestId:'MISSING',bankAccountId:'',status:'Posted'}}),/active company bank/);
 assert.throws(()=>reduceBanking(s,{type:'v2/bankAccount',record:{...s.v2.bankAccounts.at(-1),glAccountId:'1000'}}),/historical shared/);
});

test('Reconciliation samples retain matching checks, read-only completion and duplicate prevention',()=>{
 const [completed,progress,draft]=sample.v2.bankingSample.reconciliationIds.map(id=>sample.v2.reconciliations.find(r=>r.id===id));
 assert.deepEqual([completed.status,progress.status,draft.status],['Completed','In Progress','Draft']);assert.equal(completed.summary.difference,0);assert.equal(completed.summary.statementDifference,0);assert.equal(completed.summary.unmatchedCount,0);
 assert.ok(completed.matches.every(m=>completedMovementIds(sample).has(m.movementId)));
 assert.throws(()=>reduceBanking(sample,{type:'v2/reconciliation',record:completed}),/read-only/);
 const totals=reconciliationSummary(sample,progress);assert.equal(totals.difference,0);assert.equal(totals.unmatchedCount,1);
 assert.throws(()=>reduceBanking(sample,{type:'v2/reconciliation',record:{...progress,reviewed:true},complete:true}),/Resolve unmatched/);
 const unmatched=totals.unmatched[0],movement=totals.eligible.find(m=>!progress.matches.some(x=>x.movementId===m.id)&&m.amount===unmatched.moneyIn-unmatched.moneyOut);
 const next=reduceBanking(sample,{type:'v2/reconciliation',complete:true,record:{...progress,reviewed:true,matches:[...progress.matches,{statementId:unmatched.id,movementId:movement.id}]}});
 assert.equal(next.v2.reconciliations.find(r=>r.id===progress.id).status,'Completed');assert.deepEqual(next.entries,sample.entries);
 assert.throws(()=>reduceBanking(sample,{type:'v2/reconciliation',record:{...progress,matches:[...progress.matches,progress.matches[0]]}}),/one-to-one/);
 const empty={bankAccountId:'',startDate:'2026-10-21',endDate:'2026-10-26',endingBalance:0,statement:[],matches:[]};assert.throws(()=>reduceBanking(sample,{type:'v2/reconciliation',record:empty}),/active company bank/);
});
