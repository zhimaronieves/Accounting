import test from 'node:test';
import assert from 'node:assert/strict';
import { paginationItems } from './pagination.js';

test('Numbered pagination shows real page destinations and no phantom empty page', () => {
  assert.deepEqual(paginationItems(1, 0), []);
  assert.deepEqual(paginationItems(1, 1), [1]);
  assert.deepEqual(paginationItems(2, 4), [1, 2, 3, 4]);
  assert.deepEqual(paginationItems(1, 100), [1, 2, 3, 4, 5, '…', 100]);
  assert.deepEqual(paginationItems(50, 100), [1, '…', 49, 50, 51, '…', 100]);
  assert.deepEqual(paginationItems(100, 100), [1, '…', 96, 97, 98, 99, 100]);
  assert.deepEqual(paginationItems(999, 4), [1, 2, 3, 4]);
});
