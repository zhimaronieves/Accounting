import { upgradeMasterfile, blankMaster } from './masterfile.js';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { createWorkspace } from '../../accounting.js';
import { upgradeTransactions, reduceTransactions, allNotes, notePage } from './transactions.js';
import { createDirectory, canPage } from './permissions.js';
import { searchWorkspace } from './search.js';
import { resolveLocation } from '../navigation.js';
const server = await createServer({ server: { middlewareMode: true, watch: null }, appType: 'custom' });
after(() => server.close());
const { default: Notes, NoteForm } = await server.ssrLoadModule('/src/versions/v2/Notes.jsx');
const { default: FinancialStatements } = await server.ssrLoadModule('/src/versions/v2/FinancialStatements.jsx');
const state = reduceTransactions(upgradeTransactions(createWorkspace()), { type: 'v2/seedReviewData' });
const range = { start: '2026-10-01', end: '2026-10-26' };
const render = (component, props) => renderToStaticMarkup(React.createElement(component, { state, range, commit: () => ({ ok: true }), notify() {}, onNavigate() {}, ...props }));
const {default:Masterfile,comparableMaster}=await server.ssrLoadModule('/src/versions/v2/Masterfile.jsx');
const {PageContext}=await server.ssrLoadModule('/src/versions/v2/AccessContext.jsx');
const {readRecordIntent}=await server.ssrLoadModule('/src/versions/v2/RecordPage.jsx');
const {default:DocumentForm}=await server.ssrLoadModule('/src/versions/v2/DocumentForm.jsx');
const masterState=upgradeMasterfile(state);
const {default:Configuration}=await server.ssrLoadModule('/src/versions/v2/Configuration.jsx');
const {upgradeConfiguration}=await server.ssrLoadModule('/src/versions/v2/configuration.js');
const {default:SearchableSelect,selectOptions}=await server.ssrLoadModule('/src/versions/v2/SearchableSelect.jsx');
const {default:ModuleScreen}=await server.ssrLoadModule('/src/Modules.jsx');
const {RefLookup}=await server.ssrLoadModule('/src/versions/v2/RefLookup.jsx');
const {default:V2Screens}=await server.ssrLoadModule('/src/versions/v2/Screens.jsx');
const {default:Users}=await server.ssrLoadModule('/src/versions/v2/Users.jsx');
const {default:PaymentForm}=await server.ssrLoadModule('/src/versions/v2/PaymentForm.jsx');
const {default:JournalForm}=await server.ssrLoadModule('/src/versions/v2/JournalForm.jsx');
const {ReadOnlyFields,TransactionInput,TransactionSelect,transactionDate}=await server.ssrLoadModule('/src/versions/v2/TransactionFields.jsx');
const {upgradeBanking,reduceBanking}=await server.ssrLoadModule('/src/versions/v2/banking.js');
const {default:BankTransactionForm}=await server.ssrLoadModule('/src/versions/v2/BankTransactionForm.jsx');
const {PaymentSummary}=await server.ssrLoadModule('/src/versions/v2/FormLayout.jsx');
const {DataTable}=await server.ssrLoadModule('/src/module-ui.jsx');
test('Credit pages list credits only without mutating or losing existing debit notes', () => {
  const snapshot = JSON.stringify(state);
  for (const kind of ['invoice', 'bill']) {
    const html = render(Notes, { kind }), name = kind === 'invoice' ? 'Customer Credit' : 'Supplier Credit';
    assert.ok(html.includes(`Create ${name}`)); assert.ok(html.includes(`${name}s`));
    for (const note of allNotes(state, kind)) assert.equal(html.includes(note.id), note.type === 'Credit Note');
    assert.ok(!html.includes('All document types')); assert.ok(!html.includes('Credit &amp; Debit'));
    assert.equal(allNotes(state, kind).filter(n => n.type === 'Debit Note').length, 2);
  }
  assert.equal(JSON.stringify(state), snapshot);
});
test('Creation forms default to credits, lock the document type, and preserve source debit editing', () => {
  for (const kind of ['invoice', 'bill']) {
    const name = kind === 'invoice' ? 'Customer Credit' : 'Supplier Credit';
    const html = render(NoteForm, { kind, onClose() {}, onDone() {} });
    assert.ok(html.includes(`Create ${name}`)); assert.ok(html.includes(`Post ${name}`));
    assert.ok(!html.includes('Debit Note')); assert.ok(!html.includes('Adjustment document type'));
    const debit = allNotes(state, kind).find(n => n.type === 'Debit Note' && n.status === 'Draft');
    const draftHtml=render(NoteForm,{kind,original:debit});assert.ok(draftHtml.includes(debit.id));assert.ok(draftHtml.includes('Save Changes'));assert.ok(draftHtml.includes('Debit Note'));
    assert.ok(render(NoteForm, { kind, documentId: debit.docId, documentType: 'Debit Note' }).includes(`Create ${kind === 'invoice' ? 'Customer' : 'Supplier'} Debit Note`));
  }
});
test('Existing note URLs resolve renamed pages and retain role access and credit search', () => {
  const directory = createDirectory();
  for (const kind of ['invoice', 'bill']) {
    const name = notePage(kind), path = kind === 'invoice' ? '/v2/receivables/notes' : '/v2/payables/notes';
    assert.equal(resolveLocation(path, 'v2').active, name);
    for (const user of directory.users) assert.equal(canPage(user, name), canPage(user, kind === 'invoice' ? 'Customer Invoices' : 'Supplier Bills'));
    const manager = directory.users.find(u => u.role === 'Accounting Manager');
    assert.ok(searchWorkspace(state, manager, name.slice(0, -1)).some(r => r.intent?.noteId));
  }
});
test('Income Statement renders a single amount column without per-row ledger grid semantics', () => {
  const html = render(FinancialStatements, { onLedger() {} });
  assert.ok(html.includes('Amount (PHP)')); assert.ok(!html.includes('>Details<')); assert.ok(!html.includes('>Totals<'));
  assert.equal((html.match(/scope="col"/g) || []).length, 2);
  assert.ok(html.includes('report-final')); assert.ok(html.includes('report-major'));
});

