import { useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal, RefreshCw, FilterX, Download } from 'lucide-react';
import { Button } from '../../design-system/Button.jsx';
export default function ListingActions({hasFilters,canExport,onRefresh,onClear,onExport}){
 const [open,setOpen]=useState(false),trigger=useRef(null),menu=useRef(null),id=useId();
 useEffect(()=>{if(open)menu.current?.querySelector('button:not(:disabled)')?.focus();},[open]);
 useEffect(()=>{if(!open)return;const outside=e=>{if(!menu.current?.contains(e.target)&&!trigger.current?.contains(e.target))setOpen(false);};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[open]);
 const close=()=>{setOpen(false);trigger.current?.focus();};
 const choose=action=>{close();action();};
 return <div className="v3-listing-more"><Button ref={trigger} type="button" aria-label="More" title="More" aria-haspopup="menu" aria-expanded={open} aria-controls={open?id:undefined} onClick={()=>setOpen(!open)} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);}}}><MoreHorizontal size={18}/></Button>{open&&<div ref={menu} id={id} className="v3-source-menu" role="menu" aria-label="Listing actions" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();close();}else if(e.key==='Tab')setOpen(false);else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const items=[...menu.current.querySelectorAll('button:not(:disabled)')],index=items.indexOf(document.activeElement);items[e.key==='Home'?0:e.key==='End'?items.length-1:(index+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}}}><button type="button" role="menuitem" onClick={()=>choose(onRefresh)}><RefreshCw size={16}/>Refresh List</button><button type="button" role="menuitem" disabled={!hasFilters} onClick={()=>choose(onClear)}><FilterX size={16}/>Clear Filters</button><div className="menu-rule" role="separator"/><button type="button" role="menuitem" disabled={!canExport} onClick={()=>choose(onExport)}><Download size={16}/>Export CSV</button></div>}</div>;
}
