import { displayPage } from './v3-labels.js';
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {createWorkspace, STORAGE_KEY, accountBalance} from '../accounting.js';
import {upgradeBanking,reduceBanking,bankMovements} from './v2/banking.js';
import {createDirectory,validateDirectory,can,canPage,assertActionAllowed,DIRECTORY_KEY} from './v2/permissions.js';
import {V3_MODULES,assertV3Action} from './v3-policy.js';
import {v2Routes,v3Groups,resolveLocation,routeFor} from './navigation.js';
import {inventoryRecords,inventoryViewState} from './v2/inventory-records.js';
import {searchWorkspace} from './v2/search.js';

const fresh=()=>reduceBanking(upgradeBanking(createWorkspace()),{type:'v2/seedReviewData'});
const state=fresh(),user=createDirectory().users[1],range={start:'2026-10-01',end:'2026-10-26',label:'This Month'};
const arap=Object.values(V3_MODULES).slice(1,3).flat();
const removed=['Items','Customers','Suppliers','Employees','Item Configuration','Nature of Business','Customer Groups','Organizational Settings','Banks','Payment Terms','Company Information','Accounting Configuration','Users & Permissions','Approval Workspace'];
const server=await createServer({server:{middlewareMode:true,watch:null},appType:'custom'});
after(()=>server.close());
const {default:Screens}=await server.ssrLoadModule('/src/versions/v2/Screens.jsx');
const {default:Shell}=await server.ssrLoadModule('/src/versions/v2/Shell.jsx');
const {PageContext}=await server.ssrLoadModule('/src/versions/v2/AccessContext.jsx');
const {default:FinancialStatements}=await server.ssrLoadModule('/src/versions/v2/FinancialStatements.jsx');
const render=(Component,props={})=>renderToStaticMarkup(React.createElement(PageContext.Provider,{value:{title:displayPage(props.active),can:r=>can(user,props.active?.startsWith('Customer')?'Accounts Receivable':'Accounts Payable',r),user,records:true,listState:{current:{}},canNavigate:p=>canPage(user,p)}},React.createElement(Component,{state,range,commit:()=>({ok:true}),onNavigate(){},onClose(){},notify(){},...props})));