function pageRender(component,props) { return renderToStaticMarkup(React.createElement(PageContext.Provider,{value:{title:props.active||'Customer Invoices',records:true,can:()=>true,canNavigate:()=>true,listState:{current:{}}}},React.createElement(component,{state:masterState,range,commit:()=>({ok:true}),notify(){},onClose(){},onDone(){},onNavigate(){},...props}))); }
test('All four masterfiles render full-page creation with shared tabs and no record dialog',()=>{
 for(const active of ['Items','Customers','Suppliers','Employees']) {const html=pageRender(Masterfile,{active,intent:{create:true}});assert.ok(html.includes('v2-record-page'));assert.ok(!html.includes('<dialog'));assert.ok(html.includes('Back to '));assert.ok(html.includes('Save'));}
 const customer=pageRender(Masterfile,{active:'Customers',intent:{create:true}});assert.ok(customer.includes('Contacts'));assert.ok(customer.includes('Billing Address'));assert.ok(customer.includes('Shipping Address'));assert.ok(customer.includes('Same as Registered Name'));
});
test('Canonical dirty comparison treats restored money, terms, names and linked addresses as unchanged',()=>{
 const original={...blankMaster(masterState,'Customers'),registeredName:'Example',name:'Example',terms:30,creditLimit:'1000.00'};
 const restored={...original,terms:'30',creditLimit:'1000',shipping:{...original.billing},sameAddress:true};assert.deepEqual(comparableMaster(restored),comparableMaster(original));assert.notDeepEqual(comparableMaster({...restored,registeredName:'Changed'}),comparableMaster(original));
});
test('Record URLs preserve create/view/edit identity and source transaction context',()=>{
 assert.deepEqual(readRecordIntent('Customers','?mode=edit&record=CUS-0001'),{mode:'edit',recordId:'CUS-0001'});
 assert.deepEqual(readRecordIntent('Customer Credits','?mode=create&noteType=Debit+Note&source=INV-2026-001'),{mode:'create',create:true,noteType:'Debit Note',documentId:'INV-2026-001'});
 assert.deepEqual(readRecordIntent('Journal Entries','?mode=view&record=JE-2026-0001'),{mode:'view',entryId:'JE-2026-0001'});
});
test('Invoice and bill forms render shared catalog lookup, line totals and accounting defaults on full pages',()=>{
 for(const kind of ['invoice','bill']) {const html=pageRender(DocumentForm,{kind});assert.ok(!html.includes('<dialog'));assert.ok(html.includes('Catalog item 1'));assert.ok(html.includes('Manual line'));assert.ok(html.includes('Line Total'));assert.ok(html.includes(kind==='invoice'?'Income Account':'Purchase Account'));assert.ok(html.includes('ITM-0004'));}
});

