import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace, reduceWorkspace, validateEntry, reportData, accountBalance, assertWorkspace } from './accounting.js';
import { upgradeBanking, reduceBanking } from './versions/v2/banking.js';
import { financialStatements } from './versions/v2/statements.js';
import { offsetAccounts } from './versions/v2/bank-transaction.js';
import { SAMPLE_ACCOUNT_GROUPS, accountDependencies, isPostableAccount, eligibleParentAccounts, rollupBalance, accountTreeGroups, accountOptionLabel } from './account-hierarchy.js';
const range={start:'2026-10-01',end:'2026-10-26'};
const add=(state,code,parentId=null,type='Expense')=>reduceBanking(state,{type:'account',account:{code,name:`Test ${code}`,type,group:type==='Expense'?'Operations':'Current assets',parentId}});
const initial=()=>upgradeBanking(createWorkspace());
const account=(state,id)=>state.accounts.find(a=>a.id===id);
function tree(){let s=add(initial(),'6000');s=add(s,'6100','6000');s=add(s,'6200','6000');return add(s,'6110','6100');}
const entry=lines=>({date:range.end,memo:'Hierarchy QA',status:'Posted',lines});
test('Standalone and nested accounts persist relationships without changing saved journals or totals',()=>{
 const before=initial(),journals=JSON.stringify(before.entries),s=tree();assert.equal(account(s,'6000').parentId,null);assert.equal(account(s,'6110').parentId,'6100');assert.equal(JSON.stringify(s.entries),journals);assert.deepEqual(reportData(s,range).trial.filter(a=>!a.id.startsWith('6')),reportData(before,range).trial);assertWorkspace(s);
 assert.equal(isPostableAccount(s.accounts,account(s,'6000')),false);assert.equal(isPostableAccount(s.accounts,account(s,'6100')),false);assert.equal(isPostableAccount(s.accounts,account(s,'6110')),true);
});
test('Unused subaccounts may move to another compatible parent or become standalone',()=>{
 let s=add(tree(),'6300');s=reduceBanking(s,{type:'account',account:{...account(s,'6200'),parentId:'6300'}});assert.equal(account(s,'6200').parentId,'6300');s=reduceBanking(s,{type:'account',account:{...account(s,'6200'),parentId:null}});assert.equal(account(s,'6200').parentId,null);assert.equal(isPostableAccount(s.accounts,account(s,'6300')),true);
});
test('Own-parent, descendant-parent, incompatible-type and inactive-parent assignments are rejected atomically',()=>{
 const s=tree(),before=JSON.stringify(s);
 for(const [id,parentId]of [['6000','6000'],['6000','6110'],['6110','1000']])assert.throws(()=>reduceBanking(s,{type:'account',account:{...account(s,id),parentId}}),/circular|same account type/);
 const archived=reduceBanking(add(s,'6300'),{type:'archiveAccount',id:'6300'});assert.throws(()=>add(archived,'6400','6300'),/active parent/);assert.equal(JSON.stringify(s),before);
 const eligible=eligibleParentAccounts(s,account(s,'6000'));assert.ok(!eligible.some(a=>['6000','6100','6110','1000'].includes(a.id)));
});
test('Accounts with posted history, drafts, zero-net history or opening balances cannot become grouping parents',()=>{
 const s=initial();for(const id of ['1000','1200','3000','5100'])assert.throws(()=>add(s,'6400',id,account(s,id).type),/transactions|reserved|mapped/);
 let draft=add(s,'6300');draft=reduceBanking(draft,{type:'journal',entry:{...entry([{accountId:'6300',debit:100,credit:0},{accountId:'1000',debit:0,credit:100}]),status:'Draft'}});assert.throws(()=>add(draft,'6400','6300'),/existing transactions/);
 const opening=add(s,'6300');account(opening,'6300').openingBalance=100;assert.throws(()=>add(opening,'6400','6300'),/opening balances/);
});
test('Journal and banking selectors and validators reject grouping accounts for drafts and postings',()=>{
 const s=tree();for(const status of ['Draft','Posted'])assert.throws(()=>reduceBanking(s,{type:'journal',entry:{...entry([{accountId:'6000',debit:100,credit:0},{accountId:'1000',debit:0,credit:100}]),status}}),/Grouping accounts/);
 assert.ok(!offsetAccounts(s,'Bank Charge').some(a=>a.id==='6000'||a.id==='6100'));assert.ok(offsetAccounts(s,'Bank Charge').some(a=>a.id==='6110'));
 assert.throws(()=>validateEntry({...entry([{accountId:'6000',debit:100,credit:0},{accountId:'1000',debit:0,credit:100}]),source:'opening'},s.accounts,true),/Grouping accounts/);
});
test('Leaf postings aggregate once with date cutoffs and do not duplicate Trial Balance or statement totals',()=>{
 const before=tree(),original=JSON.stringify(before.entries);let s=reduceBanking(before,{type:'journal',entry:entry([{accountId:'6110',debit:5000000,credit:0},{accountId:'6200',debit:3000000,credit:0},{accountId:'1000',debit:0,credit:8000000}])});
 const report=reportData(s,range),prior=reportData(before,range);assert.equal(rollupBalance(report.accounts,'6000'),8000000);assert.equal(rollupBalance(report.accounts,'6100'),5000000);assert.equal(accountBalance(s,'6000'),0);assert.equal(accountBalance(s,'6110'),5000000);assert.equal(report.expenses-prior.expenses,8000000);assert.equal(report.trial.reduce((n,a)=>n+a.debit-a.credit,0),0);
 const statements=financialStatements(s,range);assert.equal(statements.balanceDifference,0);assert.equal(statements.cash.difference,0);assert.equal(statements.report.profit,prior.profit-8000000);
 assert.equal(rollupBalance(reportData(s,{start:'2026-10-01',end:'2026-10-25'}).accounts,'6000'),0);assert.equal(JSON.stringify(s.entries.slice(0,-1)),original);
 assert.throws(()=>reduceBanking(s,{type:'account',account:{...account(s,'6110'),parentId:null}}),/parent relationship is locked/);
 assert.throws(()=>reduceBanking(s,{type:'account',account:{...account(s,'6100'),parentId:null}}),/parent relationship is locked/);
});
test('Mapped accounts and grouping opening balances are protected without changing mappings',()=>{
 let s=add(initial(),'6300','', 'Asset');s.v2.bankAccounts.push({id:'TEST-BANK',glAccountId:'6300',active:true});assert.throws(()=>add(s,'6400','6300','Asset'),/reserved or mapped/);
 const grouped=tree();assert.throws(()=>reduceBanking(grouped,{type:'account',account:{...account(grouped,'6000'),openingBalance:100}}),/Opening balances/);
 assert.throws(()=>reduceBanking(grouped,{type:'archiveAccount',id:'6000'}),/active subaccounts/);
});
test('Tree search preserves ancestors, nested depth and sibling sorting without duplicate rows',()=>{
 const s=tree(),rows=reportData(s,range).accounts;
 let branches=accountTreeGroups(rows,{query:'Test 6110'});assert.equal(branches.length,1);assert.deepEqual(branches[0].visible.map(a=>a.id),['6000','6100','6110']);assert.deepEqual(branches[0].visible.map(a=>a.__depth),[0,1,2]);assert.equal(branches[0].visible[0].__context,true);
 branches=accountTreeGroups(rows,{query:'Test',expanded:new Set(['6000','6100']),sort:{key:'code',direction:-1}});assert.deepEqual(branches[0].visible.map(a=>a.id),['6000','6200','6100','6110']);assert.equal(new Set(branches.flatMap(b=>b.visible.map(a=>a.id))).size,4);
 branches=accountTreeGroups(rows,{query:'Test',collapsed:new Set(['6000'])});assert.deepEqual(branches[0].visible.map(a=>a.id),['6000']);assert.match(accountOptionLabel(s.accounts,account(s,'6110')),/6000.*6100.*6110/);
});