test('V3 has exactly the requested modules and its own routes; removed and old routes resolve safely',()=>{
 assert.deepEqual(v3Groups.map(g=>g.name),['Dashboard','Purchasing','Sales','Accounting','Banking','Reports']);
 assert.deepEqual(Object.keys(v2Routes).sort(),Object.values(V3_MODULES).flat().sort());
 for(const page of removed){assert.ok(!v2Routes[page]);assert.equal(canPage(user,page),false);assert.equal(routeFor('v2',page),'/v3/dashboard');}
 for(const path of ['/v3/settings/company','/v3/settings/accounting','/v3/settings/users','/v3/masterfile/items','/v3/configuration/banks','/v3/approvals','/v2/settings/accounting','/v1'])assert.equal(resolveLocation(path).active,'Dashboard');
 assert.equal(resolveLocation('/v3/accounting/journals').active,'Journal Entries');assert.equal(resolveLocation('/v3/banking/transactions').active,'Bank Transactions');
});
test('Existing permission data remains present, but AR/AP writes and hidden page access are unavailable',()=>{
 const directory=validateDirectory(createDirectory());assert.ok(directory.users.every(u=>u.permissions.Settings&&u.permissions.Configuration&&u.permissions.Masterfile));
 for(const u of directory.users)for(const module of ['Accounts Receivable','Accounts Payable'])for(const right of ['create','edit','post','approve','reverse'])assert.equal(can(u,module,right),false);
 assert.equal(can(user,'Accounting','create'),true);assert.equal(can(user,'Accounting','post'),true);assert.equal(can(user,'Reports','export'),true);
 assert.notEqual(STORAGE_KEY,'ledgerflow-accounting-v1');assert.notEqual(DIRECTORY_KEY,'booksdotnet-prototype-users-v1');assert.ok(STORAGE_KEY.includes('v3'));assert.ok(DIRECTORY_KEY.includes('v3'));
});
test('Direct mutation attempts cannot change imported AR/AP or removed configuration data',()=>{
 const before=JSON.stringify(state);
 for(const type of ['invoice','bill','payment','credit','sendInvoice','voidInvoice','voidBill','reminder','v2/invoice','v2/bill','v2/payment','v2/paymentDraft','v2/postPaymentDraft','v2/applyPayment','v2/note','v2/reverseNote','v2/credit','v2/void','v2/company','v2/accountingDefaults','v2/configuration','v2/deleteConfiguration','v2/master','v2/party']){
  assert.throws(()=>assertActionAllowed(user,{type},state),/read-only|not available/);assert.throws(()=>reduceBanking(state,{type}),/read-only|not available/);
 }
 assert.equal(JSON.stringify(state),before);
});
test('All six AR/AP views retain posted records and their references while drafts remain stored but hidden',()=>{
 const source=structuredClone(state);source.invoices.push({...source.invoices[0],id:'DRAFT-V3-CHECK',status:'Draft',entryId:undefined});const before=JSON.stringify(source),view=inventoryViewState(source),posted=new Set(source.entries.filter(e=>e.status==='Posted').map(e=>e.id));
 for(const page of arap){const records=inventoryRecords(source,page);assert.ok(records.length,page);assert.ok(records.every(r=>r.status!=='Draft'&&posted.has(r.entryId)),page);}
 assert.equal(view.v2.paymentDrafts.length,0);assert.ok(view.invoices.every(r=>r.status!=='Draft'));assert.ok(source.invoices.some(r=>r.status==='Draft'));assert.equal(JSON.stringify(source),before);assert.equal(view.v2.company,source.v2.company);assert.equal(view.v2.accountingDefaults,source.v2.accountingDefaults);assert.equal(view.v2.bankMappings,source.v2.bankMappings);
 for(const page of arap){const result=searchWorkspace(state,user,inventoryRecords(source,page)[0].id);assert.ok(result.every(r=>!removed.includes(r.page)));}
 for(const name of ['Accounting Configuration','Company Information','Users & Permissions','Items'])assert.ok(!searchWorkspace(state,user,name).some(r=>removed.includes(r.page)));
});
test('AR/AP create URLs expose no creation controls; posted detail pages retain the existing static financial fields',()=>{
 for(const active of arap){const list=render(Screens,{active,intent:{create:true}});assert.ok(!/Create invoice|Create bill|Record payment|Prepare payment|Create Customer Credit|Create Supplier Credit/.test(list),active);assert.ok(list.includes('<table'),active);assert.ok(!list.includes('class="v2-record-page"'),active);
  const record=inventoryRecords(state,active)[0],key=active.endsWith('Payments')?'paymentId':active.endsWith('Credits')?'noteId':'documentId';
  const detail=render(Screens,{active,intent:{[key]:record.id,mode:'view'}}),body=detail.split('class="v2-record-page"')[1];assert.ok(body,active);assert.ok(!/<(?:input|select)\b|<textarea\b(?![^>]*\breadonly\b)/.test(body),active);assert.ok(!/Save Changes|Post Transaction|Reverse|Record payment|Apply unapplied balance/.test(body),active);
 }
});
test('Header Settings stays visible without a settings menu or hidden navigation',()=>{
 const html=renderToStaticMarkup(React.createElement(Shell,{active:'Dashboard',state,range,commit:()=>({ok:true}),notify(){},onNavigate(){},notifications:[],setNotifications(){},renderFinancial:()=>React.createElement('p',null,'Financial summary'),assertActionAllowed,mobile:false}));
 assert.match(html,/<button type="button" class="icon-button" aria-label="Settings" title="Settings">/);assert.ok(!html.includes('id="v2-settings-menu"'));assert.ok(!html.includes('Settings navigation'));for(const page of removed)assert.ok(!html.includes('>'+page+'<'),page);assert.ok(html.includes('V3 — MCI Alignment'));
});
test('Accounting journals, typed bank posting, company balances and reconciliation keep the existing engine',()=>{
 let s=fresh();const company=structuredClone(s.v2.company),defaults=structuredClone(s.v2.accountingDefaults),directory=structuredClone(createDirectory());
 s=reduceBanking(s,{type:'account',account:{code:'1010',name:'Cash in Bank — Test',type:'Asset',group:'Cash & bank'}});
 s=reduceBanking(s,{type:'v2/bankAccount',record:{name:'Test Operating',bankId:s.v2.configuration.banks[0].id,accountNumber:'1234567890',glAccountId:'1010',currency:'PHP',active:true}});
 const bank=s.v2.bankAccounts[0],before=s.entries.length;
 const record={requestId:'v3-bank-test',type:'Direct Deposit',bankAccountId:bank.id,offsetAccountId:'3000',amount:100000,date:'2026-10-26',reference:'TEST',description:'In-memory verification',status:'Posted'};
 s=reduceBanking(s,{type:'v2/bankTransaction',record});assert.equal(s.entries.length,before+1);assert.equal(accountBalance(s,'1010'),100000);assert.equal(bankMovements(s).filter(m=>m.bankAccountId===bank.id).length,1);
 s=reduceBanking(s,{type:'v2/bankTransaction',record});assert.equal(s.entries.length,before+1);
 const movement=bankMovements(s).find(m=>m.bankAccountId===bank.id);
 s=reduceBanking(s,{type:'v2/reconciliation',complete:true,record:{bankAccountId:bank.id,startDate:'2026-10-01',endDate:'2026-10-26',endingBalance:100000,statement:[{id:'statement',date:'2026-10-26',description:'Test deposit',moneyIn:100000,moneyOut:0}],matches:[{statementId:'statement',movementId:movement.id}],reviewed:true}});
 assert.equal(s.v2.reconciliations[0].status,'Completed');assert.equal(s.entries.length,before+1);assert.deepEqual(s.v2.company,company);assert.deepEqual(s.v2.accountingDefaults,defaults);assert.deepEqual(createDirectory(),directory);
 const journalCount=s.entries.length;s=reduceBanking(s,{type:'journal',entry:{date:'2026-10-26',memo:'General adjustment',status:'Draft',lines:[{accountId:'5200',debit:10000,credit:0},{accountId:'2300',debit:0,credit:10000}]}});const draft=s.entries.at(-1);s=reduceBanking(s,{type:'postJournal',id:draft.id});assert.equal(s.entries.length,journalCount+1);assert.equal(s.entries.at(-1).status,'Posted');
});
test('Financial reports continue using preserved company configuration',()=>{
 const s=structuredClone(state);s.v2.company.name='Preserved company snapshot';const html=render(FinancialStatements,{state:s,active:'Financial Statements'});assert.ok(html.includes('Preserved company snapshot'));assert.ok(html.includes('Balance Sheet'));assert.ok(!html.includes('Company Information'));
});
test('The approved private seed retains all source records and initializes an independent object graph',()=>{
 const seed=JSON.parse(fs.readFileSync(new URL('../v3-initial-snapshot.json',import.meta.url),'utf8'));assert.ok(seed.workspace.entries.length);assert.ok(seed.directory.users.length);const before=JSON.stringify(seed),copy=upgradeBanking(structuredClone(seed.workspace));assert.deepEqual(copy.entries,seed.workspace.entries);assert.deepEqual(copy.v2.company,seed.workspace.v2.company);assert.deepEqual(copy.v2.accountingDefaults,seed.workspace.v2.accountingDefaults||{receivableAccountId:'1100',payableAccountId:'2000'});assert.deepEqual(copy.v2.bankAccounts,seed.workspace.v2.bankAccounts||[]);copy.v2.company.name='Changed only in V3';assert.equal(JSON.stringify(seed),before);
});
test('V1/V2 source, assets and project configuration remain byte-for-byte unchanged',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../../../booksdotnet-v3-original-source-manifest.json',import.meta.url),'utf8'));
 for(const [name,hash] of Object.entries(manifest)){const bytes=fs.readFileSync(new URL('../../../ledgerflow-dashboard/'+name.replaceAll('\\','/'),import.meta.url));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),hash,name);}
 assert.ok(!fs.existsSync(new URL('../../../ledgerflow-dashboard/public/v3-initial-snapshot.html',import.meta.url)));
});


