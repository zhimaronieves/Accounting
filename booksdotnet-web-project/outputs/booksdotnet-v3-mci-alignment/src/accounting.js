import { SUBSIDIARY_TYPES } from './account-fields.js';
import { hasChildren, isPostableAccount, reconcileSampleHierarchy, directAccountActivity, validateAccountRelationship, assertAccountHierarchy } from './account-hierarchy.js';
import { TODAY, transactions as seedTransactions, invoices as oldInvoices } from './data.js';

export const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];
export const CUSTOMERS = ['Mercado Foods', 'Tala Creative', 'Northline Logistics', 'Isla Ventures', 'Bayan Retail', 'Sariwa Organics', 'Pacific Works', 'Kubo Living'];
export const VENDORS = ['BGC Property Management', 'Cloudline Systems', 'Amplify Digital', 'Metro Utilities', 'Pacific Office Supply'];
export const STORAGE_KEY = 'booksdotnet-v3-mci-accounting-v1';
export const debitNormal = type => type === 'Asset' || type === 'Expense';
export const cents = value => {
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error('Enter a valid amount with no more than two decimal places.');
  const [whole, fraction = ''] = text.split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount > 100000000000) throw new Error('The amount is too large.');
  return amount;
};
const dateValid = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const requireDate = (value, title = 'Date') => { if (!dateValid(value)) throw new Error(`${title} is invalid.`); };
const textRequired = (value, name) => { if (!String(value || '').trim()) throw new Error(`${name} is required.`); };
const amountValid = value => Number.isSafeInteger(value) && value >= 0;
const nextId = (prefix, records) => `${prefix}-${String(records.reduce((max, x) => Math.max(max, Number(x.id.split('-').at(-1)) || 0), 0) + 1).padStart(4, '0')}`;
const line = (accountId, debit = 0, credit = 0) => ({ accountId, debit, credit });
export const inRange = (date, range) => date >= range.start && date <= range.end;
export const adjustmentBalance = (doc, end = '9999-12-31') => (doc.adjustments || []).filter(a => a.date <= end).reduce((s, a) => s + a.balanceDelta, 0);
export const outstanding = doc => doc.status === 'Void' || doc.status === 'Draft' ? 0 : doc.total + adjustmentBalance(doc) - doc.payments.reduce((sum, p) => sum + p.amount, 0) - (doc.credits || []).reduce((sum, c) => sum + c.amount, 0);
export const balanceAt = (doc, end = TODAY) => doc.issueDate > end || doc.status === 'Draft' || doc.status === 'Void' && (!doc.voidDate || doc.voidDate <= end) ? 0 : doc.total + adjustmentBalance(doc, end) - doc.payments.filter(p => p.date <= end).reduce((sum, p) => sum + p.amount, 0) - (doc.credits || []).filter(c => c.date <= end).reduce((sum, c) => sum + c.amount, 0);
export const documentStatus = (doc, asOf = TODAY) => doc.status === 'Draft' ? 'Draft' : doc.status === 'Void' && (!doc.voidDate || doc.voidDate <= asOf) ? 'Void' : balanceAt(doc, asOf) === 0 ? 'Paid' : doc.dueDate < asOf ? 'Overdue' : doc.payments.some(p => p.date <= asOf) ? 'Partial' : (doc.kind === 'bill' ? 'Unpaid' : 'Sent');
export function invoiceTotals(items, taxRate = 0) {
  if (!Array.isArray(items) || !items.length) throw new Error('Add at least one invoice item.');
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) throw new Error('Tax rate must be between 0 and 100.');
  const subtotal = items.reduce((sum, item) => {
    textRequired(item.description, 'Item description');
    if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 100000) throw new Error('Item quantities must be positive whole numbers.');
    if (!amountValid(item.rate) || item.rate <= 0) throw new Error('Item rates must be greater than zero.');
    return sum + item.quantity * item.rate;
  }, 0);
  const tax = Math.round(subtotal * taxRate / 100);
  if (!Number.isSafeInteger(subtotal + tax) || subtotal + tax > 100000000000) throw new Error('Invoice total is too large.');
  return { subtotal, tax, total: subtotal + tax };
}
export function validateEntry(entry, accounts, posting = false) {
  requireDate(entry.date); if (entry.date > TODAY) throw new Error('Future-dated journals cannot be saved in this demo snapshot.');
  textRequired(entry.memo, 'Description');
  if (!Array.isArray(entry.lines) || entry.lines.length < 2) throw new Error('A journal needs at least two lines.');
  let debit = 0, credit = 0;
  for (const l of entry.lines) {
    const account = accounts.find(a => a.id === l.accountId);
    if (!account || !account.active) throw new Error('Choose an active account for every journal line.');
    if(!isPostableAccount(accounts,account))throw new Error('Grouping accounts cannot receive direct postings. Choose an active leaf account.');
    if (entry.source === 'manual' && ['1100', '2000', 'booksdotnet-customer-advances', 'booksdotnet-supplier-prepayments'].includes(l.accountId)) throw new Error('Receivables and payables are controlled by invoices, bills, and their payments. Use another account for a manual adjustment.');
    if (!amountValid(l.debit) || !amountValid(l.credit) || (l.debit > 0 && l.credit > 0)) throw new Error('Each line must contain a debit or a credit, not both.');
    if (posting && !l.debit && !l.credit) throw new Error('Remove empty lines before posting.');
    debit += l.debit; credit += l.credit;
  }
  if (!Number.isSafeInteger(debit) || !Number.isSafeInteger(credit)) throw new Error('Journal total is too large.');
  if (posting && (!debit || debit !== credit)) throw new Error('Debits and credits must be equal and greater than zero before posting.');
  return { debit, credit, difference: debit - credit };
}
const expenseAccounts = { 'Payroll Expense': '5000', 'Rent Expense': '5100', 'Software Expense': '5200', 'Marketing Expense': '5300', 'Professional Fees': '5400', 'Utilities Expense': '5500', 'Repairs & Maintenance': '5600', 'Travel Expense': '5700', 'Insurance Expense': '5800' };
export function createWorkspace() {
  const accounts = [
    ['1000', 'Cash & bank', 'Asset', 'Cash & bank'], ['1100', 'Accounts Receivable', 'Asset', 'Current assets'], ['1200', 'Office equipment', 'Asset', 'Fixed assets'], ['1300', 'Prepaid expenses', 'Asset', 'Current assets'],
    ['2000', 'Accounts Payable', 'Liability', 'Current liabilities'], ['2100', 'Tax payable', 'Liability', 'Current liabilities'], ['2200', 'Business loan', 'Liability', 'Long-term liabilities'], ['2300', 'Accrued expenses', 'Liability', 'Current liabilities'], ['3000', 'Owner capital', 'Equity', 'Equity'], ['4000', 'Service revenue', 'Revenue', 'Revenue'],
    ['5000', 'Payroll Expense', 'Expense', 'Payroll'], ['5100', 'Rent Expense', 'Expense', 'Operations'], ['5200', 'Software Expense', 'Expense', 'Operations'], ['5300', 'Marketing Expense', 'Expense', 'Marketing'], ['5400', 'Professional Fees', 'Expense', 'Others'], ['5500', 'Utilities Expense', 'Expense', 'Utilities'], ['5600', 'Repairs & Maintenance', 'Expense', 'Operations'], ['5700', 'Travel Expense', 'Expense', 'Others'], ['5800', 'Insurance Expense', 'Expense', 'Others'],
  ].map(([id, name, type, group]) => ({ id, code: id, name, type, group, active: true, protected: ['1000', '1100', '2000', '2100', '3000', '4000'].includes(id) }));
  const entries = [{ id: 'JE-2026-0001', date: '2026-01-01', reference: 'OPENING', memo: 'Opening capital and office equipment', status: 'Posted', source: 'opening', lines: [line('1000', 200000000), line('1200', 45000000), line('3000', 0, 245000000)] }];
  const add = value => { const e = { id: nextId('JE-2026', entries), status: 'Posted', ...value }; entries.push(e); return e; };
  for (const t of [...seedTransactions].reverse()) {
    add({ date: t.date, reference: t.id, memo: t.description, source: 'seed', lines: t.type === 'Income' ? [line('1000', t.amount * 100), line('4000', 0, t.amount * 100)] : [line(expenseAccounts[t.account], t.amount * 100), line(t.status === 'Pending' ? '2000' : '1000', 0, t.amount * 100)] });
  }
  const invoices = oldInvoices.map((i, n) => {
    const customer = CUSTOMERS[n % CUSTOMERS.length];
    const doc = { ...i, kind: 'invoice', customer, email: `accounts@${customer.toLowerCase().replaceAll(' ', '')}.example.com`, issueDate: i.date, dueDate: n < 2 || n === 7 ? '2026-10-24' : '2026-11-15', status: 'Sent', items: [{ description: 'Professional services · October', quantity: 1, rate: i.amount * 100 }], taxRate: 0, subtotal: i.amount * 100, tax: 0, total: i.amount * 100, notes: 'Thank you for your business.', payments: [] };
    const e = add({ date: doc.issueDate, reference: doc.id, memo: `Invoice · ${customer}`, source: 'invoice', sourceId: doc.id, lines: [line('1100', doc.total), line('4000', 0, doc.total)] }); doc.entryId = e.id; return doc;
  });
  const rentEntry = entries.find(e => e.reference === 'TXN-2026-1097');
  const bills = [{ id: 'BILL-2026-0001', kind: 'bill', vendor: VENDORS[0], reference: 'BGC-OCT-2026', issueDate: '2026-10-24', dueDate: '2026-11-05', total: 8500000, accountId: '5100', description: 'Office lease · BGC', status: 'Unpaid', payments: [], entryId: rentEntry.id }];
  rentEntry.source = 'bill'; rentEntry.sourceId = bills[0].id;
  for (const [n, amount, accountId, dueDate, description] of [[1, 2400000, '5200', '2026-10-22', 'Annual software renewal'], [2, 3200000, '5300', '2026-11-02', 'Campaign production'], [3, 1850000, '5500', '2026-11-06', 'October utilities balance']]) {
    const doc = { id: nextId('BILL-2026', bills), kind: 'bill', vendor: VENDORS[n], reference: `VENDOR-OCT-${n}`, issueDate: '2026-10-20', dueDate, total: amount, accountId, description, status: 'Unpaid', payments: [] };
    doc.entryId = add({ date: doc.issueDate, reference: doc.id, memo: `${doc.vendor} · ${description}`, source: 'bill', sourceId: doc.id, lines: [line(accountId, amount), line('2000', 0, amount)] }).id; bills.push(doc);
  }
  entries.push({ id: nextId('JE-2026', entries), date: TODAY, reference: 'ADJ-OCT-REVIEW', memo: 'Payroll accrual · pending review', status: 'Draft', source: 'manual', lines: [line('5000', 1500000), line('2300', 0, 1500000)] });
  return withOwnerCapitalSamples({ version: 1, accounts, entries, invoices, bills });
}

