// Presentation only: the posted record and its accounting amounts are never changed.
const absent='—';
const amount=value=>Number.isSafeInteger(value)?value/100:absent;
const money=(label,value)=>({label,value,money:true});
const layouts={
 'bill-document':[['Document No.','Document Number'],'Bill Date','Status',['Payee','Supplier'],'Payee Type','Purchase Order','Consignee','Due Date',['Commercial Invoice No.','Commercial Invoice Number'],'Currency',['Reference No.','Reference Number'],'Checked By'],
 'bill-payment':[['Document No.','Document Number'],'Payment Date','Status','Payee','Payment Method','Bank Account',['Check No.','Check Number'],'Check Date',['Reference No.','Reference Number'],'Checked By',null,null],
 'bill-credit':[['Document No.','Document Number'],'Supplier Debit Date','Status','Supplier','Consignee','Currency',['Reference No.','Reference Number'],'Checked By',null],
 'invoice-document':[['Document No.','Document Number'],'Sales Invoice Date','Status','Customer','Payment Type',['Sales Order No.','Sales Order Number'],'Invoicing Preference','Sales Team','Salesman Code','Consignee',['Commercial Invoice No.','Commercial Invoice Number'],'Payment Terms','Due Date','Delivery Date','Posted Date','VAT Class',['Reference No.','Reference Number'],'Checked By'],
 'invoice-payment':[['Document No.','Document Number'],'Collection Receipt Date','Status','Customer Group','Customer',['Commercial Collection Receipt No.','Commercial Collection Receipt Number'],'Sales Team','Consignee','Collector','Posted By','Received From',['Reference No.','Reference Number'],'Checked By',null,null],
 'invoice-credit':[['Document No.','Document Number'],'Customer Credit Date','Status','Customer','Consignee','Tagged to EWT',['Reference No.','Reference Number'],'Checked By',null],
};
export function sourceRecordLayout(state,kind,type,record,model){
 const invoice=kind==='invoice',get=key=>record.sourceDetails?.[key]??record[key];
 const fields=layouts[`${kind}-${type}`].map(spec=>{
  if(!spec)return null;
  const [label,key]=Array.isArray(spec)?spec:[spec,spec],saved=model.fields.find(f=>f.label===key);
  return {...saved,label,value:saved?.value??absent};
 });
 const tables=[],summary=[],table=(title,columns,rows,moneyColumns=[],extra={})=>({title,columns,rows,money:moneyColumns,...extra});
 if(type==='document'){
  const original=model.tables.find(t=>t.title==='Items');
  const raw=record.items?.length?record.items:[{description:record.description,quantity:1,rate:record.subtotal??record.total-(record.tax||0)}];
  const columns=['#','Item Name','Particulars',invoice?'Unit Price':'Unit Cost','Qty','UOM',invoice?'Total Price':'Total Cost','Discount','VAT',...(invoice?['EWT Class']:[]),'EWT Amount','Line Amount'];
  const rows=original.rows.map((row,i)=>{
   const line=raw[i],unit=row[4],quantity=row[2],total=Number.isSafeInteger(line.rate)&&typeof line.quantity==='number'?amount(Math.round(line.rate*line.quantity)):absent;
   return [i+1,line.itemName||line.name||line.itemCode||line.description||row[0],row[1],unit,quantity,row[3],total,row[5],row[6],...(invoice?[line.ewtClass||absent]:[]),row[7],row[8]];
  });
  tables.push(table('Items',columns,rows,[3,6,7,8,...(invoice?[10,11]:[9,10])],{numeric:[4],itemCodes:raw.map(i=>[i.itemCode||i.itemId,i.brand,i.category].filter(Boolean).join(' · '))}));
  const subtotal=model.summary.find(f=>f.label==='Subtotal').value,tax=model.summary.find(f=>f.label==='Tax').value,discount=amount(get('discount')??0),gross=amount(get('grossAmount')??(discount===0?record.total:undefined));
  summary.push(money('Total Gross (VAT Inclusive)',gross),money('Less: VAT',tax),money('Amount: NET of VAT',subtotal),money('Less: Discount Amount',discount),money('Amount Due',typeof record.total==='number'?amount(record.total-(record.tax||0)):absent),money('Add: VAT',tax),money('EWT Amount',amount(get('ewtAmount'))),money('Total Amount Due',amount(record.total)));
 }
 if(type==='credit'){
  const original=model.tables.find(t=>t.title==='Details');tables.push(table('Details',['#',...original.columns],original.rows.map((row,i)=>[i+1,...row]),[4]));
  if(record.tax)summary.push(money('Amount Before Tax',amount(record.amount-record.tax)),money('Applicable Tax Included',amount(record.tax)));
  summary.push(money('Total Amount (PHP)',amount(record.amount)));
 }
 let allocations=[];
 if(type==='payment'){
  const original=model.tables[0],notes=model.tables.find(t=>t.title===(invoice?'Customer Credits':'Supplier Debits')),docs=invoice?state.invoices:state.bills;
  const currency=record.currency||'PHP';
  allocations=original.rows.map((row,i)=>{
   const doc=docs.find(d=>d.id===row[0]),docCurrency=doc?.currency||'PHP',conversion=doc?.sourceDetails?.conversionRate??doc?.conversionRate??(docCurrency===currency?1:absent),saved=record.allocations[i];
   const credits=notes.rows.filter(n=>n[1]===row[0]);
   return {id:row[0],row:[i+1,row[0],row[1],row[2],row[3],...(invoice?[]:[docCurrency,conversion]),row[4],row[5],...(invoice?[amount(saved.ewtAmount)]:[]),row[6],row[7]],credits};
  });
  const columns=['#',invoice?'Sales Invoice No.':'Bill No.',invoice?'Sales Invoice Date':'Bill Date','Particulars','Commercial Invoice No.',...(invoice?[]:['Currency','Conversion Rate']),invoice?'Sales Invoice Amount':'Bill Amount','Outstanding Amount',...(invoice?['EWT Amount']:[]),invoice?'Amount Collected':'Payment','Balance'];
  const title=invoice?'Sales Invoices':'Bills',numberColumns=invoice?[5,6,7,8,9]:[7,8,9,10];
  tables.push(table(title,columns,allocations.map(a=>a.row),numberColumns,{groups:allocations,numeric:invoice?[]:[6]}));
  const sumAvailable=key=>record.allocations.length&&record.allocations.every(a=>Number.isSafeInteger(a[key]))?amount(record.allocations.reduce((sum,a)=>sum+a[key],0)):absent;
  summary.push(money(invoice?'Total Sales Invoice Amount':'Total Bill Amount',original.rows.reduce((sum,row)=>sum+(typeof row[4]==='number'?row[4]:0),0)),money('Total Outstanding Amount',sumAvailable('outstandingBefore')));
  if(invoice)summary.push(money('EWT Amount',amount(get('ewtAmount'))),money('Customer Credits',amount(get('creditAmount'))),money('Total Amount Due',amount(get('totalAmountDue'))),money('Total Amount Collected',amount(record.amount)));
  else summary.push(money('Total Payment',amount(record.amount)),money('Supplier Debits',amount(get('creditAmount'))),money('Total Amount Paid',amount(record.amount)));
  summary.push(money('Allocated Amount',model.summary.find(f=>f.label==='Allocated Amount').value),money('Unapplied Amount',model.summary.find(f=>f.label==='Unapplied Amount').value),money('Balance Amount (PHP)',sumAvailable('balanceAfter')));
 }
 return {fields,contacts:!invoice&&type!=='credit'?[]:model.contactFields,tables,summary,summaryTitle:type==='document'?(invoice?'Sales Invoice Summary':'Bill Summary'):type==='payment'?'Payment Summary':null};
}