test('V2 masterfile and configuration listings have keyboard rows, no Actions, and Status last',()=>{
 const s=upgradeConfiguration(masterState),context={records:true,can:()=>true,title:'Items',canNavigate:()=>true};
 for(const page of ['Items','Customers','Suppliers','Employees','Item Configuration','Nature of Business','Customer Groups','Organizational Settings','Banks','Payment Terms']){
  const component=['Items','Customers','Suppliers','Employees'].includes(page)?Masterfile:Configuration;
  const html=renderToStaticMarkup(React.createElement(PageContext.Provider,{value:{...context,title:page}},React.createElement(component,{state:s,range,active:page,notify(){},commit(){},onNavigate(){}})));
  assert.ok(!html.includes('>Actions<'),page);assert.ok(html.includes('v2-clickable-row'),page);assert.ok(html.includes('tabindex="0"'),page);
  const header=html.split('<thead>')[1].split('</thead>')[0];assert.ok(/Status[\s\S]*<\/th><\/tr>$/.test(header),page);
 }
});
test('configuration records open compact full pages and viewer fields are disabled',()=>{
 const s=upgradeConfiguration(masterState);
 for(const edit of [true,false]){
  const html=renderToStaticMarkup(React.createElement(PageContext.Provider,{value:{records:true,title:'Payment Terms',can:r=>r==='view'||edit}},React.createElement(Configuration,{state:s,active:'Payment Terms',intent:{recordId:s.v2.configuration.terms[0].id},notify(){},commit(){}})));
  assert.ok(html.includes('v2-config-form'));assert.ok(!html.includes('role="dialog"'));assert.ok(html.includes('Due Date Rule'));
  assert.equal(html.includes('heading-never'),false);assert.equal(html.includes('<fieldset disabled=""'),!edit);
 }
});

test('unified lookup renders one closed combobox with native validation and no permanent search',()=>{
 const options=[React.createElement('option',{key:'empty',value:''},'Select unit of measure'),React.createElement('option',{key:'hr',value:'hour'},'Hour (hr)')];
 const html=renderToStaticMarkup(React.createElement(SearchableSelect,{'aria-label':'Unit of Measure',value:'hour',required:true,onChange(){},children:options}));
 assert.equal((html.match(/role="combobox"/g)||[]).length,1);assert.ok(!html.includes('type="search"'));assert.ok(html.includes('hidden="" aria-hidden="true"'));assert.ok(html.includes('required=""'));assert.ok(html.includes('<span>Hour (hr)</span>'));
 assert.deepEqual(selectOptions(options).map(o=>o.value),['','hour']);
 const disabled=renderToStaticMarkup(React.createElement(SearchableSelect,{'aria-label':'Account',value:'hour',disabled:true,children:options}));assert.ok(disabled.includes('aria-haspopup="listbox" disabled=""'));
});
test('Masterfile customer/supplier display-name checkbox is grouped after the input; unwanted uploads and customer group are absent',()=>{
 const s=upgradeConfiguration(masterState);
 for(const page of ['Customers','Suppliers'])for(const edit of [false,true]){
  const original=s.v2[page==='Customers'?'customers':'suppliers'][0];
  const html=pageRender(Masterfile,{state:s,active:page,intent:edit?{recordId:original.id,mode:'edit'}:{create:true}});
  const group=html.split('class="v2-display-name-group"')[1].split('</div>')[0];
  assert.ok(group.indexOf('Display Name')<group.indexOf('Same as Registered Name'));assert.ok(group.includes('readOnly=""'));
  if(page==='Customers'){assert.ok(!html.includes('Customer Group'));assert.ok(!html.includes('Customer Logo'));assert.ok(!html.includes('type="file"'));}
  assert.ok(html.includes('Nature of Business'));assert.ok(html.includes('Financial &amp; Tax Information'));
 }
 for(const edit of [false,true]){const html=pageRender(Masterfile,{state:s,active:'Items',intent:edit?{recordId:s.v2.items[0].id,mode:'edit'}:{create:true}});assert.ok(!html.includes('type="file"'));assert.ok(!html.includes('Item Image'));assert.ok(html.includes('Sales Price'));}
});
test('inactive reference labels persist for existing values but are omitted from new lookup choices',()=>{
 const s=upgradeConfiguration(masterState),unit=s.v2.configuration.uoms[0];unit.active=false;
 const props={state:s,kind:'uoms',label:'Unit of Measure',onChange(){}};
 const fresh=renderToStaticMarkup(React.createElement(RefLookup,{...props,value:'',previous:''}));
 const historic=renderToStaticMarkup(React.createElement(RefLookup,{...props,value:unit.id,previous:unit.id}));
 assert.ok(!fresh.includes(unit.name+' ('));assert.ok(historic.includes(unit.name+' ('+unit.abbreviation+')'));assert.ok(historic.includes('Inactive'));
});
test('General Ledger uses the shared lookup in V2 and retains the native V1 account selector',()=>{
 const props={active:'General Ledger',accountId:'3000',setAccountId(){},onLedger(){}};
 const original=render(ModuleScreen,props),updated=pageRender(ModuleScreen,props);
 assert.ok(original.includes('<select aria-label="Ledger account"'));assert.ok(!original.includes('v2-search-select'));
 assert.ok(updated.includes('v2-search-select'));assert.ok(updated.includes('role="combobox"'));assert.ok(updated.includes('Owner'));
});

