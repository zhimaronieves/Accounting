import test from 'node:test';
import assert from 'node:assert/strict';
import { colorRoles, textRoles, canonicalTextRoles, textSignature, effectRoles } from './foundations.js';
import { colors } from './tokens.js';

test('Semantic color roles resolve to the existing light application palette', () => {
  assert.equal(new Set(colorRoles.map(r => r.name)).size, colorRoles.length);
  for (const role of colorRoles) assert.ok(colors[role.token], role.name);
  for (const name of ['Color/Text/Primary', 'Color/Background/Surface', 'Color/Border/Default', 'Color/Interactive/Focus']) assert.ok(colorRoles.some(r => r.name === name));
});
test('Every requested text role is covered without duplicate registered font definitions', () => {
  const { canonical, aliases } = canonicalTextRoles();
  assert.equal(new Set(canonical.map(textSignature)).size, canonical.length);
  assert.equal(Object.keys(aliases).length, textRoles.length);
  for (let h = 1; h <= 6; h++) assert.ok(aliases[`Text/Heading/H${h}`]);
  assert.equal(aliases['Text/Table/Cell'], aliases['Text/Body/Small']);
  assert.equal(aliases['Text/Button/Medium'], aliases['Text/Label/Medium']);
  for (const role of textRoles) { assert.equal(role.family, 'Poppins'); assert.ok(role.lineHeight >= role.size); assert.ok(Number.isFinite(role.letterSpacing)); }
});
test('Elevation follows source overlays and does not add shadows to flat cards', () => {
  assert.equal(effectRoles.length, 3);
  assert.ok(effectRoles.every(r => !r.name.includes('Card')));
  assert.equal(effectRoles.find(r => r.name.endsWith('Modal')).shadows[0].blur, 80);
});
