import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace, reduceWorkspace, reportData } from '../../accounting.js';
import { equityStatement, STATEMENT_TABS } from './equity.js';
test('V2 statement sequence excludes the independent trial balance', () => {
  assert.deepEqual(STATEMENT_TABS, ['Income Statement', 'Statement of Changes in Equity', 'Balance Sheet', 'Cash Flow Statement']);
});
test('Beginning equity, contributions, drawings and earnings roll forward to the balance sheet', () => {
  const state = createWorkspace(), range = { start: '2026-10-01', end: '2026-10-26' }, result = equityStatement(state, range), report = reportData(state, range);
  assert.equal(result.totals.beginning + result.totals.increases - result.totals.decreases + result.totals.profit, result.totals.ending);
  assert.equal(result.totals.ending, report.equity + report.retained); assert.equal(result.difference, 0);
  const capital = result.rows.find(r => r.id === '3000'); assert.equal(capital.increases, 20000000); assert.equal(capital.decreases, 2500000);
});
test('Equity statement ignores drafts and future movements and includes posted reversals', () => {
  let state = createWorkspace(); const range = { start: '2026-10-01', end: '2026-10-26' }, before = equityStatement(state, range);
  state = reduceWorkspace(state, { type: 'journal', entry: { date: '2026-10-26', status: 'Draft', memo: 'Additional contribution', reference: 'TEST', lines: [{ accountId: '1000', debit: 10000, credit: 0 }, { accountId: '3000', debit: 0, credit: 10000 }] } });
  assert.deepEqual(equityStatement(state, range), before); const id = state.entries.at(-1).id;
  state = reduceWorkspace(state, { type: 'postJournal', id }); assert.equal(equityStatement(state, range).totals.ending, before.totals.ending + 10000);
  assert.deepEqual(equityStatement(state, { ...range, end: '2026-10-25' }), equityStatement(createWorkspace(), { ...range, end: '2026-10-25' }));
  state = reduceWorkspace(state, { type: 'reverseJournal', id }); const after = equityStatement(state, range); assert.equal(after.totals.ending, before.totals.ending); assert.equal(after.difference, 0);
});
test('A period with no activity preserves opening balances', () => {
  const state = createWorkspace(), range = { start: '2025-01-01', end: '2025-01-31' }, result = equityStatement(state, range);
  assert.equal(result.totals.beginning, result.totals.ending); assert.equal(result.totals.profit, 0); assert.equal(result.difference, 0);
});

test('Period losses reduce closing equity without changing contribution movements', () => {
  const range = { start: '2026-10-01', end: '2026-10-26' };
  const state = reduceWorkspace(createWorkspace(), { type: 'journal', entry: { date: '2026-10-26', status: 'Posted', memo: 'Loss scenario', lines: [{ accountId: '5000', debit: 100000000, credit: 0 }, { accountId: '1000', debit: 0, credit: 100000000 }] } });
  const result = equityStatement(state, range);
  assert.ok(result.totals.profit < 0); assert.equal(result.difference, 0);
  assert.equal(result.totals.beginning + result.totals.increases - result.totals.decreases + result.totals.profit, result.totals.ending);
});