test('all existing V2 record listings have no Actions column, Status last, and keyboard row destinations',()=>{
 const s=upgradeConfiguration(masterState),manager=createDirectory().users[1];
 const pages=['Items','Customers','Suppliers','Employees','Customer Invoices','Customer Credits','Customer Payments','Supplier Bills','Supplier Credits','Supplier Payments','Chart of Accounts','Journal Entries','General Ledger','Bank Accounts','Bank Transactions','Trial Balance','Account Reports','Receivables & Payables Reports','Item Configuration','Nature of Business','Customer Groups','Organizational Settings','Banks','Payment Terms'];
 for(const active of pages){
  const html=pageRender(V2Screens,{active,state:s,user:manager,accountId:'1000',setAccountId(){},onLedger(){}});
  assert.ok(!html.includes('>Actions<'),active);assert.ok(!html.includes('>Action<'),active);
  const header=html.split('<thead>')[1]?.split('</thead>')[0];if(header?.includes('>Status<'))assert.ok(/Status[\s\S]*<\/th><\/tr>$/.test(header),active);
  if(active!=='Bank Accounts')assert.ok(html.includes('v2-clickable-row'),active);assert.ok(!html.includes('<dialog'),active);
 }
 const html=pageRender(Users,{active:'Users & Permissions',directory:createDirectory(),saveUser:()=>({ok:true})});assert.ok(!html.includes('>Actions<'));assert.ok(html.includes('v2-clickable-row'));
});
test('draft transactions open directly for editing and posted documents remain read-only',()=>{
 const s=upgradeConfiguration(masterState);
 const invoice=s.invoices[0],draft={...invoice,id:'INV-UI-DRAFT',status:'Draft'};s.invoices.push(draft);
 const editable=pageRender(V2Screens,{active:'Customer Invoices',state:s,intent:{documentId:draft.id}});
 assert.ok(editable.includes('Save Changes'));assert.ok(editable.includes('Issue Invoice'));assert.ok(editable.includes('v2-record-page'));assert.ok(!editable.includes('<dialog'));
 const posted=pageRender(V2Screens,{active:'Customer Invoices',state:s,intent:{documentId:invoice.id}});assert.ok(!/<input[^>]*aria-label="Line price 1"/.test(posted));assert.ok(posted.includes('aria-readonly="true"')); assert.ok(posted.includes('Payment and adjustment history'));assert.ok(posted.includes('Record payment'));
 for(const kind of ['invoice','bill']){const note=allNotes(s,kind).find(n=>n.status==='Draft'&&n.type==='Credit Note'),page=kind==='invoice'?'Customer Credits':'Supplier Credits';assert.ok(pageRender(V2Screens,{active:page,state:s,intent:{noteId:note.id}}).includes('Save Changes'));
 const payment=s.v2.paymentDrafts.find(p=>p.kind===kind&&p.status==='Draft'),pPage=kind==='invoice'?'Customer Payments':'Supplier Payments',html=pageRender(V2Screens,{active:pPage,state:s,intent:{paymentId:payment.id}});assert.ok(html.includes('Save Changes'));assert.ok(html.includes('Payment Information'));assert.ok(!html.includes('<dialog'));}
});
test('account and user records are full pages with direct edits and existing supported actions',()=>{
 const s=upgradeConfiguration(masterState),dir=createDirectory();
 const account=pageRender(V2Screens,{active:'Chart of Accounts',state:s,intent:{recordId:'1000'},onLedger(){}});assert.ok(account.includes('Save Changes'));assert.ok(account.includes('View Ledger'));assert.ok(!account.includes('<dialog'));assert.ok(account.includes('disabled="" value="1000"'));
 const user=pageRender(Users,{active:'Users & Permissions',directory:dir,intent:{userId:dir.users[0].id},saveUser:()=>({ok:true})});assert.ok(user.includes('Save Changes'));assert.ok(user.includes('Deactivate'));assert.ok(user.includes('Individual permissions'));assert.ok(!user.includes('<dialog'));
});
test('V2 presentation removes action columns without changing V1 columns or CSV ordering',()=>{
 const columns=[{key:'status',label:'Status'},{key:'name',label:'Name'},{key:'actions',label:'Actions',render:()=>React.createElement('button',null,'Edit')}],rows=[{id:'one',name:'Example',status:'Draft'}];
 const v1=render(DataTable,{title:'Example',columns,rows}),v2=pageRender(DataTable,{active:'Example',title:'Example',columns,rows,onRowClick(){}});
 assert.ok(v1.includes('>Actions<'));assert.ok(v1.includes('>Edit<'));assert.ok(!v2.includes('>Actions<'));assert.ok(!v2.includes('>Edit<'));assert.ok(v2.includes('Open Example'));
});