export function withOwnerCapitalSamples(state) {
  const samples = [
    { date: '2026-10-03', reference: 'CAP-OCT-001', memo: 'Owner contribution · working capital', lines: [line('1000', 15000000), line('3000', 0, 15000000)] },
    { date: '2026-10-12', reference: 'CAP-OCT-002', memo: 'Owner contribution · office equipment', lines: [line('1200', 5000000), line('3000', 0, 5000000)] },
    { date: '2026-10-22', reference: 'CAP-OCT-003', memo: 'Return of owner capital · bank transfer', lines: [line('3000', 2500000), line('1000', 0, 2500000)] },
  ];
  const missing = samples.filter(sample => !state.entries.some(entry => entry.reference === sample.reference));
  if (!missing.length) return state;
  const next = { ...state, entries: [...state.entries] };
  for (const sample of missing) next.entries.push({ ...sample, id: nextId('JE-2026', next.entries), status: 'Posted', source: 'seed-capital' });
  return next;
}

export function postedEntries(state, end = '9999-12-31') { return state.entries.filter(e => e.status === 'Posted' && e.date <= end); }
export function accountBalance(state, id, end = '9999-12-31', start = '') {
  const account = state.accounts.find(a => a.id === id);
  const raw = postedEntries(state, end).filter(e => e.date >= start).flatMap(e => e.lines).filter(l => l.accountId === id).reduce((sum, l) => sum + l.debit - l.credit, 0);
  return raw === 0 ? 0 : debitNormal(account.type) ? raw : -raw;
}
export function ledgerRows(state, id, range) {
  let balance = accountBalance(state, id, range.start) - postedEntries(state, range.start).filter(e => e.date === range.start).flatMap(e => e.lines).filter(l => l.accountId === id).reduce((s, l) => s + (debitNormal(state.accounts.find(a => a.id === id).type) ? l.debit - l.credit : l.credit - l.debit), 0);
  const opening = balance; const rows = [];
  const account = state.accounts.find(a => a.id === id);
  for (const e of postedEntries(state, range.end).filter(e => e.date >= range.start).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))) for (const l of e.lines.filter(l => l.accountId === id)) {
    balance += debitNormal(account.type) ? l.debit - l.credit : l.credit - l.debit;
    rows.push({ ...l, entryId: e.id, date: e.date, memo: e.memo, reference: e.reference, balance });
  }
  return { opening, rows, closing: balance };
}
export function reportData(state, range) {
  const accounts = state.accounts.map(a => ({ ...a, balance: accountBalance(state, a.id, range.end), period: accountBalance(state, a.id, range.end, range.start) }));
  const sum = (type, key = 'balance') => accounts.filter(a => a.type === type).reduce((s, a) => s + a[key], 0);
  const revenue = sum('Revenue', 'period'), expenses = sum('Expense', 'period');
  const retained = sum('Revenue') - sum('Expense');
  const trial = accounts.map(a => { const raw = debitNormal(a.type) ? a.balance : -a.balance; return { ...a, debit: Math.max(0, raw), credit: Math.max(0, -raw) }; });
  const cashIds = accounts.filter(a => a.group === 'Cash & bank').map(a => a.id);
  const flows = { Operating: 0, Investing: 0, Financing: 0 };
  for (const e of postedEntries(state, range.end).filter(e => inRange(e.date, range) && e.lines.some(l => cashIds.includes(l.accountId)))) {
    for (const l of e.lines.filter(l => !cashIds.includes(l.accountId))) { const a = state.accounts.find(a => a.id === l.accountId); const group = a.type === 'Equity' || a.group === 'Long-term liabilities' ? 'Financing' : a.group === 'Fixed assets' ? 'Investing' : 'Operating'; flows[group] += l.credit - l.debit; }
  }
  const openingCash = cashIds.reduce((sum, id) => sum + ledgerRows(state, id, range).opening, 0);
  const closingCash = cashIds.reduce((sum, id) => sum + accountBalance(state, id, range.end), 0);
  return { accounts, revenue, expenses, profit: revenue - expenses, assets: sum('Asset'), liabilities: sum('Liability'), equity: sum('Equity'), retained, trial, flows, openingCash, closingCash };
}
export function agingData(documents, end = TODAY) {
  const buckets = { Current: 0, '1–30 days': 0, '31–60 days': 0, '61–90 days': 0, '90+ days': 0 };
  for (const doc of documents.filter(d => balanceAt(d, end) > 0)) {
    const balance = balanceAt(doc, end);
    const days = Math.floor((Date.parse(end) - Date.parse(doc.dueDate)) / 86400000);
    buckets[days <= 0 ? 'Current' : days <= 30 ? '1–30 days' : days <= 60 ? '31–60 days' : days <= 90 ? '61–90 days' : '90+ days'] += balance;
  }
  return buckets;
}
export function reduceWorkspace(state, action) {
  const next = structuredClone(state);
  const addEntry = entry => { validateEntry(entry, next.accounts, entry.status === 'Posted'); const saved = { ...entry, id: nextId('JE-2026', next.entries) }; next.entries.push(saved); return saved; };
  if (action.type === 'reconcileSampleHierarchy') return reconcileSampleHierarchy(next,{renameHeadings:action.renameHeadings===true});
  if (action.type === 'cashHierarchySample') {
    if (next.cashHierarchySampleVersion === 1 || next.hierarchyReconciliation?.version === 2) return next;
    const sample = [
      {code:'1001',name:'Cash & Bank',parentId:null},
      {code:'1010',name:'Cash on Hand',parentId:'1001'},
      {code:'1020',name:'BDO Checking Account',parentId:'1001'},
      {code:'1030',name:'BPI Savings Account',parentId:'1001'},
    ];
    for (const a of sample) {
      const old = next.accounts.find(x=>x.code===a.code || x.id===a.code);
      if (old) {
        if (old.id!==a.code || old.name!==a.name || old.type!=='Asset' || (old.parentId||null)!==a.parentId || !old.active) throw new Error(`Sample account ${a.code} conflicts with an existing record. No accounts were changed.`);
      } else {
        const candidate={...a,type:'Asset',group:'Cash & bank',active:true,protected:false};
        candidate.parentId=validateAccountRelationship(next,candidate);
        next.accounts.push({...candidate,id:a.code});
      }
    }
    next.cashHierarchySampleVersion=1;
  } else if (action.type === 'account') {
    const a = {...action.account};
    const existingMetadata=next.accounts.find(x=>x.id===a.id);
    if(a.legacyPostingParent!==existingMetadata?.legacyPostingParent)throw new Error('Legacy posting behavior can only be set by the controlled hierarchy migration.');
    textRequired(a.name, 'Account name'); textRequired(a.group, 'Classification');
    if (a.subsidiaryType != null && !SUBSIDIARY_TYPES.includes(a.subsidiaryType)) throw new Error('Choose a valid Subsidiary Type or None.');
    if (a.description != null && (typeof a.description !== 'string' || a.description.length > 500)) throw new Error('Description must contain no more than 500 characters.');
    a.parentId=validateAccountRelationship(next,a);
    if (!/^\d{4}$/.test(a.code) || !ACCOUNT_TYPES.includes(a.type)) throw new Error('Use a unique four-digit code and a valid account type.');
    if (next.accounts.some(x => x.code === a.code && x.id !== a.id)) throw new Error('This account code is already in use.');
    const old = next.accounts.find(x => x.id === a.id);
    if (old) { const used = next.entries.some(e => e.lines.some(l => l.accountId === old.id)); if ((used || old.protected) && (a.code !== old.code || a.type !== old.type || a.group !== old.group)) throw new Error('The code, type, and group of an account with history cannot be changed.'); Object.assign(old, a); }
    else next.accounts.push({ ...a, id: a.code, active: true, protected: false });
    const opening=action.opening;
    if (opening && (!amountValid(opening.amount) || opening.amount>100000000000)) throw new Error('Enter a valid opening balance.');
    if (opening?.amount) {
      const id=old?.id||a.code;
      if (old && (directAccountActivity(state,id) || old.protected)) throw new Error('Historical opening balances are locked. Use a separate adjustment journal.');
      if (hasChildren(next.accounts,id)) throw new Error('Grouping accounts cannot accept direct opening balances.');
      if (!['Debit','Credit'].includes(opening.side)) throw new Error('Choose Debit or Credit for the opening balance.');
      requireDate(opening.date,'As of Date');
      const offsetId='booksdotnet-opening-balance-equity';
      let offset=next.accounts.find(x=>x.id===offsetId);
      if (!offset) {
        const code=Array.from({length:100},(_,i)=>String(3900+i)).find(code=>!next.accounts.some(x=>x.code===code));
        if (!code) throw new Error('No available Opening Balance Equity account code.');
        offset={id:offsetId,code,name:'Opening Balance Equity',type:'Equity',group:'Equity',active:true,protected:true,parentId:null};next.accounts.push(offset);
      }
      if (!offset.active || offset.type!=='Equity' || hasChildren(next.accounts,offset.id) || offset.id===id) throw new Error('Opening Balance Equity must be an active posting equity account.');
      const debit=opening.side==='Debit';
      addEntry({date:opening.date,memo:`Opening balance — ${a.code} ${a.name}`,reference:`OB-${a.code}`,source:'account-opening',sourceId:id,status:'Posted',lines:[line(id,debit?opening.amount:0,debit?0:opening.amount),line(offset.id,debit?0:opening.amount,debit?opening.amount:0)]});
    }
  } else if (action.type === 'archiveAccount') {
    const a = next.accounts.find(a => a.id === action.id);
    if (!a || a.protected || accountBalance(next, a.id) !== 0 || next.entries.some(e => e.status === 'Draft' && e.lines.some(l => l.accountId === a.id))) throw new Error('Only zero-balance, unprotected accounts without draft journal lines can be archived.');
    if(a.active&&next.accounts.some(child=>child.parentId===a.id&&child.active))throw new Error('Archive or reassign active subaccounts before archiving their parent.');
    if(!a.active&&a.parentId&&!next.accounts.find(parent=>parent.id===a.parentId)?.active)throw new Error('Restore the parent account first.');
    a.active = !a.active;
  } else if (action.type === 'journal') {
    if (!['Draft', 'Posted'].includes(action.entry.status)) throw new Error('Choose a valid journal status.');
    const old = next.entries.find(e => e.id === action.entry.id);
    if (old && (old.status !== 'Draft' || old.source !== 'manual')) throw new Error('Posted or system-generated journals cannot be edited.');
    const candidate = { ...action.entry, source: 'manual' };
    validateEntry(candidate, next.accounts, candidate.status === 'Posted');
    if (old) Object.assign(old, candidate); else addEntry(candidate);
  } else if (action.type === 'postJournal') {
    const e = next.entries.find(e => e.id === action.id); if (!e || e.status !== 'Draft' || e.source !== 'manual') throw new Error('Only a manual draft can be posted.'); validateEntry(e, next.accounts, true); e.status = 'Posted';
  } else if (action.type === 'deleteDraft') {
    const e = next.entries.find(e => e.id === action.id); if (!e || e.status !== 'Draft' || e.source !== 'manual') throw new Error('Only manual drafts can be deleted.'); next.entries = next.entries.filter(x => x.id !== e.id);
  } else if (action.type === 'reverseJournal') {
    const e = next.entries.find(e => e.id === action.id); if (!e || e.status !== 'Posted' || e.source !== 'manual' || e.reversedBy || e.reversalOf) throw new Error('Only an unreversed manual posting can be reversed.');
    const reversal = addEntry({ date: TODAY, reference: e.id, memo: `Reversal · ${e.memo}`, source: 'manual', reversalOf: e.id, status: 'Posted', lines: e.lines.map(l => ({ ...l, debit: l.credit, credit: l.debit })) }); e.reversedBy = reversal.id;
  } else if (action.type === 'invoice') {
    const d = action.invoice; textRequired(d.customer, 'Customer'); requireDate(d.issueDate, 'Issue date'); requireDate(d.dueDate, 'Due date');
    if (d.issueDate > TODAY || d.dueDate < d.issueDate) throw new Error('Issue date cannot be in the future, and due date cannot precede it.');
    const old = next.invoices.find(i => i.id === d.id); if (old && old.status !== 'Draft') throw new Error('Only draft invoices can be edited.');
    const doc = { ...d, ...invoiceTotals(d.items, d.taxRate), kind: 'invoice', id: old?.id || nextId('INV-2026', next.invoices), payments: [] };
    if (!['Draft', 'Sent'].includes(doc.status)) throw new Error('Choose Draft or Sent for a new invoice.');
    if (doc.status === 'Sent') { const lines = [line('1100', doc.total), line('4000', 0, doc.subtotal)]; if (doc.tax) lines.push(line('2100', 0, doc.tax)); doc.entryId = addEntry({ date: doc.issueDate, reference: doc.id, memo: `Invoice · ${doc.customer}`, source: 'invoice', sourceId: doc.id, status: 'Posted', lines }).id; }
    if (old) Object.assign(old, doc); else next.invoices.push(doc);
  } else if (action.type === 'sendInvoice') {
    const d = next.invoices.find(i => i.id === action.id); if (!d || d.status !== 'Draft') throw new Error('Only draft invoices can be issued.');
    return reduceWorkspace(state, { type: 'invoice', invoice: { ...d, status: 'Sent' } });
  } else if (action.type === 'voidInvoice') {
    const d = next.invoices.find(i => i.id === action.id); if (!d || d.status === 'Void' || d.payments.length || d.credits?.length || d.adjustments?.length) throw new Error('An invoice with payments or credits cannot be voided.');
    if (d.entryId) { const e = next.entries.find(e => e.id === d.entryId); addEntry({ date: TODAY, reference: d.id, memo: `Void invoice · ${d.customer}`, source: 'invoice', sourceId: d.id, status: 'Posted', lines: e.lines.map(l => ({ ...l, debit: l.credit, credit: l.debit })) }); }
    d.status = 'Void'; d.voidDate = TODAY;
  } else if (action.type === 'voidBill') {
    const d = next.bills.find(i => i.id === action.id); if (!d || d.status === 'Void' || d.payments.length || d.credits?.length) throw new Error('A bill with payments or credits cannot be voided.');
    if (d.status === 'Draft') { d.status = 'Void'; d.voidDate = TODAY; return next; }
    const e = next.entries.find(e => e.id === d.entryId);
    addEntry({ date: TODAY, reference: d.id, memo: `Void bill · ${d.vendor}`, source: 'bill', sourceId: d.id, status: 'Posted', lines: e.lines.map(l => ({ ...l, debit: l.credit, credit: l.debit })) }); d.status = 'Void'; d.voidDate = TODAY;
  } else if (action.type === 'bill') {
    const d = action.bill; textRequired(d.vendor, 'Vendor'); textRequired(d.description, 'Description'); textRequired(d.reference, 'Vendor reference'); requireDate(d.issueDate); requireDate(d.dueDate);
    if (d.issueDate > TODAY || d.dueDate < d.issueDate || !amountValid(d.total) || d.total <= 0) throw new Error('Check bill dates and enter an amount greater than zero.');
    if (next.bills.some(b => b.vendor.toLowerCase() === d.vendor.toLowerCase() && b.reference.toLowerCase() === d.reference.toLowerCase())) throw new Error('This vendor reference already exists.');
    if (!next.accounts.some(a => a.id === d.accountId && a.type === 'Expense' && a.active)) throw new Error('Choose an active expense account.');
    const doc = { ...d, id: nextId('BILL-2026', next.bills), kind: 'bill', status: 'Unpaid', payments: [] };
    doc.entryId = addEntry({ date: d.issueDate, reference: doc.id, memo: `${d.vendor} · ${d.description}`, source: 'bill', sourceId: doc.id, status: 'Posted', lines: [line(d.accountId, d.total), line('2000', 0, d.total)] }).id; next.bills.push(doc);
  } else if (action.type === 'payment') {
    const docs = action.kind === 'invoice' ? next.invoices : next.bills;
    const doc = docs.find(d => d.id === action.id); if (!doc || ['Draft', 'Void'].includes(doc.status)) throw new Error('Choose an issued, unpaid document.');
    const p = action.payment; requireDate(p.date, 'Payment date');
    const lastPayment = [...doc.payments, ...(doc.credits || []), ...(doc.adjustments || [])].map(x => x.date).sort().at(-1) || doc.issueDate;
    if (p.date < doc.issueDate || p.date < lastPayment || p.date > TODAY) throw new Error('Payment date must be on or after issue/last payment date and no later than the demo date.');
    if (!amountValid(p.amount) || p.amount <= 0 || p.amount > outstanding(doc)) throw new Error('Payment must be greater than zero and cannot exceed the outstanding balance.');
    if (action.kind === 'bill' && accountBalance(next, '1000', p.date) < p.amount) throw new Error('Insufficient cash balance for this payment date.');
    const id = nextId('PAY-2026', [...next.invoices, ...next.bills].flatMap(d => d.payments));
    const entry = addEntry({ date: p.date, reference: doc.id, memo: `${action.kind === 'invoice' ? 'Receipt from' : 'Payment to'} ${doc.customer || doc.vendor}`, source: 'payment', sourceId: doc.id, status: 'Posted', lines: action.kind === 'invoice' ? [line('1000', p.amount), line('1100', 0, p.amount)] : [line('2000', p.amount), line('1000', 0, p.amount)] });
    doc.payments.push({ ...p, id, entryId: entry.id });
  } else if (action.type === 'reminder') {
    const d = next.invoices.find(d => d.id === action.id); if (!d || outstanding(d) <= 0) throw new Error('Choose an outstanding invoice.'); d.lastReminder = TODAY;
  } else throw new Error('Unknown workspace action.');
  return next;
}

