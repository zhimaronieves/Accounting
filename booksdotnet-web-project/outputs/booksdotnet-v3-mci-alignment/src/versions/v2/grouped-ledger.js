import { ledgerRows } from '../../accounting.js';
import { hasChildren, descendantIds } from '../../account-hierarchy.js';

// Ledger rows show direct postings only; CoA roll-ups remain a separate presentation.
export function postingLedger(state,range,selectedId='',query='') {
 const postedAccounts=new Set(state.entries.filter(e=>e.status==='Posted').flatMap(e=>e.lines.map(l=>l.accountId)));
 const posting=state.accounts.filter(a=>!hasChildren(state.accounts,a.id)||a.legacyPostingParent||postedAccounts.has(a.id));
 const selected=state.accounts.find(a=>a.id===selectedId);
 const scope=selectedId?new Set(selected?(posting.some(a=>a.id===selectedId)?[selectedId]:[...descendantIds(state.accounts,selectedId)]):[]):null;
 const words=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
 return posting.filter(a=>(!scope||scope.has(a.id))&&words.every(word=>`${a.code} ${a.name}`.toLowerCase().includes(word)))
   .sort((a,b)=>a.code.localeCompare(b.code,undefined,{numeric:true}))
   .map(account=>{const ledger=ledgerRows(state,account.id,range);return {account,...ledger,rows:ledger.rows.map((row,i)=>({...row,id:`${row.entryId}:${i}`}))};});
}
export function ledgerExportRows(accounts,range) {
 return accounts.flatMap(node=>[
   [node.account.code,node.account.name,'Opening Balance',range.start,'','','','','',node.opening/100],
   ...node.rows.map(r=>[node.account.code,node.account.name,'Transaction',r.date,r.entryId,r.memo,r.reference||'',r.debit/100,r.credit/100,r.balance/100]),
   [node.account.code,node.account.name,'Closing Balance',range.end,'','','','','',node.closing/100],
 ]);
}