test('Zero-net transaction history still prevents conversion and mapped bank GLs cannot be grouping accounts',()=>{
 let s=add(initial(),'6300');s=reduceBanking(s,{type:'journal',entry:entry([{accountId:'6300',debit:100,credit:0},{accountId:'1000',debit:0,credit:100}])});const id=s.entries.at(-1).id;s=reduceBanking(s,{type:'reverseJournal',id});assert.equal(accountBalance(s,'6300'),0);assert.throws(()=>add(s,'6400','6300'),/existing transactions/);
 let bank=reduceBanking(initial(),{type:'account',account:{code:'1010',name:'Bank group',type:'Asset',group:'Cash & bank'}});bank=reduceBanking(bank,{type:'account',account:{code:'1020',name:'Bank leaf',type:'Asset',group:'Cash & bank',parentId:'1010'}});
 assert.throws(()=>reduceBanking(bank,{type:'v2/bankAccount',record:{name:'Test Bank',bankId:bank.v2.configuration.banks[0].id,accountNumber:'1234567890',glAccountId:'1010',currency:'PHP',active:true}}),/leaf Cash in Bank/);
});


test('Approved 1001 sample hierarchy is idempotent and preserves 1000 history, mappings and balances',()=>{
 const original=initial(),before=JSON.stringify(original),s=reduceBanking(original,{type:'cashHierarchySample'});
 assert.deepEqual(s.entries,original.entries);assert.deepEqual(account(s,'1000'),account(original,'1000'));assert.deepEqual(s.v2.bankAccounts,original.v2.bankAccounts);
 assert.deepEqual(s.accounts.filter(a=>a.parentId==='1001').map(a=>a.code),['1010','1020','1030']);assert.equal(isPostableAccount(s.accounts,account(s,'1001')),false);
 assert.deepEqual(reduceBanking(s,{type:'cashHierarchySample'}),s);assert.equal(JSON.stringify(original),before);assertWorkspace(s);
 const conflict=add(original,'1020',null,'Asset');assert.throws(()=>reduceBanking(conflict,{type:'cashHierarchySample'}),/conflicts/);assert.ok(!account(conflict,'1001'));
});
test('Opening balances post exactly one balanced journal with correct normal balances and full report reconciliation',()=>{
 for(const [type,side,code] of [['Asset','Debit','6500'],['Liability','Credit','6501'],['Equity','Credit','6502'],['Revenue','Credit','6503'],['Expense','Debit','6504'],['Asset','Credit','6505']]){
   const original=initial(),s=reduceBanking(original,{type:'account',account:{code,name:'Opening QA',type,group:type==='Expense'?'Operations':type==='Asset'?'Current assets':type},opening:{amount:123456,side,date:'2026-10-01'}});
   const posted=s.entries.at(-1);assert.equal(posted.source,'account-opening');assert.equal(posted.status,'Posted');assert.equal(posted.lines.reduce((n,l)=>n+l.debit-l.credit,0),0);
   assert.equal(posted.lines[0][side.toLowerCase()],123456);assert.equal(accountBalance(s,code,'2026-09-30'),0);assert.equal(accountBalance(s,code,'2026-10-01'),type==='Asset'&&side==='Credit'?-123456:123456);
   const report=reportData(s,range);assert.equal(report.trial.reduce((n,a)=>n+a.debit-a.credit,0),0);assert.equal(s.entries.length,original.entries.length+1);assertWorkspace(s);
   const edited=reduceBanking(s,{type:'account',account:{...account(s,code),description:'Description update'},opening:{amount:0}});assert.deepEqual(edited.entries,s.entries);
   assert.throws(()=>reduceBanking(s,{type:'account',account:account(s,code),opening:{amount:123456,side,date:'2026-10-01'}}),/Historical opening/);
 }
});
test('Invalid or unsafe opening commands fail atomically; zero needs no date and offset code conflicts never overwrite accounts',()=>{
 const original=initial(),before=JSON.stringify(original),a={code:'6500',name:'Opening QA',type:'Expense',group:'Operations'};
 for(const opening of [{amount:-1},{amount:1.5},{amount:100,side:'Debit',date:''},{amount:100,side:'Other',date:'2026-10-01'},{amount:100,side:'Debit',date:'2026-12-01'}])assert.throws(()=>reduceBanking(original,{type:'account',account:a,opening}));
 assert.equal(JSON.stringify(original),before);const zero=reduceBanking(original,{type:'account',account:a,opening:{amount:0}});assert.equal(zero.entries.length,original.entries.length);
 const hierarchy=tree();assert.throws(()=>reduceBanking(hierarchy,{type:'account',account:account(hierarchy,'6000'),opening:{amount:100,side:'Debit',date:'2026-10-01'}}),/Grouping/);
 const conflict=add(original,'3900',null,'Equity'),s=reduceBanking(conflict,{type:'account',account:a,opening:{amount:100,side:'Debit',date:'2026-10-01'}});assert.deepEqual(account(s,'3900'),account(conflict,'3900'));assert.equal(s.accounts.find(a=>a.id==='booksdotnet-opening-balance-equity').code,'3901');
});