export function dashboardSummary(state, range) {
  const report = reportData(state, range);
  const expenseRows = report.accounts.filter(a => a.type === 'Expense');
  const categories = ['Payroll', 'Operations', 'Utilities', 'Marketing', 'Others'];
  const colors = ['#559cda', '#7aade0', '#9cc3e8', '#c0d9f0', '#dfeaf6'];
  const breakdown = categories.map((name, i) => ({ name, color: colors[i], value: expenseRows.filter(a => (categories.includes(a.group) ? a.group : 'Others') === name).reduce((s, a) => s + a.period, 0) / 100 }));
  const grossExpenses = breakdown.reduce((sum, c) => sum + Math.max(0, c.value), 0);
  const shares = breakdown.map(c => grossExpenses > 0 ? Math.max(0, c.value) / grossExpenses * 1000 : 0), units = shares.map(Math.floor);
  const remainder = grossExpenses > 0 ? 1000 - units.reduce((a, b) => a + b, 0) : 0;
  shares.map((v, i) => ({ i, f: v - units[i] })).sort((a, b) => b.f - a.f).slice(0, remainder).forEach(({ i }) => units[i]++); breakdown.forEach((c, i) => c.percentage = units[i] / 10);
  const rows = [];
  for (const e of postedEntries(state, range.end).filter(e => inRange(e.date, range))) for (const l of e.lines) {
    const a = state.accounts.find(a => a.id === l.accountId);
    if (!['Revenue', 'Expense'].includes(a.type) || (!l.debit && !l.credit)) continue;
    const signed = a.type === 'Revenue' ? l.credit - l.debit : l.debit - l.credit;
    rows.push({ id: `${e.id}/${a.code}`, displayId: e.reference || e.id, date: e.date, description: e.memo, account: a.name, type: a.type === 'Revenue' ? 'Income' : 'Expense', amount: signed / 100, status: 'Completed', category: a.group });
  }
  const open = state.invoices.map(d => ({ ...d, balanceAtDate: balanceAt(d, range.end) })).filter(d => d.balanceAtDate > 0);
  return { revenue: report.revenue / 100, expenses: report.expenses / 100, profit: report.profit / 100, outstanding: open.reduce((s, d) => s + d.balanceAtDate, 0) / 100, invoiceCount: open.length, overdue: open.filter(d => d.dueDate < range.end).length, breakdown, rows: rows.sort((a, b) => b.date.localeCompare(a.date)) };
}