test('Source detail mappings preserve all posted records and never attach PDF sample values to real records',async()=>{
 const {sourceRecordModel,findSourceRecord}=await import('./v2/source-record-model.js');const {AR_AP_REFERENCE}=await import('./v2/ar-ap-reference.js');
 const before=JSON.stringify(state);assert.equal(Object.keys(AR_AP_REFERENCE).length,6);
 for(const page of arap){const kind=page.startsWith('Customer')?'invoice':'bill',type=page.endsWith('Credits')?'credit':page.endsWith('Payments')?'payment':'document',r=inventoryRecords(state,page)[0],model=sourceRecordModel(state,kind,type,r);
  assert.equal(model.id,r.id);assert.equal(model.fields.find(f=>f.label==='Document Number').value,r.id);assert.equal(model.fields.find(f=>f.label==='Currency').value,'PHP');assert.equal(model.entryId,r.entryId);assert.deepEqual(model.history,r.sourceHistory||r.history||[]);assert.deepEqual(model.attachments,[]);
  const total=model.summary.find(f=>f.label===(type==='payment'?'Payment Amount':type==='credit'?'Total Amount':'Total Amount Due'));assert.equal(total.value,(type==='document'?r.total:r.amount)/100);
  assert.ok(!JSON.stringify(model).includes('Prime Meat Supply Corp.'));assert.ok(!JSON.stringify(model).includes('Franco'));
  assert.deepEqual(findSourceRecord(state,kind,type,r.id),model);assert.throws(()=>findSourceRecord(state,kind,type,'does-not-exist'),/no longer available/);
 }
 assert.equal(JSON.stringify(state),before);
});

test('Payment method views and allocations retain numeric amounts and distinguish unavailable historical balances',async()=>{
 const {sourceRecordModel}=await import('./v2/source-record-model.js');
 for(const page of ['Customer Payments','Supplier Payments'])for(const r of inventoryRecords(state,page)){
  const m=sourceRecordModel(state,r.kind,'payment',r),methods=m.tables.filter(t=>['Cash','Bank','Check'].includes(t.title));assert.equal(methods.length,3);assert.equal(methods.reduce((sum,t)=>sum+t.rows.reduce((s,row)=>s+row[t.title==='Cash'?1:3],0),0),r.amount/100);
  const table=m.tables[0];assert.equal(table.rows.length,r.allocations.length);table.rows.forEach((row,i)=>{assert.equal(row[0],r.allocations[i].docId);assert.equal(row[6],r.allocations[i].amount/100);assert.equal(row[5],'—');assert.equal(row[7],'—');});
  const total=m.summary.find(f=>f.label==='Payment Amount').value,allocated=m.summary.find(f=>f.label==='Allocated Amount').value,unapplied=m.summary.find(f=>f.label==='Unapplied Amount').value;assert.ok(Math.abs(total-allocated-unapplied)<.00001);
 }
});

test('All six detail pages expose review tools and consistent static fields without editable or modification controls',()=>{
 for(const active of arap){const record=inventoryRecords(state,active)[0],key=active.endsWith('Payments')?'paymentId':active.endsWith('Credits')?'noteId':'documentId',html=render(Screens,{active,intent:{[key]:record.id,mode:'view'}}).split('class="v2-record-page"')[1];
  for(const text of [active.endsWith('Invoices')||active.endsWith('Bills')?'HISTORY':'Activity History','v3-attachment-count','aria-label="More"','General Information','v2-readonly-field','v3-source-general-grid'])assert.ok(html.includes(text),active+' '+text);
  assert.ok(!/<(?:input|select)\b|<textarea\b(?![^>]*\breadonly\b)/.test(html));assert.ok(!/>Add Row<|>Save<|>Edit<|>Post<|>Delete</.test(html));
 }
});

test('Attachments and history use actual source metadata; unsafe URLs cannot become download links',async()=>{
 const {sourceRecordModel,attachmentURL}=await import('./v2/source-record-model.js');const r=structuredClone(inventoryRecords(state,'Customer Invoices')[0]);r.attachments=[{id:'a',name:'Existing source.pdf',type:'application/pdf',size:1024,url:'/source/example.pdf'}];r.history=[{date:'2026-10-01',action:'Posted',actor:'Actual source user',before:'Draft',after:'Posted'}];const m=sourceRecordModel(state,'invoice','document',r);assert.deepEqual(m.attachments,r.attachments);assert.deepEqual(m.history,r.history);assert.equal(attachmentURL(m.attachments[0]),'/source/example.pdf');assert.equal(attachmentURL({url:'javascript:alert(1)'}),null);assert.equal(attachmentURL({url:'//external.example/file'}),null);assert.equal(attachmentURL({name:'metadata-only.pdf'}),null);
});

test('Excel and PDF exports include only the viewed record and preserve numeric financial values',async()=>{
 const {sourceRecordModel}=await import('./v2/source-record-model.js');const {recordSheets,recordExcel,recordPDF}=await import('./v2/source-record-exports.js');
 for(const active of arap){const kind=active.startsWith('Customer')?'invoice':'bill',type=active.endsWith('Credits')?'credit':active.endsWith('Payments')?'payment':'document',r=inventoryRecords(state,active)[0],m=sourceRecordModel(state,kind,type,r),before=JSON.stringify(state),sheets=recordSheets(m),xlsx=new Uint8Array(await recordExcel(m).arrayBuffer()),pdf=new Uint8Array(await recordPDF(m).arrayBuffer());
  assert.equal(new DataView(xlsx.buffer).getUint32(0,true),0x04034b50);assert.equal(new TextDecoder().decode(pdf.slice(0,8)),'%PDF-1.4');assert.ok(sheets[0].rows.some(row=>row[1]===(type==='document'?r.total:r.amount)/100));assert.ok(!JSON.stringify(sheets).includes('Prime Meat Supply Corp.'));assert.equal(JSON.stringify(state),before);
 }
});


