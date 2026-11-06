export const colors = {
  primary: '#559CDA', primaryHover: '#75B0E2', primaryPressed: '#3D83BE', secondary: '#2D638F',
  ink: '#0F172A', muted: '#64748B', faint: '#94A3B8', border: '#E2E8F0', ground: '#F8FAFC', surface: '#FFFFFF',
  success: '#237348', successSoft: '#EDF8F1', warning: '#80520D', warningSoft: '#FFF7E9', danger: '#DC2626', dangerSoft: '#FEF0F0',
  info: '#245BA9', infoSoft: '#EFF5FD', focus: '#93B4FB', disabled: '#F1F5F9',
  gradientStart: '#559CDA', gradientBlue: '#7BADFF', gradientPeach: '#FFB58D', gradientEnd: '#ED8028',
};
export const gradient = 'linear-gradient(100deg,#559CDA 0%,#7BADFF 27%,#FFB58D 76%,#ED8028 100%)';
export const spacing = [0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64];
export const radii = [0, 4, 7, 8, 10, 12, 999];
export const typeScale = [11, 12, 13, 14, 16, 19, 23, 27, 32];
export const dimensions = { buttonSmall: 30, buttonMedium: 36, buttonLarge: 44, field: 40, tableRow: 54, sidebar: 256, sidebarCollapsed: 72, iconSmall: 14, iconMedium: 18, iconLarge: 24 };
export const buttonAppearance = (variant, state) => {
  const primary = variant === 'Primary', destructive = variant === 'Destructive';
  return { fill: primary ? (state === 'Hover' ? 'primaryHover' : state === 'Pressed' ? 'primaryPressed' : 'primary') : destructive ? 'danger' : state === 'Hover' || state === 'Pressed' ? 'disabled' : variant === 'Secondary' ? 'disabled' : 'surface',
    color: primary || destructive ? 'surface' : variant === 'Outline' ? 'muted' : variant === 'Tertiary' || variant === 'Ghost' ? 'secondary' : 'ink',
    stroke: variant === 'Outline' ? 'muted' : primary || destructive || variant === 'Ghost' || variant === 'Tertiary' ? null : 'border' };
};
