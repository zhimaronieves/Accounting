import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog, inventory } from './catalog.js';
import { colors, buttonAppearance } from './tokens.js';

test('The single-page catalog has every requested category with unique reusable variant identities', () => {
  assert.equal(catalog.length, 17);
  assert.equal(new Set(catalog.map(s => s.id)).size, 17);
  assert.equal(new Set(inventory.map(v => v.name)).size, inventory.length);
  for (const section of catalog) for (const family of section.families) {
    assert.ok(family.variants.length > 0, family.name);
    const axes = Object.keys(family.variants[0].props).sort();
    for (const variant of family.variants) assert.deepEqual(Object.keys(variant.props).sort(), axes, family.name);
  }
});
test('All six button styles cover every size and state; approved blue buttons retain white labels', () => {
  for (const style of ['Primary', 'Secondary', 'Tertiary', 'Outline', 'Ghost', 'Destructive']) {
    const family = catalog.flatMap(s => s.families).find(f => f.name === `Button / ${style}`);
    for (const Size of ['Small', 'Medium', 'Large']) for (const State of ['Default', 'Hover', 'Pressed', 'Focused', 'Disabled', 'Loading']) assert.ok(family.variants.some(v => v.props.Size === Size && v.props.State === State));
  }
  assert.equal(colors.primary, '#559CDA');
  for (const state of ['Default', 'Hover', 'Pressed', 'Focused', 'Disabled', 'Loading']) assert.equal(buttonAppearance('Primary', state).color, 'surface');
});
test('Native export trees contain supported editable primitives, valid token references, and finite geometry', () => {
  const kinds = new Set(['text', 'icon', 'row', 'column', 'button', 'logo', 'circle', 'divider']);
  function inspect(n) {
    assert.ok(kinds.has(n.kind), n.kind);
    for (const key of ['fill', 'stroke', 'color']) if (n[key]) assert.ok(n[key] === 'gradient' || colors[n[key]] || /^#/.test(n[key]), n[key]);
    for (const key of ['width', 'height', 'gap', 'size', 'radius']) if (n[key] !== undefined) assert.ok(Number.isFinite(n[key]) && n[key] >= 0, key);
    if (n.kind === 'text') assert.equal(typeof n.text, 'string');
    n.children?.forEach(inspect);
  }
  inventory.forEach(v => inspect(v.tree));
});