test('Reference General Information preserves the exact field rows and empty third-column slots',async()=>{
 const {sourceRecordModel}=await import('./v2/source-record-model.js');
 const expected={
  'Supplier Bills':['Document No.','Bill Date','Status','Payee','Payee Type','Purchase Order','Consignee','Due Date','Commercial Invoice No.','Currency','Reference No.','Checked By'],
  'Supplier Payments':['Document No.','Payment Date','Status','Payee','Payment Method','Bank Account','Check No.','Check Date','Reference No.','Checked By',null,null],
  'Supplier Credits':['Document No.','Supplier Debit Date','Status','Supplier','Consignee','Currency','Reference No.','Checked By',null],
  'Customer Invoices':['Document No.','Sales Invoice Date','Status','Customer','Payment Type','Sales Order No.','Invoicing Preference','Sales Team','Salesman Code','Consignee','Commercial Invoice No.','Payment Terms','Due Date','Delivery Date','Posted Date','VAT Class','Reference No.','Checked By'],
  'Customer Payments':['Document No.','Collection Receipt Date','Status','Customer Group','Customer','Commercial Collection Receipt No.','Sales Team','Consignee','Collector','Posted By','Received From','Reference No.','Checked By',null,null],
  'Customer Credits':['Document No.','Customer Credit Date','Status','Customer','Consignee','Tagged to EWT','Reference No.','Checked By',null],
 };
 const before=JSON.stringify(state);
 for(const active of arap){const kind=active.startsWith('Customer')?'invoice':'bill',type=active.endsWith('Credits')?'credit':active.endsWith('Payments')?'payment':'document',r=inventoryRecords(state,active)[0],m=sourceRecordModel(state,kind,type,r);assert.deepEqual(m.layout.fields.map(f=>f?.label??null),expected[active],active);assert.equal(m.layout.fields[2].value,'Posted');
  assert.equal(m.layout.contacts.length,active==='Customer Invoices'?3:active==='Supplier Bills'||active==='Supplier Payments'?0:2,active);
 }
 assert.equal(JSON.stringify(state),before);
});

test('Reference record headers contain only Attachment and More; all technical banners and reference examples are absent',()=>{
 for(const active of arap){const r=inventoryRecords(state,active)[0],key=active.endsWith('Payments')?'paymentId':active.endsWith('Credits')?'noteId':'documentId',html=render(Screens,{active,intent:{[key]:r.id,mode:'view'}}).split('class="v2-record-page"')[1];
  for(const text of ['Local snapshot','Source activity','Inventory reference example','PDF pages','can no longer be edited','Contact and Addresses','No Inventory connection'])assert.ok(!html.includes(text),active+' '+text);
  assert.ok(!/>Close<|>Activity History<\/button>/.test(html));assert.match(html,active.endsWith('Invoices')||active.endsWith('Bills')?/aria-label="Expand side panel"/:/aria-label="Expand Activity History"/);assert.match(html,/aria-label="Status"[^>]*aria-readonly="true">Posted/);
  assert.equal(html.includes('aria-label="Payment information"'),active==='Customer Payments',active);
  const general=html.split('class="v3-source-general"')[1].split('class="v3-source-table-section"')[0];if(!['Supplier Bills','Supplier Payments'].includes(active))assert.ok(general.includes('class="v3-source-contacts'),active);
 }
});

test('Posted display status preserves real reversals and voids without rewriting stored statuses',async()=>{
 const {sourceRecordModel}=await import('./v2/source-record-model.js');const original=inventoryRecords(state,'Customer Invoices')[0],before=JSON.stringify(original);
 assert.equal(sourceRecordModel(state,'invoice','document',original).status,'Posted');assert.equal(original.status,'Sent');
 for(const status of ['Void','Reversed'])assert.equal(sourceRecordModel(state,'invoice','document',{...original,status}).status,status);
 assert.equal(JSON.stringify(original),before);
});

test('Reference tables retain document-specific columns, nested credit relationships and stored financial values',async()=>{
 const {sourceRecordModel}=await import('./v2/source-record-model.js');
 for(const kind of ['invoice','bill']){
  const docs=inventoryRecords(state,kind==='invoice'?'Customer Invoices':'Supplier Bills'),d=sourceRecordModel(state,kind,'document',docs[0]);assert.deepEqual(d.layout.tables[0].columns.slice(0,6),['#','Item Name','Particulars',kind==='invoice'?'Unit Price':'Unit Cost','Qty','UOM']);assert.equal(d.layout.summary.at(-1).value,docs[0].total/100);
  const payments=inventoryRecords(state,kind==='invoice'?'Customer Payments':'Supplier Payments');for(const r of payments){const m=sourceRecordModel(state,kind,'payment',r),t=m.layout.tables[0];assert.equal(t.groups.length,r.allocations.length);t.groups.forEach((g,i)=>{assert.equal(g.id,r.allocations[i].docId);assert.equal(g.row[kind==='invoice'?8:9],r.allocations[i].amount/100);assert.ok(g.credits.every(c=>c[1]===g.id));});assert.equal(m.layout.summary.find(f=>f.label==='Allocated Amount').value,r.allocations.reduce((sum,a)=>sum+a.amount,0)/100);}
 }
});

