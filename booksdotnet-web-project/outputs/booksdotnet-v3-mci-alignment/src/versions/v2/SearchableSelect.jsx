import { Children, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

export function selectOptions(children) {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement(child)) return [];
    if (child.type !== 'option') return selectOptions(child.props.children);
    const text = Children.toArray(child.props.children).join('');
    return [{ value: String(child.props.value ?? text), label: text, disabled: Boolean(child.props.disabled) }];
  });
}

// Keep a native select for form validity and dirty snapshots; the visible control is shared by V2 only.
export default function SearchableSelect({ children, value = '', onChange, disabled, required, name, className = '', placeholder, searchPlaceholder, 'aria-label': label, ...props }) {
  const id = useId(), button = useRef(null), menu = useRef(null), search = useRef(null);
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [active, setActive] = useState(0), [invalid, setInvalid] = useState(false), [host, setHost] = useState(null), [position, setPosition] = useState({});
  const options = selectOptions(children), selected = options.find(o => o.value === String(value)), matches = options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()));
  const fieldName = label || 'option', enabled = () => button.current && !button.current.matches(':disabled');
  function close(restore = false) { setOpen(false); if (restore) button.current?.focus(); }
  function show() { if (!enabled()) return; setQuery(''); setActive(Math.max(0, options.findIndex(o => o.value === String(value)))); setHost(button.current.closest('dialog') || document.body); setOpen(true); }
  function choose(option) { if (!enabled() || option.disabled) return; setInvalid(false); onChange?.({ target: { value: option.value }, currentTarget: { value: option.value } }); close(true); }
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => { const r = button.current.getBoundingClientRect(), gap = 6, below = innerHeight - r.bottom - gap - 12, above = r.top - gap - 12, up = below < 240 && above > below, height = Math.max(80, Math.min(320, up ? above : below)), width = Math.min(Math.max(r.width, 240), innerWidth - 24); setPosition({ left: Math.max(12, Math.min(r.left, innerWidth - width - 12)), width, maxHeight: height, ...(up ? { bottom: innerHeight - r.top + gap } : { top: r.bottom + gap }) }); };
    place(); menu.current?.showPopover?.(); search.current?.focus({ preventScroll: true });
    const outside = e => { if (!menu.current?.contains(e.target) && !button.current?.contains(e.target)) close(); };
    const scroll = e => { if (!menu.current?.contains(e.target)) close(); };
    document.addEventListener('pointerdown', outside); document.addEventListener('focusin', outside); document.addEventListener('scroll', scroll, true); window.addEventListener('resize', place);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('focusin', outside); document.removeEventListener('scroll', scroll, true); window.removeEventListener('resize', place); };
  }, [open]);
  useEffect(() => { menu.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }); }, [open, position, active, query]);
  useEffect(() => { if (disabled) close(); }, [disabled]);
  function keys(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
    else if (e.key === 'Tab') close(true);
    else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) { e.preventDefault(); setActive(n => e.key === 'Home' ? 0 : e.key === 'End' ? Math.max(0, matches.length - 1) : Math.max(0, Math.min(matches.length - 1, n + (e.key === 'ArrowDown' ? 1 : -1)))); }
    else if (e.key === 'Enter') { e.preventDefault(); if (matches[active]) choose(matches[active]); }
  }
  return <div className={`v2-search-select ${className}`}>
    <select {...props} hidden aria-hidden="true" tabIndex={-1} className="v2-lookup-native" name={name} value={value} disabled={disabled} required={required} onChange={onChange} onClick={e=>{e.preventDefault();show();}} onFocus={() => button.current?.focus()} onInvalid={e => { e.preventDefault(); setInvalid(true); button.current?.scrollIntoView({block:'center'}); show(); }}>{children}</select>
    <button ref={button} type="button" role="combobox" className={`v2-lookup-trigger ${!value ? 'is-placeholder' : ''}`} aria-label={label} aria-expanded={open} aria-controls={`${id}-options`} aria-haspopup="listbox" aria-required={required || undefined} aria-invalid={invalid || undefined} disabled={disabled} onClick={() => open ? close(true) : show()} onKeyDown={e => { if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show(); } }}><span>{selected?.label || placeholder || `Select ${fieldName.toLowerCase()}`}</span><ChevronDown size={16} aria-hidden="true" className={open ? 'is-open' : ''}/></button>
    {open && host && createPortal(<div ref={menu} popover="manual" className="v2-lookup-menu" style={position} onKeyDown={keys}><div className="v2-lookup-search"><Search size={16} aria-hidden="true"/><input ref={search} type="search" aria-label={`Search ${fieldName}`} placeholder={searchPlaceholder || `Search ${fieldName.toLowerCase()}…`} value={query} onChange={e => { setQuery(e.target.value); setActive(0); }} aria-controls={`${id}-options`} aria-activedescendant={matches[active] ? `${id}-option-${active}` : undefined}/></div><div role="listbox" id={`${id}-options`} aria-label={`${fieldName} options`} className="v2-lookup-options">{matches.map((o, index) => <button type="button" role="option" tabIndex={-1} key={o.value} id={`${id}-option-${index}`} aria-selected={o.value === String(value)} disabled={o.disabled} data-active={active === index} onPointerMove={() => setActive(index)} onMouseDown={e => e.preventDefault()} onClick={() => choose(o)}><span>{o.label}</span>{o.value === String(value) && <Check size={16} aria-hidden="true"/>}</button>)}{!matches.length && <p role="status">No matching options</p>}</div></div>, host)}
  </div>;
}
