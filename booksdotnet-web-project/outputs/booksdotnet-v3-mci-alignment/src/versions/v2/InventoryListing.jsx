import { useContext, useState } from 'react';
import { Search } from 'lucide-react';
import { Heading, DataTable, Badge, peso, exportCSV } from '../../module-ui.jsx';
import { Button } from '../../design-system/Button.jsx';
import { PageContext } from './AccessContext.jsx';
import ListingActions from './ListingActions.jsx';
import { assertWorkspace, STORAGE_KEY } from '../../accounting.js';
import { upgradeBanking } from './banking.js';
import { useListState } from './RecordPage.jsx';
import { transactionDate } from './TransactionFields.jsx';
import { displayPage } from '../v3-labels.js';
import { routeFor } from '../navigation.js';
import SourceRecordDetails from './SourceRecordDetails.jsx';
import { listingSpecs, listingKind, listingType, eligibleListingRecords, sourceListingRows, filterListingRows } from './source-listing.js';
import './inventory-listing.css';
export default function InventoryListing({state,active,range,intent,onNavigate}){
 const context=useContext(PageContext),title=displayPage(active),kind=listingKind(active),type=listingType(active),key=type==='document'?'documentId':type==='payment'?'paymentId':'noteId';
 const [refreshed,setRefreshed]=useState(null),[notice,setNotice]=useState(null),workspace=refreshed||state;
 const [selected,setSelected]=useState(intent?.[key]||null),[filters,setFilters]=useListState(`inventory:${active}:filters`,{});
 const records=eligibleListingRecords(workspace,active),record=records.find(r=>r.id===selected),all=sourceListingRows(workspace,active,range),rows=filterListingRows(all,filters),spec=listingSpecs[active],credit=type==='credit';
 if(record)return <SourceRecordDetails state={workspace} kind={kind} type={type} record={record} onClose={()=>setSelected(null)}/>;
 if(selected)return <><Heading title={title} description="This posted record is unavailable."/><p>This record is not available in this read-only listing.</p><Button onClick={()=>setSelected(null)}>Back to {title}</Button></>;
 const columns=spec.map(([key,label,filter,width])=>({key,label,numeric:filter==='money',sortable:true,width,description:active==='Supplier Payments'&&key==='balance'?'Unapplied portion of the recorded payment':undefined,render:row=>key==='id'?<a className="record-link" href={`${routeFor('v2',active)}?mode=view&record=${encodeURIComponent(row.id)}`} onClick={e=>{if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();setSelected(row.id);}}}>{row.id}</a>:key==='status'?<Badge value={row.status}/>:filter==='money'?row[key]==null?'—':credit?`(${peso(row[key])})`:peso(row[key]):filter==='date'?transactionDate(row[key]):key==='party'&&active==='Customer Payments'?<span>{row.party}{row.customerGroup&&row.customerGroup!=='—'&&<small className="v3-listing-secondary">{row.customerGroup}</small>}</span>:row[key]??'—'}));
 const columnFilters=column=>{const [key,label,filter]=spec.find(c=>c[0]===column.key),update=value=>setFilters(old=>({...old,[key]:value}));
 if(filter==='money'||filter==='select')return <select aria-label={`Filter ${label}`} value={filters[key]||''} onChange={e=>update(e.target.value)}><option value="">All</option>{filter==='money'?<><option value=":zero">Zero amount</option><option value=":amount">With amount</option><option value=":missing">Unavailable</option></>:Array.from(new Set(all.map(r=>r[key]).filter(v=>v!=null&&v!=='—'))).sort().map(v=><option key={v} value={v}>{v}</option>)}</select>;
 return <label className="v3-column-search">{filter==='text'&&<Search size={14} aria-hidden="true"/>}<input type={filter==='date'?'date':'search'} aria-label={`Filter ${label}`} placeholder={filter==='date'?undefined:'Search'} value={filters[key]||''} onChange={e=>update(e.target.value)}/></label>;
 };
 function refresh(){try{const raw=localStorage.getItem(STORAGE_KEY);setRefreshed(raw?upgradeBanking(assertWorkspace(JSON.parse(raw))):state);setNotice({text:'List refreshed.'});}catch{setNotice({error:true,text:'Could not refresh the list. The displayed records have been retained.'});}}
 function download(){try{exportCSV(`${title.toLowerCase().replaceAll(' ','-')}.csv`,spec.map(c=>c[1]),rows.map(row=>spec.map(([key,,filter])=>filter==='money'&&typeof row[key]==='number'?row[key]/100:row[key]??'')));setNotice({text:'CSV export ready.'});}catch{setNotice({error:true,text:'Could not export this list. Please try again.'});}}
 return <div className="v3-inventory-listing"><Heading title={title} hideDateControl description={`View posted ${title.toLowerCase()} from Inventory Management.`}><ListingActions hasFilters={Object.values(filters).some(Boolean)} canExport={context?.can?.('export')??false} onRefresh={refresh} onClear={()=>{setFilters({});setNotice(null);}} onExport={download}/></Heading>{notice&&<p className={`v3-listing-feedback ${notice.error?'error-text':''}`} role={notice.error?'alert':'status'}>{notice.text}</p>}<DataTable title={title} rows={rows} columns={columns} columnFilters={columnFilters} filterKey={JSON.stringify([filters,range.start,range.end])} hideToolbar standalone emptyLabel={`No matching ${title.toLowerCase()}`} onRowClick={row=>setSelected(row.id)}/></div>;
}