test('History empty state is plain language and available timeline events remain authentic',async()=>{
 const {HistoryContent,Attachments}=await server.ssrLoadModule('/src/versions/v2/SourceRecordDetails.jsx');
 const empty=renderToStaticMarkup(React.createElement(HistoryContent,{model:{history:[]}}));assert.ok(empty.includes('No activity history available.'));assert.ok(empty.includes('Activity history for this record is not available.'));assert.ok(!empty.includes('inferred'));
 const history=[{date:'2026-10-01',action:'Quantity changed',actor:'Actual User',before:40,after:50,time:'10:42 AM'}],html=renderToStaticMarkup(React.createElement(HistoryContent,{model:{history}}));assert.ok(html.includes('Actual User'));assert.ok(html.includes('40'));assert.ok(html.includes('50'));assert.ok(html.includes('10:42 AM'));assert.equal(history.length,1);
 const files=[{name:'Existing.pdf',url:'/actual-file.pdf',type:'application/pdf',size:2048}],attachments=renderToStaticMarkup(React.createElement(Attachments,{files}));assert.ok(attachments.includes('View'));assert.ok(attachments.includes('Download'));assert.ok(!/input|upload|Replace|Delete/.test(attachments));
});

test('Non-hierarchy accounting screens, reports, shared navigation and private snapshot retain their original implementations',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../../../../tmp/v3-layout-protected-files.json',import.meta.url),'utf8'));
 const hierarchyChanges=new Set(['src/accounting.js','src/versions/v2/AccountRecords.jsx','src/versions/v2/BankAccounts.jsx','src/versions/v2/banking.js','src/versions/v2/JournalRecords.jsx','src/versions/v2/BankTransactions.jsx','src/useWorkspace.js','src/versions/v2/permissions.js','src/versions/v2/BankReconciliation.jsx','src/versions/v2/BankTransactionForm.jsx']);
 for(const [path,hash]of Object.entries(manifest).filter(([path])=>!hierarchyChanges.has(path)))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../../'+path,import.meta.url))).digest('hex'),hash,path);
});


test('Demo enrichment preserves source records, amounts, taxes, journals and payment allocations',async()=>{
 const {demoSourceRecord}=await import('./v2/source-record-demo.js');const before=JSON.stringify(state);
 for(const active of arap){const kind=active.startsWith('Customer')?'invoice':'bill',type=active.endsWith('Payments')?'payment':active.endsWith('Credits')?'credit':'document';for(const record of inventoryRecords(state,active)){
 const demo=demoSourceRecord(state,kind,type,record);assert.equal(demo.total,record.total);assert.equal(demo.amount,record.amount);assert.equal(demo.tax,record.tax);assert.equal(demo.entryId,record.entryId);assert.deepEqual(demo.allocations,record.allocations);assert.deepEqual(demo.history,record.history);assert.deepEqual(demo.sourceHistory,record.sourceHistory);
 if(type==='document'&&demo.items?.length>=3){assert.equal(demo.items.reduce((s,i)=>s+i.rate*i.quantity,0),record.subtotal??record.total-(record.tax||0));assert.equal(demo.items.reduce((s,i)=>s+i.tax,0),record.tax||0);assert.ok(demo.items.length<=5);}
 if(type==='credit'&&demo.sourceDetails.details?.length){assert.equal(demo.sourceDetails.details.reduce((s,i)=>s+i.amount,0),record.amount);assert.ok(demo.sourceDetails.details.length>=3&&demo.sourceDetails.details.length<=5);}
 assert.deepEqual(demoSourceRecord(state,kind,type,record),demo);
 }}assert.equal(JSON.stringify(state),before);
 const actual={id:'ACTUAL-1',customer:'Mercado Foods',total:10000,sourceDetails:{checkedBy:'Real Reviewer'}};assert.strictEqual(demoSourceRecord(state,'invoice','document',actual),actual);
 const production={...state.invoices[0],production:true};assert.strictEqual(demoSourceRecord(state,'invoice','document',production),production);
 const explicit={...actual,demo:true};assert.equal(demoSourceRecord(state,'invoice','document',explicit).sourceDetails.checkedBy,'Real Reviewer');
});
test('Accounting panel reads only the existing linked journal and enforces Accounting visibility',async()=>{
 const {linkedSourceJournal,default:AccountingView}=await server.ssrLoadModule('/src/versions/v2/AccountingView.jsx');const r=inventoryRecords(state,'Customer Invoices')[0],before=JSON.stringify(state),j=linkedSourceJournal(state,r.entryId),raw=state.entries.find(e=>e.id===r.entryId);
 assert.equal(j.id,raw.id);assert.equal(j.status,raw.status);assert.deepEqual(j.lines.map(l=>[l.accountId,l.debit,l.credit]),raw.lines.map(l=>[l.accountId,l.debit,l.credit]));assert.equal(j.debit,j.credit);assert.equal(j.balanced,true);assert.equal(linkedSourceJournal(state,'missing'),null);
 const renderPanel=(entryId,allowed,data=state)=>renderToStaticMarkup(React.createElement(PageContext.Provider,{value:{canNavigate:()=>allowed}},React.createElement(AccountingView,{state:data,entryId})));
 assert.match(renderPanel(r.entryId,true),/Balanced/);assert.ok(renderPanel(r.entryId,true).includes('Debits equal credits ('));assert.ok(renderPanel(r.entryId,true).includes('role="status"'));assert.ok(renderPanel(r.entryId,true).includes('v3-journal-table'));assert.match(renderPanel(r.entryId,true),/v3\/accounting\/journals/);assert.match(renderPanel('missing',true),/No linked journal entry available/);assert.match(renderPanel(r.entryId,false),/outside your current access/);assert.equal(JSON.stringify(state),before);
});
test('Shared rail is document-only; customer settlement and related-invoice footer are hidden',()=>{
 for(const active of arap){const record=inventoryRecords(state,active)[0],key=active.endsWith('Payments')?'paymentId':active.endsWith('Credits')?'noteId':'documentId',html=render(Screens,{active,intent:{[key]:record.id,mode:'view'}});assert.equal(html.includes('v3-shared-rail'),active==='Customer Invoices'||active==='Supplier Bills',active);if(active==='Customer Invoices'||active==='Supplier Bills'){assert.ok(!html.includes('Payments and Adjustments'));assert.ok(!html.includes('v3-source-settlement'));}if(active==='Customer Credits')assert.ok(!html.includes('v3-source-related'));}
});


