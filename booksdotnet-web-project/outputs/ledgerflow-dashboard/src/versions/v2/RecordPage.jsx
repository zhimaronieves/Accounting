import { Children, cloneElement, createContext, isValidElement, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { Modal } from '../../Modal.jsx';
import { Button } from '../../design-system/Button.jsx';
import { PageContext } from './AccessContext.jsx';
export const RecordNavigation = createContext(null);
const RecordContext = createContext(null);
export function readRecordIntent(page, search = window.location.search) {
  const q = new URLSearchParams(search), mode = q.get('mode'), id = q.get('record'); if (!mode) return null;
  const key = ['Customer Invoices', 'Supplier Bills'].includes(page) ? 'documentId' : page.includes('Credit') ? 'noteId' : page.includes('Payments') ? 'paymentId' : page==='Users & Permissions' ? 'userId' : ['Journal Entries', 'Bank Transactions', 'General Ledger'].includes(page) ? 'entryId' : 'recordId';
  return { mode, ...(q.get('tab') ? {tab:q.get('tab')} : {}), ...(mode === 'create' ? { create: true } : { [key]: id }), ...(q.get('noteType') ? { noteType: q.get('noteType') } : {}), ...(q.get('source') ? { documentId:q.get('source') } : {}) };
}
export function useListState(key, initial) {
  const page = useContext(PageContext), store = page?.listState;
  const [value, set] = useState(() => store?.current[key] ?? initial);
  const update = next => set(old => { const result = typeof next === 'function' ? next(old) : next; if (store) store.current[key] = result; return result; });
  return [value, update];
}
function fields(form) { return JSON.stringify(Array.from(form?.querySelectorAll('input:not([type="search"]),select,textarea') || []).map(e => [e.getAttribute('aria-label') || e.name || e.type, ['checkbox', 'radio'].includes(e.type) ? e.checked : e.type === 'number' && e.value !== '' ? Number(e.value) : e.value])); }
function withForm(children, formId) { return Children.map(children, child => !isValidElement(child) ? child : cloneElement(child, { ...(child.type === 'button' || child.type === Button ? { form: formId } : {}), ...(child.props.children ? { children: withForm(child.props.children, formId) } : {}) })); }
export const useRecordDirty=()=>useContext(RecordContext)?.dirty||false;
export function RecordActions({ children }) {
  const record = useContext(RecordContext);
  const content = <div className="modal-footer" onClickCapture={e => { const button = e.target.closest('button'); if (record && button && /^(Cancel|Close)$/.test(button.textContent.trim())) { e.preventDefault(); e.stopPropagation(); record.close(); } }}>{withForm(children, record?.formId)}</div>;
  return record?.host ? createPortal(content, record.host) : content;
}
export function RecordPage({ title, children, onClose, recordId, mode: explicitMode, dirty, actions, noteType, sourceId, tabKey, status, statusInline=false, readOnlyMessage }) {
  const nav = useContext(RecordNavigation), page = useContext(PageContext), ref = useRef(null), baseline = useRef(null), currentDirty = useRef(dirty), allowPost = useRef(false), submitter = useRef(null);
  const [formDirty,setFormDirty]=useState(false);
  const [host, setHost] = useState(null), [confirmPost, setConfirmPost] = useState(false);
  const formId = useId(), mode = explicitMode || (/^Edit/i.test(title) ? 'edit' : /^(New|Create|Record|Prepare)/i.test(title) ? 'create' : 'view');
  currentDirty.current = dirty;
  const isDirty = () => currentDirty.current !== undefined ? currentDirty.current : baseline.current !== null && fields(ref.current?.querySelector('form')) !== baseline.current;
  const close = () => nav ? nav.leave(onClose) : onClose();
  useEffect(() => {
    baseline.current = fields(ref.current?.querySelector('form'));
    if (nav) { nav.guard.current = isDirty; nav.close.current = onClose; }
    const previous = window.location.pathname, previousTitle = document.title, q = new URLSearchParams({ ...(tabKey ? {tab:tabKey} : {}), mode, ...(recordId ? { record: recordId } : {}), ...(noteType ? {noteType} : {}), ...(sourceId ? {source:sourceId} : {}) });
    document.title = `${title} — booksdotnet`; ref.current?.querySelector('h1')?.focus({preventScroll:true}); const main=ref.current?.closest('main'); if(main) main.scrollTop=0;
    const url = previous + '?' + q; if (nav) nav.url.current = url; if (window.location.search !== '?' + q) window.history.pushState({ record: true }, '', url);
    const before = e => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } };
    const pop = () => { if (!window.location.search.includes('mode=')) { if (isDirty()) { window.history.pushState({ record: true }, '', url); nav?.leave(onClose); } else onClose(); } };
    window.addEventListener('beforeunload', before); window.addEventListener('popstate', pop);
    return () => { if(document.title===`${title} — booksdotnet`) document.title=previousTitle; if (nav?.guard.current === isDirty) { nav.guard.current = null; nav.close.current = null; } window.removeEventListener('beforeunload', before); window.removeEventListener('popstate', pop); if (window.location.pathname === previous && window.location.search === '?' + q) window.history.replaceState(null, '', previous); };
  }, [recordId, mode]);
  useEffect(()=>{if(dirty===undefined){const next=isDirty();setFormDirty(old=>old===next?old:next);}});
  const content = Children.map(children, child => isValidElement(child) && child.type === 'form' ? cloneElement(child, { id: formId }) : child);
  return <RecordContext.Provider value={{ host, formId, close, dirty:dirty??formDirty }}><section ref={ref} className="v2-record-page" data-unsaved={dirty} data-navigation-guard={Boolean(nav)} aria-label={title} onChangeCapture={()=>setFormDirty(isDirty())} onInputCapture={()=>setFormDirty(isDirty())} onSubmitCapture={e => { const button = e.nativeEvent.submitter; if (!allowPost.current && ['Posted', 'Sent'].includes(button?.value)) { e.preventDefault(); e.stopPropagation(); if (!e.target.reportValidity()) return; submitter.current = { form: e.target, button }; setConfirmPost(true); } else allowPost.current = false; }}>
    <header className="v2-record-header"><div><button type="button" className="record-link v2-back-link" onClick={close}><ArrowLeft size={15}/>Back to {page?.title || 'records'}</button><div className={statusInline?"v2-record-title-inline":undefined}><h1 tabIndex={-1}>{title}</h1>{status && <div className="v2-record-status">{status}</div>}</div>{readOnlyMessage && <p className="v2-readonly-message"><LockKeyhole size={13} aria-hidden="true"/>{readOnlyMessage}</p>}</div><div className="v2-record-header-actions" ref={setHost}>{actions}</div></header>
    <div className="v2-record-content">{content}</div>
  </section>{confirmPost && <Modal title="Confirm posting" onClose={() => setConfirmPost(false)}><div className="modal-body"><p>This posts a balanced entry to the local accounting books. Posted records retain their original values.</p></div><div className="modal-footer"><Button onClick={() => setConfirmPost(false)}>Cancel</Button><Button className="primary" onClick={() => { setConfirmPost(false); allowPost.current = true; submitter.current.form.requestSubmit(submitter.current.button); }}>Confirm posting</Button></div></Modal>}</RecordContext.Provider>;
}
export function RecordModal({ children, confirmation, ...props }) {
  const page = useContext(PageContext);
  return page?.records && !confirmation ? <RecordPage {...props}>{children}</RecordPage> : <Modal {...props}>{children}</Modal>;
}
