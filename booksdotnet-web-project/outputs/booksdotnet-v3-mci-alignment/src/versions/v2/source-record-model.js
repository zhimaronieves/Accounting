import { displayPage, canonicalPage } from '../v3-labels.js';
import { demoSourceRecord } from './source-record-demo.js';
import { sourceRecordLayout } from './source-record-layout.js';
import { inventoryRecords } from './inventory-records.js';
import { documentsFor, partiesFor, paidAt, creditedAt, settlement } from './accounting.js';
import { allNotes } from './transactions.js';
import { outstanding } from '../../accounting.js';

const missing = '—';
const field = (label, value, money=false) => ({label, value:value==null||value===''?missing:value, money});
const amount = value => Number.isSafeInteger(value) ? value/100 : missing;
const address = value => typeof value==='string' ? value : value ? [value.line1,value.line2,value.city,value.province,value.postal,value.country].filter(Boolean).join(', ') : '';
const refName = (state,kind,id) => state.v2.configuration?.[kind]?.find(x=>x.id===id)?.name;
export const recordPage = (kind,type) => displayPage(`${kind==='invoice'?'Customer':'Supplier'} ${type==='payment'?'Payments':type==='credit'?'Credits':kind==='invoice'?'Invoices':'Bills'}`);
export function attachmentURL(file) {
 const url=file.url || file.downloadUrl || file.dataUrl;
 if(typeof url!=='string')return null;
 return /^(https?:\/\/|blob:)/i.test(url) || /^data:(application\/pdf|image\/(png|jpeg|webp)|text\/plain);base64,/i.test(url) || /^\/(?!\/)/.test(url) ? url : null;
}
export function sourceRecordModel(state,kind,type,record) {
 const r=demoSourceRecord(state,kind,type,record), docs=documentsFor(state,kind), party=partiesFor(state,kind).find(p=>p.id===r.partyId), journal=state.entries.find(e=>e.id===r.entryId), invoice=kind==='invoice';
 // Only saved source fields override an existing posted record; master data is identified separately below.
 const s=r.sourceDetails || {}, get=key=>s[key] ?? r[key], payment=type==='payment', credit=type==='credit';
 const date=payment||credit?r.date:r.issueDate, partyName=r.partyName || r.customer || r.vendor || party?.name;
 const status=['Sent','Unpaid'].includes(r.status)&&journal?.status==='Posted'?'Posted':r.status;
 const fields=[field('Document Number',r.id),field(payment?invoice?'Collection Receipt Date':'Payment Date':credit?invoice?'Customer Credit Date':'Supplier Debit Date':invoice?'Sales Invoice Date':'Bill Date',date),field('Status',status),field(payment&&!invoice?'Payee':invoice?'Customer':'Supplier',partyName)];
 const add=(label,key)=>fields.push(field(label,get(key)));
 if(!payment&&!credit){
  if(invoice){for(const [l,k] of [['Payment Type','paymentType'],['Sales Order Number','salesOrderNumber'],['Tracking Reference','trackingReference'],['Sales Team','salesTeam'],['Statement Code','statementCode'],['Salesman Code','salesmanCode'],['Invoicing Preference','invoicingPreference']])add(l,k);}
  else for(const [l,k] of [['Payee Type','payeeType'],['Purchase Order','purchaseOrder'],['Consignee','consignee']])add(l,k);
  if(invoice)add('Consignee','consignee');
  add('Commercial Invoice Number','commercialInvoiceNumber');
  fields.push(field('Payment Terms',get('paymentTerms') || refName(state,'terms',r.paymentTermId)),field('Due Date',r.dueDate));
  if(invoice){add('Delivery Date','deliveryDate');fields.push(field('Posted Date',get('postedDate')||journal?.date));add('VAT Class','vatClass');}
 }
 if(credit&&!invoice)fields.push(field('Source Document Type',r.type||'Credit Note'));
 if(credit){add('Consignee','consignee');if(invoice)fields.push(field('Tagged to EWT',get('taggedToEwt')==null?missing:get('taggedToEwt')?'Yes':'No'));fields.push(field(`Related ${invoice?'Invoice':'Bill'}`,r.docId));}
 if(payment){
  if(invoice)for(const [l,k] of [['Customer Group','customerGroup'],['Commercial Collection Receipt Number','commercialCollectionReceiptNumber'],['Sales Team','salesTeam'],['Consignee','consignee'],['Collector','collector'],['Posted By','postedBy'],['Received From','receivedFrom']])add(l,k);
  fields.push(field('Payment Method',r.method));
  const bank=state.v2.bankAccounts?.find(b=>b.id===r.bankAccountId),gl=state.accounts.find(a=>a.id===r.cashAccountId);
  fields.push(field('Bank Account',r.bankAccountName||bank?.name),field('Bank / Cash GL',gl?`${gl.code} · ${gl.name}`:r.cashAccountId));
  add('Check Number','checkNumber');add('Check Date','checkDate');
 }
 // The current engine stores PHP centavos. Never borrow a reference screenshot's USD currency.
 fields.push(field('Currency',get('currency')||'PHP'),field('Reference Number',r.reference),field('Checked By',get('checkedBy')),field('Posted Journal',r.entryId));
 if(r.reversalEntryId)fields.push(field('Reversal Journal',r.reversalEntryId));
 const contact=get('contactInformation') || r.contact || party?.contacts?.find(c=>c.primary) || party?.contacts?.[0];
 const contactText=typeof contact==='string'?contact:contact?[contact.name,contact.position,contact.phone,contact.email].filter(Boolean).join('\n'):[r.email||party?.email,party?.phone].filter(Boolean).join('\n');
 const contactFields=payment&&!invoice?[]:[field('Contact Information',contactText),field('Billing Address',address(get('billingAddress')||r.billing||party?.billing||party?.address))];
 if(invoice&&!payment&&!credit)contactFields.push(field('Shipping Address',address(get('shippingAddress')||r.shipping||party?.shipping)));
 const tables=[],summary=[]; const table=(title,columns,rows,money=[])=>tables.push({title,columns,rows,money});
 if(!payment&&!credit){
  const items=r.items?.length?r.items:[{description:r.description,quantity:1,rate:r.subtotal ?? r.total-(r.tax||0),accountId:r.accountId}];
  table('Items',['Item','Particulars','Quantity','UOM',invoice?'Unit Price':'Unit Cost','Discount','VAT','EWT Amount','Line Amount','GL Account'],items.map(i=>{
   const base=Math.round(i.quantity*i.rate),tax=i.tax ?? Math.round(base*(i.taxRate??r.taxRate??0)/100),discount=i.discount ?? 0;
   return [i.itemCode||i.itemId||missing,i.description||i.particulars||missing,i.quantity,i.uom||missing,amount(i.rate),amount(i.discount),amount(i.tax ?? (r.items?.length?tax:r.tax)),amount(i.ewtAmount),amount(i.total ?? i.lineAmount ?? base+tax-discount),i.accountId||missing];
  }),[4,5,6,7,8]);
  summary.push(field('Subtotal',amount(r.subtotal??r.total-(r.tax||0)),true),field('Tax',amount(r.tax??0),true));
  if(get('discount')!=null)summary.push(field('Discount',amount(get('discount')),true));
  if(get('ewtAmount')!=null)summary.push(field('EWT Amount',amount(get('ewtAmount')),true));
  summary.push(field('Total Amount Due',amount(r.total),true),field('Payments',amount(paidAt(r)),true),field('Credits Applied',amount(creditedAt(r)),true),field('Additional Charges',amount((r.adjustments||[]).filter(a=>a.balanceDelta>0&&!a.reversal||a.balanceDelta<0&&a.reversal).reduce((total,a)=>total+a.balanceDelta,0)),true),field('Outstanding Balance',amount(outstanding(r)),true),field('Payment Status',settlement(r)));
  table('Payment and Adjustment References',['Reference','Date','Type','Amount','Journal'],[
   ...(r.payments||[]).map(p=>[p.aggregateId||p.id,p.date,p.method,amount(p.amount),p.entryId||missing]),
   ...(r.credits||[]).map(c=>[c.id,c.date,c.reason||'Credit',amount(c.amount),c.entryId||missing]),
   ...(r.adjustments||[]).map(a=>[a.noteId,a.date,a.reversal?'Reversal':a.balanceDelta<0?'Credit':'Additional charge',amount(a.balanceDelta),a.entryId||missing])
  ],[3]);
 }
 if(credit){
  const lines=get('details')?.length?get('details'):[{code:r.categoryCode,creditCategory:r.creditCategory,particulars:r.reason,amount:r.amount}];
  table('Details',['Code','Credit Category','Particulars','Amount'],lines.map(l=>[l.code||missing,l.creditCategory||l.category||missing,l.particulars||l.description||missing,amount(l.amount)]),[3]);
  summary.push(field('Amount Before Tax',amount(r.amount-(r.tax||0)),true),field('Applicable Tax Included',amount(r.tax||0),true),field('Total Amount',amount(r.amount),true));
 }
 if(payment){
  const allocations=r.allocations||[];
  table(invoice?'Sales Invoices':'Related Bills',[invoice?'Invoice Number':'Bill Number','Document Date','Particulars','Commercial Invoice Number','Document Amount','Outstanding at Payment','Amount '+(invoice?'Collected':'Paid'),'Remaining at Payment','Current Outstanding'],allocations.map(a=>{
   const doc=docs.find(d=>d.id===a.docId);
   return [a.docId,doc?.issueDate||missing,doc?.description||doc?.items?.map(i=>i.description).join('; ')||missing,doc?.sourceDetails?.commercialInvoiceNumber||doc?.commercialInvoiceNumber||missing,amount(doc?.total),amount(a.outstandingBefore),amount(a.amount),amount(a.balanceAfter),doc?amount(outstanding(doc)):missing];
  }),[4,5,6,7,8]);
  const notes=allNotes(state,kind).filter(n=>n.type==='Credit Note'&&allocations.some(a=>a.docId===n.docId));
  table(invoice?'Customer Credits':'Supplier Debits',['Credit Number','Related Document','Date','Particulars','Amount','Status'],notes.map(n=>[n.id,n.docId,n.date,n.reason,amount(n.amount),n.status]),[4]);
  const details=Array.isArray(get('paymentDetails'))&&get('paymentDetails').length?get('paymentDetails'):[{method:r.method,date:r.date,amount:r.amount,particulars:r.reference,checkNumber:get('checkNumber'),checkDate:get('checkDate'),bankName:get('bankName'),bankAccountName:r.bankAccountName,bankAccountNumber:get('bankAccountNumber'),bankAccountId:r.bankAccountId,attachments:r.attachments}];
  for(const method of ['Cash','Bank','Check']){
   const rows=details.filter(d=>method==='Bank'?/bank|transfer/i.test(d.method||''):d.method?.toLowerCase()===method.toLowerCase()).map(d=>{
    const bank=state.v2.bankAccounts?.find(b=>b.id===d.bankAccountId);
    const common=[amount(d.amount),d.particulars||missing,Array.isArray(d.attachments)?d.attachments.map(f=>f.name||f.fileName).filter(Boolean).join(', ')||missing:missing];
    return method==='Cash'?[d.date||missing,...common]:method==='Bank'?[d.bankAccountName||bank?.name||missing,d.bankAccountNumber||bank?.accountNumber||missing,d.date||missing,...common]:[d.checkNumber||missing,d.checkDate||missing,d.bankName||bank?.name||missing,...common];
   });
   table(method,method==='Cash'?['Receipt Date','Amount','Particulars','Attachment References']:method==='Bank'?['Bank Account','Bank Account Number','Bank Transfer Date','Amount','Particulars','Attachment References']:['Check Number','Check Date','Bank','Amount','Particulars','Attachment References'],rows,[method==='Cash'?1:3]);
  }
  if(r.applications?.length)table('Payment Applications',['Date','Amount','Journal','Documents'],r.applications.map(a=>[a.date,amount(a.amount),a.entryId,(a.allocations||[]).map(x=>x.docId).join(', ')||missing]),[1]);
  const allocated=allocations.reduce((s,a)=>s+a.amount,0);
  summary.push(field('Payment Amount',amount(r.amount),true),field('Allocated Amount',amount(allocated),true),field('Unapplied Amount',amount(r.amount-allocated),true));
 }
 const methodSummary=payment?['Cash','Bank','Check'].map(name=>field(`Total ${name} Amount`,tables.find(t=>t.title===name).rows.reduce((sum,row)=>sum+(typeof row[name==='Cash'?1:3]==='number'?row[name==='Cash'?1:3]:0),0),true)):[];
 const rawFiles=[...(Array.isArray(r.attachments)?r.attachments:[]),...(Array.isArray(s.attachments)?s.attachments:[]),...(Array.isArray(get('paymentDetails'))?get('paymentDetails'):[]).flatMap(d=>Array.isArray(d.attachments)?d.attachments:[])];
 const attachments=rawFiles.filter(f=>f&&typeof f==='object').filter((f,i,a)=>a.findIndex(x=>(x.id||x.url||x.name||x.fileName)===(f.id||f.url||f.name||f.fileName))===i);
 const links=[...docs.map(d=>({value:d.id,page:recordPage(kind,'document'),id:d.id})),...allNotes(state,kind).filter(n=>n.type==='Credit Note').map(n=>({value:n.id,page:recordPage(kind,'credit'),id:n.id})),...inventoryRecords(state,recordPage(kind,'payment')).map(p=>({value:p.id,page:recordPage(kind,'payment'),id:p.id}))];
 const history=Array.isArray(r.sourceHistory)?r.sourceHistory:Array.isArray(r.history)?r.history:[];
 const model={id:r.id,page:recordPage(kind,type),kind,type,company:state.v2.company?.name||'booksdotnet',status,fields,contactFields,tables,summary,methodSummary,remarks:get('remarks')||r.notes||r.reason||missing,attachments,history,links,entryId:r.entryId,
  contactNote:contactFields.length?'Where a source contact/address snapshot is unavailable, current saved reference details are shown. Missing source values are marked —.':'Missing source fields are marked —. Historical outstanding balances are shown only when saved; current outstanding is separately labeled.'};
 model.layout=sourceRecordLayout(state,kind,type,r,model);return model;
}
export function findSourceRecord(state,kind,type,id){
 const record=inventoryRecords(state,canonicalPage(recordPage(kind,type))).find(r=>r.id===id);
 if(!record)throw new Error('This posted record is no longer available in the local workspace. The displayed copy has been retained.');
 return sourceRecordModel(state,kind,type,record);
}