test('V3 display names preserve canonical routes, permission keys and supplier credit semantics',async()=>{
 const {canonicalPage,singularPage}=await import('./v3-labels.js');
 assert.deepEqual(v3Groups.slice(1,3).map(g=>[g.name,...g.pages.map(displayPage)]),[['Purchasing','Bills','Payments Made','Supplier Debits'],['Sales','Sales Invoices','Collection Receipts','Customer Credits']]);
 for(const page of arap){assert.equal(canonicalPage(displayPage(page)),page);assert.equal(routeFor('v2',displayPage(page)),routeFor('v2',page));assert.ok(searchWorkspace(state,user,displayPage(page)).some(r=>r.label===displayPage(page)));}
 assert.equal(singularPage('Supplier Payments'),'Payment Made');
 const note=inventoryRecords(state,'Supplier Credits')[0],before=JSON.stringify(note),entry=state.entries.find(e=>e.id===note.entryId),doc=state.bills.find(d=>d.id===note.docId);assert.equal(note.type,'Credit Note');assert.ok(entry.lines.some(l=>l.accountId===(doc.controlAccountId||'2000')&&l.debit===note.amount));assert.equal(JSON.stringify(note),before);
});
test('All six Inventory reference listings have the exact requested columns, filters and read-only links',async()=>{
 const {listingSpecs}=await import('./v2/source-listing.js');
 const expected={
 'Customer Invoices':['Document No.','SI Date','Customer','Due Date','EWT Amount','Net Amount','Amount Collected','Balance','Status'],
 'Customer Payments':['Document No.','CR Date','Customer Group / Customer','Consignee','Amount Collected','Collector','Status'],
 'Customer Credits':['Document No.','Customer Credit Date','Customer','Consignee','Tagged as EWT','Total Amount','Status'],
 'Supplier Bills':['Document No.','Bills Date','Payee','PO No.','Due Date','Currency','Total Amount Due','Payment','Balance','Status'],
 'Supplier Payments':['Document No.','PM Date','Payee','Payment Method','Total Amount Paid','Balance Amount','Status'],
 'Supplier Credits':['Document No.','Supplier Debit Date','Supplier','Consignee','Currency','Total Amount','Status']};
 for(const active of arap){assert.deepEqual(listingSpecs[active].map(c=>c[1]),expected[active]);const html=render(Screens,{active});assert.ok(!html.includes('module-table-tools'));assert.ok(!html.includes('search-input'));assert.ok(html.includes('aria-label="More"'));assert.ok(html.includes('v3-column-filters'));assert.ok(html.includes('aria-sort="none"'));assert.ok(html.includes('mode=view'));assert.ok(!/>Actions<|>New<|>Create<|>Requests<|>For Approval<|>Edit<|>Save</.test(html));assert.ok(html.includes(displayPage(active)+' pages'));assert.ok(!html.includes('>Export CSV<'));}
});
test('Listing finances and date boundaries use recorded amounts and linked settlements without mutation',async()=>{
 const {sourceListingRows,filterListingRows}=await import('./v2/source-listing.js'),{paidAt}=await import('./v2/accounting.js'),{balanceAt}=await import('../accounting.js');const before=JSON.stringify(state);
 for(const active of arap){const rows=sourceListingRows(state,active,range);for(const row of rows){const r=row.sourceRecord;assert.equal(row.id,r.id);assert.equal(row.status,'Posted');assert.ok(row.date>=range.start&&row.date<=range.end);if(active.endsWith('Invoices')||active.endsWith('Bills')){assert.equal(row.total,r.total);assert.equal(row.paid,paidAt(r,range.end));assert.equal(row.balance,balanceAt(r,range.end));}else{assert.equal(row.amount,r.amount);if(active.endsWith('Payments'))assert.equal(row.balance,r.amount-r.allocations.reduce((sum,a)=>sum+a.amount,0));}}
 const one=rows[0];if(one){assert.ok(filterListingRows(rows,{id:one.id}).every(r=>r.id.includes(one.id)));assert.ok(filterListingRows(rows,{party:one.party,date:one.date}).every(r=>r.party.includes(one.party)&&r.date===one.date));}
 assert.equal(sourceListingRows(state,active,{start:'2030-01-01',end:'2030-01-31'}).length,0);
 }assert.equal(JSON.stringify(state),before);
 assert.deepEqual(filterListingRows([{amount:0},{amount:10},{amount:null}],{amount:':missing'}),[{amount:null}]);assert.deepEqual(filterListingRows([{amount:0},{amount:10}],{amount:':zero'}),[{amount:0}]);
});
test('Listing eligibility excludes unposted, voided and reversed documents without rewriting their statuses',async()=>{
 const {eligibleListingRecords}=await import('./v2/source-listing.js');for(const status of ['Draft','Void','Reversed']){
 const copy=structuredClone(state),record=copy.invoices[0];record.status=status;const before=JSON.stringify(copy);assert.ok(!eligibleListingRecords(copy,'Customer Invoices').some(r=>r.id===record.id));assert.equal(JSON.stringify(copy),before);
 }const copy=structuredClone(state),record=copy.invoices[0];copy.entries.find(e=>e.id===record.entryId).status='Draft';assert.ok(!eligibleListingRecords(copy,'Customer Invoices').some(r=>r.id===record.id));
 const payments=structuredClone(state),payment=payments.v2.payments.find(p=>p.kind==='bill');payment.status='Reversed';assert.ok(!eligibleListingRecords(payments,'Supplier Payments').some(r=>r.id===payment.id));
});


