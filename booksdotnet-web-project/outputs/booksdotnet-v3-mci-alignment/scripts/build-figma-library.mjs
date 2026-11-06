import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Lucide from 'lucide-react';
import { catalog, inventory } from '../src/design-system/catalog.js';
import { colors, spacing, radii, typeScale, dimensions } from '../src/design-system/tokens.js';
import { colorRoles, textRoles, canonicalTextRoles, effectRoles } from '../src/design-system/foundations.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'figma-library-builder');
await fs.mkdir(out, { recursive: true });
const iconNames = new Set();
function visit(n) { if (n.kind === 'icon') iconNames.add(n.icon); n.children?.forEach(visit); }
inventory.forEach(v => visit(v.tree));
const icons = Object.fromEntries([...iconNames].map(name => [name, renderToStaticMarkup(React.createElement(Lucide[name], { size: 24, strokeWidth: 1.7 }))]));
const foundations = { colorRoles, textRoles, ...canonicalTextRoles(), effectRoles, themes: ['Light'] };
const payload = { catalog, colors, spacing, radii, typeScale, dimensions, foundations, icons, logo: (await fs.readFile(path.join(root, 'public/booksdotnet-logo.png'))).toString('base64') };
const runtime = await fs.readFile(path.join(root, 'scripts/figma-library-runtime.js'), 'utf8');
await fs.writeFile(path.join(out, 'code.js'), `const DATA = ${JSON.stringify(payload)};\n${runtime}`);
await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify({ name: 'booksdotnet — Native UI Library', id: process.argv[2] || 'REPLACE_WITH_FIGMA_ASSIGNED_PLUGIN_ID', api: '1.0.0', main: 'code.js', editorType: ['figma'], documentAccess: 'dynamic-page', networkAccess: { allowedDomains: ['none'] } }, null, 2));
await fs.writeFile(path.join(out, 'inventory.json'), JSON.stringify({ categories: catalog.length, families: catalog.reduce((n, s) => n + s.families.length, 0), specimens: inventory.length, inventory: inventory.map(({ tree, ...v }) => v) }, null, 2));
await fs.writeFile(path.join(out, 'style-registry-plan.json'), JSON.stringify(foundations, null, 2));
await fs.writeFile(path.join(root, 'src/design-system/tokens.css'), ':root{\n' + Object.entries(colors).map(([name, value]) => `  --ds-color-${name}:${value};`).concat(spacing.map(n => `  --ds-space-${n}:${n}px;`), radii.map(n => `  --ds-radius-${n}:${n}px;`), typeScale.map(n => `  --ds-font-size-${n}:${n}px;`), Object.entries(dimensions).map(([name, n]) => `  --ds-dimension-${name}:${n}px;`), ['  --ds-font-family:Poppins;', '  --ds-border-width:1px;']).join('\n') + '\n}\n');
console.log(`Prepared native builder: ${catalog.length} sections, ${inventory.length} variants, ${iconNames.size} Lucide vector icons. Not executed in Figma.`);
