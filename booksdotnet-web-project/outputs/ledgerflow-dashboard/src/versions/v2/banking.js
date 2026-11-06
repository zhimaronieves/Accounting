import { bankTransactionLines, bankTransactionFingerprint, movementSourceLabel } from './bank-transaction.js';
import { upgradeConfiguration, reduceConfiguration } from './configuration.js';
import { accountBalance } from '../../accounting.js';
import { TODAY } from '../../data.js';
import { nextCode } from './masterfile.js';
import { validateRef } from './configuration-data.js';

export function upgradeBanking(state) {
 const next=upgradeConfiguration(state);
 next.v2.bankTransactions ||= []; next.v2.bankAccounts ||= []; next.v2.bankMappings ||= {}; next.v2.reconciliations ||= [];
 return next;
}
const cashAccount=(s,id)=>s.accounts.find(a=>a.id===id&&a.type==='Asset'&&a.group==='Cash & bank');
const money=n=>Number.isSafeInteger(n)&&Math.abs(n)<=100000000000;
function date(value,label='Date') {if(!/^\d{4}-\d{2}-\d{2}$/.test(value||'') || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10)!==value || value>TODAY)throw new Error(`${label} must be a valid date no later than ${TODAY}.`);}
export const maskAccount=number=>number?'•••• '+String(number).replace(/[^a-z0-9]/gi,'').slice(-4):'—';
export const bankBookBalance=(s,id,end=TODAY)=>{const b=s.v2.bankAccounts?.find(b=>b.id===id);return b?accountBalance(s,b.glAccountId,end):0;};
export function bankMovements(s,{includeDrafts=false}={}) {
 return s.entries.filter(e=>e.status==='Posted'||includeDrafts&&e.status==='Draft').flatMap(e=>e.lines.flatMap((l,index)=>{
  if(!cashAccount(s,l.accountId)||!l.debit&&!l.credit)return [];
  const id=`${e.id}:${index}`,mapping=s.v2.bankMappings?.[id],linked=s.v2.bankAccounts?.find(b=>b.glAccountId===l.accountId);
  const payment=s.v2.payments?.find(p=>p.entryId===e.id)||[...s.invoices,...s.bills].flatMap(d=>d.payments||[]).find(p=>p.entryId===e.id),explicit=l.bankAccountId||payment?.bankAccountId;
  const bank=s.v2.bankAccounts?.find(b=>b.id===(mapping?.bankAccountId||explicit)) || (linked&&!linked.legacyMovementIds?.includes(id)?linked:null);
  const cash=l.nonBankCash||payment?.method==='Cash'||mapping?.resolution==='legacy-cash';
  return [{id,transactionId:e.bankTransactionId,sourceLabel:movementSourceLabel(s,e,payment),journalId:e.id,date:e.date,description:e.memo,reference:payment?.reference||e.reference||'',source:e.source,sourceId:e.sourceId,status:e.status,glAccountId:l.accountId,moneyIn:l.debit,moneyOut:l.credit,amount:l.debit-l.credit,bankAccountId:!cash&&bank?.glAccountId===l.accountId?bank.id:'',bankAccountName:!cash&&bank?.glAccountId===l.accountId?bank.name:cash?'Nonbank cash':'Mapping requires review',mappingStatus:!cash&&bank?.glAccountId===l.accountId?'Mapped':cash?'Nonbank cash':'Requires review',entry:e}];
 }));
}
export const completedMovementIds=(s,except)=>new Set((s.v2.reconciliations||[]).filter(r=>r.status==='Completed'&&r.id!==except).flatMap(r=>r.matches.map(m=>m.movementId)));
export function reconciliationSummary(s,r) {
 const completed=(s.v2.reconciliations||[]).filter(x=>x.id!==r.id&&x.bankAccountId===r.bankAccountId&&x.status==='Completed').sort((a,b)=>b.endDate.localeCompare(a.endDate));
 const previous=completed.find(x=>x.endDate<r.startDate),cleared=completedMovementIds(s,r.id),matches=r.matches||[],statement=r.statement||[];
 const eligible=bankMovements(s).filter(m=>Boolean(r.bankAccountId)&&m.bankAccountId===r.bankAccountId&&m.date<=r.endDate&&!cleared.has(m.id));
 const outstanding=eligible.filter(m=>!matches.some(x=>x.movementId===m.id)),unmatched=statement.filter(x=>!matches.some(m=>m.statementId===x.id));
 const previousBalance=previous?.endingBalance||0,bookBalance=bankBookBalance(s,r.bankAccountId,r.endDate),deposits=outstanding.reduce((v,m)=>v+m.moneyIn,0),withdrawals=outstanding.reduce((v,m)=>v+m.moneyOut,0),unrecorded=unmatched.reduce((v,m)=>v+m.moneyIn-m.moneyOut,0);
 const adjustedBank=(r.endingBalance||0)+deposits-withdrawals,adjustedBook=bookBalance+unrecorded;
 const bank=s.v2.bankAccounts?.find(b=>b.id===r.bankAccountId),unresolved=bankMovements(s).filter(m=>m.glAccountId===bank?.glAccountId&&m.date<=r.endDate&&!m.bankAccountId);
 return {previousBalance,bookBalance,statementBalance:r.endingBalance||0,matched:matches.length,outstandingDeposits:deposits,outstandingWithdrawals:withdrawals,unrecorded,adjustedBank,adjustedBook,difference:adjustedBank-adjustedBook,statementDifference:previousBalance+statement.reduce((v,m)=>v+m.moneyIn-m.moneyOut,0)-(r.endingBalance||0),unmatchedCount:unmatched.length,unresolvedCount:unresolved.length,eligible,outstanding,unmatched};
}
export function suggestedMatches(statement,movements) {
 return movements.filter(m=>m.amount===statement.moneyIn-statement.moneyOut&&Math.abs(Date.parse(m.date)-Date.parse(statement.date))<=3*86400000).sort((a,b)=>{
  const score=m=>Number(Boolean(statement.reference&&m.reference&&m.reference.toLowerCase().includes(statement.reference.toLowerCase())))*10+Number(m.date===statement.date);
  return score(b)-score(a);
 });
}
function validateReconciliation(s,r,old) {
 const bank=s.v2.bankAccounts.find(b=>b.id===r.bankAccountId);if(!bank||!bank.active&&old?.bankAccountId!==bank.id)throw new Error('Choose an active company bank account.');
 date(r.startDate,'Statement start date');date(r.endDate,'Statement ending date');if(r.startDate>r.endDate||!money(r.endingBalance))throw new Error('Check the statement period and ending balance.');
 const completed=s.v2.reconciliations.filter(x=>x.status==='Completed'&&x.bankAccountId===r.bankAccountId&&x.id!==r.id);
 if(completed.some(x=>r.startDate<=x.endDate))throw new Error('Start after the last completed reconciliation. Overlapping or backdated periods are not allowed.');
 if(!Array.isArray(r.statement)||!Array.isArray(r.matches)||r.statement.some(x=>typeof x.id!=='string'||!x.id)||new Set(r.statement.map(x=>x.id)).size!==r.statement.length)throw new Error('Statement entries must have unique identifiers.');
 for(const x of r.statement){date(x.date,'Statement entry date');if(x.date<r.startDate||x.date>r.endDate||!String(x.description||'').trim()||!money(x.moneyIn)||!money(x.moneyOut)||x.moneyIn<0||x.moneyOut<0||Boolean(x.moneyIn)===Boolean(x.moneyOut))throw new Error('Every statement entry needs a description, date in the period, and one positive Money In or Money Out amount.');}
 const ids=completedMovementIds(s,r.id),movements=bankMovements(s);if(new Set(r.matches.map(m=>m.statementId)).size!==r.matches.length||new Set(r.matches.map(m=>m.movementId)).size!==r.matches.length)throw new Error('Use one-to-one matches. A book movement or statement entry cannot be matched twice.');
 for(const match of r.matches){const entry=r.statement.find(x=>x.id===match.statementId),m=movements.find(x=>x.id===match.movementId);if(!entry||!m||m.status!=='Posted'||m.bankAccountId!==r.bankAccountId||m.date>r.endDate||ids.has(m.id)||m.amount!==entry.moneyIn-entry.moneyOut)throw new Error('Match equal signed amounts from this bank account to eligible posted movements. Previously reconciled movements cannot be used again.');}
}
function validatePaymentBank(s,p,posting) {
 if(p.method==='Cash') {if(p.bankAccountId||s.v2.bankAccounts.some(b=>b.glAccountId===(p.cashAccountId||'1000')))throw new Error('Cash payments must use a nonbank cash GL account.');return {...p,bankAccountId:''};}
 const bank=s.v2.bankAccounts.find(b=>b.id===p.bankAccountId);
 if(!bank){if(!posting&&!p.bankAccountId)return p;throw new Error('Select a company bank account for bank transfer or check payments. Legacy bank postings require mapping review.');}
 if(!bank.active&&(posting||!s.v2.paymentDrafts.some(d=>d.id===p.id&&d.bankAccountId===bank.id)))throw new Error('Choose an active company bank account before posting.');
 if(!cashAccount(s,bank.glAccountId)?.active)throw new Error('The linked bank GL account must be active.');
 return {...p,cashAccountId:bank.glAccountId,bankAccountName:bank.name,bankAccountId:bank.id,currency:bank.currency};
}
export function reduceBanking(state,action) {
 let next=upgradeBanking(state);
 if(action.type==='v2/bankTransaction') {
  const input=action.record;
  if(!input?.requestId)throw new Error('A bank transaction request identifier is required.');
  const old=next.v2.bankTransactions.find(r=>r.id===input.id||r.requestId===input.requestId);
  if(input.id&&(!old||old.id!==input.id))throw new Error('Bank transaction not found.');
  if(old&&input.requestId!==old.requestId)throw new Error('The saved transaction request identifier is protected.');
  if(old?.status==='Posted') {
   if(input.status==='Posted'&&bankTransactionFingerprint(input)===bankTransactionFingerprint(old))return next;
   throw new Error('Posted bank transactions are read-only. Use a controlled reversal or correction.');
  }
  if(!['Draft','Posted'].includes(input.status))throw new Error('Choose Draft or Posted.');
  date(input.date,'Transaction date');
  const r={...input,id:old?.id||nextCode('BTX',next.v2.bankTransactions),reference:String(input.reference||'').trim(),description:String(input.description||'').trim()};
  if(r.reference.length>60||r.description.length>160)throw new Error('Reference or description is too long.');
  const lines=bankTransactionLines(next,r),legacyId=old?.legacyDraftEntryId||input.legacyDraftEntryId;
  if(old?.legacyDraftEntryId!==input.legacyDraftEntryId&&old)throw new Error('The original draft reference is protected.');
  if(legacyId) {
   const legacy=next.entries.find(e=>e.id===legacyId);
   if(!legacy||legacy.status!=='Draft'||!legacy.bankTransaction||next.v2.bankTransactions.some(t=>t.id!==r.id&&t.legacyDraftEntryId===legacyId))throw new Error('Only an unclaimed manual bank draft can be converted.');
  }
  const bank=next.v2.bankAccounts.find(b=>b.id===r.bankAccountId),to=next.v2.bankAccounts.find(b=>b.id===r.toBankAccountId);
  r.bankAccountName=bank.name;r.toBankAccountName=to?.name||'';r.currency=bank.currency;
  r.history=[...(old?.history||[]),{date:TODAY,action:r.status==='Posted'?'Posted':old?'Updated':'Created',user:action.actor||'Local prototype user'}];
  if(r.status==='Posted'||legacyId) {
   next=upgradeBanking(reduceConfiguration(next,{type:'v2/bankJournal',entry:{id:legacyId,date:r.date,reference:r.reference,memo:r.description||`${r.type} · ${bank.name}`,source:'manual',status:r.status,lines,bankTransactionId:r.id,bankTransactionType:r.type}}));
   r.entryId=next.entries.find(e=>e.bankTransactionId===r.id).id;
  }
  const index=next.v2.bankTransactions.findIndex(t=>t.id===r.id);if(index>=0)next.v2.bankTransactions[index]=r;else next.v2.bankTransactions.push(r);
  return next;
 }
 if(action.type==='v2/deleteBankTransactionDraft') {
  const r=next.v2.bankTransactions.find(t=>t.id===action.id);if(!r||r.status!=='Draft')throw new Error('Only saved bank transaction drafts can be deleted.');
  if(r.legacyDraftEntryId)next=upgradeBanking(reduceConfiguration(next,{type:'deleteDraft',id:r.legacyDraftEntryId}));
  next.v2.bankTransactions=next.v2.bankTransactions.filter(t=>t.id!==r.id);return next;
 }
 if(['journal','v2/bankJournal','postJournal','deleteDraft'].includes(action.type)) {
  const e=next.entries.find(e=>e.id===(action.entry?.id||action.id));
  if(e?.bankTransactionId)throw new Error('Use Bank Transactions to edit or post this bank transaction draft.');
 }
 if(action.type==='v2/bankAccount') {
  const input=action.record,old=next.v2.bankAccounts.find(b=>b.id===input.id);if(input.id&&!old)throw new Error('Bank account not found.');
  const r={...old,...input,id:old?.id||nextCode('BANK',next.v2.bankAccounts),name:String(input.name||'').trim(),accountNumber:String(input.accountNumber||'').trim(),currency:input.currency||'PHP'};
  if(!r.name||typeof r.active!=='boolean'||r.currency!=='PHP'||!/^[0-9][0-9 -]{4,32}[0-9]$/.test(r.accountNumber))throw new Error('Enter an account name, a 6–34 character sample account number (digits, spaces or hyphens), PHP currency, and valid status.');
  validateRef(next,'banks',r.bankId,old?.bankId,true);
  const gl=cashAccount(next,r.glAccountId);if(!gl||!gl.active||gl.id==='1000')throw new Error('Choose a separate active Cash in Bank GL account. 1000 is the historical shared cash posting account.');
  if(next.v2.bankAccounts.some(b=>b.id!==r.id&&(b.glAccountId===r.glAccountId||b.bankId===r.bankId&&b.accountNumber.replace(/\D/g,'')===r.accountNumber.replace(/\D/g,''))))throw new Error('The bank account number or linked GL account is already in use. Each company account requires a separate GL account.');
  const activity=old&&(next.entries.some(e=>e.status==='Posted'&&e.lines.some(l=>l.accountId===old.glAccountId&&(l.debit||l.credit)))||next.v2.reconciliations.some(x=>x.bankAccountId===old.id));
  if(activity&&(r.glAccountId!==old.glAccountId||r.currency!==old.currency||r.bankId!==old.bankId||r.accountNumber!==old.accountNumber))throw new Error('Bank, account number, currency and linked GL are protected after financial activity.');
  const legacyMovementIds=old?.legacyMovementIds||bankMovements(next).filter(m=>m.glAccountId===r.glAccountId).map(m=>m.id);
  r.legacyMovementIds=legacyMovementIds;r.history=[...(old?.history||[]),{date:TODAY,action:old?'Updated':'Created',user:action.actor||'Local prototype user'}];
  if(old)Object.assign(old,r);else next.v2.bankAccounts.push(r);return next;
 }
 if(action.type==='v2/bankMapping') {
  const m=bankMovements(next).find(m=>m.id===action.movementId);if(!m||m.status!=='Posted'||completedMovementIds(next).has(m.id))throw new Error('Only unreconciled posted movements can be reviewed.');
  if(!String(action.reason||'').trim())throw new Error('Record the evidence or reason for this mapping review.');
  const b=next.v2.bankAccounts.find(b=>b.id===action.bankAccountId);
  if(action.resolution!=='legacy-cash'&&(!b||b.glAccountId!==m.glAccountId||m.mappingStatus==='Nonbank cash'))throw new Error('Map only to the company account using the same GL. Mixed legacy 1000 activity needs a separately posted reclassification; it cannot be assigned arbitrarily.');
  if(action.resolution==='legacy-cash'&&next.v2.bankAccounts.some(b=>b.glAccountId===m.glAccountId))throw new Error('A company bank GL movement cannot be classified as nonbank cash.');
  const old=next.v2.bankMappings[m.id];next.v2.bankMappings[m.id]={bankAccountId:b?.id||'',resolution:action.resolution,reason:action.reason,history:[...(old?.history||[]),{date:TODAY,reason:action.reason,user:action.actor||'Local prototype user'}]};return next;
 }
 if(action.type==='v2/reconciliation') {
  const input=structuredClone(action.record),old=next.v2.reconciliations.find(r=>r.id===input.id);
  if(input.id&&!old)throw new Error('Reconciliation not found.');if(old?.status==='Completed')throw new Error('Completed reconciliations are read-only. Reopening is not supported.');
  const r={...input,id:old?.id||nextCode('REC',next.v2.reconciliations),status:action.complete?'Completed':input.matches?.length?'In Progress':'Draft'};
  validateReconciliation(next,r,old);const summary=reconciliationSummary(next,r);
  if(action.complete&&(summary.difference!==0||summary.statementDifference!==0||summary.unmatchedCount||summary.unresolvedCount||r.reviewed!==true))throw new Error('Resolve unmatched statement entries, mapping issues, statement roll-forward and differences, then confirm review of outstanding items.');
  r.history=[...(old?.history||[]),{date:TODAY,action:action.complete?'Completed':old?'Updated':'Created',user:action.actor||'Local prototype user'}];
  if(action.complete){const {eligible,outstanding,unmatched,...totals}=summary;r.summary=totals;r.outstandingSnapshots=outstanding.map(({entry,...m})=>m);r.completedAt=new Date().toISOString();r.completedBy=action.actor||'Local prototype user';r.movementSnapshots=summary.eligible.filter(m=>r.matches.some(x=>x.movementId===m.id)).map(({entry,...m})=>m);}
  if(old)Object.assign(old,r);else next.v2.reconciliations.push(r);return next;
 }
 if(['v2/payment','v2/paymentDraft'].includes(action.type))action={...action,payment:validatePaymentBank(next,action.payment,action.type==='v2/payment')};
 if(action.type==='v2/postPaymentDraft'){const p=next.v2.paymentDrafts.find(p=>p.id===action.id);if(p)Object.assign(p,validatePaymentBank(next,p,true));}
 if(action.type==='v2/bankJournal') {
  const entry=action.entry,bankLines=entry.lines.filter(l=>cashAccount(next,l.accountId));
  if(!bankLines.some(l=>(l.debit||l.credit)&&next.v2.bankAccounts.some(b=>b.active&&b.glAccountId===l.accountId)))throw new Error('Direct bank transactions must include an active company bank GL account. Use AR/AP for customer or supplier payments.');
  if(bankLines.some(l=>next.v2.bankAccounts.some(b=>b.glAccountId===l.accountId&&!b.active)))throw new Error('Choose active company bank accounts.');
  action={...action,entry:{...entry,lines:entry.lines.map(l=>cashAccount(next,l.accountId)?{...l,nonBankCash:!next.v2.bankAccounts.some(b=>b.glAccountId===l.accountId)}:l)}};
 }

 if(['journal','v2/bankJournal'].includes(action.type)&&action.entry.status==='Posted'&&action.entry.lines.some(l=>next.v2.bankAccounts.some(b=>b.glAccountId===l.accountId&&!b.active)))throw new Error('This company bank account is inactive.');
 if(action.type==='postJournal'){const draft=next.entries.find(e=>e.id===action.id);if(draft?.bankTransaction&&!draft.lines.some(l=>(l.debit||l.credit)&&next.v2.bankAccounts.some(b=>b.active&&b.glAccountId===l.accountId)))throw new Error('Select an active company bank GL before posting this bank draft.');if(draft?.lines.some(l=>next.v2.bankAccounts.some(b=>b.glAccountId===l.accountId&&!b.active)))throw new Error('This company bank account is inactive.');}
 if(action.type==='archiveAccount'&&next.v2.bankAccounts.some(b=>b.glAccountId===action.id))throw new Error('This GL account is linked to a company bank account. Deactivate the bank account instead.');
 if(action.type==='account'&&next.v2.bankAccounts.some(b=>b.glAccountId===action.account.id)&&(action.account.type!=='Asset'||action.account.group!=='Cash & bank'))throw new Error('A linked bank GL must remain an Asset in Cash & bank.');
 if(action.type==='reverseJournal'&&bankMovements(next).some(m=>m.journalId===action.id&&completedMovementIds(next).has(m.id)))throw new Error('This posting is reconciled. Completed reconciliations cannot be reopened; use a separate dated correction journal.');
 if(action.type==='v2/deleteConfiguration'&&action.key==='banks'&&next.v2.bankAccounts.some(b=>b.bankId===action.id))throw new Error('This bank is referenced by company accounts. Deactivate it instead.');
 return upgradeBanking(reduceConfiguration(next,action));
}