test('All six listing headers expose only More and keep their column filter controls',()=>{
 for(const active of arap){const html=render(Screens,{active});const header=html.split('class="module-heading"')[1].split('class="module-table v3-standalone-table"')[0];assert.ok(header.includes('aria-label="More"'));assert.ok(!/View AR Aging|View AP Aging|This Month|Export CSV|Clear column filters|search-input/.test(header));assert.ok(!html.includes('module-table-tools'));assert.ok(html.includes('Filter Document No.'));assert.ok(html.includes('Filter Status'));assert.ok(html.includes('v3-column-filters'));}
});
test('DataTable toolbar removal is opt-in and ignores stale global searches only for simplified listings',async()=>{
 const {DataTable}=await server.ssrLoadModule('/src/module-ui.jsx');const props={title:'QA',columns:[{key:'id',label:'Document No.',sortable:true}],rows:[{id:'DOC-1'}]};
 const table=hideToolbar=>renderToStaticMarkup(React.createElement(PageContext.Provider,{value:{records:true,can:()=>true,listState:{current:{'table:QA:query':'old hidden search'}}}},React.createElement(DataTable,{...props,hideToolbar})));
 assert.ok(table(false).includes('module-table-tools'));assert.ok(table(false).includes('No matching records'));assert.ok(!table(true).includes('module-table-tools'));assert.ok(table(true).includes('DOC-1'));
});


test('All six listings opt into standalone tables with pagination outside the table border',()=>{
 for(const active of arap){const html=render(Screens,{active});assert.ok(html.includes('class="module-table v3-standalone-table"'),active);assert.ok(!html.includes('class="panel module-table"'),active);assert.ok(!html.includes('module-tabs'),active);assert.ok(!/>Requests<|>For Approval</.test(html),active);assert.match(html,/<\/table><\/div><div class="table-footer">/);assert.ok(html.includes('Showing 1–'),active);assert.ok(html.includes('v3-column-filters'),active);}
});
test('Standalone styling is optional and preserves existing table presentation elsewhere',async()=>{
 const {DataTable}=await server.ssrLoadModule('/src/module-ui.jsx');const props={title:'Other module',columns:[{key:'id',label:'Document'}],rows:[{id:'DOC-1'}]};
 const html=renderToStaticMarkup(React.createElement(DataTable,props));assert.ok(html.includes('class="panel module-table"'));assert.ok(!html.includes('Showing 1–'));
});


test('Chart of Accounts renders nested rows and editable parent controls without changing existing form fields',async()=>{
 const {default:AccountRecords}=await server.ssrLoadModule('/src/versions/v2/AccountRecords.jsx');const copy=structuredClone(state);
 copy.accounts.push({id:'6000',code:'6000',name:'QA Parent',type:'Expense',group:'Operations',active:true},{id:'6100',code:'6100',name:'QA Child',type:'Expense',group:'Operations',active:true,parentId:'6000'});
 const context={title:'Chart of Accounts',can:()=>true,canNavigate:()=>true,records:true,listState:{current:{'table:Chart of accounts:query':'QA'}}};
 const screen=intent=>renderToStaticMarkup(React.createElement(PageContext.Provider,{value:context},React.createElement(AccountRecords,{state:copy,range,commit(){},notify(){},onLedger(){},intent})));
 const listing=screen();assert.ok(listing.includes('Collapse subaccounts for 6000'));assert.ok(listing.includes('v3-parent-account'));assert.ok(listing.includes('padding-inline-start:20px'));assert.ok(listing.includes('QA Child'));
 const form=screen({recordId:'6100'});assert.ok(!form.includes('Make this a subaccount'));assert.ok(form.includes('Subsidiary Type'));assert.ok(form.includes('aria-label="Parent Account"'));assert.ok(form.includes('6000 — QA Parent'));assert.ok(form.includes('Account code'));assert.ok(form.includes('Classification'));assert.ok(!form.includes('Postable/Non-postable'));
 const parent=screen({recordId:'6000'});assert.ok(parent.includes('Aggregated Balance'));assert.ok(parent.includes('aria-label="Subaccounts"'));
});


test('Chart of Accounts and Journal Entries have no KPI cards and account chevrons sit beside names',async()=>{
 const coa=render(Screens,{active:'Chart of Accounts'});assert.ok(!coa.includes('module-stats'));for(const text of ['Account Code','Account Name','Classification','Search accounts','Export CSV'])assert.ok(coa.includes(text));
 const journals=render(Screens,{active:'Journal Entries'});assert.ok(!journals.includes('module-stats'));for(const label of ['Journal','Date','Description','Reference','Source','Amount','Status'])assert.ok(journals.includes(label));
 const copy=structuredClone(state);copy.accounts.push({id:'6000',code:'6000',name:'Parent expenses',type:'Expense',group:'Operations',active:true},{id:'6100',code:'6100',name:'Leaf expense',type:'Expense',group:'Operations',active:true,parentId:'6000'});
 copy.accounts=copy.accounts.filter(a=>['6000','6100'].includes(a.id));copy.entries=[];
 const html=render(Screens,{active:'Chart of Accounts',state:copy});assert.match(html,/<td[^>]*><span class="v3-account-tree-code"[^>]*>.*?Parent expenses<\/span><\/td><td[^>]*>6000<\/td>/);assert.ok(html.indexOf('>Account Name<')<html.indexOf('>Account Code<'));assert.ok(!html.includes('Direct postings retained'));
});
test('General Ledger has flat account rows, direct transaction expansion and no repeated balance or historical sections',()=>{
 const all=render(Screens,{active:'General Ledger',accountId:'',setAccountId(){}});assert.ok(all.includes('placeholder="Search accounts..."'));assert.ok(!all.includes('module-stats'));assert.ok(all.includes('General Ledger account pages'));assert.ok(!all.includes('Running Balance</th>'));
 for(const [a,b]of [['Account Name','Account Code'],['Account Code','Opening Balance'],['Opening Balance','Closing Balance']])assert.ok(all.indexOf(`>${a}</th>`)<all.indexOf(`>${b}</th>`));
 const selected=render(Screens,{active:'General Ledger',accountId:'1000',setAccountId(){}});assert.ok(selected.includes('Running Balance</th>'));assert.ok(!selected.includes('Period Totals'));assert.ok(!selected.includes('Direct historical postings'));assert.ok(!selected.includes('Reconciliation pending'));assert.equal((selected.match(/>Opening Balance</g)||[]).length,1);assert.equal((selected.match(/>Closing Balance</g)||[]).length,1);assert.ok(!selected.includes('v3-ledger-historical'));
 const empty=render(Screens,{active:'General Ledger',accountId:'1300',setAccountId(){}});assert.ok(empty.includes('No posted transactions in this period.'));
});

