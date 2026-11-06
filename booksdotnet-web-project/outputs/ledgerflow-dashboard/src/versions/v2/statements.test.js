import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace } from '../../accounting.js';
import { upgradeTransactions, reduceTransactions } from './transactions.js';
import { financialStatements } from './statements.js';
const range = { start: '2026-10-01', end: '2026-10-26' };
const initial = () => upgradeTransactions(createWorkspace());
const line = (accountId, debit = 0, credit = 0) => ({ accountId, debit, credit });
function journal(state, lines, extra = {}) { state.entries.push({ id: `TEST-${state.entries.length}`, date: range.end, status: 'Posted', source: 'manual', lines, ...extra }); }
function reconciles(state, period = range) {
  const result = financialStatements(state, period);
  assert.equal(result.income.at(-1).amount, result.equity.profit);
  assert.equal(result.equity.rows.find(r => r.label === 'Net income / (loss)').total, result.report.profit);
  assert.equal(result.equity.rows[0].total + result.equity.rows.slice(1, -1).reduce((s, r) => s + r.total, 0), result.equity.total);
  assert.equal(result.equity.total, result.report.equity + result.report.retained);
  assert.equal(result.equity.difference, 0);
  assert.equal(result.balanceDifference, 0);
  assert.equal(result.cash.beginning + result.cash.net, result.cash.ending);
  assert.equal(result.cash.difference, 0);
  return result;
}
test('All four statements reconcile for every supported preset and seeded transaction snapshot', () => {
  const before = initial(), after = reduceTransactions(before, { type: 'v2/seedReviewData' });
  for (const state of [before, after]) for (const period of [range, { start: '2026-10-26', end: '2026-10-26' }, { start: '2026-01-01', end: '2026-10-26' }, { start: '2026-09-01', end: '2026-09-30' }]) reconciles(state, period);
  assert.notEqual(financialStatements(before, range).report.profit, financialStatements(after, range).report.profit);
});
test('Drafts, future entries and out-of-period activity do not change period income', () => {
  const state = initial(), before = reconciles(state);
  journal(state, [line('5000', 895000), line('1000', 0, 895000)], { status: 'Draft' });
  journal(state, [line('5000', 895000), line('1000', 0, 895000)], { date: '2026-11-01' });
  assert.equal(reconciles(state).report.profit, before.report.profit);
  state.entries.at(-2).status = 'Posted';
  assert.equal(reconciles(state).report.profit, before.report.profit - 895000);
});
test('Equity matrix uses configured components, signed movements and no forced corporate columns', () => {
  const state = initial(), result = reconciles(state);
  assert.deepEqual(result.equity.columns.map(c => c.label), ['Owner capital', 'Unclosed earnings']);
  assert.ok(result.equity.rows.find(r => r.label === 'Owner drawings / capital returns').total < 0);
  state.accounts.push({ id: '3100', code: '3100', name: 'Additional owner capital', type: 'Equity', group: 'Equity', active: true });
  journal(state, [line('3000', 25000), line('3100', 0, 25000)]);
  const moved = reconciles(state).equity.rows.find(r => r.label === 'Other equity movements');
  assert.equal(moved.values['3000'], -25000); assert.equal(moved.values['3100'], 25000); assert.equal(moved.total, 0);
});
test('Balance Sheet flags unknown classifications and keeps their amounts in the accounting equation', () => {
  const state = initial(); state.accounts.find(a => a.id === '1200').group = 'Unspecified';
  const result = reconciles(state);
  assert.match(result.warnings[0], /1200/);
  assert.ok(result.balance.some(r => r.label === 'Unclassified Assets — review required'));
});
test('Income subtotals include cost of sales, other income, financing cost and tax only when configured', () => {
  const state = initial();
  assert.ok(!reconciles(state).income.some(r => r.label.startsWith('Gross profit')));
  for (const [id, name, type, group] of [['5900', 'Materials', 'Expense', 'Cost of sales'], ['4100', 'Other receipts', 'Revenue', 'Other income'], ['5910', 'Finance cost', 'Expense', 'Finance costs'], ['5920', 'Income tax', 'Expense', 'Income tax']]) state.accounts.push({ id, code: id, name, type, group, active: true });
  journal(state, [line('5900', 10000), line('5910', 2000), line('5920', 3000), line('4100', 0, 1000), line('1000', 0, 14000)]);
  const result = reconciles(state);
  assert.ok(result.income.some(r => r.label.startsWith('Gross profit')));
  assert.equal(result.income.find(r => r.label === 'Income before tax').amount - 3000, result.report.profit);
});
test('Cash flow excludes noncash capital and internal bank transfers and flags ambiguous compound journals', () => {
  const state = initial(), before = reconciles(state);
  journal(state, [line('1200', 10000), line('3000', 0, 10000)]);
  state.accounts.push({ id: '1010', code: '1010', name: 'Second bank', type: 'Asset', group: 'Cash & bank', active: true });
  journal(state, [line('1010', 20000), line('1000', 0, 20000)]);
  assert.deepEqual(reconciles(state).cash, before.cash);
  journal(state, [line('1000', 30000), line('1200', 10000), line('3000', 0, 40000)]);
  const result = reconciles(state); assert.equal(result.cash.unclassified - before.cash.unclassified, 30000);
  assert.match(result.cash.review.at(-1).reason, /noncash offsets/);
});
test('Cash policy is honored and unknown / variable classifications stay visible for review', () => {
  const state = initial(); state.accounts.push({ id: '5990', code: '5990', name: 'Interest expense', type: 'Expense', group: 'Finance costs', active: true });
  journal(state, [line('5990', 10000), line('1000', 0, 10000)]);
  assert.ok(reconciles(state).cash.review.some(r => r.reason.includes('5990')));
  state.v2.company.cashFlowPolicy = { '5990': 'loanRepayments' };
  const result = reconciles(state);
  assert.ok(!result.cash.review.some(r => r.reason.includes('5990')));
  assert.equal(result.cash.groups.find(g => g.activity === 'Financing').rows.find(r => r.key === 'loanRepayments').amount, -10000);
});
test('AP settlement of an equipment bill is investing; later advance applications are not cash movements', () => {
  let state = initial();
  state.bills.push({ id: 'BILL-EQUIPMENT', partyId: state.v2.suppliers[0].id, vendor: state.v2.suppliers[0].name, issueDate: range.end, dueDate: range.end, accountId: '1200', total: 10000, status: 'Unpaid', payments: [] }); journal(state, [line('1200', 10000), line('2000', 0, 10000)], { source: 'bill', sourceId: 'BILL-EQUIPMENT' });
  const bill = state.bills.at(-1);
  state = reduceTransactions(state, { type: 'v2/payment', kind: 'bill', payment: { partyId: bill.partyId, date: range.end, method: 'Bank transfer', reference: 'PAY-EQUIPMENT', requestId: 'equipment-payment', amount: 15000, allocations: [{ docId: bill.id, amount: 10000 }] } });
  const result = reconciles(state);
  assert.equal(result.cash.groups.find(g => g.activity === 'Investing').rows.find(r => r.key === 'equipment').amount, -10000);
  const payment = state.v2.payments.at(-1), target = state.bills.find(b => b.partyId === bill.partyId && b.id !== bill.id);
  state = reduceTransactions(state, { type: 'v2/applyPayment', kind: 'bill', id: payment.id, date: range.end, requestId: 'no-cash-application', allocations: [{ docId: target.id, amount: 5000 }] });
  assert.deepEqual(reconciles(state).cash, result.cash);
});



test('An unbalanced imported ledger is reported rather than forced to balance', () => {
  const state = initial(); journal(state, [line('1000', 10000)]);
  const result = financialStatements(state, range);
  assert.equal(result.balanceDifference, 10000);
  assert.equal(result.cash.difference, 10000);
});