test('Complete hierarchy reconciliation creates every actual child, removes only unused 1001, and preserves all financial records',()=>{
 const old=reduceBanking(initial(),{type:'cashHierarchySample'}),before=JSON.stringify(old),next=reduceBanking(old,{type:'reconcileSampleHierarchy'});
 assert.equal(next.accounts.some(a=>a.code==='1001'),false);assert.equal(next.accounts.length,initial().accounts.length+25);
 for(const [code,,, ,children]of SAMPLE_ACCOUNT_GROUPS){const parent=next.accounts.find(a=>a.code===code);assert.ok(parent);for(const [childCode]of children)assert.equal(next.accounts.find(a=>a.code===childCode).parentId,parent.id);}
 for(const key of ['entries','invoices','bills','v2'])assert.deepEqual(next[key],old[key],key);
 assert.deepEqual(reportData(next,range).trial.filter(a=>old.accounts.some(o=>o.id===a.id)).map(a=>[a.id,a.debit,a.credit]),reportData(old,range).trial.filter(a=>a.id!=='1001').map(a=>[a.id,a.debit,a.credit]));
 assert.equal(account(next,'1000').legacyPostingParent,true);assert.equal(isPostableAccount(next.accounts,account(next,'1000')),true);
 assert.equal(account(next,'5000').name,account(old,'5000').name);assert.ok(next.hierarchyReconciliation.issues.some(s=>s.includes('5000')));
 assert.deepEqual(reduceBanking(next,{type:'reconcileSampleHierarchy'}),next);assert.deepEqual(reduceBanking(next,{type:'cashHierarchySample'}),next);assert.equal(JSON.stringify(old),before);assertWorkspace(next);
});
test('Duplicate dependency scan blocks removal for journals, opening fields, mappings, documents, drafts and unexpected children',()=>{
 for(const mutate of [s=>s.entries.push({id:'QA',date:range.end,memo:'draft',status:'Draft',lines:[{accountId:'1001',debit:100,credit:0},{accountId:'1000',debit:0,credit:100}]}),s=>account(s,'1001').openingBalance=100,s=>s.v2.bankMappings.qa={accountId:'1001'},s=>s.invoices[0].controlAccountId='1001',s=>s.accounts.push({id:'9900',code:'9900',name:'Unexpected child',type:'Asset',group:'Cash & bank',active:true,parentId:'1001'})]){
  const old=reduceBanking(initial(),{type:'cashHierarchySample'});mutate(old);const next=reduceBanking(old,{type:'reconcileSampleHierarchy'});assert.ok(account(next,'1001'));assert.ok(next.hierarchyReconciliation.issues.some(s=>s.startsWith('1001 retained')));assert.equal(account(next,'1010').parentId,'1001');assert.deepEqual(next.entries,old.entries);
 }
});
test('Code conflicts never rename or reparent a different child; ordinary account edits cannot grant legacy posting rights',()=>{
 const original=add(initial(),'1110',null,'Asset'),next=reduceBanking(original,{type:'reconcileSampleHierarchy'});assert.deepEqual(account(next,'1110'),account(original,'1110'));assert.ok(next.hierarchyReconciliation.issues.some(s=>s.startsWith('1110')));
 assert.throws(()=>reduceBanking(original,{type:'account',account:{...account(original,'1110'),legacyPostingParent:true}}),/controlled hierarchy/);
});
test('All major groups roll up actual test postings once while unused siblings remain zero and Trial Balance agrees',()=>{
 let s=reduceBanking(initial(),{type:'reconcileSampleHierarchy'});
 for(const [code,,, ,children]of SAMPLE_ACCOUNT_GROUPS){
  const parent=s.accounts.find(a=>a.code===code),child=s.accounts.find(a=>a.code===children[0][0]),before=reportData(s,range),normal=['Asset','Expense'].includes(child.type);
  s=reduceBanking(s,{type:'journal',entry:{date:range.end,memo:'In-memory hierarchy test only',status:'Posted',lines:[{accountId:child.id,debit:normal?100:0,credit:normal?0:100},{accountId:'5100',debit:normal?0:100,credit:normal?100:0}]}});
  const report=reportData(s,range);assert.equal(accountBalance(s,child.id,range.end),100);assert.equal(accountBalance(s,children[1][0],range.end),0);assert.equal(rollupBalance(report.accounts,parent.id)-rollupBalance(before.accounts,parent.id),100);assert.equal(report.trial.reduce((n,a)=>n+a.debit-a.credit,0),0);
 }
 assertWorkspace(s);
});