test('New Account includes description and zero-default opening journal inputs in separate sections',async()=>{
 const {default:AccountRecords}=await server.ssrLoadModule('/src/versions/v2/AccountRecords.jsx');
 const html=renderToStaticMarkup(React.createElement(PageContext.Provider,{value:{can:()=>true,records:true,title:'Chart of Accounts'}},React.createElement(AccountRecords,{state,range,commit(){},notify(){},onLedger(){},intent:{create:true}})));
 for(const label of ['Account code *','Account type *','Account name *','Classification *','Description','Opening Balance','Balance Type','As of Date','Create Account'])assert.ok(html.includes(label),label);
 assert.ok(html.includes('value="0.00"'));assert.ok(html.indexOf('Description<textarea')<html.indexOf('<h2>Opening Balance</h2>'));assert.ok(html.indexOf('<h2>Opening Balance</h2>')<html.indexOf('Create Account</button>'));
});

test('Journal listing amounts remain one side of each balanced multi-line entry',()=>{
 const copy=structuredClone(state);copy.entries=[{id:'QA-MULTI',date:range.end,memo:'Multiple account lines',reference:'QA',source:'manual',status:'Posted',lines:[{accountId:'5100',debit:10000,credit:0},{accountId:'5200',debit:5000,credit:0},{accountId:'1000',debit:0,credit:15000}]}];
 const html=render(Screens,{active:'Journal Entries',state:copy});assert.ok(html.includes('₱150.00'));assert.ok(!html.includes('₱300.00'));assert.ok(!html.includes('module-stats'));
});

test('Opening balance creation requires Accounting posting permission in addition to account creation',()=>{
 const actor=structuredClone(user);actor.permissions.Accounting.create=true;actor.permissions.Accounting.post=false;
 const action={type:'account',account:{code:'6500'},opening:{amount:100}};
 assert.throws(()=>assertActionAllowed(actor,action,state),/permission required/);
 assert.doesNotThrow(()=>assertActionAllowed(actor,{...action,opening:{amount:0}},state));
 actor.permissions.Accounting.post=true;assert.doesNotThrow(()=>assertActionAllowed(actor,action,state));
});


test('Saved account metadata and multiline descriptions load in Edit and View without financial changes',async()=>{
 const {default:AccountRecords}=await server.ssrLoadModule('/src/versions/v2/AccountRecords.jsx');
 const copy=structuredClone(state);copy.accounts.push({id:'6500',code:'6500',name:'Metadata fixture',type:'Expense',group:'Operations',active:true,parentId:null,subsidiaryType:'Supplier',description:'First line\nSecond line'});
 const before=JSON.stringify(copy);
 for(const editable of [true,false]){
  const html=renderToStaticMarkup(React.createElement(PageContext.Provider,{value:{can:()=>editable,records:true,title:'Chart of Accounts'}},React.createElement(AccountRecords,{state:copy,range,commit(){},notify(){},onLedger(){},intent:{recordId:'6500'}})));
  assert.match(html,/<option[^>]*selected=""[^>]*>Supplier<\/option>/);
  assert.match(html,/<textarea[^>]*maxLength="500"[^>]*>First line\nSecond line<\/textarea>/);
  assert.ok(!html.includes('Make this a subaccount'));
  assert.ok(html.includes(editable?'Edit Account':'View Account'));
 }
 assert.equal(JSON.stringify(copy),before);
});


test('Banking listings enable creation without setup panels or prerequisite button gates',async()=>{
 for(const [module,filename,label] of [['Bank Accounts','BankAccounts','New Bank Account'],['Bank Transactions','BankTransactions','New Bank Transaction'],['Bank Reconciliation','BankReconciliation','New Reconciliation']]){
  const {default:Component}=await server.ssrLoadModule('/src/versions/v2/'+filename+'.jsx');
  const context={title:module,can:r=>can(user,'Banking',r),canNavigate:()=>true,records:true,listState:{current:{}}};
  const show=(state,intent)=>renderToStaticMarkup(React.createElement(PageContext.Provider,{value:context},React.createElement(Component,{state,range,intent,commit:()=>({ok:true}),notify(){},onNavigate(){},onLedger(){}})));
  const empty=structuredClone(state);empty.v2.bankAccounts=[];empty.v2.bankTransactions=[];empty.v2.reconciliations=[];
  const listing=show(empty);assert.ok(listing.includes(label));assert.ok(!listing.includes('Set up company bank accounts'));assert.ok(!listing.includes('No company bank accounts are configured'));assert.ok(!listing.includes('Open Bank Accounts'));assert.ok(!listing.includes('Set up a company bank account first'));
  const button=[...listing.matchAll(/<button\b[^]*?<\/button>/g)].map(m=>m[0]).find(b=>b.includes(label));assert.ok(button);assert.ok(!/^<button[^>]*disabled/.test(button));
  const form=show(empty,{create:true});assert.ok(form.includes('v2-record-page'),module);assert.ok(form.includes(module==='Bank Accounts'?'Bank Account Information':module==='Bank Transactions'?'Transaction Information':'Reconciliation Information'));
 }
});
