import { useRef, useState } from 'react';
import { RecordPage, RecordActions } from './RecordPage.jsx';
import { ReadOnlyFields, TransactionInput, TransactionSelect } from './TransactionFields.jsx';
import { RecordLookup } from './RefLookup.jsx';
import { FormGrid } from './FormLayout.jsx';
import { usePageAccess } from './AccessContext.jsx';
import { Badge, ErrorText, peso } from '../../module-ui.jsx';
import { Button } from '../../design-system/Button.jsx';
import { cents } from '../../accounting.js';
import { TODAY } from '../../data.js';
import { BANK_TRANSACTION_TYPES, bankTransactionLines, defaultOffset, offsetAccounts } from './bank-transaction.js';

export default function BankTransactionForm({ state, transaction, movement, entry, viewOnly=false, commit, onClose, onDone, onDelete, onNavigate, actions, children, extraDirty=false }) {
  const banks=state.v2.bankAccounts||[],access=usePageAccess(), readOnly=viewOnly || transaction?.status==='Posted' || !access(transaction?'edit':'create');
  const original=transaction || (movement ? { bankAccountId:movement.bankAccountId, bankAccountName:movement.bankAccountName, type:movement.sourceLabel, date:movement.date, amount:Math.abs(movement.amount), reference:movement.reference, description:entry.memo, status:entry.status, offsetAccountId:entry.lines.length===2?entry.lines.find(l=>l.accountId!==movement.glAccountId)?.accountId:'' } : null);
  const [form,setForm]=useState(()=>({...original,type:original?.type||'Direct Deposit',date:original?.date||TODAY,reference:original?.reference||'',description:original?.description||'',bankAccountId:original?.bankAccountId||'',toBankAccountId:original?.toBankAccountId||'',offsetAccountId:original?.offsetAccountId||'',amount:original?.amount?(original.amount/100).toFixed(2):''}));
  const [requestId]=useState(()=>transaction?.requestId||crypto.randomUUID()),[error,setError]=useState(''),busy=useRef(false);
  const transfer=form.type==='Bank Transfer',set=(key,value)=>setForm(f=>({...f,[key]:value}));
  const changeType=type=>setForm(f=>({...f,type,toBankAccountId:'',offsetAccountId:['Bank Charge','Bank Interest'].includes(type)?defaultOffset(state,type):offsetAccounts(state,type).some(a=>a.id===f.offsetAccountId)?f.offsetAccountId:''}));
  let lines=[],incomplete='';
  try {lines=readOnly&&entry?entry.lines:bankTransactionLines(state,{...form,amount:cents(form.amount)});} catch(e) {incomplete=e.message;}
  const totalDebit=lines.reduce((n,l)=>n+l.debit,0),totalCredit=lines.reduce((n,l)=>n+l.credit,0),balanced=lines.length>0&&totalDebit>0&&totalDebit===totalCredit;
  const offsetLabel=form.type==='Bank Charge'?'Bank Charges Expense Account':form.type==='Bank Interest'?'Interest Income Account':'Offset Account';
  const bankField=(key,label)=> <RecordLookup label={label} required rows={banks} filter={b=>key!=='toBankAccountId'||b.id!==form.bankAccountId} value={form[key]||''} previous={original?.[key]} displayValue={readOnly?(key==='toBankAccountId'?original?.toBankAccountName:original?.bankAccountName)||banks.find(b=>b.id===form[key])?.name||'Mapping requires review':undefined} onChange={id=>set(key,id)}/>;
  const status=entry?.reversedBy?'Reversed':original?.status||'Draft';
  return <ReadOnlyFields.Provider value={readOnly}><RecordPage title={transaction?.id||entry?.id||'New Bank Transaction'} statusInline status={<Badge value={status}/>} recordId={transaction?.id||entry?.id} mode={readOnly?'view':original?'edit':'create'} dirty={readOnly?extraDirty:undefined} readOnlyMessage={readOnly&&entry?.status==='Posted'?'This transaction has been posted and can no longer be edited.':undefined} onClose={onClose}>
    <form onSubmit={e=>{e.preventDefault();if(readOnly||busy.current)return;busy.current=true;try {const result=commit({type:'v2/bankTransaction',record:{...transaction,...form,requestId,amount:cents(form.amount),status:e.nativeEvent.submitter?.value||'Draft'}});if(!result.ok)throw new Error(result.error);onDone();}catch(err){setError(err.message);busy.current=false;}}}>
      <div className="modal-body module-form v2-bank-form">
        <section className="v2-form-section v2-bank-information"><h2>Transaction Information</h2>
          {transfer&&<FormGrid><label>Transaction Type *<TransactionSelect aria-label="Transaction Type" required value={form.type} onChange={e=>changeType(e.target.value)}>{BANK_TRANSACTION_TYPES.map(t=><option key={t}>{t}</option>)}</TransactionSelect></label></FormGrid>}
          <FormGrid>{bankField('bankAccountId',transfer?'From Bank Account':'Bank Account')}{transfer?bankField('toBankAccountId','To Bank Account'):<label>Transaction Type *<TransactionSelect aria-label="Transaction Type" required value={form.type} displayValue={readOnly?form.type:undefined} onChange={e=>changeType(e.target.value)}>{!BANK_TRANSACTION_TYPES.includes(form.type)&&<option>{form.type}</option>}{BANK_TRANSACTION_TYPES.map(t=><option key={t}>{t}</option>)}</TransactionSelect></label>}</FormGrid>

          <FormGrid><label>Transaction Date *<TransactionInput aria-label="Transaction Date" type="date" required max={TODAY} value={form.date} onChange={e=>set('date',e.target.value)}/></label><label>Amount (₱) *<TransactionInput aria-label="Transaction amount" type="number" min="0.01" step="0.01" required value={form.amount} displayValue={readOnly?peso(original.amount):undefined} onChange={e=>set('amount',e.target.value)}/></label></FormGrid>
          <FormGrid><label>Reference<TransactionInput aria-label="Transaction Reference" maxLength={60} value={form.reference} onChange={e=>set('reference',e.target.value)}/></label>{!transfer&&<RecordLookup label={offsetLabel} required rows={readOnly?state.accounts:offsetAccounts(state,form.type,form.bankAccountId)} value={form.offsetAccountId} previous={original?.offsetAccountId} displayValue={readOnly&&!form.offsetAccountId?'Multiple GL accounts — see Accounting Preview':undefined} format={a=>`${a.code} · ${a.name}`} onChange={id=>set('offsetAccountId',id)}/>}</FormGrid>
          <FormGrid><label className="v2-full-width">Description<TransactionInput aria-label="Transaction Description" maxLength={160} value={form.description} onChange={e=>set('description',e.target.value)}/></label></FormGrid>
        </section>
        <section className="v2-form-section"><h2>Accounting Preview</h2>{incomplete?<p className="field-help" role="status">Incomplete preview — {incomplete}</p>:<><div className="table-scroll"><table className="v2-accounting-preview" aria-label="Accounting Preview"><thead><tr><th>GL Account</th><th className="amount-cell">Debit (₱)</th><th className="amount-cell">Credit (₱)</th></tr></thead><tbody>{lines.map((l,i)=><tr key={i}><td>{((a)=>a?`${a.code} · ${a.name}`:l.accountId)(state.accounts.find(a=>a.id===l.accountId))}</td><td className="amount-cell">{peso(l.debit)}</td><td className="amount-cell">{peso(l.credit)}</td></tr>)}</tbody><tfoot><tr><th>Total</th><th className="amount-cell">{peso(totalDebit)}</th><th className="amount-cell">{peso(totalCredit)}</th></tr></tfoot></table></div><p className={balanced?'change-positive':'danger'} role="status">{balanced?'Balanced':'Unbalanced'}</p></>}
          <p className="field-help">{readOnly?'Original journal lines are retained.':'Preview only. Drafts do not change ledger balances. Use AR/AP to record customer or supplier payments.'}</p>
          {entry&&<p className="field-help">Journal {entry.id} · Source {entry.sourceId||entry.source}{entry.reversedBy?' · Reversed by '+entry.reversedBy:''}{entry.reversalOf?' · Reverses '+entry.reversalOf:''}</p>}
        </section>
        {(transaction?.history||entry?.history||[]).length>0&&<section className="v2-form-section"><h2>History</h2>{(transaction?.history||entry.history).map((h,i)=><p className="field-help" key={i}>{h.date} · {h.action} {h.user&&`· ${h.user}`}</p>)}</section>}
        {children}<ErrorText error={error}/>
      </div>
      <RecordActions><Button type="button" onClick={onClose}>{readOnly?'Close':'Cancel'}</Button>{actions}{entry&&onNavigate&&<Button type="button" onClick={()=>onNavigate('Journal Entries',{entryId:entry.id})}>View Journal Entry</Button>}{!readOnly&&<>{(transaction?.id||transaction?.legacyDraftEntryId)&&onDelete&&<Button type="button" onClick={onDelete}>Delete Draft</Button>}<Button type="submit" value="Draft">{original?'Save Changes':'Save Draft'}</Button>{access('post')&&<Button type="submit" className="primary" value="Posted" disabled={!balanced}>Post Transaction</Button>}</>}</RecordActions>
    </form>
  </RecordPage></ReadOnlyFields.Provider>;
}
