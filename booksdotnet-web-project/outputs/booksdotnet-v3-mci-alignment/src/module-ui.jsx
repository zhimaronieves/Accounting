import { accountTreeGroups } from './account-hierarchy.js';
import { V2_PAGE_DESCRIPTIONS } from './versions/v2/page-descriptions.js';
import { useListState } from './versions/v2/RecordPage.jsx';
import { useContext, useRef } from 'react';
import { PageContext, usePageAccess } from './versions/v2/AccessContext.jsx';
import { Button } from './design-system/Button.jsx';
import { useEffect, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { Pagination } from './design-system/Pagination.jsx';
import { money } from './data.js';

export const peso = value => money(value / 100, 2);
export const signedPeso = value => value < 0 ? `−${peso(-value)}` : peso(value);
export function exportCSV(filename, headers, rows) {
  const cell = value => { let text = String(value ?? ''); if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`; };
  const blob = new Blob(['\uFEFF', [headers, ...rows].map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Heading({ title, description, children, hideDateControl=false }) { const page = useContext(PageContext), Title = page ? 'h1' : 'h2', subtitle = page?.records && title !== 'Access unavailable' ? V2_PAGE_DESCRIPTIONS[page.title] ?? description : description; return <div className="module-heading"><div><Title>{page?.title || title}</Title>{subtitle && <p>{subtitle}</p>}</div><div className="module-actions">{!hideDateControl&&page?.dateControl}{children}</div></div>; }
export function Stats({ items }) { const page = useContext(PageContext); return <div className="module-stats" data-stat-count={page ? items.length : undefined} style={page ? { '--stat-count': items.length } : undefined}>{items.map(i => <div key={i.label}><span>{i.label}</span><strong className={i.alert ? 'danger' : ''}>{i.value}</strong>{i.note && <small>{i.note}</small>}</div>)}</div>; }
export function Badge({ value }) { return <span className={`document-badge badge-${value.toLowerCase()}`}>{value}</span>; }
export function ErrorText({ error }) { return error ? <p className="form-error" role="alert">{error}</p> : null; }
export function useFormAction(commit, onDone) {
  const [error, setError] = useState('');
  function submit(build) { try { const result = commit(build()); if (!result.ok) throw new Error(result.error); onDone(); } catch (e) { setError(e.message); } }
  return { error, submit };
}
export function DataTable({ title, columns, rows, searchLabel = 'Search records', filters, filename = 'ledgerflow-records.csv', exportRows, onRowClick, columnFilters, emptyLabel, filterKey, hideToolbar=false, standalone=false, hierarchy }) {
  const allowed = usePageAccess(), context = useContext(PageContext);
  const [query, setQuery] = useListState(`table:${title}:query`, ''), [page, setPage] = useListState(`table:${title}:page`, 1), [sort, setSort] = useListState(`table:${title}:sort`, { key: '', direction: 1 });
  const isStatus = c => c.key==='status' || c.key==='active' || c.label==='Status';
  const listingColumns = context?.records ? columns.filter(c=>!/^actions?$/i.test(c.label||c.key)) : columns;
  const displayColumns = context?.records ? [...listingColumns.filter(c=>!isStatus(c)),...listingColumns.filter(isStatus)] : listingColumns;
  const previous = useRef({ length: rows.length, query, filterKey });
  useEffect(() => { if (!context || previous.current.query !== query || previous.current.filterKey !== filterKey) setPage(1); previous.current = { length: rows.length, query, filterKey }; }, [rows.length, query, filterKey]);
  const filtered = hideToolbar?rows:rows.filter(row => (!hierarchy||hierarchy.filter(row)) && (row.search || Object.values(row).filter(v => typeof v !== 'object').join(' ')).toLowerCase().includes(query.toLowerCase()));
  const sorted = sort.key ? [...filtered].sort((a,b) => { const av=a[sort.key] ?? '', bv=b[sort.key] ?? ''; return sort.direction * (typeof av === 'number' || typeof av === 'boolean' ? Number(av)-Number(bv) : String(av).localeCompare(String(bv), undefined, {numeric:true})); }) : filtered;
  const branches=hierarchy?accountTreeGroups(rows,{query,sort,...hierarchy}):null,count=branches?branches.length:filtered.length;
  const pages = Math.max(1, Math.ceil(count / 10)), current = Math.min(page, pages), visible = branches?branches.slice((current-1)*10,current*10).flatMap(b=>b.visible):sorted.slice((current - 1) * 10, current * 10);
  return <section className={standalone?'module-table v3-standalone-table':'panel module-table'}>{!hideToolbar&&<div className="module-table-tools"><label className="search-input"><Search size={16}/><input aria-label={searchLabel} placeholder={`${searchLabel}…`} value={query} onChange={e => setQuery(e.target.value)}/></label><div className="module-actions">{filters}{exportRows && allowed('export') && <Button className="button" onClick={() => exportCSV(filename, columns.filter(c => c.key !== 'actions').map(c => c.label), filtered.map(exportRows))}><Download size={14}/>Export CSV</Button>}</div></div>}<div className="table-scroll" tabIndex={context ? 0 : undefined} role={context ? 'region' : undefined} aria-label={context ? `${title} records, scroll to view more` : undefined}><table aria-label={title}>{columnFilters&&<colgroup>{displayColumns.map(c=><col key={c.key} style={{width:c.width}}/>)}</colgroup>}<thead><tr>{displayColumns.map(c => <th scope="col" key={c.key} className={c.numeric ? 'amount-cell' : isStatus(c) && onRowClick ? 'v2-status-column' : ''} aria-sort={c.sortable ? sort.key === c.key ? sort.direction === 1 ? 'ascending' : 'descending' : 'none' : undefined}>{c.sortable ? <button type="button" className="v2-sort-heading" title={c.description} onClick={() => setSort({ key:c.key, direction:sort.key===c.key ? -sort.direction : 1 })}>{c.label}<span aria-hidden="true">{sort.key===c.key ? sort.direction===1 ? '↑' : '↓' : '↕'}</span></button> : c.label}</th>)}</tr>{columnFilters&&<tr className="v3-column-filters">{displayColumns.map(c=><td key={c.key}>{columnFilters(c)}</td>)}</tr>}</thead><tbody>{visible.map((row, index) => <tr key={row.id || index} className={`${onRowClick?'v2-clickable-row':''} ${row.__group?'v3-parent-account':''} ${row.__context?'v3-hierarchy-context':''}`} tabIndex={onRowClick ? 0 : undefined} aria-label={onRowClick ? `Open ${row.name || row.code || row.id || row.entryId}` : undefined} onClick={onRowClick ? e => { if (e.target.closest('button,a,input,select,textarea,[contenteditable],[role=button],[role=link],[role=checkbox]') || window.getSelection()?.toString()) return; onRowClick(row); } : undefined} onKeyDown={onRowClick ? e => { if (e.target === e.currentTarget && ['Enter',' '].includes(e.key)) { e.preventDefault(); onRowClick(row); } } : undefined}>{displayColumns.map(c => <td key={c.key} className={c.numeric ? 'amount-cell' : c.key === 'actions' ? 'row-actions-cell' : isStatus(c) && onRowClick ? 'v2-status-column' : ''}>{c.render ? c.render(row) : row[c.key]}</td>)}</tr>)}</tbody></table>{!visible.length && <div className="table-empty"><Search size={23}/><strong>{emptyLabel||'No matching records'}</strong><span>Try another search, filter, or date range.</span></div>}</div><div className="table-footer"><span aria-live="polite">{count ? `${standalone?'Showing ':''}${(current - 1) * 10 + 1}–${Math.min(current * 10, count)} of ${count} ${hierarchy?'top-level accounts':'records'}` : '0 records'}</span><Pagination page={current} pageCount={pages} onPageChange={setPage} empty={!count} label={`${title} pages`}/></div></section>;
}

