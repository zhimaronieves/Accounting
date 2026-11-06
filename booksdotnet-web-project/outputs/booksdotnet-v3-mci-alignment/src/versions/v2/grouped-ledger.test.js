import test from 'node:test';
import assert from 'node:assert/strict';
import { postingLedger, ledgerExportRows } from './grouped-ledger.js';
import { upgradeBanking, reduceBanking } from './banking.js';
import { createWorkspace, reportData, ledgerRows } from '../../accounting.js';
const range={start:'2026-10-01',end:'2026-10-31'};
const line=(accountId,debit=0,credit=0)=>({accountId,debit,credit});
const entry=(id,date,lines,status='Posted')=>({id,date,lines,status,memo:id,reference:'REF-'+id});
const state={accounts:[{id:'1000',code:'1000',name:'Cash group',type:'Asset',active:true},{id:'1010',code:'1010',name:'Cash on hand',type:'Asset',active:true,parentId:'1000'},{id:'1020',code:'1020',name:'Bank group',type:'Asset',active:true,parentId:'1000'},{id:'1021',code:'1021',name:'Bank leaf',type:'Asset',active:true,parentId:'1020'},{id:'2000',code:'2000',name:'Payable',type:'Liability',active:true}],entries:[entry('JE-0001','2026-09-30',[line('1010',10000),line('2000',0,10000)]),entry('JE-0003','2026-10-01',[line('1010',2000),line('2000',0,2000)]),entry('JE-0002','2026-10-01',[line('1021',5000),line('1010',0,5000)]),entry('JE-0004','2026-10-02',[line('1010',999),line('2000',0,999)],'Draft'),entry('JE-0005','2026-11-01',[line('1010',777),line('2000',0,777)])]};