test('Approved heading changes preserve IDs, classifications and all journal lines and work on an already migrated workspace',()=>{
 const before=reduceBanking(initial(),{type:'reconcileSampleHierarchy'}),after=reduceBanking(before,{type:'reconcileSampleHierarchy',renameHeadings:true});
 for(const [code,name]of [['3000','Equity'],['4000','Revenue'],['5000','Operating Expenses']]){assert.equal(account(after,code).name,name);assert.equal(account(after,code).group,account(before,code).group);assert.equal(account(after,code).id,account(before,code).id);}
 assert.deepEqual(after.entries,before.entries);assert.deepEqual(after.v2,before.v2);assert.equal(after.hierarchyReconciliation.issues.length,0);assert.equal(after.hierarchyReconciliation.renamed.filter(r=>['3000','4000','5000'].includes(r.id)).length,3);assert.deepEqual(reduceBanking(after,{type:'reconcileSampleHierarchy',renameHeadings:true}),after);
});

test('Conflicting parent codes and unrecognized 1001 records are preserved without sample reassignment',()=>{
 const old=initial();account(old,'1300').name='Different existing asset';old.accounts.push({id:'1001',code:'1001',name:'Unrelated account',type:'Asset',group:'Cash & bank',active:true});
 const next=reduceBanking(old,{type:'reconcileSampleHierarchy',renameHeadings:true});assert.equal(account(next,'1300').name,'Different existing asset');assert.ok(!account(next,'1310'));assert.ok(account(next,'1001'));assert.ok(next.hierarchyReconciliation.issues.some(s=>s.includes('different existing account')));assert.ok(next.hierarchyReconciliation.issues.some(s=>s.startsWith('1001 retained')));
});

