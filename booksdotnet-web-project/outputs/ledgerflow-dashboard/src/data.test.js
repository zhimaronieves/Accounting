import test from 'node:test';
import assert from 'node:assert/strict';
import { presetRange, getSummary, chartData, isValidRange, transactions, comparisonRange } from './data.js';
test('October totals reconcile with the ledger and charts', () => {
  const r = presetRange('This Month'), summary = getSummary(r), chart = chartData(r);
  assert.equal(summary.revenue, 1250000); assert.equal(summary.expenses, 785000);
  assert.equal(summary.profit, 465000); assert.equal(summary.outstanding, 215000); assert.equal(summary.invoiceCount, 12);
  assert.equal(summary.breakdown.reduce((s, x) => s + x.value, 0), summary.expenses);
  assert.equal(summary.breakdown.reduce((s, x) => s + Math.round(x.percentage * 10), 0), 1000);
  assert.equal(chart.reduce((s, x) => s + x.Revenue, 0), summary.revenue);
  assert.equal(chart.reduce((s, x) => s + x.Expenses, 0), summary.expenses);
  assert.equal(new Set(transactions.map(t => t.id)).size, transactions.length);
});
test('Date presets are inclusive and custom filters exclude outside rows', () => {
  const today = getSummary(presetRange('Today')); assert.equal(today.rows.length, 1); assert.equal(today.revenue, 125000); assert.equal(today.expenses, 0);
  assert.deepEqual(presetRange('Last 7 Days'), { start: '2026-10-20', end: '2026-10-26', label: 'Last 7 Days' });
  const r = { start: '2026-10-21', end: '2026-10-25' }; assert.equal(getSummary(r).revenue, 85000); assert.equal(getSummary(r).expenses, 523000);
  assert.equal(isValidRange('2026-10-26', '2026-10-16'), false); assert.equal(isValidRange('', ''), false);
  assert.equal(isValidRange('2026-02-30', '2026-03-01'), false);
  assert.deepEqual(comparisonRange({ start: '2026-10-20', end: '2026-10-26' }), { start: '2026-10-13', end: '2026-10-19' });
});
