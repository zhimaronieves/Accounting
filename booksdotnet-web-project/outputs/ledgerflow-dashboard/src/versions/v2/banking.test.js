import { bankTransactionLines, defaultOffset, legacyBankDraft } from './bank-transaction.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspace,accountBalance} from '../../accounting.js';
import {upgradeBanking,reduceBanking,bankMovements,bankBookBalance,reconciliationSummary,suggestedMatches} from './banking.js';
import {createDirectory,assertActionAllowed} from './permissions.js';
const fresh=()=>upgradeBanking(createWorkspace());
const gl=(s,code,name='Cash in Bank – BDO')=>reduceBanking(s,{type:'account',account:{code,name,type:'Asset',group:'Cash & bank'}});
function setup(){let s=gl(fresh(),'1010');s=reduceBanking(s,{type:'v2/bankAccount',record:{name:'BDO Operating Account',bankId:s.v2.configuration.banks[0].id,accountNumber:'001-234567-890',currency:'PHP',glAccountId:'1010',description:'Sample operating account',active:true}});return s;}
function journal(s,amount=1000000,date='2026-10-01',out=false){return reduceBanking(s,{type:'journal',entry:{date,memo:out?'Outstanding check':'Genuine bank funding transfer',reference:out?'CHK-OUT':'OPEN-BDO',status:'Posted',source:'manual',lines:[{accountId:'1010',debit:out?0:amount,credit:out?amount:0},{accountId:out?'5200':'1000',debit:out?amount:0,credit:out?0:amount}]}});}
function scenario(){let s=journal(setup());const before=s.entries.length;s=reduceBanking(s,{type:'v2/payment',kind:'bill',payment:{requestId:'bank-e2e-payment',partyId:s.v2.suppliers[0].id,date:'2026-10-10',method:'Bank transfer',bankAccountId:s.v2.bankAccounts[0].id,reference:'SUP-5000',amount:500000,allocations:[]}});assert.equal(s.entries.length,before+1);return s;}
function reconcile(s){const bank=s.v2.bankAccounts[0],movements=bankMovements(s).filter(m=>m.bankAccountId===bank.id&&['OPEN-BDO','SUP-5000'].includes(m.reference));return {bankAccountId:bank.id,startDate:'2026-10-01',endDate:'2026-10-20',endingBalance:500000,statement:[{id:'deposit',date:'2026-10-01',description:'Opening deposit',reference:'OPEN-BDO',moneyIn:1000000,moneyOut:0},{id:'payment',date:'2026-10-10',description:'Supplier payment',reference:'SUP-5000',moneyIn:0,moneyOut:500000}],matches:movements.map(m=>({statementId:m.amount>0?'deposit':'payment',movementId:m.id})),reviewed:true};}

