import { inventoryRecords } from './inventory-records.js';
import { demoSourceRecord } from './source-record-demo.js';
import { sourceRecordModel } from './source-record-model.js';
import { paidAt } from './accounting.js';
import { balanceAt } from '../../accounting.js';
import { unappliedAmount } from './transactions.js';
export const listingSpecs={
 'Customer Invoices':[['id','Document No.','text',170],['date','SI Date','date',140],['party','Customer','text',250],['dueDate','Due Date','date',140],['ewt','EWT Amount','money',165],['total','Net Amount','money',165],['paid','Amount Collected','money',175],['balance','Balance','money',165],['status','Status','select',130]],
 'Customer Payments':[['id','Document No.','text',170],['date','CR Date','date',140],['party','Customer Group / Customer','text',280],['consignee','Consignee','text',250],['amount','Amount Collected','money',185],['collector','Collector','text',200],['status','Status','select',130]],
 'Customer Credits':[['id','Document No.','text',170],['date','Customer Credit Date','date',190],['party','Customer','text',250],['consignee','Consignee','text',240],['ewtTagged','Tagged as EWT','select',150],['amount','Total Amount','money',175],['status','Status','select',130]],
 'Supplier Bills':[['id','Document No.','text',170],['date','Bills Date','date',140],['party','Payee','text',260],['purchaseOrder','PO No.','text',170],['dueDate','Due Date','date',140],['currency','Currency','select',130],['total','Total Amount Due','money',185],['paid','Payment','money',165],['balance','Balance','money',165],['status','Status','select',130]],
 'Supplier Payments':[['id','Document No.','text',170],['date','PM Date','date',140],['party','Payee','text',260],['method','Payment Method','select',190],['amount','Total Amount Paid','money',190],['balance','Balance Amount','money',180],['status','Status','select',130]],
 'Supplier Credits':[['id','Document No.','text',170],['date','Supplier Debit Date','date',190],['party','Supplier','text',260],['consignee','Consignee','text',250],['currency','Currency','select',130],['amount','Total Amount','money',180],['status','Status','select',130]],
};
export const listingKind=page=>page.startsWith('Customer')?'invoice':'bill';
export const listingType=page=>page.endsWith('Payments')?'payment':page.endsWith('Credits')?'credit':'document';
export function eligibleListingRecords(state,page){
 return inventoryRecords(state,page).filter(r=>{
 const raw=page.endsWith('Payments')?state.v2.payments.find(p=>p.id===r.id)||r:r;
 return !['Draft','Void','Reversed'].includes(raw.status)&&!state.entries.some(e=>e.id===raw.reversalEntryId&&e.status==='Posted');
 });
}
export function sourceListingRows(state,page,range){
 const kind=listingKind(page),type=listingType(page);
 return eligibleListingRecords(state,page).map(original=>{
 const r=demoSourceRecord(state,kind,type,original),model=sourceRecordModel(state,kind,type,original),get=key=>r.sourceDetails?.[key]??r[key],field=label=>model.fields.find(f=>f.label===label)?.value??'—';
 const row={id:r.id,date:type==='document'?r.issueDate:r.date,party:r.customer||r.vendor||r.partyName||field(kind==='invoice'?'Customer':'Supplier'),consignee:field('Consignee'),currency:field('Currency'),status:model.status,sourceRecord:original};
 if(type==='document')Object.assign(row,{dueDate:r.dueDate,ewt:get('ewtAmount')??null,total:get('netAmount')??r.total,paid:paidAt(original,range.end),balance:balanceAt(original,range.end),purchaseOrder:field('Purchase Order')});
 else if(type==='payment')Object.assign(row,{customerGroup:field('Customer Group'),amount:r.amount,collector:field('Collector'),method:r.method,balance:get('balanceAmount')??unappliedAmount(original)});
 else Object.assign(row,{amount:r.amount,ewtTagged:field('Tagged to EWT')});
 row.search=[...Object.values(row).filter(v=>typeof v==='string'),r.reference].join(' ');return row;
 }).filter(r=>r.date>=range.start&&r.date<=range.end);
}
export function filterListingRows(rows,filters){return rows.filter(row=>Object.entries(filters).every(([key,value])=>{
 if(!value)return true;const actual=row[key];
 if(value===':zero')return typeof actual==='number'&&actual===0;
 if(value===':amount')return typeof actual==='number'&&actual!==0;
 if(value===':missing')return actual==null||actual==='—';
 return String(actual??'').toLowerCase().includes(String(value).toLowerCase());
}));}
