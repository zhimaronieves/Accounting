import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace, accountBalance, outstanding, balanceAt, assertWorkspace, reportData } from '../../accounting.js';
import { upgradeWorkspace, reduceV2, paymentRecords, dueDateFor } from './accounting.js';
const fresh = () => upgradeWorkspace(createWorkspace());
const payment = (state, kind, docs, amounts, requestId = 'test-request') => ({ type: 'v2/payment', kind, payment: { requestId, partyId: docs[0].partyId, date: '2026-10-26', method: 'Bank transfer', reference: 'TEST', allocations: docs.map((d, i) => ({ docId: d.id, amount: amounts[i] })) } });
const reconcile = state => { assertWorkspace(state); for (const [key, id] of [['invoices', '1100'], ['bills', '2000']]) assert.equal(state[key].reduce((s, d) => s + outstanding(d), 0), accountBalance(state, id)); const r = reportData(state, { start: '2026-01-01', end: '2026-10-26' }); assert.equal(r.trial.reduce((s, a) => s + a.debit - a.credit, 0), 0); };
test('Upgrade preserves original accounting records, assigns stable masters and is idempotent', () => {
  const original = createWorkspace(), copy = structuredClone(original), s = upgradeWorkspace(original);
  assert.deepEqual(original, copy); assert.deepEqual(s.entries, original.entries); assert.deepEqual(s.accounts, original.accounts);
  assert.deepEqual(s.invoices.map(({ partyId, ...d }) => d), original.invoices);
  assert.deepEqual(upgradeWorkspace(s), s); assert.equal(s.v2.customers.length, 8); reconcile(s);
});
test('Multiple invoice allocations create one payment and one journal, with idempotent replay', () => {
  const s = fresh(), docs = s.invoices.filter(d => d.partyId === s.invoices[0].partyId && outstanding(d) > 0), action = payment(s, 'invoice', docs, docs.map(() => 10000)), next = reduceV2(s, action);
  assert.equal(next.entries.length, s.entries.length + 1); assert.equal(next.v2.payments.length, 1); assert.equal(paymentRecords(next, 'invoice').length, paymentRecords(s, 'invoice').length + 1);
  const header = next.v2.payments[0]; assert.equal(header.amount, docs.length * 10000); assert.equal(new Set(next.invoices.flatMap(d => d.payments.filter(p => p.aggregateId === header.id).map(p => p.entryId))).size, 1);
  assert.deepEqual(reduceV2(next, action), next); assert.throws(() => reduceV2(next, { ...action, payment: { ...action.payment, reference: 'changed' } }), /already used/); reconcile(next);
});
test('Cross-party allocation, overpayment, duplicate allocation and draft allocation fail atomically', () => {
  const s = fresh(), d = s.invoices[0], other = s.invoices.find(x => x.partyId !== d.partyId), snapshot = structuredClone(s);
  assert.throws(() => reduceV2(s, payment(s, 'invoice', [d, other], [100, 100])), /selected party/);
  assert.throws(() => reduceV2(s, payment(s, 'invoice', [d], [outstanding(d) + 1])), /exceeds/);
  assert.throws(() => reduceV2(s, payment(s, 'invoice', [d, d], [100, 100])), /unique/);
  const draft = { ...d, status: 'Draft' }, draftState = { ...s, invoices: [draft, ...s.invoices.slice(1)] };
  assert.throws(() => reduceV2(draftState, payment(draftState, 'invoice', [draft], [100])), /posted/); assert.deepEqual(s, snapshot);
});
test('Supplier draft can be edited and posted once under the same document ID', () => {
  let s = fresh(); const before = accountBalance(s, '2000'), count = s.entries.length;
  s = reduceV2(s, { type: 'v2/bill', kind: 'bill', document: { partyId: s.v2.suppliers[0].id, issueDate: '2026-10-20', dueDate: '2026-11-20', reference: 'DRAFT-TEST', description: 'Office rental', total: 100000, accountId: '5200', status: 'Draft' } });
  const d = s.bills.at(-1); assert.equal(s.entries.length, count); assert.equal(accountBalance(s, '2000'), before);
  s = reduceV2(s, { type: 'v2/bill', kind: 'bill', document: { ...d, total: 200000, status: 'Unpaid' } });
  assert.equal(s.bills.at(-1).id, d.id); assert.equal(s.entries.length, count + 1); assert.equal(accountBalance(s, '2000'), before + 200000);
  assert.throws(() => reduceV2(s, { type: 'v2/bill', document: { ...s.bills.at(-1), total: 3 } }), /Only draft/); reconcile(s);
});
test('Supplier multi-bill payment reduces AP and cash once', () => {
  const s = fresh(), d = s.bills[0], docs = s.bills.filter(x => x.partyId === d.partyId && outstanding(x) > 0), next = reduceV2(s, payment(s, 'bill', docs, docs.map(() => 10000)));
  assert.equal(next.entries.length, s.entries.length + 1); assert.equal(accountBalance(s, '1000') - accountBalance(next, '1000'), docs.length * 10000); assert.equal(accountBalance(s, '2000') - accountBalance(next, '2000'), docs.length * 10000); reconcile(next);
});
test('Dated credit notes retain source posting, reconcile and prohibit a second void', () => {
  let s = fresh(); const d = s.invoices[0], original = structuredClone(s.entries.find(e => e.id === d.entryId));
  s = reduceV2(s, { type: 'v2/credit', kind: 'invoice', id: d.id, credit: { date: '2026-10-25', amount: 100000, reason: 'Price correction' } });
  const after = s.invoices.find(x => x.id === d.id); assert.equal(outstanding(after), d.total - 100000); assert.equal(balanceAt(after, '2026-10-24'), d.total); assert.deepEqual(s.entries.find(e => e.id === d.entryId), original);
  assert.throws(() => reduceV2(s, { type: 'v2/void', kind: 'invoice', id: d.id }), /credits/); assert.throws(() => reduceV2(s, payment(s, 'invoice', [after], [outstanding(after) + 1])), /exceeds/); reconcile(s);
});
test('Cumulative credit tax rounding returns exactly the original tax on full credit', () => {
  let s = fresh(); s = reduceV2(s, { type: 'v2/invoice', document: { partyId: s.v2.customers[0].id, issueDate: '2026-10-26', dueDate: '2026-10-26', status: 'Sent', items: [{ description: 'Small service', quantity: 1, rate: 101 }], taxRate: 12 } });
  const d = s.invoices.at(-1); for (const amount of [30, 30, d.total - 60]) s = reduceV2(s, { type: 'v2/credit', kind: 'invoice', id: d.id, credit: { date: '2026-10-26', amount, reason: 'Correction' } });
  assert.equal(s.invoices.at(-1).credits.reduce((s, c) => s + c.tax, 0), d.tax); assert.equal(outstanding(s.invoices.at(-1)), 0); reconcile(s);
});
test('Supplier credit posts an offset without changing the original bill', () => {
  const s = fresh(), d = s.bills.find(d => outstanding(d) > 0), next = reduceV2(s, { type: 'v2/credit', kind: 'bill', id: d.id, credit: { date: '2026-10-26', amount: 10000, reason: 'Supplier allowance' } });
  assert.equal(next.bills.find(x => x.id === d.id).total, d.total); assert.equal(accountBalance(s, '2000') - accountBalance(next, '2000'), 10000); reconcile(next);
});
test('Master rename preserves issued snapshots and transaction association across V1 additions', () => {
  let s = fresh(); const p = s.v2.customers[0], ids = s.invoices.filter(d => d.partyId === p.id).map(d => d.id);
  s = reduceV2(s, { type: 'v2/party', kind: 'invoice', party: { ...p, name: 'Renamed Customer', terms: 0 } });
  assert.equal(s.invoices.find(d => d.id === ids[0]).customer, p.name); assert.equal(s.invoices.filter(d => d.partyId === p.id).length, ids.length);
  s = reduceV2(s, { type: 'invoice', invoice: { customer: p.name, issueDate: '2026-10-26', dueDate: '2026-10-26', status: 'Draft', items: [{ description: 'V1 service', quantity: 1, rate: 10000 }], taxRate: 0 } });
  assert.equal(s.invoices.at(-1).partyId, p.id); assert.equal(s.v2.customers.length, 8); assert.equal(dueDateFor(0), '2026-10-26');
});
test('V1 payments appear once in V2 and both versions continue using shared balances', () => {
  const s = fresh(), d = s.invoices[0], next = reduceV2(s, { type: 'payment', kind: 'invoice', id: d.id, payment: { amount: 10000, date: '2026-10-26', method: 'Cash', reference: 'V1' } });
  assert.equal(paymentRecords(next, 'invoice').length, paymentRecords(s, 'invoice').length + 1); assert.equal(next.v2.payments.length, 0); reconcile(upgradeWorkspace(JSON.parse(JSON.stringify(next))));
});
test('One-cent credits can reverse rounded tax without empty journal lines', () => {
  let s = fresh(); s = reduceV2(s, { type: 'v2/invoice', document: { partyId: s.v2.customers[0].id, issueDate: '2026-10-25', dueDate: '2026-10-26', status: 'Sent', items: [{ description: 'Rounding case', quantity: 1, rate: 101 }], taxRate: 12 } });
  const d = s.invoices.at(-1);
  for (let i = 0; i < d.total; i++) s = reduceV2(s, { type: 'v2/credit', kind: 'invoice', id: d.id, credit: { date: '2026-10-26', amount: 1, reason: 'Centavo correction' } });
  assert.equal(outstanding(s.invoices.at(-1)), 0); assert.equal(s.invoices.at(-1).credits.reduce((s, c) => s + c.tax, 0), d.tax); reconcile(s);
});
test('V1 payment cannot backdate before a V2 credit and reused master aliases cannot collide', () => {
  let s = fresh(); const d = s.invoices[0], p = s.v2.customers[0];
  s = reduceV2(s, { type: 'v2/credit', kind: 'invoice', id: d.id, credit: { date: '2026-10-26', amount: 100, reason: 'Correction' } });
  assert.throws(() => reduceV2(s, { type: 'payment', kind: 'invoice', id: d.id, payment: { date: '2026-10-25', amount: 100, method: 'Cash' } }), /last payment/);
  s = reduceV2(s, { type: 'v2/party', kind: 'invoice', party: { ...p, name: 'New legal name' } });
  assert.throws(() => reduceV2(s, { type: 'v2/party', kind: 'invoice', party: { name: p.name, terms: 30 } }), /already exists/);
});
