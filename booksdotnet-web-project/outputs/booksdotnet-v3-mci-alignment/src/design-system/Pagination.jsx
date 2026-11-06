import { ChevronLeft, ChevronRight } from 'lucide-react';
import { paginationItems } from './pagination.js';

export function Pagination({ page, pageCount, onPageChange, empty = false, label = 'Pagination' }) {
  const total = Math.max(1, pageCount), current = Math.max(1, Math.min(page, total));
  return <nav className="numbered-pagination" aria-label={label}>
    <button type="button" className="pagination-step" aria-label="Previous page" disabled={empty || current === 1} onClick={() => onPageChange(current - 1)}><ChevronLeft size={16} aria-hidden="true"/></button>
    {paginationItems(current, empty ? 0 : total).map((item, i) => item === '…' ? <span className="pagination-ellipsis" key={`gap-${i}`} aria-hidden="true">…</span> : <button type="button" key={item} className="pagination-number" aria-label={`Page ${item}`} aria-current={item === current ? 'page' : undefined} onClick={() => onPageChange(item)}>{item}</button>)}
    <button type="button" className="pagination-step" aria-label="Next page" disabled={empty || current === total} onClick={() => onPageChange(current + 1)}><ChevronRight size={16} aria-hidden="true"/></button>
  </nav>;
}
