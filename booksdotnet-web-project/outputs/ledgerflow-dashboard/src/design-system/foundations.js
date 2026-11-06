// Native-registration plan. These definitions are not registered in Figma until the builder runs.
export const colorRoles = [
  ['Color/Primary', 'primary', 'fill'], ['Color/Secondary', 'secondary', 'fill'],
  ['Color/Text/Primary', 'ink', 'text'], ['Color/Text/Secondary', 'muted', 'text'],
  ['Color/Text/Muted', 'faint', 'text'], ['Color/Text/Disabled', 'faint', 'text'], ['Color/Text/Inverse', 'surface', 'text'],
  ['Color/Background/Canvas', 'ground', 'fill'], ['Color/Background/Surface', 'surface', 'fill'], ['Color/Background/Disabled', 'disabled', 'fill'],
  ['Color/Border/Default', 'border', 'stroke'], ['Color/Border/Outline', 'muted', 'stroke'], ['Color/Divider/Default', 'border', 'fill'],
  ['Color/Semantic/Success', 'success', 'all'], ['Color/Semantic/SuccessSurface', 'successSoft', 'fill'],
  ['Color/Semantic/Warning', 'warning', 'all'], ['Color/Semantic/WarningSurface', 'warningSoft', 'fill'],
  ['Color/Semantic/Error', 'danger', 'all'], ['Color/Semantic/ErrorSurface', 'dangerSoft', 'fill'],
  ['Color/Semantic/Information', 'info', 'all'], ['Color/Semantic/InformationSurface', 'infoSoft', 'fill'],
  ['Color/Interactive/Hover', 'primaryHover', 'fill'], ['Color/Interactive/Pressed', 'primaryPressed', 'fill'],
  ['Color/Interactive/Selected', 'infoSoft', 'fill'], ['Color/Interactive/Focus', 'focus', 'all'],
].map(([name, token, usage]) => ({ name, token, usage }));

export const textRoles = [
  ['Text/Display', 48, 600, 60, -1.6],
  ['Text/Heading/H1', 23, 600, 28.75, -.7], ['Text/Page heading', 23, 600, 28.75, -.7],
  ['Text/Heading/H2', 19, 600, 28.5, -.45], ['Text/Heading/H3', 16, 600, 24, -.25],
  ['Text/Heading/H4', 15, 600, 22.5, -.25], ['Text/Heading/H5', 14, 600, 21, -.2], ['Text/Heading/H6', 13, 600, 19.5, -.15],
  ['Text/Body/Large', 16, 400, 24, 0], ['Text/Body/Medium', 14, 400, 21, 0], ['Text/Body/Small', 12, 400, 18, 0],
  ['Text/Label/Medium', 12, 500, 18, 0], ['Text/Label/Large', 14, 500, 21, 0], ['Text/Caption', 11, 400, 16.5, 0],
  ['Text/Button/Small', 12, 500, 18, 0], ['Text/Button/Medium', 12, 500, 18, 0], ['Text/Button/Large', 14, 500, 21, 0],
  ['Text/Table/Header', 11, 500, 16.5, 0], ['Text/Table/Cell', 12, 400, 18, 0], ['Text/Table/Amount', 12, 500, 18, 0],
  ['Text/Helper', 11, 400, 16.5, 0], ['Text/Validation', 11, 400, 16.5, 0],
  ['Text/Dialog/Title', 17, 600, 25.5, -.35], ['Text/Metric', 27, 600, 40.5, -.9],
].map(([name, size, weight, lineHeight, letterSpacing]) => ({ name, family: 'Poppins', size, weight, lineHeight, letterSpacing }));

export const textSignature = s => JSON.stringify([s.family, s.size, s.weight, s.lineHeight, s.letterSpacing]);
export function canonicalTextRoles() {
  const canonical = [], bySignature = new Map(), aliases = {};
  for (const role of textRoles) {
    const signature = textSignature(role);
    if (!bySignature.has(signature)) { canonical.push(role); bySignature.set(signature, role.name); }
    aliases[role.name] = bySignature.get(signature);
  }
  return { canonical, aliases };
}
export const effectRoles = [
  { name: 'Effect/Overlay/Popover', uses: ['Dropdown', 'Popover', 'Action menu'], shadows: [{ x: 0, y: 12, blur: 40, spread: 0, alpha: 20 / 255 }, { x: 0, y: 2, blur: 8, spread: 0, alpha: 5 / 255 }] },
  { name: 'Effect/Overlay/Modal', uses: ['Modal', 'Dialog'], shadows: [{ x: 0, y: 20, blur: 80, spread: 0, alpha: 43 / 255 }] },
  { name: 'Effect/Focus/Ring', uses: ['Focused controls'], color: 'focus', shadows: [{ x: 0, y: 0, blur: 0, spread: 3, alpha: 1 }] },
];
