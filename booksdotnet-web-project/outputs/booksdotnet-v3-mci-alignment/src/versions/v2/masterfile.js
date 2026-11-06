import { validateMasterRefs, validateRef, priorDocumentLine } from './configuration-data.js';
import { TODAY } from '../../data.js';
import { accountBalance, balanceAt, reduceWorkspace, validateEntry } from '../../accounting.js';
import { upgradeTransactions, reduceTransactions, postEntry } from './transactions.js';
export const MASTER_PAGES = ['Items', 'Customers', 'Suppliers', 'Employees'];
export const masterKey = page => ({ Items: 'items', Customers: 'customers', Suppliers: 'suppliers', Employees: 'employees' })[page];
const text = value => String(value || '').trim();
const normalized = value => text(value).toLowerCase();
const amount = value => Number.isSafeInteger(value) && value >= 0 && value <= 100000000000;
export const nextCode = (prefix, records) => `${prefix}-${String(Math.max(0, ...records.map(r => Number((r.code || r.id).split('-').at(-1)) || 0)) + 1).padStart(4, '0')}`;
export const controlAccounts = (state, kind) => state.accounts.filter(a => a.active && (kind === 'invoice' ? a.type === 'Asset' && /receivable/i.test(a.name) : a.type === 'Liability' && /payable/i.test(a.name) && !/tax/i.test(a.name)));
export const purchaseAccounts = state => state.accounts.filter(a => a.active && (a.type === 'Expense' || a.type === 'Asset' && !['Cash & bank'].includes(a.group) && !/receivable/i.test(a.name) && a.id !== 'booksdotnet-supplier-prepayments'));
const address = () => ({ line1: '', line2: '', city: '', province: '', postal: '', country: 'Philippines' });
function blankMasterRaw(state, page) {
  const list = state.v2[masterKey(page)] || [], code = nextCode(({ Items: 'ITM', Customers: 'CUS', Suppliers: 'SUP', Employees: 'EMP' })[page], list);
  if (page === 'Items') return { code, name: '', type: 'Service', description: '', category: '', uom: 'service', image: '', active: true, canSell: true, canPurchase: false, salesPrice: 0, purchasePrice: 0, incomeAccountId: '4000', purchaseAccountId: '5200', salesTax: 0, purchaseTax: 0 };
  if (page === 'Employees') return { code, firstName: '', lastName: '', middleName: '', suffix: '', gender: '', birthdate: '', email: '', phone: '', workPhone: '', branch: '', department: '', position: '', employmentStatus: '', image: '', active: true };
  return { code, registeredName: '', name: '', sameName: true, partyType: '', nature: '', image: '', currency: 'PHP', tin: '', vatClass: '', withholding: '', creditLimit: null, terms: 30, controlAccountId: '', email: '', phone: '', address: '', contacts: [], billing: address(), shipping: address(), sameAddress: true, active: true };
}
export function blankMaster(state,page) {
 const r=blankMasterRaw(state,page), cfg=state.v2.configuration;
 if(!cfg)return r;
 if(page==='Items'){r.categoryId='';r.uomId=cfg.uoms.find(u=>u.active&&u.abbreviation==='service')?.id||'';}
 else if(page==='Employees'){r.branchId='';r.departmentId='';r.positionId='';}
 else {r.natureId='';r.paymentTermId=cfg.terms.find(t=>t.active&&t.days===30)?.id||'';if(page==='Customers')r.customerGroupId='';}
 return r;
}
export function upgradeMasterfile(state) {
  const next = upgradeTransactions(state);
  for (const page of ['Customers', 'Suppliers']) for (const p of next.v2[masterKey(page)]) {
    const defaults = blankMasterRaw(next, page);
    for (const [key, value] of Object.entries({ ...defaults, code: p.id, registeredName: p.name, sameName: true, billing: { ...address(), line1: p.address || '' }, contacts: p.email || p.phone ? [{ id: 'legacy-contact', primary: true, name: p.name, department: 'Accounts', position: '', phone: p.phone || '', workPhone: '', email: p.email || '' }] : [] })) if (p[key] === undefined) p[key] = value;
  }
  next.v2.accountingDefaults ||= { receivableAccountId:'1100', payableAccountId:'2000' };
  if (!next.v2.items) next.v2.items = [
    ['ITM-0001', 'Monthly bookkeeping', 'Service', 'Accounting services', 'month', 1500000, 0, true, false, '4000', '5200'],
    ['ITM-0002', 'Tax preparation assistance', 'Service', 'Professional services', 'engagement', 800000, 450000, true, true, '4000', '5400'],
    ['ITM-0003', 'Office paper A4', 'Product', 'Office supplies', 'ream', 28000, 22000, true, true, '4000', '5200'],
    ['ITM-0004', 'Office laptop', 'Product', 'Equipment', 'unit', 4800000, 4200000, true, true, '4000', '1200'],
    ['ITM-0005', 'Cloud accounting subscription', 'Service', 'Software', 'month', 250000, 180000, true, true, '4000', '5200'],
    ['ITM-0006', 'Professional training', 'Service', 'Professional services', 'session', 1200000, 650000, true, true, '4000', '5400'],
  ].map(([code, name, type, category, uom, salesPrice, purchasePrice, canSell, canPurchase, incomeAccountId, purchaseAccountId]) => ({ code, id: code, name, description: name, type, category, uom, salesPrice, purchasePrice, canSell, canPurchase, incomeAccountId, purchaseAccountId, salesTax: 0, purchaseTax: 0, active: true, image: '' }));
  if (!next.v2.employees) next.v2.employees = [['Mara', 'Dela Cruz', 'Finance', 'Accounting Officer'], ['Paolo', 'Mendoza', 'Operations', 'Operations Coordinator'], ['Camille', 'Ramos', 'Administration', 'Office Administrator'], ['Enzo', 'Navarro', 'Finance', 'Accounting Assistant']].map(([firstName, lastName, department, position], i) => ({ ...blankMaster(next, 'Employees'), id: `EMP-${String(i + 1).padStart(4, '0')}`, code: `EMP-${String(i + 1).padStart(4, '0')}`, firstName, lastName, name: `${firstName} ${lastName}`, email: `${firstName.toLowerCase()}@booksdotnet.example`, branch: i % 2 ? 'Quezon City' : 'Makati', department, position, employmentStatus: 'Regular', active: true }));
  return next;
}
function checkDate(value, label) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value || value > TODAY) throw new Error(`${label} must be a valid date no later than ${TODAY}.`); }
function checkImage(value) { if (value && (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) || value.length > 700000)) throw new Error('Choose a PNG, JPEG or WebP image smaller than 500 KB.'); }
export function reduceMasterfile(state, action) {
  let next = upgradeMasterfile(state);
  if (['invoice','sendInvoice'].includes(action.type) && next.invoices.find(d=>d.id===(action.invoice?.id||action.id))?.controlAccountId) throw new Error('Use the V2 source workflow to edit or issue this catalog-based draft.');
  if (action.type==='payment') { const doc=(action.kind==='bill'?next.bills:next.invoices).find(d=>d.id===action.id); if(doc?.controlAccountId && doc.controlAccountId!==(action.kind==='bill'?'2000':'1100')) throw new Error('Use the V2 source workflow for this document’s configured control account.'); }
  if (action.type === 'v2/master') {
    const page = action.page, key = masterKey(page); if (!key) throw new Error('Unknown masterfile.');
    const list = next.v2[key], input = structuredClone(action.record), old = list.find(r => r.id === input.id);
    if (input.id && !old) throw new Error('This record no longer exists.');
    const record = { ...input, id: old?.id || nextCode(({ Items: 'ITM', Customers: 'CUS', Suppliers: 'SUP', Employees: 'EMP' })[page], list), code: old?.code || nextCode(({ Items: 'ITM', Customers: 'CUS', Suppliers: 'SUP', Employees: 'EMP' })[page], list) };
    if (old && input.code !== old.code) throw new Error('Record codes cannot be changed.');
    if (list.some(r => r.id !== old?.id && r.code === record.code)) throw new Error('This record code already exists.');
    validateMasterRefs(next,page,record,old);
    if (typeof record.active !== 'boolean') throw new Error('Choose an Active or Inactive status.'); checkImage(record.image);
    if (page === 'Items') {
      if (typeof record.canSell !== 'boolean' || typeof record.canPurchase !== 'boolean') throw new Error('Choose valid sales and purchase availability.');
      if (!text(record.name) || !['Product', 'Service'].includes(record.type)) throw new Error('Item name and type are required.');
      for (const [enabled, price, accountId, tax, accounts] of [[record.canSell, record.salesPrice, record.incomeAccountId, record.salesTax, next.accounts.filter(a => a.active && a.type === 'Revenue')], [record.canPurchase, record.purchasePrice, record.purchaseAccountId, record.purchaseTax, purchaseAccounts(next)]]) if (enabled && (!amount(price) || !accounts.some(a => a.id === accountId) || !Number.isFinite(tax) || tax < 0 || tax > 100)) throw new Error('Enter valid prices, tax rates and an appropriate active posting account.');
    } else if (page === 'Employees') {
      if (![record.firstName, record.lastName, record.branch, record.department, record.position].every(v => text(v))) throw new Error('First name, last name, branch, department and position are required.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) throw new Error('A valid employee email is required.');
      if (record.birthdate) checkDate(record.birthdate, 'Birthdate');
      record.name = [record.firstName, record.middleName, record.lastName, record.suffix].filter(Boolean).join(' ');
    } else {
      if (!text(record.registeredName)) throw new Error('Registered name is required.');
      record.name = text(record.sameName ? record.registeredName : record.name); if (!record.name) throw new Error('Display name is required.');
      if (list.some(r => r.id !== old?.id && normalized(r.name) === normalized(record.name))) throw new Error('This customer or supplier name already exists.');
      if (record.currency !== 'PHP' || !Number.isInteger(record.terms) || record.terms < 0 || record.terms > 365 || record.creditLimit !== null && !amount(record.creditLimit)) throw new Error('Use PHP, valid payment terms (0–365 days) and a valid optional credit limit.');
      if (record.controlAccountId && !controlAccounts(next, page === 'Customers' ? 'invoice' : 'bill').some(a => a.id === record.controlAccountId)) throw new Error('Choose an appropriate active receivable or payable account.');
      if (!Array.isArray(record.contacts) || record.contacts.filter(c => c.primary).length > 1) throw new Error('Select at most one primary contact.');
      for (const c of record.contacts) if (!text(c.name) || c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) throw new Error('Every contact needs a name and a valid email when supplied.');
      if (record.sameAddress) record.shipping = { ...record.billing };
      const primary = record.contacts.find(c => c.primary) || record.contacts[0]; record.email = primary?.email || ''; record.phone = primary?.phone || ''; record.address = Object.values(record.billing).filter(Boolean).join(', ');
      record.aliases = [...new Set([...(old?.aliases || []), ...(old ? [old.name] : [])])];
    }
    record.history = [...(old?.history || []), { date: TODAY, action: old ? 'Updated' : 'Created' }];
    if (old) Object.assign(old, record); else list.push(record);
    return next;
  }
  if (action.type === 'v2/accountingDefaults') { for (const [kind,key] of [['invoice','receivableAccountId'],['bill','payableAccountId']]) if (!controlAccounts(next,kind).some(a=>a.id===action.defaults[key])) throw new Error('Choose appropriate receivable and payable accounts.'); next.v2.accountingDefaults={...action.defaults}; return next; }
  if (['v2/invoice', 'v2/bill'].includes(action.type) && action.document.items?.length) return saveDocument(next, action);
  if (action.type === 'v2/bankJournal') {
    if (!action.entry.lines.some(l => next.accounts.some(a => a.id === l.accountId && a.group === 'Cash & bank') && (l.debit || l.credit))) throw new Error('A bank transaction must include a cash / bank movement.');
    const old = next.entries.find(e => e.id === action.entry.id); if (old && !old.bankTransaction) throw new Error('Use the source transaction workflow to change this entry.');
    return upgradeMasterfile(reduceWorkspace(next, { type: 'journal', entry: { ...action.entry, bankTransaction: true } }));
  }
  return upgradeMasterfile(reduceTransactions(next, action));
}
export function documentTotals(items) {
  const lines = items.map(i => {
    if (!text(i.description) || !Number.isInteger(i.quantity) || i.quantity <= 0 || !amount(i.rate) || i.rate === 0 || !Number.isFinite(i.taxRate ?? 0) || i.taxRate < 0 || i.taxRate > 100) throw new Error('Each line needs a description, positive whole quantity, positive price and valid tax rate.');
    const subtotal = i.quantity * i.rate, tax = Math.round(subtotal * (i.taxRate || 0) / 100);
    if (!amount(subtotal + tax)) throw new Error('Line amount is too large.');
    return { ...i, subtotal, tax, total: subtotal + tax };
  });
  if (!lines.length) throw new Error('Add at least one line item.');
  const subtotal = lines.reduce((s, l) => s + l.subtotal, 0), tax = lines.reduce((s, l) => s + l.tax, 0); if (!amount(subtotal + tax)) throw new Error('Document total is too large.');
  return { items: lines, subtotal, tax, total: subtotal + tax };
}
function saveDocument(next, action) {
  const invoice = action.type === 'v2/invoice', kind = invoice ? 'invoice' : 'bill', list = invoice ? next.invoices : next.bills, d = structuredClone(action.document), old = list.find(x => x.id === d.id);
  if (d.id && (!old || old.status !== 'Draft')) throw new Error('Only draft documents can be edited.');
  validateRef(next,'terms',d.paymentTermId,old?.paymentTermId,Boolean(next.v2.configuration));
  const party = next.v2[invoice ? 'customers' : 'suppliers'].find(p => p.id === d.partyId && (p.active || p.id===old?.partyId)); if (!party) throw new Error('Choose an active customer or supplier.');
  checkDate(d.issueDate, 'Issue date'); if (!/^\d{4}-\d{2}-\d{2}$/.test(d.dueDate) || Number.isNaN(Date.parse(d.dueDate)) || new Date(d.dueDate).toISOString().slice(0, 10) !== d.dueDate || d.dueDate < d.issueDate) throw new Error('Choose a valid due date on or after the issue date.');
  if (!['Draft', invoice ? 'Sent' : 'Unpaid'].includes(d.status)) throw new Error('Invalid document status.');
  if (!invoice && (!text(d.reference) || list.some(x => x.id !== old?.id && x.partyId === party.id && normalized(x.reference) === normalized(d.reference)))) throw new Error('Enter a unique supplier reference.');
  const totals = documentTotals(d.items.map(l => ({ ...l, taxRate: l.taxRate ?? d.taxRate ?? 0 })));
  for (const [index,l] of totals.items.entries()) {
    const prior=priorDocumentLine(old,l,index);
    const priorUom=prior?.uomId || next.v2.configuration?.uoms.find(u=>u.abbreviation===prior?.uom)?.id;
    validateRef(next,'uoms',l.uomId,priorUom,Boolean(next.v2.configuration));
    if(next.v2.configuration)l.uom=next.v2.configuration.uoms.find(u=>u.id===l.uomId).abbreviation;
    if (!(invoice ? next.accounts.some(a => a.active && a.id === l.accountId && a.type === 'Revenue') : purchaseAccounts(next).some(a => a.id === l.accountId))) throw new Error('Choose an appropriate active posting account for every line.');
    if (l.itemId) l.itemCode = next.v2.items.find(i=>i.id===l.itemId)?.code || l.itemCode;
    if (l.itemId && !next.v2.items.some(i => i.id === l.itemId && (old?.items?.some(x => x.itemId === i.id) || i.active && (invoice ? i.canSell : i.canPurchase)))) throw new Error('Choose an active item available for this transaction, or use a manual line.');
  }
  const controlAccountId = party.controlAccountId || next.v2.accountingDefaults[invoice ? 'receivableAccountId' : 'payableAccountId'];
  if (!controlAccounts(next,kind).some(a=>a.id===controlAccountId)) throw new Error('The configured control account must be active and appropriate for this document.');
  const doc = { ...d, ...totals, controlAccountId, kind, id: old?.id || nextCode(invoice ? 'INV-2026' : 'BILL-2026', list), [invoice ? 'customer' : 'vendor']: party.name, email: party.email, payments: [], credits: [], accountId: totals.items[0].accountId, description: d.description || totals.items.map(l => l.description).join('; '), history: [...(old?.history || []), { date: TODAY, action: d.status === 'Draft' ? 'Draft saved' : 'Posted' }] };
  if (d.status !== 'Draft') {
    const lines = invoice ? [{ accountId: controlAccountId, debit: doc.total, credit: 0 }, ...doc.items.map(l => ({ accountId: l.accountId, debit: 0, credit: l.subtotal })), ...(doc.tax ? [{ accountId: '2100', debit: 0, credit: doc.tax }] : [])] : [...doc.items.map(l => ({ accountId: l.accountId, debit: l.total, credit: 0 })), { accountId: controlAccountId, debit: 0, credit: doc.total }];
    doc.entryId = postEntry(next, { date: doc.issueDate, reference: doc.id, memo: `${invoice ? 'Invoice' : 'Bill'} · ${party.name}`, source: kind, sourceId: doc.id, lines });
  }
  if (old) Object.assign(old, doc); else list.push(doc); return next;
}
export function partySummary(state, page, id, end) {
  const docs = (page === 'Customers' ? state.invoices : state.bills).filter(d => d.partyId === id);
  return { outstanding: docs.reduce((s, d) => s + balanceAt(d, end), 0), overdue: docs.filter(d => d.dueDate < end).reduce((s, d) => s + balanceAt(d, end), 0), docs };
}
