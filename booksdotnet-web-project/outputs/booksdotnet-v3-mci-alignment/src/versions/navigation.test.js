import test from 'node:test';
import assert from 'node:assert/strict';
import { v2Groups, v2Routes, resolveLocation, equivalentPage, routeFor } from './navigation.js';
test('V2 has nine parents and no operational aging or balance-report secondary menus', () => {
  assert.equal(v2Groups.length, 9); assert.deepEqual(v2Groups[2].pages, ['Customer Invoices', 'Customer Credits', 'Customer Payments']); assert.deepEqual(v2Groups[3].pages, ['Supplier Bills', 'Supplier Credits', 'Supplier Payments']);
  assert.deepEqual(v2Groups[1].pages, ['Items','Customers','Suppliers','Employees']);
  assert.equal(new Set(Object.values(v2Routes)).size, Object.keys(v2Routes).length);
});
test('Explicit version links override persistence; refresh and legacy links map equivalent screens', () => {
  assert.deepEqual(resolveLocation('/v1/general-ledger', 'v2'), { version: 'v1', active: 'General Ledger' }); assert.deepEqual(resolveLocation('/v2/payables/bills', 'v1'), { version: 'v2', active: 'Supplier Bills' });
  assert.deepEqual(resolveLocation('/invoices', 'v2'), { version: 'v2', active: 'Customer Invoices' }); assert.deepEqual(resolveLocation('/v2/unknown'), { version: 'v2', active: 'Dashboard' });
});
test('Version switching maps equivalents and falls back to Dashboard for unavailable screens', () => {
  assert.equal(equivalentPage('Customer Invoices', 'v1'), 'Invoices'); assert.equal(equivalentPage('Supplier Bills', 'v1'), 'Accounts Payable'); assert.equal(equivalentPage('Customers', 'v1'), 'Dashboard'); assert.equal(routeFor('v2', 'General Ledger'), '/v2/accounting/ledger');
});
test('Canonical URLs retain explicit version identity for browser back/forward', () => {
  assert.equal(routeFor('v1', 'Dashboard'), '/v1'); assert.equal(routeFor('v1', 'Invoices'), '/v1/invoices');
  assert.deepEqual(resolveLocation(routeFor('v1', 'Invoices'), 'v2'), { version: 'v1', active: 'Invoices' });
});