test('Posting ledger is flat, excludes pure groups and never mutates shared account or journal records',()=>{
 const before=JSON.stringify(state),accounts=postingLedger(state,range);
 assert.deepEqual(accounts.map(n=>n.account.id),['1010','1021','2000']);assert.ok(accounts.every(n=>!Object.hasOwn(n,'children')));assert.equal(JSON.stringify(state),before);
});
test('Account drill-through selects direct balances, while a grouping-only link shows flat posting descendants',()=>{
 const parent=postingLedger(state,range,'1000');assert.deepEqual(parent.map(n=>n.account.id),['1010','1021']);
 const leaf=postingLedger(state,range,'1010');assert.equal(leaf.length,1);assert.equal(leaf[0].opening,10000);assert.equal(leaf[0].closing,7000);assert.deepEqual(postingLedger(state,range,'missing'),[]);
});
test('Opening cutoffs, chronological postings and debit/credit-normal balances remain correct',()=>{
 const leaf=postingLedger(state,range,'1010')[0];assert.equal(leaf.opening,10000);assert.deepEqual(leaf.rows.map(r=>r.entryId),['JE-0002','JE-0003']);assert.deepEqual(leaf.rows.map(r=>r.balance),[5000,7000]);assert.equal(leaf.rows.at(-1).balance,leaf.closing);assert.equal(leaf.closing,ledgerRows(state,'1010',range).closing);
 const credit=postingLedger(state,range,'2000')[0];assert.equal(credit.opening,10000);assert.equal(credit.rows.at(-1).balance,12000);assert.equal(credit.closing,12000);
 const quiet=postingLedger(state,{start:'2026-10-20',end:'2026-10-31'},'1010')[0];assert.equal(quiet.rows.length,0);assert.equal(quiet.opening,7000);assert.equal(quiet.closing,7000);
});
test('CSV includes all filtered movements once and keeps explicit account opening and closing metadata',()=>{
 const rows=ledgerExportRows(postingLedger(state,range),range),movements=rows.filter(r=>r[2]==='Transaction');assert.equal(movements.length,4);assert.ok(!rows.some(r=>r[0]==='1000'||r[0]==='1020'));assert.equal(movements.reduce((n,r)=>n+Math.round(r[7]*100)-Math.round(r[8]*100),0),0);
 assert.deepEqual(rows.find(r=>r[0]==='1010'&&r[2]==='Opening Balance').slice(7),['','',100]);assert.equal(rows.find(r=>r[0]==='1010'&&r[2]==='Closing Balance')[9],70);
});
test('Account and transaction pagination cannot change full-period balances or CSV completeness',()=>{
 const many={...state,entries:Array.from({length:60},(_,i)=>entry(`JE-${String(i).padStart(4,'0')}`,'2026-10-01',[line('1010',100),line('2000',0,100)]))},accounts=postingLedger(many,range),node=accounts.find(n=>n.account.id==='1010');
 assert.equal(node.rows.length,60);assert.equal(node.rows[25].balance,2600);assert.equal(node.closing,6000);assert.equal(node.rows.at(-1).balance,node.closing);assert.equal(ledgerExportRows(accounts,range).filter(r=>r[2]==='Transaction').length,120);
});
test('Search matches account names/codes without injecting ancestor rows or unrelated parent postings',()=>{
 const before=JSON.stringify(state);assert.deepEqual(postingLedger(state,range,'','bank leaf').map(n=>n.account.id),['1021']);assert.deepEqual(postingLedger(state,range,'','1010').map(n=>n.account.id),['1010']);assert.equal(postingLedger(state,range,'','no match').length,0);assert.equal(JSON.stringify(state),before);
 const exported=ledgerExportRows(postingLedger(state,range,'','bank leaf'),range);assert.ok(exported.every(r=>r[0]==='1021'));
});
test('Historical parent postings, zero-balance posting leaves and archived history each have one direct account row',()=>{
 const copy=structuredClone(state);copy.accounts[0].legacyPostingParent=true;copy.accounts[1].active=false;copy.accounts.push({id:'1030',code:'1030',name:'Empty savings',type:'Asset',active:true,parentId:'1000'});copy.entries.push(entry('JE-0006','2026-10-05',[line('1000',333),line('2000',0,333)]));
 const accounts=postingLedger(copy,range),parent=accounts.find(n=>n.account.id==='1000');assert.equal(parent.opening,0);assert.equal(parent.closing,333);assert.equal(parent.rows.length,1);assert.equal(accounts.find(n=>n.account.id==='1010').closing,7000);assert.equal(accounts.find(n=>n.account.id==='1030').rows.length,0);assert.equal(accounts.filter(n=>n.account.id==='1000').length,1);
 assert.deepEqual(postingLedger(copy,range,'1000').map(n=>n.account.id),['1000']);const csv=ledgerExportRows(accounts,range);assert.equal(csv.filter(r=>r[2]==='Transaction'&&r[0]==='1000').length,1);assert.equal(csv.filter(r=>r[2]==='Transaction').reduce((n,r)=>n+Math.round(r[7]*100)-Math.round(r[8]*100),0),0);
});

test('Flat migrated ledger includes every posted journal line once and reconciles to the Trial Balance',()=>{
 const saved=reduceBanking(upgradeBanking(createWorkspace()),{type:'reconcileSampleHierarchy',renameHeadings:true}),before=JSON.stringify(saved),period={start:'2026-10-01',end:'2026-10-26'},accounts=postingLedger(saved,period),report=reportData(saved,period),movements=accounts.flatMap(a=>a.rows),expected=saved.entries.filter(e=>e.status==='Posted'&&e.date>=period.start&&e.date<=period.end).flatMap(e=>e.lines);
 assert.equal(movements.length,expected.length);assert.equal(movements.reduce((sum,l)=>sum+l.debit-l.credit,0),0);
 for(const trial of report.trial){const node=accounts.find(n=>n.account.id===trial.id),debitNormal=['Asset','Expense'].includes(trial.type),balance=debitNormal?trial.debit-trial.credit:trial.credit-trial.debit;if(node)assert.equal(node.closing,balance);else assert.equal(balance,0);}
 assert.equal(new Set(accounts.map(n=>n.account.id)).size,accounts.length);assert.equal(JSON.stringify(saved),before);
});