test('Banking upgrade preserves all historical records and never assigns the shared 1000 GL to an arbitrary bank',()=>{
 const base=fresh(),snapshot=structuredClone(base),next=upgradeBanking(base);assert.deepEqual(next.entries,snapshot.entries);assert.deepEqual(next.invoices,snapshot.invoices);assert.deepEqual(next.v2.payments,snapshot.v2.payments);assert.equal(next.v2.bankAccounts.length,0);assert.ok(bankMovements(next).some(m=>m.glAccountId==='1000'&&!m.bankAccountId));assert.deepEqual(upgradeBanking(next),next);
});
test('Company bank accounts use configured banks, unique GLs and masked metadata without generating balances',()=>{
 let s=setup();assert.equal(bankBookBalance(s,s.v2.bankAccounts[0].id),0);const count=s.entries.length;
 s=gl(s,'1020','Cash in Bank – BDO Payroll');s=reduceBanking(s,{type:'v2/bankAccount',record:{...s.v2.bankAccounts[0],id:undefined,name:'BDO Payroll Account',glAccountId:'1020',accountNumber:'001-234567-891'}});assert.equal(s.v2.bankAccounts.length,2);assert.equal(s.entries.length,count);
 assert.throws(()=>reduceBanking(s,{type:'v2/bankAccount',record:{...s.v2.bankAccounts[1],glAccountId:'1010'}}),/already in use/);
 assert.throws(()=>reduceBanking(s,{type:'v2/bankAccount',record:{...s.v2.bankAccounts[0],glAccountId:'1000'}}),/historical shared/);
 const b=s.v2.configuration.banks[0];s=reduceBanking(s,{type:'v2/configuration',key:'banks',record:{...b,active:false}});assert.doesNotThrow(()=>reduceBanking(s,{type:'v2/bankAccount',record:{...s.v2.bankAccounts[0],description:'Nonfinancial update'}}));
 assert.throws(()=>reduceBanking(gl(s,'1030'),{type:'v2/bankAccount',record:{...s.v2.bankAccounts[0],id:undefined,glAccountId:'1030',accountNumber:'99999999'}}),/active bank/);assert.throws(()=>reduceBanking(s,{type:'v2/deleteConfiguration',key:'banks',id:b.id}),/Deactivate/);
});
test('Supplier payment flows once into the linked bank GL and bank movements; reconciliation completion generates no journal',()=>{
 let s=scenario(),payment=s.v2.payments.at(-1),bank=s.v2.bankAccounts[0];assert.equal(payment.bankAccountId,bank.id);assert.equal(payment.cashAccountId,'1010');assert.equal(s.entries.find(e=>e.id===payment.entryId).lines.find(l=>l.accountId==='1010').credit,500000);assert.equal(bankMovements(s).filter(m=>m.journalId===payment.entryId).length,1);assert.equal(bankBookBalance(s,bank.id,'2026-10-20'),500000);
 const r=reconcile(s),summary=reconciliationSummary(s,r);assert.equal(summary.difference,0);assert.equal(summary.statementDifference,0);assert.equal(summary.matched,2);
 const entries=structuredClone(s.entries),payments=structuredClone(s.v2.payments);s=reduceBanking(s,{type:'v2/reconciliation',record:r,complete:true,actor:'QA Banking Operator'});const completed=s.v2.reconciliations[0];assert.equal(completed.status,'Completed');assert.equal(completed.completedBy,'QA Banking Operator');assert.equal(completed.movementSnapshots.length,2);assert.deepEqual(s.entries,entries);assert.deepEqual(s.v2.payments,payments);assert.throws(()=>reduceBanking(s,{type:'v2/reconciliation',record:{...completed,endingBalance:0}}),/read-only/);
 assert.throws(()=>reduceBanking(s,{type:'v2/reconciliation',record:r}),/Overlapping|overlapping/);
 assert.throws(()=>reduceBanking(s,{type:'reverseJournal',id:completed.movementSnapshots.find(m=>m.reference==='OPEN-BDO').journalId}),/reconciled/);
 assert.throws(()=>reduceBanking(s,{type:'v2/bankAccount',record:{...bank,accountNumber:'77777777'}}),/protected/);
});
test('Unrecorded charges cannot be forced to zero; posting and explicitly matching the charge enables completion',()=>{
 let s=scenario(),r=reconcile(s);r.statement.push({id:'fee',date:'2026-10-11',description:'Bank charge',reference:'FEE',moneyIn:0,moneyOut:5000});r.endingBalance-=5000;
 const summary=reconciliationSummary(s,r);assert.equal(summary.difference,0);assert.equal(summary.unmatchedCount,1);assert.throws(()=>reduceBanking(s,{type:'v2/reconciliation',record:r,complete:true}),/Resolve unmatched/);
 s=reduceBanking(s,{type:'v2/bankJournal',entry:{date:'2026-10-11',memo:'Bank service charge',reference:'FEE',status:'Posted',source:'manual',lines:[{accountId:'5200',debit:5000,credit:0},{accountId:'1010',debit:0,credit:5000}]}});const fee=bankMovements(s).find(m=>m.reference==='FEE');assert.equal(suggestedMatches(r.statement.at(-1),[fee])[0].id,fee.id);r.matches.push({statementId:'fee',movementId:fee.id});assert.doesNotThrow(()=>reduceBanking(s,{type:'v2/reconciliation',record:r,complete:true}));
});
test('Outstanding checks reduce adjusted bank balance and carry forward without deletion or double reconciliation',()=>{
 let s=journal(scenario(),200000,'2026-10-15',true),r=reconcile(s),summary=reconciliationSummary(s,r);assert.equal(summary.bookBalance,300000);assert.equal(summary.outstandingWithdrawals,200000);assert.equal(summary.adjustedBank,300000);assert.equal(summary.difference,0);
 s=reduceBanking(s,{type:'v2/reconciliation',record:r,complete:true});const outstanding=s.v2.reconciliations[0].outstandingSnapshots[0];assert.equal(outstanding.reference,'CHK-OUT');
 const next={bankAccountId:r.bankAccountId,startDate:'2026-10-21',endDate:'2026-10-26',endingBalance:300000,statement:[{id:'cleared-check',date:'2026-10-25',description:'Cleared check',reference:'CHK-OUT',moneyIn:0,moneyOut:200000}],matches:[{statementId:'cleared-check',movementId:outstanding.id}],reviewed:true};assert.equal(reconciliationSummary(s,next).previousBalance,500000);assert.doesNotThrow(()=>reduceBanking(s,{type:'v2/reconciliation',record:next,complete:true}));
 const reused={...next,matches:[{statementId:'cleared-check',movementId:r.matches[0].movementId}]};assert.throws(()=>reduceBanking(s,{type:'v2/reconciliation',record:reused}),/Previously reconciled/);
});
test('Matching rejects duplicate, cross-bank, wrong-direction and incomplete reconciliations',()=>{
 const s=scenario(),r=reconcile(s);
 assert.throws(()=>reduceBanking(s,{type:'v2/reconciliation',record:{...r,reviewed:false},complete:true}),/review/);
 assert.throws(()=>reduceBanking(s,{type:'v2/reconciliation',record:{...r,endingBalance:r.endingBalance+1},complete:true}),/roll-forward/);
 assert.throws(()=>reduceBanking(s,{type:'v2/reconciliation',record:{...r,matches:[...r.matches,r.matches[0]]}}),/one-to-one/);
 const wrong={...r,matches:[{statementId:'payment',movementId:r.matches.find(m=>m.statementId==='deposit').movementId}]};assert.throws(()=>reduceBanking(s,{type:'v2/reconciliation',record:wrong}),/equal signed/);
 assert.throws(()=>reduceBanking(s,{type:'v2/bankMapping',movementId:r.matches[0].movementId,bankAccountId:'missing',reason:'unsupported'}),/Map only/);
});
test('Bank transfer and cash payments keep their own GL rules; missing company selection is rejected',()=>{
 let s=scenario(),p={requestId:'second',partyId:s.v2.customers[0].id,date:'2026-10-12',method:'Bank transfer',amount:10000,allocations:[]};assert.throws(()=>reduceBanking(s,{type:'v2/payment',kind:'invoice',payment:p}),/Select a company/);
 s=reduceBanking(s,{type:'v2/payment',kind:'invoice',payment:{...p,bankAccountId:s.v2.bankAccounts[0].id}});const receipt=s.v2.payments.at(-1);assert.equal(bankMovements(s).find(m=>m.journalId===receipt.entryId).moneyIn,10000);
 s=reduceBanking(s,{type:'v2/payment',kind:'invoice',payment:{...p,requestId:'cash',method:'Cash',cashAccountId:'1000'}});assert.equal(bankMovements(s).find(m=>m.journalId===s.v2.payments.at(-1).entryId).mappingStatus,'Nonbank cash');
 assert.throws(()=>reduceBanking(s,{type:'v2/payment',kind:'invoice',payment:{...p,requestId:'invalid-cash',method:'Cash',cashAccountId:'1010'}}),/nonbank/);
});
test('Banking permissions remain explicit, and completed reconciliation needs Approve / Finalize',()=>{
 const s=scenario(),user=structuredClone(createDirectory().users[1]),action={type:'v2/bankAccount',record:{}};assert.throws(()=>assertActionAllowed(user,action,s),/permission/);user.permissions.Banking.create=true;assert.doesNotThrow(()=>assertActionAllowed(user,action,s));user.permissions.Banking.approve=false;assert.throws(()=>assertActionAllowed(user,{type:'v2/reconciliation',record:reconcile(s),complete:true},s),/Approve/);user.permissions.Banking.approve=true;assert.doesNotThrow(()=>assertActionAllowed(user,{type:'v2/reconciliation',record:reconcile(s),complete:true},s));
});


