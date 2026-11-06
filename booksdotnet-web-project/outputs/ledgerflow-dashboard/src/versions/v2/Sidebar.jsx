import { canPage } from './permissions.js';
import { useEffect, useState } from 'react';
import { SlidersHorizontal, FolderOpen, LayoutDashboard, ArrowDownLeft, ArrowUpRight, BookOpen, Landmark, FileBarChart2, Settings, Building2, ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react';
import { v2Groups } from '../navigation.js';
const icons = { SlidersHorizontal, FolderOpen, LayoutDashboard, ArrowDownLeft, ArrowUpRight, BookOpen, Landmark, FileBarChart2, Settings };
export default function V2Sidebar({ collapsed, toggle, active, onNavigate, onHelp, mobile, mobileOpen, user }) {
  const parent = v2Groups.find(g => g.pages.includes(active))?.name || 'Dashboard';
  const [expanded, setExpanded] = useState(parent);
  useEffect(() => setExpanded(parent), [parent]);
  return <aside className={`sidebar v2-sidebar ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Main navigation V2">
    <div className="v2-sidebar-header"><div className={`brand ${collapsed ? 'brand-icon' : ''}`}><img src="/booksdotnet-logo.png" alt="booksdotnet — Financial & Accounting System"/></div><button className="v2-sidebar-toggle" onClick={toggle} aria-label={mobile ? mobileOpen ? 'Close navigation' : 'Open navigation' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={mobile ? mobileOpen : !collapsed}><span aria-hidden="true">{(mobile ? !mobileOpen : collapsed) ? <ChevronRight size={15}/> : <ChevronLeft size={15}/>}</span><span className="v2-toggle-tooltip" role="tooltip">{mobile ? mobileOpen ? 'Close navigation' : 'Open navigation' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span></button></div>
    {!collapsed && <div className="workspace"><span className="workspace-avatar"><Building2 size={17}/></span><div><strong>booksdotnet</strong><span>Company accounts</span></div></div>}
    <div className="nav-label">{!collapsed && 'Workspace'}</div><nav className="v2-menu-scroll">{v2Groups.map(g => ({ ...g, pages: g.pages.filter(p => !user || canPage(user, p)) })).filter(g => g.pages.length).map(g => { const Icon = icons[g.icon], selected = parent === g.name, open = expanded === g.name, nested = g.name !== 'Dashboard'; return <div key={g.name}><button className={`nav-item group ${selected ? 'active' : ''}`} aria-label={g.name} aria-current={!nested && selected ? 'page' : undefined} aria-expanded={nested ? open && !collapsed : undefined} onClick={() => { if (collapsed && nested) { toggle(); setExpanded(g.name); } else if (nested) setExpanded(open ? '' : g.name); else onNavigate(g.pages[0]); }}><Icon size={19} strokeWidth={1.7}/>{!collapsed && <><span>{g.name}</span>{nested && (open ? <ChevronDown className="v2-menu-chevron" size={14}/> : <ChevronRight className="v2-menu-chevron" size={14}/>)}</>}{collapsed && <span className="nav-tooltip">{g.name}</span>}</button>{nested && open && !collapsed && <div className="v2-submenu">{g.pages.map(page => <button className={active === page ? 'selected' : ''} aria-current={active === page ? 'page' : undefined} key={page} onClick={() => onNavigate(page)}>{page.replace(/^(AR|AP) /, '')}</button>)}</div>}</div>; })}</nav>

  </aside>;
}

