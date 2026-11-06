import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace, assertWorkspace, reduceWorkspace, withOwnerCapitalSamples, accountBalance, reportData, ledgerRows, dashboardSummary, outstanding, agingData, cents, invoiceTotals, balanceAt } from './accounting.js';
const range = { start: '2026-10-01', end: '2026-10-26' };
test('Owner capital samples populate October and upgrade saved books without duplicates or lost entries', () => {
  const fresh = createWorkspace();
  const old = { ...fresh, entries: fresh.entries.filter(e => e.source !== 'seed-capital') };
  const upgraded = assertWorkspace(withOwnerCapitalSamples(old));
  assert.deepEqual(upgraded.entries.slice(0, old.entries.length), old.entries);
  assert.equal(withOwnerCapitalSamples(upgraded), upgraded);
  assert.equal(new Set(upgraded.entries.map(e => e.id)).size, upgraded.entries.length);
  const ledger = ledgerRows(upgraded, '3000', range);
  assert.equal(ledger.opening, 245000000);
  assert.deepEqual(ledger.rows.map(row => [row.debit, row.credit, row.balance]), [[0, 15000000, 260000000], [0, 5000000, 265000000], [2500000, 0, 262500000]]);
  const report = reportData(upgraded, range);
  assert.equal(report.assets, report.liabilities + report.equity + report.retained);
  assert.equal(report.flows.Financing, 12500000);
  assert.equal(report.closingCash - report.openingCash, Object.values(report.flows).reduce((a, b) => a + b, 0));
});
test('Seed books balance; reports, cash flow, subledgers and dashboard reconcile', () => {
  const s = assertWorkspace(createWorkspace()), r = reportData(s, range), d = dashboardSummary(s, range);
  assert.equal(r.assets, r.liabilities + r.equity + r.retained);
  assert.equal(r.trial.reduce((v, a) => v + a.debit - a.credit, 0), 0);
  assert.equal(r.closingCash - r.openingCash, Object.values(r.flows).reduce((a, b) => a + b, 0));
  assert.equal(accountBalance(s, '1100'), s.invoices.reduce((v, x) => v + outstanding(x), 0));
  assert.equal(accountBalance(s, '2000'), s.bills.reduce((v, x) => v + outstanding(x), 0));
  assert.equal(r.profit / 100, d.profit); assert.equal(d.revenue, 1465000); assert.equal(d.expenses, 859500);
  assert.equal(d.breakdown.reduce((v, x) => v + x.value, 0), d.expenses);
  assert.equal(d.breakdown.reduce((v, x) => v + Math.round(x.percentage * 10), 0), 1000);
  const ledger = ledgerRows(s, '1000', range); assert.equal(ledger.closing, accountBalance(s, '1000', range.end));
});
test('Draft journals do not affect books; posting validates balance; reversal offsets once', () => {
  let s = createWorkspace(); const before = accountBalance(s, '5000');
  const entry = { date: range.end, memo: 'Adjustment', reference: 'TEST', status: 'Draft', lines: [{ accountId: '5000', debit: 120000, credit: 0 }, { accountId: '1000', debit: 0, credit: 100000 }] };
  s = reduceWorkspace(s, { type: 'journal', entry }); const id = s.entries.at(-1).id;
  assert.equal(accountBalance(s, '5000'), before);
  assert.throws(() => reduceWorkspace(s, { type: 'postJournal', id }), /equal/);
  s = reduceWorkspace(s, { type: 'journal', entry: { ...s.entries.at(-1), lines: [{ accountId: '5000', debit: 100000, credit: 0 }, { accountId: '1000', debit: 0, credit: 100000 }] } });
  s = reduceWorkspace(s, { type: 'postJournal', id }); assert.equal(accountBalance(s, '5000'), before + 100000);
  s = reduceWorkspace(s, { type: 'reverseJournal', id }); assert.equal(accountBalance(s, '5000'), before);
  assert.throws(() => reduceWorkspace(s, { type: 'reverseJournal', id }), /unreversed/);
});
test('Invoice draft/issue, tax posting and partial receipts preserve AR and prevent overpayments', () => {
  let s = createWorkspace(); const initial = accountBalance(s, '1100');
  const invoice = { customer: 'Test Client', email: '', issueDate: range.end, dueDate: '2026-11-26', status: 'Draft', items: [{ description: 'Services', quantity: 2, rate: 100000 }], taxRate: 12 };
  s = reduceWorkspace(s, { type: 'invoice', invoice }); const id = s.invoices.at(-1).id;
  assert.equal(accountBalance(s, '1100'), initial);
  s = reduceWorkspace(s, { type: 'sendInvoice', id }); assert.equal(accountBalance(s, '1100'), initial + 224000); assert.equal(accountBalance(s, '2100'), 24000);
  s = reduceWorkspace(s, { type: 'payment', kind: 'invoice', id, payment: { date: range.end, amount: 100000, method: 'Bank transfer' } });
  assert.equal(outstanding(s.invoices.at(-1)), 124000); assert.equal(accountBalance(s, '1100'), initial + 124000);
  assert.throws(() => reduceWorkspace(s, { type: 'payment', kind: 'invoice', id, payment: { date: range.end, amount: 124001 } }), /exceed/);
  assert.throws(() => reduceWorkspace(s, { type: 'voidInvoice', id }), /payments/);
});
test('Bills and payments update AP and cash together; aging totals agree', () => {
  let s = createWorkspace(); const oldAP = accountBalance(s, '2000'), oldCash = accountBalance(s, '1000');
  const bill = { vendor: 'Supplier', reference: 'NEW-1', issueDate: range.end, dueDate: '2026-11-01', total: 420000, description: 'Services', accountId: '5200' };
  s = reduceWorkspace(s, { type: 'bill', bill }); const id = s.bills.at(-1).id;
  assert.equal(accountBalance(s, '2000'), oldAP + 420000);
  s = reduceWorkspace(s, { type: 'payment', kind: 'bill', id, payment: { date: range.end, amount: 200000, method: 'Bank transfer' } });
  assert.equal(accountBalance(s, '2000'), oldAP + 220000); assert.equal(accountBalance(s, '1000'), oldCash - 200000);
  assert.equal(Object.values(agingData(s.bills)).reduce((a, b) => a + b, 0), accountBalance(s, '2000'));
  assert.throws(() => reduceWorkspace(s, { type: 'bill', bill }), /already exists/);
});
test('Currency parser, account uniqueness and archive checks reject invalid inputs', () => {
  assert.equal(cents('12.35'), 1235); assert.throws(() => cents('12.345')); assert.throws(() => cents('-1'));
  assert.equal(invoiceTotals([{ description: 'Item', quantity: 3, rate: 1235 }], 0).total, 3705);
  const s = createWorkspace(); assert.throws(() => reduceWorkspace(s, { type: 'archiveAccount', id: '1000' }));
  assert.throws(() => reduceWorkspace(s, { type: 'account', account: { name: 'Duplicate', code: '1000', type: 'Asset' } }));
});
test('Voids retain historical balances and offset only on the void date', () => {
  let s = createWorkspace(); const invoice = s.invoices[0], before = accountBalance(s, '1100');
  s = reduceWorkspace(s, { type: 'voidInvoice', id: invoice.id });
  assert.equal(accountBalance(s, '1100'), before - invoice.total);
  assert.equal(balanceAt(s.invoices[0], '2026-10-25'), invoice.total);
  assert.equal(balanceAt(s.invoices[0], range.end), 0);
  for (const end of ['2026-10-25', range.end]) assert.equal(Object.values(agingData(s.invoices, end)).reduce((a, b) => a + b, 0), accountBalance(s, '1100', end));
  const bill = s.bills[0], ap = accountBalance(s, '2000'); s = reduceWorkspace(s, { type: 'voidBill', id: bill.id });
  assert.equal(accountBalance(s, '2000'), ap - bill.total);
  assert.equal(Object.values(agingData(s.bills)).reduce((a, b) => a + b, 0), accountBalance(s, '2000'));
});
test('Manual journals cannot bypass AR/AP source documents; accrual drafts post safely', () => {
  let s = createWorkspace(); const draft = s.entries.find(e => e.status === 'Draft'), ar = accountBalance(s, '1100'), ap = accountBalance(s, '2000');
  assert.throws(() => reduceWorkspace(s, { type: 'journal', entry: { ...draft, lines: [{ accountId: '1100', debit: 100, credit: 0 }, { accountId: '4000', debit: 0, credit: 100 }], status: 'Posted' } }), /controlled/);
  s = reduceWorkspace(s, { type: 'postJournal', id: draft.id });
  assert.equal(accountBalance(s, '1100'), ar); assert.equal(accountBalance(s, '2000'), ap); assert.equal(accountBalance(s, '2300'), 1500000);
});
test('Expense credits stay signed and do not create negative donut allocations', () => {
  let s = createWorkspace();
  s = reduceWorkspace(s, { type: 'journal', entry: { date: range.end, memo: 'Software refund', status: 'Posted', source: 'manual', lines: [{ accountId: '1000', debit: 100000, credit: 0 }, { accountId: '5200', debit: 0, credit: 100000 }] } });
  const d = dashboardSummary(s, { start: range.end, end: range.end });
  assert.equal(d.expenses, -1000); assert.ok(d.breakdown.every(x => x.percentage >= 0 && Number.isFinite(x.percentage)));
});
