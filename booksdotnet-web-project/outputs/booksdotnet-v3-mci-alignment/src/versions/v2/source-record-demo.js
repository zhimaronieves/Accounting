import { createWorkspace } from '../../accounting.js';

// Enrich only explicitly flagged demos or exact copies of the application's bundled
// sample documents. This adapter never writes to the saved workspace or journals.
const bundled=createWorkspace();
const present=v=>v!==undefined&&v!==null&&v!=='';
const fingerprint=r=>JSON.stringify([r.id,r.customer||r.vendor,r.issueDate,r.total,r.tax||0,r.subtotal??r.total-(r.tax||0),r.description||'',(r.items||[]).map(i=>[i.description,i.quantity,i.rate,i.taxRate??r.taxRate??0,i.tax??null])]);
export function isDemoSourceRecord(record,kind,type){
 if(record.demo===false||record.production===true||record.sourceDetails?.production===true)return false;
 if(record.demo===true)return true;
 return type==='document'&&bundled[kind==='invoice'?'invoices':'bills'].some(r=>fingerprint(r)===fingerprint(record));
}
const profiles={
 'Mercado Foods':['Angela Mercado','Accounts Payable Officer','120 Legazpi Street','Makati City','Metro Manila','1229'],
 'Tala Creative':['Bianca Santos','Finance Coordinator','48 Scout Rallos Street','Quezon City','Metro Manila','1103'],
 'Northline Logistics':['Carlo Navarro','Accounting Supervisor','62 Industrial Avenue','Valenzuela City','Metro Manila','1440'],
 'Isla Ventures':['Diana Reyes','Finance Officer','38 Cebu Business Park','Cebu City','Cebu','6000'],
 'Bayan Retail':['Enzo Garcia','Accounts Payable Specialist','21 Shaw Boulevard','Mandaluyong City','Metro Manila','1550'],
 'Sariwa Organics':['Faye Cruz','Finance Coordinator','76 J.P. Rizal Avenue','Pasig City','Metro Manila','1600'],
 'Pacific Works':['Gabriel Tan','Accounting Officer','14 Harbor Drive','Manila','Metro Manila','1018'],
 'Kubo Living':['Hannah Lim','Finance Manager','45 Commerce Avenue','Muntinlupa City','Metro Manila','1780'],
 'BGC Property Management':['Isabel Ramos','Billing Coordinator','18 Bonifacio High Street','Taguig City','Metro Manila','1634'],
 'Cloudline Systems':['Javier Torres','Accounts Receivable Officer','30 Ayala Avenue','Makati City','Metro Manila','1226'],
 'Amplify Digital':['Katrina Flores','Billing Officer','27 Ortigas Avenue','Pasig City','Metro Manila','1605'],
 'Metro Utilities':['Leo Villanueva','Collections Officer','91 EDSA','Quezon City','Metro Manila','1104'],
};
const hash=s=>[...String(s)].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0);
const weightsFor=n=>n===3?[50,30,20]:n===4?[40,30,20,10]:[30,25,20,15,10];
export function splitDemoAmount(total,count){
 if(!Number.isSafeInteger(total)||total<count)return null;
 const weights=weightsFor(count),parts=weights.map(w=>Math.floor(total*w/100));parts[parts.length-1]+=total-parts.reduce((s,x)=>s+x,0);
 return parts.every(n=>n>0)?parts:null;
}
function itemNames(kind,description){
 if(kind==='invoice')return ['Monthly bookkeeping','Account reconciliation','Management reporting','Tax workpaper preparation','Financial review support'];
 if(/lease|rent/i.test(description))return ['Base office lease','Common area charges','Facilities service fee','Parking lease','Office services'];
 if(/software|cloud|subscription/i.test(description))return ['Software license','User access licenses','Technical support','Data storage services','Subscription administration'];
 if(/electric|water|utilit/i.test(description))return ['Electricity usage','Water consumption','Distribution charges','Service charges','Meter maintenance'];
 if(/market|advertis|campaign/i.test(description))return ['Campaign management','Creative production','Media services','Performance reporting','Account coordination'];
 return ['Professional service fee','Operational support','Administrative services','Project coordination','Service delivery'];
}
export function expandedDemoItems(record,kind){
 if(record.items?.length>=3)return record.items;
 if(record.items?.length>1)return null;
 const original=record.items?.[0]||{description:record.description,quantity:1,rate:record.subtotal??record.total-(record.tax||0),taxRate:record.taxRate??0,accountId:record.accountId};
 const base=record.subtotal??record.total-(record.tax||0),tax=record.tax||0,rate=original.taxRate??record.taxRate;
 // A single service bundle can be itemized safely. Product quantities, discounts,
 // unknown tax treatment, and historical mismatches are deliberately left alone.
 if(original.quantity!==1||original.rate!==base||original.discount||record.discount||original.ewtAmount||record.ewtAmount||!Number.isSafeInteger(base)||base<=0||base+tax!==record.total||tax>0&&!Number.isFinite(rate))return null;
 const count=3+hash(record.id)%3,parts=splitDemoAmount(base,count);if(!parts)return null;
 const taxes=values=>values.map(v=>Math.round(v*(rate||0)/100));
 let bases=parts,taxParts=taxes(bases);
 if(taxParts.reduce((s,x)=>s+x,0)!==tax){
  let found=false;
  for(let delta=-50;delta<=50;delta++){
   const candidate=[parts[0]+delta,parts[1]-delta,...parts.slice(2)];if(candidate.some(n=>n<=0))continue;
   const calculated=taxes(candidate);if(calculated.reduce((s,x)=>s+x,0)===tax){bases=candidate;taxParts=calculated;found=true;break;}
  }
  if(!found)return null;
 }
 const names=itemNames(kind,original.description||record.description||''),prefix=kind==='invoice'?'SVC':'EXP';
 return bases.map((value,i)=>({...original,lineId:`${record.id}-detail-${i+1}`,itemCode:original.itemCode||`${prefix}-${String(i+1).padStart(3,'0')}`,itemName:names[i],description:`${names[i]} · ${original.description||record.description||record.id}`,quantity:1,uom:original.uom||'service',rate:value,taxRate:rate||0,tax:taxParts[i],discount:0,total:value+taxParts[i]}));
}
export function demoSourceRecord(state,kind,type,original){
 if(!isDemoSourceRecord(original,kind,type))return original;
 const record={...original,sourceDetails:{...original.sourceDetails}},s=record.sourceDetails;
 const party=state.v2[kind==='invoice'?'customers':'suppliers']?.find(p=>p.id===record.partyId),partyName=record.customer||record.vendor||record.partyName||party?.name;
 const profile=profiles[partyName]||['Nina Mendoza',kind==='invoice'?'Accounts Payable Officer':'Billing Coordinator','42 Pioneer Street','Mandaluyong City','Metro Manila','1550'];
 const number=hash(partyName)%900+100,staff=['Mara Dela Cruz','Paolo Mendoza','Camille Ramos','Enzo Navarro'],checker=staff[hash(record.id)%staff.length];
 const date=record.issueDate||record.date,code=record.id.split('-').at(-1).padStart(4,'0'),year=date?.slice(0,4)||'2026';
 const entry=state.entries.find(e=>e.id===record.entryId),fill=(key,value)=>{if(!present(s[key])&&!present(record[key]))s[key]=value;};
 if(!record.reference)record.reference=`REF-${record.id}`;
 fill('consignee',kind==='invoice'?partyName:state.v2.company?.name||'booksdotnet Workspace');
 fill('checkedBy',checker);fill('currency','PHP');
 const existingContact=record.contact||party?.contacts?.find(c=>c.primary)||party?.contacts?.[0]||{};
 if(!present(s.contactInformation)&&!present(record.contactInformation))s.contactInformation=typeof existingContact==='string'?existingContact:{...existingContact,name:existingContact.name||profile[0],position:existingContact.position||profile[1],phone:existingContact.phone||`+63 917 555 0${String(number).slice(-3)}`,email:existingContact.email||record.email||party?.email||`accounts@${partyName.toLowerCase().replace(/[^a-z]/g,'')}.example`};
 const defaultAddress={line1:profile[2],city:profile[3],province:profile[4],postal:profile[5],country:'Philippines'};
 const mergeAddress=value=>typeof value==='string'&&value.trim()?value:Object.fromEntries(Object.entries({...defaultAddress,...value}).map(([k,v])=>[k,present(v)?v:defaultAddress[k]||'']));
 if(!present(s.billingAddress)&&!present(record.billingAddress))s.billingAddress=mergeAddress(record.billing||party?.billing||party?.address);
 if(!present(s.shippingAddress)&&!present(record.shippingAddress))s.shippingAddress=party?.sameAddress===false?mergeAddress(record.shipping||party?.shipping):s.billingAddress||record.billingAddress;
 if(type==='document'){
  const days=Math.max(0,Math.round((Date.parse(record.dueDate)-Date.parse(record.issueDate))/86400000));
  fill('paymentTerms',state.v2.configuration?.terms?.find(t=>t.id===record.paymentTermId)?.name||(days===0?'Due on receipt':Number.isFinite(days)?`Net ${days}`:'Due on agreed date'));
  fill('commercialInvoiceNumber',`${kind==='invoice'?'SI':'SB'}-${year}-${code}`);
  if(kind==='invoice'){
   fill('paymentType','Sales Order');fill('salesOrderNumber',`SO-${year}-${code}`);fill('invoicingPreference','Sales Invoice');fill('salesTeam',hash(partyName)%2?'Corporate Accounts':'Business Services');fill('salesmanCode',`SALES-${String(hash(partyName)%4+1).padStart(2,'0')}`);fill('deliveryDate',date);fill('postedDate',entry?.date||date);fill('vatClass',`${record.taxRate||0}% VAT`);
  }else {fill('payeeType','Purchase Order');fill('purchaseOrder',`PO-${year}-${code}`);}
  if(!record.notes&&!present(s.remarks))s.remarks=`${record.description||'Professional services'} for ${partyName}. Reference ${record.reference}.`;
  const items=expandedDemoItems(record,kind);if(items)record.items=items;
 }else if(type==='credit'){
  fill('taggedToEwt',false);
  if(!Array.isArray(s.details)&&!Array.isArray(record.details)){
   const count=3+hash(record.id)%3,parts=splitDemoAmount(record.amount,count),labels=['Service fee adjustment','Rate adjustment','Billing allowance','Support fee correction','Administrative fee adjustment'];
   if(parts)s.details=parts.map((amount,i)=>({code:`${record.id}-${String(i+1).padStart(2,'0')}`,creditCategory:record.creditCategory||'Billing Adjustment',particulars:`${labels[i]} · ${(record.reason||'Contract adjustment').replace(/^Demo\s*·\s*/,'')}`,amount}));
  }
 }else if(type==='payment'){
  if(kind==='invoice'){
   fill('customerGroup',party?.customerGroup||'Corporate Customers');fill('commercialCollectionReceiptNumber',`CR-${year}-${code}`);fill('salesTeam',hash(partyName)%2?'Corporate Accounts':'Business Services');fill('collector',staff[hash(partyName)%staff.length]);fill('postedBy',entry?.actor||checker);fill('receivedFrom',profile[0]);
  }
  if(record.method==='Check'){fill('checkNumber',`CHK-${year}-${code}`);fill('checkDate',date);}else{fill('checkNumber','N/A');fill('checkDate','N/A');}
  if(record.method==='Cash'&&!record.bankAccountName)record.bankAccountName='N/A';
  // Do not invent a company bank account or GL mapping for legacy bank payments.
  if(!record.notes&&!present(s.remarks))s.remarks=record.allocations?.length?`${record.method} ${kind==='invoice'?'collection':'payment'} for ${record.allocations.map(a=>a.docId).join(', ')}.`:`${record.method} advance ${kind==='invoice'?'received from':'paid to'} ${partyName}.`;
 }
 return record;
}
