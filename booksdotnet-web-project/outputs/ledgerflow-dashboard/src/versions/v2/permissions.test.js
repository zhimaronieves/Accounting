import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace, accountBalance } from '../../accounting.js';
import { upgradeWorkspace, reduceV2 } from './accounting.js';
import { createDirectory, can, canPage, reportTabs, assertActionAllowed, updateUser, validateDirectory } from './permissions.js';
import { searchWorkspace } from './search.js';
const state = () => upgradeWorkspace(createWorkspace());
test('Six role defaults isolate administration, operations and read-only management', () => {
  const [admin, manager, accountant, ar, ap, viewer] = createDirectory().users;
  assert.equal(canPage(admin, 'Users & Permissions'), true); assert.equal(canPage(admin, 'Customer Invoices'), false); assert.equal(can(admin, 'Accounting', 'post'), false);
  assert.equal(canPage(manager, 'Accounting Configuration'), true); assert.equal(canPage(manager, 'Users & Permissions'), false); assert.equal(can(manager, 'Accounting', 'reverse'), true);
  assert.equal(can(accountant, 'Accounting', 'post'), true); assert.equal(can(accountant, 'Accounts Payable', 'approve'), false);
  assert.equal(canPage(ar, 'Customer Invoices'), true); assert.equal(canPage(ar, 'Supplier Bills'), false); assert.equal(canPage(ar, 'General Ledger'), false); assert.deepEqual(reportTabs(ar), ['AR Aging', 'Customer Balance Summary']);
  assert.equal(canPage(ap, 'Supplier Payments'), true); assert.equal(can(ap, 'Accounts Payable', 'post'), false); assert.deepEqual(reportTabs(ap), ['AP Aging', 'Supplier Balance Summary']);
  assert.equal(canPage(viewer, 'Financial Statements'), true); assert.equal(canPage(viewer, 'Journal Entries'), false); assert.equal(can(viewer, 'Reports', 'export'), true); assert.equal(can(viewer, 'Reports', 'create'), false);
});
test('Explicit individual grants, status and page scopes govern access independently of role labels', () => {
  const d = createDirectory(), admin = d.users[0]; admin.permissions['Accounts Receivable'].view = true;
  assert.equal(canPage(admin, 'Customer Invoices'), true); assert.equal(can(admin, 'Accounts Receivable', 'create'), false);
  const ar = d.users[3]; ar.role = 'System Administrator'; assert.equal(canPage(ar, 'Supplier Bills'), false);
  ar.status = 'Inactive'; assert.equal(canPage(ar, 'Customer Invoices'), false);
  const viewer = d.users[5]; viewer.reportAccess = ['ar']; assert.equal(canPage(viewer, 'Financial Statements'), false); assert.equal(canPage(viewer, 'Receivables & Payables Reports'), true);
});
test('Search returns only real records and authorized destinations, including journal drill-down', () => {
  const s = state(), [, manager, , ar, ap, viewer] = createDirectory().users;
  assert.equal(searchWorkspace(s, ar, 'BILL-').length, 0); assert.equal(searchWorkspace(s, ap, 'INV-').length, 0); assert.ok(searchWorkspace(s, viewer, 'Mercado').every(r=>r.page==='Customers'));
  const invoice = searchWorkspace(s, ar, s.invoices[0].id).find(r => r.type === 'Invoice'); assert.equal(invoice.intent.documentId, s.invoices[0].id);
  const journal = searchWorkspace(s, manager, s.entries[0].id).find(r => r.type === 'Journal'); assert.equal(journal.intent.entryId, s.entries[0].id);
  assert.equal(searchWorkspace(s, ar, 'fictional-record-999').length, 0); assert.equal(searchWorkspace(s, ar, '').some(r => r.page === 'Supplier Bills'), false);
});
test('Action guards reject direct mutation attempts even when bypassing hidden navigation', () => {
  const s = state(), [admin, manager, , ar, ap, viewer] = createDirectory().users;
  const receipt = { type: 'v2/payment', kind: 'invoice' }, supplier = { type: 'v2/payment', kind: 'bill' };
  assert.doesNotThrow(() => assertActionAllowed(ar, receipt, s)); assert.throws(() => assertActionAllowed(ap, supplier, s), /Access denied/);
  for (const user of [admin, viewer]) assert.throws(() => assertActionAllowed(user, receipt, s), /Access denied/);
  assert.throws(() => assertActionAllowed(ar, { type: 'reverseJournal' }, s), /Access denied/); assert.doesNotThrow(() => assertActionAllowed(manager, { type: 'reverseJournal' }, s));
  assert.throws(() => assertActionAllowed(manager, { type: 'unknown' }, s), /not authorized/);
});
test('Forged IDs, mismatched kind hints and legacy bill status cannot bypass required rights', () => {
  const s = state(), ap = createDirectory().users[4]; ap.permissions['Accounts Payable'].post = true;
  assert.throws(() => assertActionAllowed(ap, { type: 'v2/invoice', kind: 'bill', document: { status: 'Draft' } }, s), /Accounts Receivable/);
  ap.permissions['Accounts Payable'].post = false;
  assert.throws(() => assertActionAllowed(ap, { type: 'bill', bill: { status: 'Draft' } }, s), /Post/);
  ap.permissions.Masterfile.create = false; ap.masterfilePermissions.Suppliers.create = false;
  assert.throws(() => assertActionAllowed(ap, { type: 'v2/party', kind: 'bill', party: { id: 'forged-new-id' } }, s), /Masterfile/);
});
test('User CRUD validates duplicates, role values and the last active access administrator', () => {
  const directory = createDirectory(), admin = directory.users[0], original = structuredClone(directory);
  const proposed = { ...directory.users[3], id: undefined, firstName: 'Maya', email: 'maya@example.com' };
  const next = updateUser(directory, admin, proposed); assert.equal(next.users.length, 7); assert.deepEqual(directory, original); assert.equal(next.users.at(-1).lastLogin, null);
  assert.throws(() => updateUser(next, admin, { ...proposed, email: 'MAYA@example.com' }), /already exists/);
  assert.throws(() => updateUser(directory, admin, { ...admin, status: 'Inactive' }), /at least one/);
  assert.throws(() => updateUser(directory, directory.users[1], proposed), /Manage Users/);
  assert.throws(() => updateUser(directory, admin, { ...proposed, role: 'Unknown role' }), /invalid/);
  assert.deepEqual(validateDirectory(JSON.parse(JSON.stringify(next))), next);
});
test('Supplier draft preparation does not post; authorized approval posts once and revalidates balances', () => {
  let s = state(); const [, manager, , , ap] = createDirectory().users, d = s.bills[0];
  const action = { type: 'v2/paymentDraft', kind: 'bill', payment: { requestId: 'prepare-test', partyId: d.partyId, date: '2026-10-26', method: 'Cash', reference: 'PREP', allocations: [{ docId: d.id, amount: 10000 }] } };
  assertActionAllowed(ap, action, s); const before = accountBalance(s, '2000'), entries = s.entries.length;
  s = reduceV2(s, action); assert.equal(s.entries.length, entries); assert.equal(accountBalance(s, '2000'), before); assert.equal(s.v2.payments.length, 0);
  const post = { type: 'v2/postPaymentDraft', id: s.v2.paymentDrafts[0].id };
  assert.throws(() => assertActionAllowed(ap, post, s), /Access denied/); assertActionAllowed(manager, post, s);
  s = reduceV2(s, post); assert.equal(s.entries.length, entries + 1); assert.equal(s.v2.payments.length, 1); assert.equal(s.v2.paymentDrafts[0].status, 'Posted'); assert.equal(accountBalance(s, '2000'), before - 10000);
  assert.throws(() => reduceV2(s, post), /unposted/);
});
test('Inactive users cannot mutate or manage users, and settings scopes restrict company writes', () => {
  const s = state(), directory = createDirectory(), [admin, manager] = directory.users;
  assert.throws(() => assertActionAllowed(manager, { type: 'v2/company' }, s), /Company configuration/);
  admin.status = 'Inactive'; assert.throws(() => assertActionAllowed(admin, { type: 'v2/company' }, s)); assert.throws(() => updateUser(directory, admin, directory.users[3]), /Manage Users/);
});