test('V2 Masterfile Create and Edit forms omit uploads and group shipping controls and item fields',()=>{
 const s=upgradeConfiguration(masterState);
 for(const page of ['Items','Customers','Suppliers','Employees'])for(const edit of [false,true]){
  const record=s.v2[page.toLowerCase()][0],html=pageRender(Masterfile,{state:s,active:page,intent:edit?{recordId:record.id}:{create:true}});
  assert.ok(!html.includes('type="file"'));assert.ok(!html.includes('v2-image-panel'));assert.ok(!html.includes('Employee Image'));assert.ok(!html.includes('Supplier Logo'));
  if(['Customers','Suppliers'].includes(page)){
   assert.ok(!html.includes('Shipping Address (optional)'));
   assert.match(html,/<div class="v2-shipping-heading"><h2>Shipping Address<\/h2><label class="v2-checkbox">.*?Same as Billing Address<\/label><\/div>/);
   assert.match(html,/<input disabled="" type="text" value=/);
  }
  if(page==='Items'){
   const general=html.split('<h2>General Information</h2>')[1].split('</section>')[0];
   assert.match(general,/<label class="v2-full-width">Description<input[^>]*type="text"/);
   const fields=['Item Code','Item Name','Description','Item Type','Category','Unit of Measure'];
   for(let i=1;i<fields.length;i++)assert.ok(general.indexOf(fields[i-1])<general.indexOf(fields[i]));
   assert.equal((general.match(/aria-label="Category"/g)||[]).length,1);
  }
 }
});


