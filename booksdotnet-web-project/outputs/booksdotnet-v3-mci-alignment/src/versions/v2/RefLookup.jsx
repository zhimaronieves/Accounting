import { TransactionSelect as SearchableSelect } from './TransactionFields.jsx';
import { refRows } from './configuration-data.js';
export function RefLookup({state,kind,...props}) { return <RecordLookup rows={refRows(state,kind)} {...props}/>; }
export function RecordLookup({rows,label,value='',previous=value,onChange,required=false,filter,disabled=false,emptyLabel,format,displayValue}) {
 const selected=rows.find(r=>r.id===value);
 const available=rows.filter(r=>(r.active||r.id===previous)&&( !filter||filter(r)||r.id===previous));
 return <label className="v2-reference-lookup">{label}{required?' *':''}<SearchableSelect displayValue={displayValue} aria-label={label} value={value} required={required} disabled={disabled} onChange={e=>onChange(e.target.value,rows.find(r=>r.id===e.target.value))}><option value="">{emptyLabel||`Select ${label.toLowerCase()}`}</option>{selected&&!available.some(r=>r.id===value)&&<option value={value} disabled>{selected.name} · unavailable</option>}{available.map(r=><option key={r.id} value={r.id}>{format?format(r):r.name}{r.abbreviation?` (${r.abbreviation})`:''}{!r.active?' · Inactive':''}</option>)}</SearchableSelect></label>;
}
