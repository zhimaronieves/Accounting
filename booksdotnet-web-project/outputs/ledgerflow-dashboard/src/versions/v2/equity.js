import { postedEntries, reportData } from '../../accounting.js';
export const STATEMENT_TABS = ['Income Statement', 'Statement of Changes in Equity', 'Balance Sheet', 'Cash Flow Statement'];
export function equityStatement(state, range) {
  const report = reportData(state, range), entries = postedEntries(state, range.end).filter(e => e.date >= range.start);
  const rows = report.accounts.filter(a => a.type === 'Equity').map(a => {
    const lines = entries.flatMap(e => e.lines.filter(l => l.accountId === a.id));
    return { id: a.id, label: `${a.code} · ${a.name}`, beginning: a.balance - a.period, increases: lines.reduce((s, l) => s + l.credit, 0), decreases: lines.reduce((s, l) => s + l.debit, 0), profit: 0, ending: a.balance };
  });
  rows.push({ id: 'unclosed-earnings', label: 'Accumulated unclosed earnings', beginning: report.retained - report.profit, increases: 0, decreases: 0, profit: report.profit, ending: report.retained });
  const totals = Object.fromEntries(['beginning', 'increases', 'decreases', 'profit', 'ending'].map(k => [k, rows.reduce((s, row) => s + row[k], 0)]));
  return { rows, totals, balanceSheetEquity: report.equity + report.retained, difference: totals.ending - report.equity - report.retained };
}