test('Fresh approved migration produces all requested heading names and meaningful child classifications',()=>{
 const s=reduceBanking(initial(),{type:'reconcileSampleHierarchy',renameHeadings:true});
 for(const [code,name]of SAMPLE_ACCOUNT_GROUPS)assert.equal(s.accounts.find(a=>a.code===code).name,name);
 assert.equal(s.hierarchyReconciliation.issues.length,0);assert.equal(account(s,'2210').group,'Current liabilities');assert.equal(account(s,'5020').group,'Utilities');assert.equal(account(s,'5030').group,'Payroll');
});

test('Optional subsidiary metadata and multiline descriptions round-trip without financial or hierarchy side effects',()=>{
 const initialState=initial(),before=JSON.stringify(initialState),description='First line\nSecond line\nThird line';
 let s=reduceBanking(initialState,{type:'account',account:{code:'6500',name:'Metadata test',type:'Expense',group:'Operations',parentId:null,subsidiaryType:'Supplier',description}});
 assert.equal(account(s,'6500').parentId,null);assert.equal(account(s,'6500').subsidiaryType,'Supplier');assert.equal(account(s,'6500').description,description);assert.deepEqual(s.entries,initialState.entries);
 s=reduceBanking(s,{type:'account',account:{...account(s,'6500'),subsidiaryType:'None',description:'Changed\nPreserved line break'}});const loaded=JSON.parse(JSON.stringify(s));assert.equal(account(loaded,'6500').subsidiaryType,'None');assert.equal(account(loaded,'6500').description,'Changed\nPreserved line break');assert.deepEqual(loaded.entries,initialState.entries);assert.equal(JSON.stringify(initialState),before);
 assert.throws(()=>reduceBanking(s,{type:'account',account:{...account(s,'6500'),subsidiaryType:'Unsupported'}}),/Subsidiary Type/);
});
