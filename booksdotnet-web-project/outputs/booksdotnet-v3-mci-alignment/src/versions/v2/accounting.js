import { TODAY } from '../../data.js';
import { reduceWorkspace, validateEntry, accountBalance, outstanding, balanceAt } from '../../accounting.js';

const normalize = name => String(name || '').trim().toLowerCase();
const nextId = (prefix, records) => `${prefix}-${String(Math.max(0, ...records.map(x => Number(x.id.split('-').at(-1)) || 0)) + 1).padStart(4, '0')}`;
const validAmount = n => Number.isSafeInteger(n) && n > 0 && n <= 100000000000;
function dateCheck(date) { if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date > TODAY) throw new Error('Choose a valid date no later than the demo date.'); }
export function dueDateFor(days = 30, start = TODAY) { const d = new Date(`${start}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
export function upgradeWorkspace(state) {
  const next = structuredClone(state);
  next.v2 ||= { schema: 1, customers: [], suppliers: [], payments: [], company: { name: 'booksdotnet Workspace', email: '', address: '' } };
  next.v2.paymentDrafts ||= [];
  for (const [docs, key, prefix, nameKey] of [[next.invoices, 'customers', 'CUS', 'customer'], [next.bills, 'suppliers', 'SUP', 'vendor']]) for (const doc of docs) {
    let party = next.v2[key].find(p => p.id === doc.partyId) || next.v2[key].find(p => [p.name, ...(p.aliases || [])].some(n => normalize(n) === normalize(doc[nameKey])));
    if (!party) { party = { id: nextId(prefix, next.v2[key]), name: doc[nameKey], email: doc.email || '', phone: '', address: '', terms: 30, active: true, aliases: [] }; next.v2[key].push(party); }
    doc.partyId = party.id;
  }
  return next;
}
export const documentsFor = (state, kind) => kind === 'invoice' ? state.invoices : state.bills;
export const partiesFor = (state, kind) => state.v2[kind === 'invoice' ? 'customers' : 'suppliers'];
export const paidAt = (doc, end = TODAY) => doc.payments.filter(p => p.date <= end).reduce((s, p) => s + p.amount, 0);
export const creditedAt = (doc, end = TODAY) => (doc.credits || []).filter(c => c.date <= end).reduce((s, c) => s + c.amount, 0) + (doc.adjustments || []).filter(a => a.date <= end && (a.balanceDelta < 0 && !a.reversal || a.balanceDelta > 0 && a.reversal)).reduce((s, a) => s - a.balanceDelta, 0);
export function settlement(doc, end = TODAY) {
  if (doc.status === 'Draft' || doc.status === 'Void' && doc.voidDate <= end) return '—';
  const balance = balanceAt(doc, end), paid = paidAt(doc, end), credits = creditedAt(doc, end);
  return balance === 0 ? credits ? 'Settled' : 'Paid' : paid ? 'Partial' : credits ? 'Partially credited' : 'Unpaid';
}
export function paymentRecords(state, kind) {
  const grouped = state.v2.payments.filter(p => p.kind === kind);
  const legacy = documentsFor(state, kind).flatMap(d => d.payments.filter(p => !p.aggregateId).map(p => ({ ...p, kind, partyId: d.partyId, partyName: d.customer || d.vendor, allocations: [{ docId: d.id, amount: p.amount }], legacy: true })));
  return [...grouped, ...legacy].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}
function addEntry(state, entry) { const e = { ...entry, id: nextId('JE-2026', state.entries), status: 'Posted' }; validateEntry(e, state.accounts, true); state.entries.push(e); return e.id; }
function findParty(state, kind, id) { const p = partiesFor(state, kind).find(p => p.id === id); if (!p || !p.active) throw new Error('Choose an active customer or supplier.'); return p; }
export function reduceV2(state, action) {
  const next = upgradeWorkspace(state);
  if (!action.type.startsWith('v2/')) return upgradeWorkspace(reduceWorkspace(next, action));
  const kind = action.kind === 'bill' ? 'bill' : 'invoice';
  if (action.type === 'v2/party') {
    const list = partiesFor(next, kind), p = action.party;
    if (!normalize(p.name) || !Number.isInteger(p.terms) || p.terms < 0 || p.terms > 365) throw new Error('Enter a name and payment terms between 0 and 365 days.');
    if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) throw new Error('Enter a valid email address.');
    if (list.some(x => x.id !== p.id && [x.name, ...(x.aliases || [])].some(name => normalize(name) === normalize(p.name)))) throw new Error('This customer or supplier name already exists.');
    const old = list.find(x => x.id === p.id);
    if (old) Object.assign(old, p, { name: p.name.trim(), aliases: [...new Set([...(old.aliases || []), old.name])] });
    else list.push({ ...p, name: p.name.trim(), id: nextId(kind === 'invoice' ? 'CUS' : 'SUP', list), active: true, aliases: [] });
  } else if (action.type === 'v2/invoice') {
    const party = findParty(next, 'invoice', action.document.partyId);
    return upgradeWorkspace(reduceWorkspace(next, { type: 'invoice', invoice: { ...action.document, customer: party.name, email: party.email } }));
  } else if (action.type === 'v2/bill') {
    const d = action.document, party = findParty(next, 'bill', d.partyId), old = next.bills.find(x => x.id === d.id);
    if (old && old.status !== 'Draft') throw new Error('Only draft bills can be edited.');
    dateCheck(d.issueDate); if (!/^\d{4}-\d{2}-\d{2}$/.test(d.dueDate) || !Number.isFinite(Date.parse(d.dueDate)) || new Date(d.dueDate).toISOString().slice(0, 10) !== d.dueDate || d.dueDate < d.issueDate) throw new Error('Due date cannot precede the bill date.');
    if (!d.reference?.trim() || !d.description?.trim() || !validAmount(d.total)) throw new Error('Reference, description, and a positive amount are required.');
    if (next.bills.some(b => b.id !== d.id && b.partyId === party.id && normalize(b.reference) === normalize(d.reference))) throw new Error('This supplier reference already exists.');
    if (!next.accounts.some(a => a.id === d.accountId && a.active && a.type === 'Expense')) throw new Error('Choose an active expense account.');
    if (!['Draft', 'Unpaid'].includes(d.status)) throw new Error('Choose draft or posted bill status.');
    const doc = { ...d, reference: d.reference.trim(), id: old?.id || nextId('BILL-2026', next.bills), vendor: party.name, kind: 'bill', payments: [], credits: [] };
    if (d.status === 'Unpaid') doc.entryId = addEntry(next, { date: d.issueDate, reference: doc.id, memo: `${party.name} · ${d.description}`, source: 'bill', sourceId: doc.id, lines: [{ accountId: d.accountId, debit: d.total, credit: 0 }, { accountId: '2000', debit: 0, credit: d.total }] });
    if (old) Object.assign(old, doc); else next.bills.push(doc);
  } else if (action.type === 'v2/paymentDraft') {
    const old = next.v2.paymentDrafts.find(d => d.id === action.payment.id);
    if (action.payment.id && (!old || old.status !== 'Draft')) throw new Error('Only unposted payment drafts can be edited.');
    const replay = next.v2.paymentDrafts.find(d => d.requestId === action.payment.requestId && d.id !== action.payment.id);
    if (replay) throw new Error('This preparation request was already saved.');
    const validated = reduceV2(next, { type: 'v2/payment', kind, payment: action.payment }).v2.payments.at(-1);
    const draft = { ...action.payment, id: old?.id || nextId('PD-2026', next.v2.paymentDrafts), kind, status: 'Draft', amount: validated.amount, partyName: validated.partyName };
    if (old) Object.assign(old, draft); else next.v2.paymentDrafts.push(draft);
  } else if (action.type === 'v2/postPaymentDraft') {
    const draft = next.v2.paymentDrafts.find(d => d.id === action.id);
    if (!draft || draft.status !== 'Draft') throw new Error('Choose an unposted payment draft.');
    const posted = reduceV2(next, { type: 'v2/payment', kind: draft.kind, payment: draft });
    const header = posted.v2.payments.find(p => p.requestId === draft.requestId);
    Object.assign(posted.v2.paymentDrafts.find(d => d.id === draft.id), { status: 'Posted', paymentId: header.id });
    return posted;
  } else if (action.type === 'v2/payment') {
    const p = action.payment, party = findParty(next, kind, p.partyId);
    if (!p.requestId) throw new Error('This payment request needs a unique identifier. Reopen the form.');
    const fingerprint = JSON.stringify({ kind, partyId: p.partyId, date: p.date, method: p.method, reference: p.reference || '', allocations: p.allocations });
    const replay = next.v2.payments.find(x => x.requestId === p.requestId);
    if (replay) { if (replay.fingerprint !== fingerprint) throw new Error('This request was already used for a different payment.'); return next; }
    dateCheck(p.date); if (!['Bank transfer', 'Cash', 'Check'].includes(p.method)) throw new Error('Choose a supported payment method.');
    if (!Array.isArray(p.allocations) || !p.allocations.length || new Set(p.allocations.map(a => a.docId)).size !== p.allocations.length) throw new Error('Choose unique documents and enter an allocation.');
    const docs = documentsFor(next, kind), total = p.allocations.reduce((sum, a) => sum + a.amount, 0);
    if (!validAmount(total)) throw new Error('Enter a valid payment total.');
    for (const a of p.allocations) {
      const d = docs.find(d => d.id === a.docId);
      if (!d || d.partyId !== party.id || ['Draft', 'Void'].includes(d.status)) throw new Error('Allocate only to posted documents for the selected party.');
      const latest = [d.issueDate, ...d.payments.map(p => p.date), ...(d.credits || []).map(c => c.date)].sort().at(-1);
      if (p.date < latest) throw new Error('Payment date cannot precede the document or its latest payment or credit.');
      if (!validAmount(a.amount) || a.amount > outstanding(d)) throw new Error(`Allocation exceeds the outstanding balance on ${d.id}.`);
    }
    if (kind === 'bill' && accountBalance(next, '1000', p.date) < total) throw new Error('Insufficient cash balance on this payment date.');
    const id = nextId(kind === 'invoice' ? 'RCP-2026' : 'SPAY-2026', next.v2.payments), lines = kind === 'invoice' ? [{ accountId: '1000', debit: total, credit: 0 }, { accountId: '1100', debit: 0, credit: total }] : [{ accountId: '2000', debit: total, credit: 0 }, { accountId: '1000', debit: 0, credit: total }];
    const entryId = addEntry(next, { date: p.date, reference: id, memo: `${kind === 'invoice' ? 'Receipt from' : 'Payment to'} ${party.name}`, source: 'payment', sourceId: id, lines });
    for (const allocation of p.allocations) { const all = [...next.invoices, ...next.bills].flatMap(d => d.payments); docs.find(d => d.id === allocation.docId).payments.push({ id: nextId('PAY-2026', all), aggregateId: id, entryId, date: p.date, method: p.method, reference: p.reference || '', amount: allocation.amount }); }
    next.v2.payments.push({ ...p, id, kind, partyName: party.name, amount: total, entryId, fingerprint });
  } else if (action.type === 'v2/credit') {
    const d = documentsFor(next, kind).find(d => d.id === action.id), c = action.credit;
    if (!d || ['Draft', 'Void'].includes(d.status)) throw new Error('Choose a posted document.');
    dateCheck(c.date); if (!c.reason?.trim()) throw new Error('A credit reason is required.');
    const latest = [d.issueDate, ...d.payments.map(p => p.date), ...(d.credits || []).map(c => c.date)].sort().at(-1);
    if (c.date < latest) throw new Error('Credit date cannot precede the latest document activity.');
    if (!validAmount(c.amount) || c.amount > outstanding(d)) throw new Error('Credit must be positive and cannot exceed the unpaid balance. Refunds and paid-document credits are not implemented.');
    const original = next.entries.find(e => e.id === d.entryId);
    if (!original) throw new Error('The source posting is missing.');
    const credits = [...next.invoices, ...next.bills].flatMap(d => d.credits || []), id = nextId(kind === 'invoice' ? 'CRN-2026' : 'SCN-2026', credits);
    const prior = d.credits || [];
    const tax = kind === 'invoice' ? Math.round((prior.reduce((sum, x) => sum + x.amount, 0) + c.amount) * (d.tax || 0) / d.total) - prior.reduce((sum, x) => sum + (x.tax || 0), 0) : 0;
    const lines = kind === 'invoice' ? [{ accountId: '4000', debit: c.amount - tax, credit: 0 }, ...(tax ? [{ accountId: '2100', debit: tax, credit: 0 }] : []), { accountId: '1100', debit: 0, credit: c.amount }] : [{ accountId: '2000', debit: c.amount, credit: 0 }, { accountId: d.accountId, debit: 0, credit: c.amount }];
    const entryId = addEntry(next, { date: c.date, reference: id, memo: `Credit · ${d.id} · ${c.reason.trim()}`, source: 'credit', sourceId: d.id, lines: lines.filter(l => l.debit || l.credit) });
    (d.credits ||= []).push({ ...c, id, entryId, tax });
  } else if (action.type === 'v2/void') {
    const d = documentsFor(next, kind).find(d => d.id === action.id);
    if (d?.status === 'Draft' && kind === 'bill') { d.status = 'Void'; d.voidDate = TODAY; }
    else return upgradeWorkspace(reduceWorkspace(next, { type: kind === 'invoice' ? 'voidInvoice' : 'voidBill', id: action.id }));
  } else if (action.type === 'v2/company') {
    if (!action.company.name?.trim()) throw new Error('Company name is required.');
    next.v2.company = { ...next.v2.company, ...action.company };
  } else throw new Error('Unsupported V2 action.');
  return next;
}