test('Transaction views reuse core form sections with static saved values, no editing controls, and retained history',()=>{
 const s=upgradeConfiguration(masterState),snapshot=JSON.stringify(s);
 for(const [active,idKey,record] of [
  ['Customer Invoices','documentId',s.invoices.find(d=>d.status!=='Draft'&&d.status!=='Void')],
  ['Supplier Bills','documentId',s.bills.find(d=>d.status!=='Draft'&&d.status!=='Void')],
  ...['invoice','bill'].flatMap(kind=>[[kind==='invoice'?'Customer Credits':'Supplier Credits','noteId',allNotes(s,kind).find(n=>n.status==='Posted')],[kind==='invoice'?'Customer Payments':'Supplier Payments','paymentId',s.v2.payments.find(p=>p.kind===kind)]]),
  ['Journal Entries','entryId',s.entries.find(e=>e.status==='Posted')],
  ['Bank Transactions','entryId',s.entries.find(e=>e.status==='Posted'&&e.lines.some(l=>l.accountId==='1000'))]
 ]){
  assert.ok(record,active);const html=pageRender(V2Screens,{state:s,active,intent:{[idKey]:record.id}}),body=html.split('class="v2-record-page"')[1]?.split('<h2>Mapping Review Required</h2>')[0];
  assert.ok(body,active);assert.ok(body.includes('v2-readonly-field'),active);assert.ok(body.includes('can no longer be edited.'),active);
  assert.ok(!/<(?:input|select|textarea)\b/.test(body),active);assert.ok(!body.includes('role="combobox"'),active);
  assert.ok(!body.includes('Save Changes'),active);assert.ok(!body.includes('Add Line'),active);
  if(idKey==='documentId'){
   const sections=['Document Information','Line Items','Notes and Totals','Payment Summary','Payment and adjustment history'];
   for(let i=1;i<sections.length;i++)assert.ok(body.indexOf(sections[i])>body.indexOf(sections[i-1]),active);
   assert.ok(body.includes('Price (₱)'));assert.ok(body.includes('Tax (%)'));assert.ok(body.includes('Line Total'));
  }
 }
 assert.equal(JSON.stringify(s),snapshot);
});

test('Posted document display retains transaction snapshots after catalog and party defaults change',()=>{
 const s=upgradeConfiguration(masterState),d=s.invoices.find(d=>d.status!=='Draft'&&d.status!=='Void');
 Object.assign(d,{customer:'Saved customer snapshot',notes:'Saved transaction note',subtotal:24690,tax:2963,total:27653,items:[{itemId:s.v2.items[0].id,itemCode:'SAVED-ITEM',description:'Saved line description',uom:'saved unit',quantity:2,rate:12345,taxRate:12,subtotal:24690,tax:2963,total:27653,accountId:'4000'}]});
 Object.assign(s.v2.items[0],{description:'NEW CATALOG DESCRIPTION',salesPrice:999999,salesTax:99});s.v2.customers.find(p=>p.id===d.partyId).name='NEW CUSTOMER NAME';
 const html=pageRender(DocumentForm,{state:s,active:'Customer Invoices',kind:'invoice',document:d});
 for(const value of ['Saved customer snapshot','Saved transaction note','Saved line description','SAVED-ITEM','saved unit','₱123.45','₱276.53'])assert.ok(html.includes(value),value);
 assert.ok(!html.includes('NEW CATALOG DESCRIPTION'));assert.ok(!html.includes('NEW CUSTOMER NAME'));assert.ok(!/<(?:input|select|textarea)\b/.test(html));
});

test('Read-only transaction fields have no native editing or dropdown behavior and format dates consistently',()=>{
 const html=renderToStaticMarkup(React.createElement(ReadOnlyFields.Provider,{value:true},React.createElement(React.Fragment,null,React.createElement(TransactionInput,{type:'date',value:'2026-10-26','aria-label':'Posting date'}),React.createElement(TransactionSelect,{value:'old','aria-label':'Account'},React.createElement('option',{value:'old'},'Saved account')))));
 assert.ok(html.includes('Oct 26, 2026'));assert.ok(html.includes('Saved account'));assert.ok(html.includes('aria-readonly="true"'));assert.ok(!/<(?:input|select|button)\b/.test(html));assert.equal(transactionDate(''),'—');
});


