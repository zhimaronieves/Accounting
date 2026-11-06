import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace, assertWorkspace, outstanding, balanceAt, accountBalance, reportData } from '../../accounting.js';
import { upgradeTransactions, reduceTransactions, seedReviewData, allocatedAmount, unappliedAmount } from './transactions.js';
import { createDirectory, assertActionAllowed, canPage } from './permissions.js';
const fresh = () => upgradeTransactions(createWorkspace()), range = { start: '2026-10-01', end: '2026-10-26' };
function reconcile(s) { assertWorkspace(s); assert.equal(accountBalance(s, '1100'), s.invoices.reduce((v, d) => v + outstanding(d), 0)); assert.equal(accountBalance(s, '2000'), s.bills.reduce((v, d) => v + outstanding(d), 0)); const r = reportData(s, range); assert.equal(r.assets, r.liabilities + r.equity + r.retained); assert.equal(r.closingCash - r.openingCash, Object.values(r.flows).reduce((a, b) => a + b, 0)); }
const note = (s, kind, type = 'Debit Note', status = 'Posted', amount = 10000) => { const doc = (kind === 'invoice' ? s.invoices : s.bills)[0]; return { type: 'v2/note', kind, note: { partyId: doc.partyId, docId: doc.id, type, status, amount, tax: 0, date: range.end, reason: 'Test adjustment', requestId: 'test-note-' + kind + type } }; };
test('AR and supplier-received AP credit/debit directions balance and retain source documents', () => {
  for (const kind of ['invoice', 'bill']) for (const type of ['Credit Note', 'Debit Note']) { const s = fresh(), action = note(s, kind, type), before = structuredClone(s), next = reduceTransactions(s, action), docs = kind === 'invoice' ? 'invoices' : 'bills'; assert.equal(outstanding(next[docs][0]) - outstanding(s[docs][0]), type === 'Credit Note' ? -10000 : 10000); assert.equal(next[docs][0].total, s[docs][0].total); assert.equal(balanceAt(next[docs][0], '2026-10-25'), balanceAt(s[docs][0], '2026-10-25')); assert.deepEqual(s, before); reconcile(next); }
});
test('Note drafts do not post; existing-note and request replay prevent duplicate journals', () => {
  let s = fresh(); const action = note(s, 'invoice', 'Debit Note', 'Draft'), before = s.entries.length; s = reduceTransactions(s, action); assert.equal(s.entries.length, before); const draft = s.v2.notes[0]; s = reduceTransactions(s, { ...action, note: { ...draft, status: 'Posted' } }); assert.equal(s.entries.length, before + 1); assert.throws(() => reduceTransactions(s, { ...action, note: { ...s.v2.notes[0], status: 'Posted' } }), /Only draft/);
  const initial = fresh(), postedAction = note(initial, 'invoice'); const posted = reduceTransactions(initial, postedAction); assert.deepEqual(reduceTransactions(posted, postedAction), posted); assert.throws(() => reduceTransactions(posted, { ...postedAction, note: { ...postedAction.note, amount: 20000 } }), /already used/); reconcile(s);
});
test('Reversal creates a separate offset and rejects a duplicate reversal', () => {
  let s = fresh(), before = outstanding(s.invoices[0]); s = reduceTransactions(s, note(s, 'invoice')); const id = s.v2.notes[0].id, original = structuredClone(s.entries.at(-1)); s = reduceTransactions(s, { type: 'v2/reverseNote', kind: 'invoice', id, date: range.end }); assert.equal(outstanding(s.invoices[0]), before); assert.deepEqual(s.entries.at(-2), original); assert.equal(s.v2.notes[0].status, 'Reversed'); assert.throws(() => reduceTransactions(s, { type: 'v2/reverseNote', kind: 'invoice', id, date: range.end }), /unreversed/); reconcile(s);
});
test('Customer tax adjustments use output tax and reject excessive tax credits', () => {
  let s = fresh(); s = reduceTransactions(s, { type: 'v2/invoice', document: { partyId: s.v2.customers[0].id, issueDate: range.end, dueDate: range.end, status: 'Sent', items: [{ description: 'Tax test', quantity: 1, rate: 10000 }], taxRate: 12 } }); const d = s.invoices.at(-1), action = { type: 'v2/note', kind: 'invoice', note: { partyId: d.partyId, docId: d.id, type: 'Credit Note', status: 'Posted', amount: 11200, tax: 1200, date: range.end, reason: 'Full allowance' } }; const next = reduceTransactions(s, action); assert.equal(accountBalance(s, '2100') - accountBalance(next, '2100'), 1200); assert.equal(outstanding(next.invoices.at(-1)), 0); assert.throws(() => reduceTransactions(s, { ...action, note: { ...action.note, tax: 1201 } }), /Credit tax/); reconcile(next);
});
test('Wholly and partly unapplied payments post only the allocated control balance', () => {
  for (const kind of ['invoice', 'bill']) { const s = fresh(), d = (kind === 'invoice' ? s.invoices : s.bills)[0], action = { type: 'v2/payment', kind, payment: { requestId: kind, partyId: d.partyId, date: range.end, method: 'Cash', amount: 50000, allocations: [{ docId: d.id, amount: 20000 }] } }, next = reduceTransactions(s, action), p = next.v2.payments[0]; assert.equal(allocatedAmount(p), 20000); assert.equal(unappliedAmount(p), 30000); assert.equal(s.entries.length + 1, next.entries.length); assert.equal(outstanding(d) - outstanding((kind === 'invoice' ? next.invoices : next.bills)[0]), 20000); assert.deepEqual(reduceTransactions(next, action), next); reconcile(next); }
});
test('Applying an advance creates no second cash movement and records history once', () => {
  for (const kind of ['invoice', 'bill']) { let s = fresh(); const d = (kind === 'invoice' ? s.invoices : s.bills)[0]; s = reduceTransactions(s, { type: 'v2/payment', kind, payment: { requestId: 'advance', partyId: d.partyId, date: range.end, method: 'Bank transfer', amount: 50000, allocations: [] } }); const p = s.v2.payments[0], cash = accountBalance(s, '1000'), action = { type: 'v2/applyPayment', kind, id: p.id, requestId: 'apply-1', date: range.end, allocations: [{ docId: d.id, amount: 30000 }] }; s = reduceTransactions(s, action); assert.equal(accountBalance(s, '1000'), cash); assert.equal(unappliedAmount(s.v2.payments[0]), 20000); assert.equal(s.v2.payments[0].applications.length, 1); assert.throws(() => reduceTransactions(s, action), /already recorded/); assert.throws(() => reduceTransactions(s, { ...action, requestId: 'apply-2', allocations: [{ docId: d.id, amount: 20001 }] }), /exceeds/); reconcile(s); }
});
test('Draft advances do not affect cash and AP staff cannot post or apply supplier funds', () => {
  const s = fresh(), d = s.bills[0], ap = createDirectory().users[4], action = { type: 'v2/paymentDraft', kind: 'bill', payment: { requestId: 'draft', partyId: d.partyId, date: range.end, method: 'Cash', amount: 100000, allocations: [] } }, next = reduceTransactions(s, action); assert.equal(next.entries.length, s.entries.length); assert.equal(accountBalance(next, '1000'), accountBalance(s, '1000')); assert.doesNotThrow(() => assertActionAllowed(ap, action, s)); assert.throws(() => assertActionAllowed(ap, { type: 'v2/postPaymentDraft', id: next.v2.paymentDrafts[0].id }, next)); assert.throws(() => assertActionAllowed(ap, { type: 'v2/applyPayment', kind: 'bill' }, s));
});
test('Deterministic demo seed adds 18 payments per kind, replays safely, and preserves existing entries', () => {
  const s = fresh(), originalEntries = structuredClone(s.entries), next = seedReviewData(s); assert.deepEqual(next.entries.slice(0, originalEntries.length), originalEntries); assert.equal(s.v2.payments.length, 0); for (const kind of ['invoice', 'bill']) { const posted = next.v2.payments.filter(p => p.kind === kind && p.demo), drafts = next.v2.paymentDrafts.filter(p => p.kind === kind && p.demo); assert.equal(posted.length, 14); assert.equal(drafts.length, 4); assert.ok(posted.some(p => p.allocations.length > 1)); assert.ok(posted.some(p => allocatedAmount(p) === 0)); assert.ok(posted.some(p => unappliedAmount(p) > 0 && allocatedAmount(p) > 0)); assert.ok(posted.some(p => unappliedAmount(p) === 0)); for (const p of posted) assert.equal(allocatedAmount(p) + unappliedAmount(p), p.amount); } assert.deepEqual(seedReviewData(next), next); assert.deepEqual(seedReviewData(upgradeTransactions(JSON.parse(JSON.stringify(next)))), next); reconcile(next);
});
test('One shared dataset survives all six roles without additional visibility grants', () => {
  const s = seedReviewData(fresh()), copy = structuredClone(s); for (const u of createDirectory().users) { const permitted = canPage(u, 'Customer Payments'); if (u.role === 'System Administrator' || u.role === 'Management / Viewer') assert.equal(permitted, false); assert.deepEqual(s, copy); } reconcile(s);
});
test('A settled debit cannot be reversed into a negative outstanding balance', () => {
  let s = fresh(); s = reduceTransactions(s, note(s, 'invoice')); const d = s.invoices[0], id = s.v2.notes[0].id;
  s = reduceTransactions(s, { type: 'v2/payment', kind: 'invoice', payment: { requestId: 'settle', partyId: d.partyId, date: range.end, method: 'Cash', allocations: [{ docId: d.id, amount: outstanding(d) }] } });
  assert.throws(() => reduceTransactions(s, { type: 'v2/reverseNote', kind: 'invoice', id, date: range.end }), /over-settle/); reconcile(s);
});
test('Cross-party allocations, overallocations, and cross-module draft edits are rejected', () => {
  let s = fresh(); const first = s.invoices[0], other = s.invoices.find(d => d.partyId !== first.partyId), action = { type: 'v2/payment', kind: 'invoice', payment: { requestId: 'invalid', partyId: first.partyId, date: range.end, method: 'Cash', amount: 1000, allocations: [{ docId: other.id, amount: 500 }] } };
  assert.throws(() => reduceTransactions(s, action), /selected party/); assert.throws(() => reduceTransactions(s, { ...action, payment: { ...action.payment, allocations: [{ docId: first.id, amount: 1001 }] } }), /exceed/);
  s = reduceTransactions(s, note(s, 'invoice', 'Credit Note', 'Draft')); assert.throws(() => reduceTransactions(s, { type: 'v2/note', kind: 'bill', note: { ...s.v2.notes[0], docId: s.bills[0].id, partyId: s.bills[0].partyId } }), /Only draft/); reconcile(s);
});
test('Note actions and source pages retain the six-role access rules', () => {
  const s = fresh(), [admin, manager, accountant, ar, ap, viewer] = createDirectory().users;
  for (const u of [admin, viewer]) { assert.equal(canPage(u, 'Customer Credits'), false); assert.throws(() => assertActionAllowed(u, note(s, 'invoice'), s)); }
  assert.doesNotThrow(() => assertActionAllowed(ar, note(s, 'invoice'), s)); assert.throws(() => assertActionAllowed(ar, note(s, 'bill'), s)); assert.doesNotThrow(() => assertActionAllowed(ap, note(s, 'bill', 'Credit Note', 'Draft'), s)); assert.throws(() => assertActionAllowed(ap, note(s, 'bill'), s)); assert.throws(() => assertActionAllowed(accountant, { type: 'v2/reverseNote', kind: 'invoice' }, s)); assert.doesNotThrow(() => assertActionAllowed(manager, { type: 'v2/reverseNote', kind: 'invoice' }, s));
});
test('Payment advance control balances cannot be bypassed by manual journals', () => {
  const s = seedReviewData(fresh());
  assert.throws(() => reduceTransactions(s, { type: 'journal', entry: { date: range.end, status: 'Posted', memo: 'Unlinked advance adjustment', lines: [{ accountId: '1000', debit: 1000, credit: 0 }, { accountId: 'booksdotnet-customer-advances', debit: 0, credit: 1000 }] } }), /controlled/);
});

