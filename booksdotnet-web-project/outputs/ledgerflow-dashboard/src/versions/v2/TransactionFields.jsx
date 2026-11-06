import { createContext, useContext } from 'react';
import SearchableSelect, { selectOptions } from './SearchableSelect.jsx';
export const ReadOnlyFields = createContext(false);
export const transactionDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? new Intl.DateTimeFormat('en-PH', { day:'2-digit', month:'short', year:'numeric', timeZone:'UTC' }).format(new Date(value+'T12:00:00Z')) : value || '—';
export function ReadOnlyValue({ value, multiline, className='', 'aria-label':label }) {
 return <div className={`v2-readonly-field ${multiline?'v2-readonly-multiline':''} ${className}`} aria-label={label} role={label?'textbox':undefined} aria-readonly={label?'true':undefined}>{value === '' || value === undefined || value === null ? '—' : value}</div>;
}
export function TransactionInput({ displayValue, ...props }) {
 const locked=useContext(ReadOnlyFields);
 return locked || props.readOnly ? <ReadOnlyValue {...props} value={displayValue ?? (props.type==='date'?transactionDate(props.value):props.value)}/> : <input {...props} onInput={props.onInput || (props.type==='date'?props.onChange:undefined)}/>;
}
export function TransactionTextarea(props) {
 const locked=useContext(ReadOnlyFields);
 return locked ? <ReadOnlyValue {...props} multiline/> : <textarea {...props}/>;
}
export function TransactionSelect({ native, displayValue, readOnly, ...props }) {
 const locked=useContext(ReadOnlyFields);
 return locked || readOnly ? <ReadOnlyValue {...props} value={displayValue ?? (props.value === '' || props.value == null ? '—' : selectOptions(props.children).find(o=>o.value===String(props.value))?.label ?? props.value)}/> : native ? <select {...props}/> : <SearchableSelect {...props}/>;
}