test('Banking forms share creation and read-only layouts with native listing navigation and protected completed data',()=>{
 let s=upgradeBanking(masterState);s=reduceBanking(s,{type:'account',account:{code:'1010',name:'Cash in Bank – BDO',type:'Asset',group:'Cash & bank'}});s=reduceBanking(s,{type:'v2/bankAccount',record:{name:'BDO Operating Account',bankId:s.v2.configuration.banks[0].id,glAccountId:'1010',accountNumber:'1234567890',currency:'PHP',active:true}});
 const account=s.v2.bankAccounts[0];
 const createAccount=pageRender(V2Screens,{state:s,active:'Bank Accounts',intent:{create:true}});for(const label of ['Bank Account Information','Opening Balance Information','Linked GL Account'])assert.ok(createAccount.includes(label));assert.ok(!createAccount.includes('<dialog'));
 const listing=pageRender(V2Screens,{state:s,active:'Bank Accounts'});assert.ok(listing.includes('•••• 7890'));assert.ok(!listing.includes('1234567890'));assert.ok(listing.includes('v2-clickable-row'));
 const create=pageRender(V2Screens,{state:s,active:'Bank Reconciliation',intent:{create:true}});for(const label of ['Reconciliation Information','Bank Statement Entries','Transaction Matching','Reconciliation Summary'])assert.ok(create.includes(label));assert.ok(!create.includes('<dialog'));
 s=reduceBanking(s,{type:'v2/reconciliation',record:{bankAccountId:account.id,startDate:'2026-10-01',endDate:'2026-10-26',endingBalance:0,statement:[],matches:[],reviewed:true},complete:true,actor:'UI test operator'});
 const completed=pageRender(V2Screens,{state:s,active:'Bank Reconciliation',intent:{recordId:s.v2.reconciliations[0].id}}),body=completed.split('class="v2-record-page"')[1];assert.ok(body.includes('This reconciliation is completed'));assert.ok(body.includes('UI test operator'));assert.ok(!/<(?:input|select|textarea)\b/.test(body));assert.ok(!body.includes('Complete Reconciliation'));assert.ok(body.includes('Audit History'));
});


test('Payment summary uses shared vertical rows and exact saved totals for AR and AP',()=>{
 const html=renderToStaticMarkup(React.createElement(PaymentSummary,{amount:1000000,allocated:800000}));assert.ok(html.includes('<dt>Payment Amount</dt><dd>₱10,000.00</dd>'));assert.ok(html.includes('<dt>Allocated Amount</dt><dd>₱8,000.00</dd>'));assert.ok(html.includes('<dt>Unapplied Amount</dt><dd>₱2,000.00</dd>'));
 for(const kind of ['invoice','bill']) {const body=pageRender(PaymentForm,{state:upgradeBanking(masterState),active:kind==='invoice'?'Customer Payments':'Supplier Payments',kind});assert.ok(body.includes('v2-payment-summary'));assert.match(body,/<div class="v2-field-grid"><label>Payment reference/);}
});
test('Dedicated bank forms retain two-column positions, live preview, inline status and readonly posted journal',()=>{
 let s=upgradeBanking(masterState);s=reduceBanking(s,{type:'account',account:{code:'1010',name:'Cash in Bank – BDO',type:'Asset',group:'Cash & bank'}});s=reduceBanking(s,{type:'v2/bankAccount',record:{name:'BDO Operating Account',bankId:s.v2.configuration.banks[0].id,glAccountId:'1010',accountNumber:'1234567890',currency:'PHP',active:true}});
 const create=pageRender(BankTransactionForm,{state:s,active:'Bank Transactions'});for(const text of ['Transaction Information','Accounting Preview','Incomplete preview','Post Transaction','Save Draft','v2-record-title-inline'])assert.ok(create.includes(text),text);assert.ok(!create.includes('Journal Lines'));assert.ok(!create.includes('Add line'));assert.match(create,/<label>Reference<input/);assert.match(create,/<label class="v2-full-width">Description<input/);
 const r={requestId:'ui-bank',bankAccountId:s.v2.bankAccounts[0].id,type:'Bank Charge',offsetAccountId:'5200',amount:25000,date:'2026-10-26',reference:'UI-FEE',description:'Saved bank fee',status:'Draft'};s=reduceBanking(s,{type:'v2/bankTransaction',record:r});const draft=s.v2.bankTransactions[0],edit=pageRender(BankTransactionForm,{state:s,active:'Bank Transactions',transaction:draft});assert.ok(edit.includes('Balanced'));assert.ok(edit.includes('Bank Charges Expense Account'));assert.ok(edit.includes('value="250.00"'));
 s=reduceBanking(s,{type:'v2/bankTransaction',record:{...draft,status:'Posted'}});const posted=s.v2.bankTransactions[0],entry=s.entries.find(e=>e.id===posted.entryId),view=pageRender(BankTransactionForm,{state:s,active:'Bank Transactions',transaction:posted,entry});const body=view.split('class="v2-record-page"')[1];assert.ok(!/<(?:input|select|textarea)\b/.test(body));assert.ok(body.includes('Saved bank fee'));assert.ok(body.includes(entry.id));assert.ok(body.includes('Accounting Preview'));assert.ok(!body.includes('Post Transaction'));assert.ok(!body.includes('Add line'));
});