test('Historical activity in an existing bank GL stays unresolved until an evidence-based mapping review',()=>{
 let s=gl(fresh(),'1010');s=journal(s);const original=structuredClone(s.entries),movement=bankMovements(s).find(m=>m.glAccountId==='1010');
 s=reduceBanking(s,{type:'v2/bankAccount',record:{name:'Reviewed historical account',bankId:s.v2.configuration.banks[0].id,accountNumber:'123456789',glAccountId:'1010',currency:'PHP',active:true}});
 assert.equal(bankMovements(s).find(m=>m.id===movement.id).mappingStatus,'Requires review');
 assert.throws(()=>reduceBanking(s,{type:'v2/bankMapping',movementId:movement.id,bankAccountId:s.v2.bankAccounts[0].id,reason:''}),/evidence/);
 s=reduceBanking(s,{type:'v2/bankMapping',movementId:movement.id,bankAccountId:s.v2.bankAccounts[0].id,reason:'Verified original bank deposit reference'});assert.equal(bankMovements(s).find(m=>m.id===movement.id).bankAccountId,s.v2.bankAccounts[0].id);assert.deepEqual(s.entries,original);
});
test('Transfers have one signed movement per bank account, and company deactivation blocks later postings',()=>{
 let s=gl(setup(),'1020','Cash in Bank – BPI');s=reduceBanking(s,{type:'v2/bankAccount',record:{name:'BPI Savings',bankId:s.v2.configuration.banks[1].id,accountNumber:'234567890',glAccountId:'1020',currency:'PHP',active:true}});
 const action={type:'v2/bankJournal',entry:{date:'2026-10-15',memo:'Interbank transfer',reference:'TRANSFER',status:'Posted',source:'manual',lines:[{accountId:'1010',debit:0,credit:10000},{accountId:'1020',debit:10000,credit:0}]}};const before=s.entries.length;s=reduceBanking(s,action);assert.equal(s.entries.length,before+1);const rows=bankMovements(s).filter(m=>m.reference==='TRANSFER');assert.equal(rows.length,2);assert.equal(rows.reduce((n,m)=>n+m.amount,0),0);assert.equal(new Set(rows.map(m=>m.bankAccountId)).size,2);
 s=reduceBanking(s,{type:'v2/bankAccount',record:{...s.v2.bankAccounts[0],active:false}});assert.throws(()=>reduceBanking(s,action),/active/);
});
test('Payment draft posting resolves the current bank GL and preserves no-post drafts',()=>{
 let s=setup(),bank=s.v2.bankAccounts[0],count=s.entries.length;
 s=reduceBanking(s,{type:'v2/paymentDraft',kind:'invoice',payment:{requestId:'bank-draft',partyId:s.v2.customers[0].id,date:'2026-10-15',method:'Bank transfer',bankAccountId:bank.id,amount:10000,allocations:[]}});assert.equal(s.entries.length,count);
 s=gl(s,'1020');s=reduceBanking(s,{type:'v2/bankAccount',record:{...s.v2.bankAccounts[0],glAccountId:'1020'}});s=reduceBanking(s,{type:'v2/postPaymentDraft',id:s.v2.paymentDrafts.at(-1).id});assert.equal(s.v2.payments.at(-1).cashAccountId,'1020');assert.equal(s.entries.length,count+1);assert.equal(accountBalance(s,'1010'),0);assert.equal(accountBalance(s,'1020'),10000);
});


