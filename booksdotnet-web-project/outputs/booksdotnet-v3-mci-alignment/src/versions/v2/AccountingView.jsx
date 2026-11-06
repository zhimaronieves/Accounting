import { useContext } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { PageContext } from './AccessContext.jsx';
import { routeFor } from '../navigation.js';
import { transactionDate } from './TransactionFields.jsx';
import { peso } from '../../module-ui.jsx';
export function linkedSourceJournal(state, entryId){
 const entry=state.entries.find(e=>e.id===entryId);if(!entry)return null;
 const lines=entry.lines.map(l=>({...l,account:state.accounts.find(a=>a.id===l.accountId)}));
 const debit=lines.reduce((s,l)=>s+(l.debit||0),0),credit=lines.reduce((s,l)=>s+(l.credit||0),0);
 return {...entry,lines,debit,credit,balanced:lines.length>1&&debit>0&&debit===credit};
}
export default function AccountingView({state,entryId}){
 const context=useContext(PageContext);
 if(!context?.canNavigate?.('Journal Entries'))return <p className="v3-source-empty">Accounting details are outside your current access.</p>;
 const journal=linkedSourceJournal(state,entryId);
 if(!journal)return <p className="v3-source-empty">No linked journal entry available.</p>;
 return <div className="v3-accounting-view"><dl className="v3-journal-meta"><div><dt>Journal Entry</dt><dd><a className="record-link" href={`${routeFor('v2','Journal Entries')}?mode=view&record=${encodeURIComponent(journal.id)}`}>{journal.id}</a></dd></div><div><dt>Date</dt><dd>{transactionDate(journal.date)}</dd></div><div><dt>Status</dt><dd><span className={`v3-source-status status-${journal.status.toLowerCase()}`}>{journal.status}</span></dd></div></dl><div className="table-scroll v3-journal-table" tabIndex={0} role="region" aria-label="Journal lines"><table className="v3-source-table"><thead><tr><th scope="col">GL Code / Account</th><th scope="col" className="amount-cell">Debit</th><th scope="col" className="amount-cell">Credit</th></tr></thead><tbody>{journal.lines.map((line,i)=><tr key={i}><td><strong>{line.account?.code||line.accountId}</strong><span className="v3-journal-account-name">{line.account?.name||'Account unavailable'}</span></td><td className="amount-cell">{line.debit?peso(line.debit):'—'}</td><td className="amount-cell">{line.credit?peso(line.credit):'—'}</td></tr>)}</tbody><tfoot><tr><th scope="row">Total</th><th className="amount-cell">{peso(journal.debit)}</th><th className="amount-cell">{peso(journal.credit)}</th></tr></tfoot></table></div><div className={`v3-journal-balance ${journal.balanced?'is-balanced':''}`} role="status">{journal.balanced?<CheckCircle2 size={20} aria-hidden="true"/>:<AlertCircle size={20} aria-hidden="true"/>}<div><strong>{journal.balanced?'Balanced':'Not balanced'}</strong><p>{journal.balanced?`Debits equal credits (${peso(journal.debit)}).`:`Review journal totals: debit ${peso(journal.debit)}; credit ${peso(journal.credit)}.`}</p></div></div></div>;
}
