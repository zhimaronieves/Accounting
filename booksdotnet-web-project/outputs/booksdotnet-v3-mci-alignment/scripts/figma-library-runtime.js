// Prepared for manual execution in Figma Desktop after importing manifest.json.
// No network access, no deletions, and no changes to existing screens.
async function buildLibrary() {
  const PAGE = 'Design System & Components', PREFIX = 'booksdotnet / ';
  const result = { createdNodeIds: [], createdVariableIds: [], createdStyleIds: [], families: [], warnings: [], existingScreensModified: 0 };
  const existing = figma.root.children.find(p => p.name === PAGE);
  const page = existing || figma.createPage();
  page.name = PAGE;
  await figma.setCurrentPageAsync(page);
  if (!existing) result.createdNodeIds.push(page.id);
  const existingGallery = page.children.find(n => n.name === 'booksdotnet / Native Component Gallery');
  await Promise.all(['Regular', 'Medium', 'SemiBold'].map(style => figma.loadFontAsync({ family: 'Poppins', style })));
  const existingCollections = await figma.variables.getLocalVariableCollectionsAsync();
  const existingVariables = await figma.variables.getLocalVariablesAsync();
  const vars = {}, styles = {}, iconMasters = {}, roleVariables = {}, roleStyles = {}, effectStyles = {};
  function collection(name) { return existingCollections.find(c => c.name === name) || figma.variables.createVariableCollection(name); }
  const raw = collection(PREFIX + 'Primitives'), semantic = collection(PREFIX + 'Semantic tokens');
  function variable(name, type, value, scopes, syntax, c = semantic) {
    let v = existingVariables.find(v => v.name === name && v.variableCollectionId === c.id);
    if (!v) { v = figma.variables.createVariable(name, c, type); v.setValueForMode(c.modes[0].modeId, value); v.scopes = scopes; v.setVariableCodeSyntax('WEB', syntax); result.createdVariableIds.push(v.id); }
    return v;
  }
  const rgb = hex => { const v = hex.replace('#', ''); return { r: parseInt(v.slice(0, 2), 16) / 255, g: parseInt(v.slice(2, 4), 16) / 255, b: parseInt(v.slice(4, 6), 16) / 255 }; };
  for (const [name, hex] of Object.entries(DATA.colors)) {
    const p = variable('raw/color/' + name, 'COLOR', rgb(hex), [], `var(--ds-color-${name})`, raw);
    vars[name] = variable('color/' + name, 'COLOR', { type: 'VARIABLE_ALIAS', id: p.id }, ['FRAME_FILL', 'SHAPE_FILL', 'TEXT_FILL', 'STROKE_COLOR'], `var(--ds-color-${name})`);
  }
  const colorScopes = { text: ['TEXT_FILL'], stroke: ['STROKE_COLOR'], fill: ['FRAME_FILL', 'SHAPE_FILL'], all: ['FRAME_FILL', 'SHAPE_FILL', 'TEXT_FILL', 'STROKE_COLOR'] };
  const paintStyles = await figma.getLocalPaintStylesAsync();
  const sameColor = (paint, token) => paint && paint.type === 'SOLID' && (paint.opacity === undefined || paint.opacity === 1) && ['r', 'g', 'b'].every(c => Math.abs(paint.color[c] - rgb(DATA.colors[token])[c]) < .00001);
  result.colorStyleAliases = {};
  for (const role of DATA.foundations.colorRoles) {
    roleVariables[role.name] = variable(role.name, 'COLOR', { type: 'VARIABLE_ALIAS', id: vars[role.token].id }, colorScopes[role.usage], `var(--ds-color-${role.token})`);
    let style = paintStyles.find(s => s.name === PREFIX + role.name) || paintStyles.find(s => s.paints.length === 1 && sameColor(s.paints[0], role.token));
    if (!style) { style = figma.createPaintStyle(); style.name = PREFIX + role.name; style.description = 'Reusable palette paint. Semantic element roles are independently bound to the corresponding Color variables.'; style.paints = [figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: rgb(DATA.colors[role.token]) }, 'color', vars[role.token])]; paintStyles.push(style); result.createdStyleIds.push(style.id); }
    result.colorStyleAliases[role.name] = style.id;
  }
  function numberToken(name, value, scopes, syntax) {
    const p = variable('raw/' + name, 'FLOAT', value, [], syntax, raw);
    vars[name] = variable(name, 'FLOAT', { type: 'VARIABLE_ALIAS', id: p.id }, scopes, syntax);
  }
  DATA.spacing.forEach(n => numberToken('space/' + n, n, ['GAP'], `var(--ds-space-${n})`));
  DATA.radii.forEach(n => numberToken('radius/' + n, n, ['CORNER_RADIUS'], `var(--ds-radius-${n})`));
  DATA.typeScale.forEach(n => numberToken('fontSize/' + n, n, ['FONT_SIZE'], `var(--ds-font-size-${n})`));
  Object.entries(DATA.dimensions).forEach(([name, value]) => numberToken('dimension/' + name, value, ['WIDTH_HEIGHT'], `var(--ds-dimension-${name})`));
  numberToken('border/width', 1, ['STROKE_FLOAT'], 'var(--ds-border-width)');
  const fontPrimitive = variable('raw/font/family', 'STRING', 'Poppins', [], 'var(--ds-font-family)', raw);
  vars.font = variable('font/family', 'STRING', { type: 'VARIABLE_ALIAS', id: fontPrimitive.id }, ['FONT_FAMILY'], 'var(--ds-font-family)');
  const oldTextStyles = await figma.getLocalTextStylesAsync();
  const existingFonts = [...new Map(oldTextStyles.filter(s => s.name.startsWith(PREFIX)).map(s => [JSON.stringify(s.fontName), s.fontName])).values()];
  await Promise.all(existingFonts.map(font => figma.loadFontAsync(font)));
  function registerText(role) {
    const fontStyle = role.weight === 600 ? 'SemiBold' : role.weight === 500 ? 'Medium' : 'Regular';
    const exact = s => s.fontName.family === role.family && s.fontName.style === fontStyle && s.fontSize === role.size && s.lineHeight.unit !== 'AUTO' && Math.abs((s.lineHeight.unit === 'PIXELS' ? s.lineHeight.value : s.fontSize * s.lineHeight.value / 100) - role.lineHeight) < .001 && Math.abs((s.letterSpacing.unit === 'PIXELS' ? s.letterSpacing.value : s.fontSize * s.letterSpacing.value / 100) - role.letterSpacing) < .001;
    let style = oldTextStyles.find(s => s.name === PREFIX + role.name) || oldTextStyles.find(exact);
    if (!style) { style = figma.createTextStyle(); style.name = PREFIX + role.name; style.fontName = { family: role.family, style: fontStyle }; style.fontSize = role.size; style.lineHeight = { unit: 'PIXELS', value: role.lineHeight }; style.letterSpacing = { unit: 'PIXELS', value: role.letterSpacing }; oldTextStyles.push(style); result.createdStyleIds.push(style.id); }
    return style;
  }
  for (const role of DATA.foundations.canonical) { const style = registerText(role); roleStyles[role.name] = style.id; styles[`${role.size}/${role.weight}`] = style.id; }
  result.textStyleAliases = {};
  for (const [role, canonical] of Object.entries(DATA.foundations.aliases)) result.textStyleAliases[role] = roleStyles[canonical];
  for (const size of [...new Set([...DATA.typeScale, 10, 15, 17, 48])]) for (const weight of [400, 500, 600]) {
    if (!styles[`${size}/${weight}`]) styles[`${size}/${weight}`] = registerText({ name: `Text/Utility/${size}/${weight}`, family: 'Poppins', size, weight, lineHeight: size * 1.5, letterSpacing: 0 }).id;
  }
  const effects = await figma.getLocalEffectStylesAsync();
  result.effectStyleRoles = {};
  for (const role of DATA.foundations.effectRoles) {
    const color = role.color || 'ink';
    const values = role.shadows.map(s => ({ type: 'DROP_SHADOW', color: { ...rgb(DATA.colors[color]), a: s.alpha }, offset: { x: s.x, y: s.y }, radius: s.blur, spread: s.spread, visible: true, blendMode: 'NORMAL' }));
    const equal = candidate => candidate.effects.length === values.length && candidate.effects.every((e, i) => { const v = values[i]; return e.type === v.type && e.visible === v.visible && e.blendMode === v.blendMode && e.radius === v.radius && (e.spread || 0) === v.spread && e.offset.x === v.offset.x && e.offset.y === v.offset.y && ['r', 'g', 'b', 'a'].every(c => Math.abs(e.color[c] - v.color[c]) < .00001); });
    let style = effects.find(e => e.name === PREFIX + role.name) || effects.find(equal);
    if (!style) { style = figma.createEffectStyle(); style.name = PREFIX + role.name; style.description = role.uses.join(', ') + '. Matches application effects; no shadow is added to flat cards.'; style.effects = values; effects.push(style); result.createdStyleIds.push(style.id); }
    effectStyles[role.name] = style.id; result.effectStyleRoles[role.name] = style.id;
  }
  result.semanticColorVariableIds = Object.fromEntries(Object.entries(roleVariables).map(([key, v]) => [key, v.id]));
  result.themes = ['Light'];
  if (existingGallery) { figma.showUI('<body style="font:13px system-ui;padding:20px"><h2>Foundations registered</h2><p>The existing native gallery was not duplicated. Its older bindings and existing screen connections still require an audit.</p><textarea style="width:100%;height:240px">' + JSON.stringify(result, null, 2) + '</textarea></body>', { width: 520, height: 370 }); return; }
  const logoHash = figma.createImage(figma.base64Decode(DATA.logo)).hash;
  function track(n) { result.createdNodeIds.push(n.id); return n; }
  function paint(key, usage = 'fill') { const role = DATA.foundations.colorRoles.find(r => r.token === key && (r.usage === usage || r.usage === 'all')) || DATA.foundations.colorRoles.find(r => r.token === key); const v = role ? roleVariables[role.name] : vars[key]; return v ? figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: rgb(DATA.colors[key]) }, 'color', v) : { type: 'SOLID', color: rgb(key || '#FFFFFF') }; }
  function bind(n, field, key) { if (vars[key]) n.setBoundVariable(field, vars[key]); }
  function auto(name, direction = 'VERTICAL', width) {
    const n = track(figma.createFrame()); n.name = name; n.layoutMode = direction; n.fills = []; n.primaryAxisSizingMode = 'AUTO'; n.counterAxisSizingMode = width ? 'FIXED' : 'AUTO'; n.itemSpacing = 8; n.clipsContent = false;
    if (width) n.resize(width, 1); return n;
  }
  function text(value, size = 12, weight = 400, color = 'ink', width) {
    const n = track(figma.createText()); n.name = 'Label'; n.fontName = { family: 'Poppins', style: weight === 600 ? 'SemiBold' : weight === 500 ? 'Medium' : 'Regular' }; n.characters = value; n.fontSize = size; n.lineHeight = { unit: 'PERCENT', value: 150 }; n.letterSpacing = { unit: 'PIXELS', value: 0 }; n.textAutoResize = 'WIDTH_AND_HEIGHT'; n.fills = [paint(color, 'text')];
    if (styles[`${size}/${weight}`]) n.textStyleId = styles[`${size}/${weight}`];
    // The registered Text Style owns font properties so style edits can propagate.
    if (width) { n.resize(width, Math.max(1, n.height)); n.textAutoResize = 'HEIGHT'; }
    return n;
  }
  const masters = auto('booksdotnet / Masters — reusable definitions', 'VERTICAL', 1900);
  masters.x = Math.max(2200, ...page.children.filter(n => n !== masters).map(n => n.x + n.width + 200)); masters.y = 100; masters.paddingTop = masters.paddingBottom = masters.paddingLeft = masters.paddingRight = 32; masters.itemSpacing = 40;
  const gallery = auto('booksdotnet / Native Component Gallery', 'VERTICAL', 1800); gallery.x = 100; gallery.y = 100; gallery.fills = [paint('ground')]; gallery.paddingTop = gallery.paddingBottom = gallery.paddingLeft = gallery.paddingRight = 64; gallery.itemSpacing = 48;
  for (const [name, svg] of Object.entries(DATA.icons)) {
    const vector = track(figma.createNodeFromSvg(svg)); vector.name = name;
    const comp = track(figma.createComponentFromNode(vector)); comp.name = PREFIX + 'Icon/' + name; comp.description = `Lucide ${name}. Swap this instance through the Icon component property.`; masters.appendChild(comp); iconMasters[name] = comp;
  }
  function render(d) {
    if (d.kind === 'text') { const n = text(d.text, d.size || 12, d.weight || 400, d.color || 'ink', d.width); n.textAlignHorizontal = d.textAlign === 'right' ? 'RIGHT' : 'LEFT'; return n; }
    if (d.kind === 'icon') {
      const n = track(iconMasters[d.icon].createInstance()); n.name = 'Icon'; n.resize(d.size || 18, d.size || 18);
      for (const v of n.findAll(x => x.type === 'VECTOR')) { if (v.strokes.length) v.strokes = [paint(d.color || 'muted', 'text')]; if (v.fills.length) v.fills = [paint(d.color || 'muted', 'text')]; }
      return n;
    }
    if (d.kind === 'logo') {
      const n = track(figma.createFrame()); n.name = 'booksdotnet / Logo'; n.resize(d.width, d.height); n.fills = []; n.clipsContent = !!d.collapsed;
      const image = track(figma.createRectangle()); n.appendChild(image); image.name = 'Supplied booksdotnet brand asset'; image.resize(d.collapsed ? 246 : d.width, d.collapsed ? 56.31 : d.height); image.fills = [{ type: 'IMAGE', imageHash: logoHash, scaleMode: 'FIT' }]; if (d.collapsed) { image.x = -8; image.y = -6; } return n;
    }
    if (d.kind === 'circle') { const n = track(figma.createEllipse()); n.name = 'Indicator'; n.resize(d.width, d.height); n.fills = [paint(d.fill)]; return n; }
    if (d.kind === 'divider') { const n = track(figma.createRectangle()); n.name = 'Divider'; n.resize(d.width || 240, 1); n.fills = [paint('border')]; return n; }
    const horizontal = d.kind === 'row' || d.kind === 'button';
    const n = auto(d.kind === 'button' ? 'Button content' : horizontal ? 'Row' : 'Stack', horizontal ? 'HORIZONTAL' : 'VERTICAL', d.width);
    if (d.height) { n.resize(d.width || 1, d.height); n.primaryAxisSizingMode = horizontal ? 'AUTO' : 'FIXED'; if (horizontal) n.counterAxisSizingMode = 'FIXED'; }
    if (d.width) { n.resize(d.width, d.height || Math.max(1, n.height)); if (horizontal) n.primaryAxisSizingMode = 'FIXED'; else n.counterAxisSizingMode = 'FIXED'; }
    n.itemSpacing = d.gap || 0; bind(n, 'itemSpacing', 'space/' + (d.gap || 0));
    n.primaryAxisAlignItems = d.justify === 'between' ? 'SPACE_BETWEEN' : d.justify === 'end' ? 'MAX' : d.justify === 'center' ? 'CENTER' : 'MIN';
    n.counterAxisAlignItems = d.align === 'end' ? 'MAX' : d.align === 'center' || horizontal && !d.align ? 'CENTER' : 'MIN';
    const p = Array.isArray(d.padding) ? d.padding : [d.padding || 0, d.padding || 0];
    n.paddingTop = n.paddingBottom = p[0]; n.paddingLeft = n.paddingRight = p[1];
    for (const field of ['paddingTop', 'paddingBottom']) bind(n, field, 'space/' + p[0]);
    for (const field of ['paddingLeft', 'paddingRight']) bind(n, field, 'space/' + p[1]);
    n.cornerRadius = d.radius || 0; bind(n, 'cornerRadius', 'radius/' + (d.radius || 0));
    if (d.fill === 'gradient') n.fills = [{ type: 'GRADIENT_LINEAR', gradientTransform: [[1, 0, 0], [0, 1, 0]], gradientStops: [['gradientStart', 0], ['gradientBlue', .27], ['gradientPeach', .76], ['gradientEnd', 1]].map(([key, position]) => ({ position, color: { ...rgb(DATA.colors[key]), a: 1 }, boundVariables: { color: { type: 'VARIABLE_ALIAS', id: key === 'gradientStart' ? roleVariables['Color/Primary'].id : vars[key].id } } })) }];
    else if (d.fill) n.fills = [paint(d.fill)];
    if (d.stroke) { n.strokes = [paint(d.stroke, 'stroke')]; n.strokeWeight = 1; bind(n, 'strokeWeight', 'border/width'); }
    if (d.elevation) n.effectStyleId = effectStyles[d.effect || 'Effect/Overlay/Popover'];
    if (d.focus) n.effectStyleId = effectStyles['Effect/Focus/Ring'];
    n.opacity = d.opacity === undefined ? 1 : d.opacity;
    for (const child of d.children || []) n.appendChild(render(child));
    const growing = (d.children || []).map((child, i) => child.grow ? n.children[i] : null).filter(Boolean);
    if (horizontal && d.width && growing.length) {
      const fixed = n.children.filter(child => !growing.includes(child)).reduce((sum, child) => sum + child.width, 0);
      const available = Math.max(1, (d.width - p[1] * 2 - fixed - Math.max(0, n.children.length - 1) * n.itemSpacing) / growing.length);
      for (const child of growing) { if (child.type === 'TEXT') { child.resize(available, child.height); child.textAutoResize = 'HEIGHT'; } child.layoutGrow = 1; child.layoutSizingHorizontal = 'FILL'; }
    }
    return n;
  }
  const cover = auto('Design System & Components', 'VERTICAL', 1672); cover.paddingTop = cover.paddingBottom = cover.paddingLeft = cover.paddingRight = 48; cover.fills = [paint('surface')]; cover.cornerRadius = 12; cover.itemSpacing = 24; gallery.appendChild(cover);
  cover.appendChild(render({ kind: 'logo', width: 320, height: 74 })); cover.appendChild(text('Design System & Components', 48, 600)); cover.appendChild(text('booksdotnet · Poppins · #559CDA · Light theme', 16, 400, 'muted')); cover.appendChild(text(DATA.catalog.length + ' categories · ' + DATA.catalog.reduce((n,s)=>n+s.families.length,0) + ' component families · ' + DATA.catalog.reduce((n,s)=>n+s.families.reduce((a,f)=>a+f.variants.length,0),0) + ' reusable variant specimens', 12, 500, 'secondary'));
  const records = [];
  for (const [index, s] of DATA.catalog.entries()) {
    const section = auto(String(index + 1).padStart(2, '0') + ' / ' + s.title, 'VERTICAL', 1672); section.itemSpacing = 24; gallery.appendChild(section);
    section.appendChild(text(String(index + 1).padStart(2, '0') + ' / ' + s.title, 27, 600)); section.appendChild(text(s.note, 12, 400, 'muted', 1450));
    for (const f of s.families) {
      const existingSet = page.findOne(n => (n.type === 'COMPONENT_SET' || n.type === 'COMPONENT') && n.name === PREFIX + f.name);
      const built = [];
      if (!existingSet) for (const v of f.variants) { const frame = render(v.tree); const comp = track(figma.createComponentFromNode(frame)); comp.name = Object.entries(v.props).map(([key, value]) => `${key}=${value}`).join(', '); comp.description = `${f.name}. ${Object.entries(v.props).map(([k, v]) => `${k}: ${v}`).join('; ')}. Source: src/design-system/catalog.js`; built.push({ comp, v }); }
      let set = existingSet;
      if (!set) { set = built.length > 1 ? track(figma.combineAsVariants(built.map(r => r.comp), page)) : built[0].comp; set.name = PREFIX + f.name; set.description = `${f.name}. Reusable native Figma definitions matching the booksdotnet React catalog. Labels and icons are overridable where exposed.`; masters.appendChild(set);
        if (set.type === 'COMPONENT_SET') { let x = 24, y = 24, rowHeight = 0; for (const { comp } of built) { if (x + comp.width > 1800) { x = 24; y += rowHeight + 24; rowHeight = 0; } comp.x = x; comp.y = y; x += comp.width + 24; rowHeight = Math.max(rowHeight, comp.height); } set.resize(1848, y + rowHeight + 24); }
        if (/^(Button|Input|Card|Navigation \/ Sidebar item)/.test(f.name)) {
          const firstText = built[0].comp.findOne(n => n.type === 'TEXT');
          if (firstText) { const prop = set.addComponentProperty('Label', 'TEXT', firstText.characters); for (const r of built) { const label = r.comp.findOne(n => n.type === 'TEXT'); if (label) label.componentPropertyReferences = { ...label.componentPropertyReferences, characters: prop }; } }
        }
        if (f.name.startsWith('Button /')) { const firstIcon = built[0].comp.findOne(n => n.type === 'INSTANCE'); if (firstIcon) { const show = set.addComponentProperty('Show icon', 'BOOLEAN', true), swap = set.addComponentProperty('Icon', 'INSTANCE_SWAP', firstIcon.mainComponent.id); for (const r of built) { const icon = r.comp.findOne(n => n.type === 'INSTANCE'); if (icon) icon.componentPropertyReferences = { ...icon.componentPropertyReferences, visible: show, mainComponent: swap }; } } }
      }
      const variants = built.length ? built : f.variants.map((v, i) => ({ comp: set.type === 'COMPONENT_SET' ? set.children[i] : set, v }));
      for (const { comp, v } of variants) {
        const State = v.props.State; if (!State || ['Disabled', 'Loading', 'Read-only'].includes(State)) continue;
        const same = target => variants.find(r => r.v.props.State === target && Object.entries(v.props).every(([k, value]) => k === 'State' || r.v.props[k] === value));
        const links = [];
        const add = (type, target) => { const other = same(target); if (other && other.comp.id !== comp.id) links.push({ trigger: ['MOUSE_ENTER', 'MOUSE_LEAVE'].includes(type) ? { type, delay: 0, deprecatedVersion: false } : ['MOUSE_DOWN', 'MOUSE_UP'].includes(type) ? { type, delay: 0 } : { type }, actions: [{ type: 'NODE', destinationId: other.comp.id, navigation: 'CHANGE_TO', transition: { type: 'DISSOLVE', duration: .15, easing: { type: 'EASE_OUT' } } }] }); };
        if (State === 'Default') { add('MOUSE_ENTER', 'Hover'); add('MOUSE_DOWN', 'Pressed'); const click = ['Selected', 'Open', 'Focused', 'Focus', 'Expanded'].find(x => same(x)); if (click) add('ON_CLICK', click); }
        if (State === 'Hover') { add('MOUSE_LEAVE', 'Default'); add('MOUSE_DOWN', 'Pressed'); add('ON_CLICK', 'Selected'); }
        if (State === 'Pressed') add('MOUSE_UP', 'Default');
        const target = { Closed: 'Open', Open: 'Closed', Inactive: 'Active', Active: 'Inactive', Collapsed: 'Expanded', Expanded: 'Collapsed', Selected: 'Default', Checked: 'Default', Focused: 'Default', Focus: 'Filled', Error: 'Focus' }[State]; if (target) add('ON_CLICK', target);
        if (links.length) await comp.setReactionsAsync(links);
      }
      const familyFrame = auto(f.name, 'VERTICAL', 1672); familyFrame.fills = [paint('surface')]; familyFrame.paddingTop = familyFrame.paddingBottom = familyFrame.paddingLeft = familyFrame.paddingRight = 28; familyFrame.cornerRadius = 10; familyFrame.itemSpacing = 20; section.appendChild(familyFrame); familyFrame.appendChild(text(f.name, 13, 500, 'muted'));
      let line = auto('Variants', 'HORIZONTAL'); line.itemSpacing = 20; line.counterAxisAlignItems = 'MIN'; familyFrame.appendChild(line); let used = 0;
      for (const { comp, v } of variants) {
        const width = Math.max(180, comp.width + 36); if (used && used + width > 1616) { line = auto('Variants', 'HORIZONTAL'); line.itemSpacing = 20; line.counterAxisAlignItems = 'MIN'; familyFrame.appendChild(line); used = 0; }
        const tile = auto(f.name + ' / ' + Object.values(v.props).join(' / '), 'VERTICAL', width); tile.itemSpacing = 16; tile.paddingTop = tile.paddingBottom = tile.paddingLeft = tile.paddingRight = 18; tile.strokes = [paint('border')]; tile.cornerRadius = 8; line.appendChild(tile); tile.appendChild(text(Object.entries(v.props).map(([k, v]) => `${k}: ${v}`).join(' · '), 10, 400, 'muted', width - 36)); const instance = track(comp.createInstance()); tile.appendChild(instance); used += width + 20; records.push({ family: f.name, props: v.props, componentId: comp.id, instanceId: instance.id });
      }
      result.families.push({ name: f.name, id: set.id, variants: variants.length });
    }
  }
  result.variants = records.length; result.pageId = page.id; result.galleryId = gallery.id; result.variables = result.createdVariableIds.length; result.styles = result.createdStyleIds.length;
  result.warnings.push('Existing screens were deliberately left intact. Instance replacement needs a visual audit and explicit node matching; no automatic matching was performed.');
  result.warnings.push('Modal menus and input focus are represented as component states. Figma does not execute React input validation or application logic.');
  figma.currentPage.selection = [gallery]; figma.viewport.scrollAndZoomIntoView([cover]);
  figma.showUI('<html><body style="font:13px system-ui;padding:20px"><h2>Native booksdotnet library built</h2><p>One page. ' + records.length + ' component specimens and linked gallery instances.</p><p>Existing screens modified: 0. Review warnings before integrating.</p><textarea style="width:100%;height:220px">' + JSON.stringify(result, null, 2).replaceAll('&', '&amp;').replaceAll('<', '&lt;') + '</textarea></body></html>', { width: 520, height: 410 });
}
buildLibrary().catch(error => { figma.showUI('<body style="font:13px system-ui;padding:20px"><h2>Library build stopped</h2><p>No existing screen was deleted or replaced. A partially built library may remain; inspect before retrying.</p><pre>' + String(error.message).replaceAll('&', '&amp;').replaceAll('<', '&lt;') + '</pre></body>', { width: 520, height: 280 }); });