test('An unselected reconciliation account never includes unassigned historical cash movements',()=>{
 const s=scenario(),summary=reconciliationSummary(s,{bankAccountId:'',startDate:'2026-10-01',endDate:'2026-10-26',endingBalance:0,statement:[],matches:[]});assert.equal(summary.eligible.length,0);assert.equal(summary.outstanding.length,0);assert.equal(summary.difference,0);
});


test('A zero bank GL line cannot disguise a nonbank-only journal as a direct bank transaction',()=>{
 const s=setup();assert.throws(()=>reduceBanking(s,{type:'v2/bankJournal',entry:{date:'2026-10-26',memo:'Invalid bank movement',status:'Posted',source:'manual',lines:[{accountId:'1010',debit:0,credit:0},{accountId:'1000',debit:10000,credit:0},{accountId:'4000',debit:0,credit:10000}]}}),/must include an active company bank GL/);
});


const typed=(s,type='Direct Deposit',extra={})=>({requestId:'typed-'+type,type,bankAccountId:s.v2.bankAccounts[0].id,toBankAccountId:'',offsetAccountId:type==='Bank Interest'?'4000':type==='Bank Charge'||type==='Direct Withdrawal'?'5200':'3000',date:'2026-10-26',amount:25000,reference:'TYPED',description:'Typed bank movement',status:'Draft',...extra});
const saveTyped=(s,r)=>reduceBanking(s,{type:'v2/bankTransaction',record:r});
test('Typed bank drafts retain values without entries, then post exactly once through the journal engine',()=>{
 let s=setup(),entries=structuredClone(s.entries),payments=structuredClone(s.v2.payments),r=typed(s);s=saveTyped(s,r);assert.deepEqual(s.entries,entries);assert.equal(bankBookBalance(s,r.bankAccountId),0);r={...s.v2.bankTransactions[0],amount:43210,reference:'EDITED'};s=saveTyped(s,r);assert.equal(s.v2.bankTransactions[0].amount,43210);assert.deepEqual(s.entries,entries);
 s=saveTyped(s,{...r,status:'Posted'});const posted=s.v2.bankTransactions[0],entry=s.entries.find(e=>e.id===posted.entryId);assert.equal(s.entries.length,entries.length+1);assert.deepEqual(entry.lines,bankTransactionLines(s,posted));assert.equal(bankBookBalance(s,r.bankAccountId),43210);assert.deepEqual(s.v2.payments,payments);assert.equal(bankMovements(s).find(m=>m.journalId===entry.id).sourceLabel,'Manual Bank Transaction');
 const snapshot=structuredClone(s);s=saveTyped(s,{...r,status:'Posted'});assert.deepEqual(s,snapshot);assert.throws(()=>saveTyped(s,{...posted,amount:1}),/read-only/);assert.throws(()=>reduceBanking(s,{type:'journal',entry:{...entry,status:'Draft'}}),/Use Bank Transactions/);
});
test('All direct bank types use the expected debit and credit accounts, without changing old records',()=>{
 for(const type of ['Direct Deposit','Direct Withdrawal','Bank Charge','Bank Interest']){let s=setup();const before=structuredClone(s.entries),r=typed(s,type,{status:'Posted'});s=saveTyped(s,r);const entry=s.entries.at(-1),incoming=['Direct Deposit','Bank Interest'].includes(type);assert.equal(entry.lines.find(l=>l.accountId==='1010')[incoming?'debit':'credit'],25000);assert.equal(entry.lines.find(l=>l.accountId===r.offsetAccountId)[incoming?'credit':'debit'],25000);assert.equal(entry.lines.reduce((n,l)=>n+l.debit-l.credit,0),0);assert.deepEqual(s.entries.slice(0,-1),before);}
});
test('Typed transfer produces one journal and two mapped movements with stable individual reconciliation IDs',()=>{
 let s=gl(setup(),'1020','Cash in Bank – BPI');s=reduceBanking(s,{type:'v2/bankAccount',record:{name:'BPI Savings',bankId:s.v2.configuration.banks[1].id,accountNumber:'234567890',glAccountId:'1020',currency:'PHP',active:true}});const count=s.entries.length,r=typed(s,'Bank Transfer',{toBankAccountId:s.v2.bankAccounts[1].id,offsetAccountId:'',status:'Posted'});s=saveTyped(s,r);assert.equal(s.entries.length,count+1);const entry=s.entries.at(-1),movements=bankMovements(s).filter(m=>m.journalId===entry.id);assert.equal(movements.length,2);assert.equal(new Set(movements.map(m=>m.id)).size,2);assert.ok(movements.every(m=>m.bankAccountId&&m.sourceLabel==='Bank Transfer'));assert.equal(bankBookBalance(s,r.bankAccountId),-25000);assert.equal(bankBookBalance(s,r.toBankAccountId),25000);assert.equal(reconciliationSummary(s,{bankAccountId:r.toBankAccountId,endDate:r.date,startDate:'2026-10-01',matches:[],statement:[]}).eligible.length,1);
 assert.throws(()=>saveTyped(s,{...r,requestId:'same-bank',toBankAccountId:r.bankAccountId}),/different/);const foreign=structuredClone(s);foreign.v2.bankAccounts[1].currency='USD';assert.throws(()=>saveTyped(foreign,{...r,requestId:'foreign'}),/same currency/);
});
test('Typed bank validation rejects controlled balances, wrong account types, invalid dates and inactive accounts',()=>{
 const s=setup(),r=typed(s);for(const offset of ['1100','2000','booksdotnet-customer-advances','booksdotnet-supplier-prepayments','1010'])assert.throws(()=>saveTyped(s,{...r,offsetAccountId:offset}),/offset account/);
 assert.throws(()=>saveTyped(s,typed(s,'Bank Charge',{offsetAccountId:'4000'})),/Expense/);assert.throws(()=>saveTyped(s,typed(s,'Bank Interest',{offsetAccountId:'5200'})),/Income/);assert.equal(defaultOffset(s,'Bank Charge'),'');assert.equal(defaultOffset(s,'Bank Interest'),'');
 assert.throws(()=>saveTyped(s,{...r,date:'2026-11-10'}),/valid date/);assert.throws(()=>saveTyped(s,{...r,amount:1.5}),/positive amount/);const inactive=structuredClone(s);inactive.v2.bankAccounts[0].active=false;assert.throws(()=>saveTyped(inactive,r),/active company bank/);
 const custom=structuredClone(s);custom.v2.customers[0].controlAccountId='3000';assert.throws(()=>saveTyped(custom,r),/offset account/);
});
test('Bank transaction create, edit and post keep the existing explicit Banking permissions',()=>{
 const s=setup(),user=createDirectory().users.find(u=>u.role==='Accountant'),r=typed(s);assert.throws(()=>assertActionAllowed(user,{type:'v2/bankTransaction',record:r},s),/Banking/);const operator={...user,permissions:{...user.permissions,Banking:{view:true,create:true,edit:true}}};assert.doesNotThrow(()=>assertActionAllowed(operator,{type:'v2/bankTransaction',record:r},s));assert.throws(()=>assertActionAllowed(operator,{type:'v2/bankTransaction',record:{...r,status:'Posted'}},s),/Post/);assert.doesNotThrow(()=>assertActionAllowed({...operator,permissions:{...operator.permissions,Banking:{view:true,create:true,edit:true,post:true}}},{type:'v2/bankTransaction',record:{...r,status:'Posted'}},s));
});
test('Simple legacy bank drafts convert in place, preserving their journal ID and posting once',()=>{
 let s=setup();s=reduceBanking(s,{type:'v2/bankJournal',entry:{date:'2026-10-26',memo:'Existing draft',reference:'LEGACY',status:'Draft',lines:[{accountId:'1010',debit:10000,credit:0},{accountId:'3000',debit:0,credit:10000}]}});const draft=s.entries.at(-1),count=s.entries.length,r={...legacyBankDraft(s,draft),requestId:'convert'};s=saveTyped(s,r);assert.equal(s.entries.length,count);assert.equal(s.v2.bankTransactions[0].entryId,draft.id);r.id=s.v2.bankTransactions[0].id;s=saveTyped(s,{...r,amount:20000});assert.equal(s.entries.length,count);s=saveTyped(s,{...r,status:'Posted'});assert.equal(s.entries.length,count);assert.equal(s.entries.at(-1).id,draft.id);assert.equal(s.entries.at(-1).status,'Posted');assert.equal(bankBookBalance(s,r.bankAccountId),10000);
});