export function assertWorkspace(state) {
  if (state?.version !== 1 || !['accounts', 'entries', 'invoices', 'bills'].every(k => Array.isArray(state[k]))) throw new Error('Saved workspace format is not supported.');
  assertAccountHierarchy(state.accounts);
  const accountIds = new Set(state.accounts.map(a => a.id));
  if (accountIds.size !== state.accounts.length) throw new Error('Account IDs must be unique.');
  for (const e of state.entries) { if (!e.lines.every(l => accountIds.has(l.accountId) && amountValid(l.debit) && amountValid(l.credit))) throw new Error('Journal references an invalid account or amount.'); if (e.status === 'Posted' && e.lines.reduce((s, l) => s + l.debit - l.credit, 0) !== 0) throw new Error('Saved posted journal is unbalanced.'); }
  for (const d of [...state.invoices, ...state.bills]) if (!Array.isArray(d.payments) || !amountValid(d.total) || d.payments.some(p => !amountValid(p.amount)) || d.payments.reduce((s, p) => s + p.amount, 0) + (d.credits || []).reduce((s, c) => s + c.amount, 0) > d.total + adjustmentBalance(d) || (d.adjustments || []).some(a => !Number.isSafeInteger(a.balanceDelta) || !dateValid(a.date)) || (d.credits || []).some(c => !amountValid(c.amount))) throw new Error('Saved document payments are invalid.');
  return state;
}
