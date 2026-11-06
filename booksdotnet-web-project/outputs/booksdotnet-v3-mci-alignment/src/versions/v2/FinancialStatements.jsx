import { useContext, useEffect, useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { PageContext, usePageAccess } from './AccessContext.jsx';
import { Button } from '../../design-system/Button.jsx';
import { Heading, exportCSV, peso } from '../../module-ui.jsx';
import { TODAY, shortDate } from '../../data.js';
import { STATEMENT_TABS } from './equity.js';
import { financialStatements } from './statements.js';

const amount = value => value < 0 ? `(${peso(-value)})` : peso(value);
export default function FinancialStatements({ state, range, onLedger }) {
  const access = usePageAccess(), context = useContext(PageContext);
  const [asOf, setAsOf] = useState(range.end), [tab, setTab] = useState('Income Statement');
  useEffect(() => setAsOf(range.end), [range.end]);
  const end = tab === 'Balance Sheet' ? asOf : range.end;
  const data = useMemo(() => financialStatements(state, { start: range.start, end }), [state, range.start, end]);
  const ledgerAllowed = !context || context.canNavigate('General Ledger');
  const pageContext = { ...context, dateControl: tab === 'Balance Sheet' ? <label className="v2-asof-control">As of Date<input aria-label="As of Date" type="date" required max={TODAY} value={asOf} onInput={e => { if (e.target.value && e.target.value <= TODAY) setAsOf(e.target.value); }} onChange={e => { if (e.target.value && e.target.value <= TODAY) setAsOf(e.target.value); }}/></label> : context?.dateControl };
  const company = state.v2?.company?.name || 'booksdotnet Workspace';
  const period = tab === 'Balance Sheet' ? `As of ${shortDate(asOf)}` : `For the period ${shortDate(range.start)} – ${shortDate(range.end)}`;
  const basis = `Amounts in Philippine Peso (PHP) · ${tab === 'Cash Flow Statement' ? 'Direct cash movements' : 'Accrual basis'}`;
  const matrix = tab === 'Statement of Changes in Equity';
  const rows = tab === 'Income Statement' ? data.income : tab === 'Balance Sheet' ? data.balance : data.cashRows;
  const checks = matrix ? [`Net income / (loss): ${amount(data.equity.profit)} — same posted ledger and reporting period as the Income Statement.`, `Ending equity: ${amount(data.equity.total)} · Balance Sheet equity: ${amount(data.report.equity + data.report.retained)} · Difference: ${amount(data.equity.difference)}.`] : tab === 'Balance Sheet' ? [`Assets less liabilities and equity: ${amount(data.balanceDifference)}.`] : tab === 'Cash Flow Statement' ? [`Beginning cash + net movement = ending cash: ${amount(data.cash.beginning)} + ${amount(data.cash.net)} = ${amount(data.cash.ending)}. Difference: ${amount(data.cash.difference)}.`, 'Cash and cash equivalents include accounts classified as Cash & bank. Internal cash transfers are excluded.'] : [`Net income / (loss): ${amount(data.report.profit)} — also used in the equity movement matrix for this reporting period.`];
  const issues = tab === 'Balance Sheet' ? [...data.warnings, ...(data.balanceDifference ? ['Assets do not equal liabilities plus equity. Review the posted ledger.'] : [])] : matrix && data.equity.difference ? ['Ending equity does not reconcile to the Balance Sheet. Review posted equity movements.'] : tab === 'Cash Flow Statement' ? [...(data.cash.review.length ? [`${data.cash.review.length} cash movement(s) require classification or accounting policy review. They are shown separately and included in the cash reconciliation.`] : []), ...(data.cash.difference ? ['Cash movement allocation does not reconcile to the cash accounts.'] : [])] : [];
  function download() {
    const headers = matrix ? ['Particulars', ...data.equity.columns.map(c => `${c.label} (PHP)`), 'Total Equity (PHP)'] : ['Particulars', 'Amount (PHP)'];
    const records = matrix ? data.equity.rows.map(r => [r.label, ...data.equity.columns.map(c => amount(r.values[c.id])), amount(r.total)]) : rows.map(r => [r.label, r.amount === null ? '' : amount(r.amount)]);
    exportCSV(`booksdotnet-${tab.toLowerCase().replaceAll(' ', '-')}.csv`, [company], [[tab], [period], [basis], [], headers, ...records, [], ...checks.map(c => [c]), ...issues.map(c => ['Review required', c])]);
  }
  return <PageContext.Provider value={pageContext}>
    <Heading title="Your financial statements" description="One posted ledger and reporting period across all four statements. Drafts are excluded."><Button disabled={!access('export')} onClick={() => window.print()}><Printer size={15}/>Print / Save PDF</Button><Button disabled={!access('export')} className="primary" onClick={download}><Download size={15}/>Export CSV</Button></Heading>
    <div className="module-tabs" role="tablist" aria-label="Financial reports">{STATEMENT_TABS.map((t, i) => <button role="tab" id={`statement-tab-${i}`} aria-controls="statement-panel" key={t} aria-selected={tab === t} tabIndex={tab === t ? 0 : -1} onKeyDown={e => { const direction = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (direction || ['Home', 'End'].includes(e.key)) { e.preventDefault(); const index = e.key === 'Home' ? 0 : e.key === 'End' ? STATEMENT_TABS.length - 1 : (i + direction + STATEMENT_TABS.length) % STATEMENT_TABS.length; setTab(STATEMENT_TABS[index]); e.currentTarget.parentElement.children[index].focus(); } }} onClick={() => setTab(t)}>{t}</button>)}</div>
    <section id="statement-panel" role="tabpanel" aria-labelledby={`statement-tab-${STATEMENT_TABS.indexOf(tab)}`} className="panel report-sheet print-sheet v2-financial-sheet">
      <div className="report-heading"><strong>{company}</strong><h2>{tab}</h2><span>{period}</span><small>{basis}</small></div>
      <div className="table-scroll v2-statement-scroll" tabIndex={0} role="region" aria-label={`${tab} report, scroll horizontally if needed`}>
        {matrix ? <table className="v2-statement-table v2-equity-matrix" aria-label={tab}><thead><tr><th scope="col">Particulars</th>{data.equity.columns.map(c => <th className="amount-cell" scope="col" key={c.id}>{c.label}</th>)}<th className="amount-cell" scope="col">Total Equity</th></tr></thead><tbody>{data.equity.rows.map(r => <tr className={`report-${r.kind}`} key={r.label}><th scope="row">{r.label}</th>{data.equity.columns.map(c => <td key={c.id} className="amount-cell">{amount(r.values[c.id])}</td>)}<td className="amount-cell">{amount(r.total)}</td></tr>)}</tbody></table> : <table className="v2-statement-table" aria-label={tab}><colgroup><col/><col className="report-amount-column"/></colgroup><thead><tr><th scope="col">Particulars</th><th scope="col" className="amount-cell">Amount (PHP)</th></tr></thead><tbody>{rows.map((r, i) => <tr className={`report-${r.kind}`} key={i}><th scope="row">{r.accountId && ledgerAllowed ? <button className="record-link" onClick={() => onLedger(r.accountId)}>{r.label}</button> : r.label}</th><td className="amount-cell">{r.amount === null ? '' : amount(r.amount)}</td></tr>)}</tbody></table>}
      </div>
      <div className="v2-report-reconciliation">{checks.map(c => <p className="report-check" key={c}>{c}</p>)}{issues.map(c => <p className="v2-report-review" key={c}>{c}</p>)}</div>
      {matrix && <p className="report-description">Columns follow the configured equity accounts. Unclosed earnings are shown separately; corporate share categories are not imposed. Contributions, drawings and other movements reflect posted journals.</p>}
      <div className="report-footnote">Local demonstration records. Not audited financial statements. Amounts and classifications come from the configured accounts and posted journals.</div>
    </section>
  </PageContext.Provider>;
}


