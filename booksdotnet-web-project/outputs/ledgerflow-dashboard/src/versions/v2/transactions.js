import { allocationControls, notePostingLines } from './posting.js';
import { TODAY } from '../../data.js';
import { validateEntry, accountBalance, outstanding } from '../../accounting.js';
import { upgradeWorkspace, reduceV2, documentsFor, partiesFor } from './accounting.js';
export const notePage = kind => kind === 'invoice' ? 'Customer Credits' : 'Supplier Credits';
const idFor = (prefix, list) => `${prefix}-${String(Math.max(0, ...list.map(r => Number(r.id.split('-').at(-1)) || 0)) + 1).padStart(4, '0')}`;
const positive = n => Number.isSafeInteger(n) && n > 0 && n <= 100000000000;
function dateCheck(date) { if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date > TODAY) throw new Error('Choose a valid date no later than the demo date.'); }
export function upgradeTransactions(state) { const next = upgradeWorkspace(state); next.v2.notes ||= []; return next; }
export function postEntry(state, entry) { const e = { ...entry, id: idFor('JE-2026', state.entries), status: 'Posted', lines: entry.lines.filter(l => l.debit || l.credit) }; validateEntry(e, state.accounts, true); state.entries.push(e); return e.id; }
const line = (accountId, debit = 0, credit = 0) => ({ accountId, debit, credit });
export const allocatedAmount = payment => payment.allocations.reduce((s, a) => s + a.amount, 0);
export const unappliedAmount = payment => payment.amount - allocatedAmount(payment);
export function advanceAccount(state, kind) {
  const id = kind === 'invoice' ? 'booksdotnet-customer-advances' : 'booksdotnet-supplier-prepayments', existing = state.accounts.find(a => a.id === id);
  if (existing) return id;
  let code = kind === 'invoice' ? 2200 : 1400; while (state.accounts.some(a => a.code === String(code))) code++;
  state.accounts.push({ id, code: String(code), name: kind === 'invoice' ? 'Unapplied customer receipts' : 'Supplier prepayments', type: kind === 'invoice' ? 'Liability' : 'Asset', group: kind === 'invoice' ? 'Current liabilities' : 'Current assets', active: true, protected: true }); return id;
}
function partyFor(state, kind, id) { const party = partiesFor(state, kind).find(p => p.id === id); if (!party?.active) throw new Error('Choose an active customer or supplier.'); return party; }
function validateAllocations(state, kind, partyId, allocations, date) {
  if (!Array.isArray(allocations) || new Set(allocations.map(a => a.docId)).size !== allocations.length) throw new Error('Choose unique related documents.');
  for (const a of allocations) {
    const doc = documentsFor(state, kind).find(d => d.id === a.docId);
    if (!doc || doc.partyId !== partyId || ['Draft', 'Void'].includes(doc.status)) throw new Error('Allocate only to posted documents for the selected party.');
    const latest = [doc.issueDate, ...doc.payments.map(p => p.date), ...(doc.credits || []).map(c => c.date), ...(doc.adjustments || []).map(a => a.date)].sort().at(-1);
    if (date < latest) throw new Error('Date cannot precede the document or its latest activity.');
    if (!positive(a.amount) || a.amount > outstanding(doc)) throw new Error(`Allocation exceeds the outstanding balance on ${doc.id}.`);
  }
}
function attachAllocations(state, kind, payment, allocations, entryId, date) {
  for (const a of allocations) { const all = [...state.invoices, ...state.bills].flatMap(d => d.payments); documentsFor(state, kind).find(d => d.id === a.docId).payments.push({ id: idFor('PAY-2026', all), aggregateId: payment.id, entryId, date, method: payment.method, reference: payment.reference || '', amount: a.amount }); }
}
export function allNotes(state, kind) {
  const legacy = documentsFor(state, kind).flatMap(d => (d.credits || []).map(c => ({ ...c, kind, type: 'Credit Note', status: 'Posted', docId: d.id, partyId: d.partyId, partyName: d.customer || d.vendor, date: c.date, legacy: true })));
  return [...(state.v2.notes || []).filter(n => n.kind === kind), ...legacy].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}
export function reduceTransactions(state, action) {
  const next = upgradeTransactions(state), kind = action.kind === 'bill' ? 'bill' : 'invoice';
  if (action.type === 'v2/seedReviewData') return seedReviewData(next);
  if (action.type === 'v2/note') {
    const input = action.note, old = next.v2.notes.find(n => n.id === input.id);
    const fingerprint = JSON.stringify({ kind, partyId: input.partyId, docId: input.docId, type: input.type, date: input.date, reason: input.reason?.trim(), amount: input.amount, tax: input.tax, status: input.status });
    const replay = !input.id && input.requestId && next.v2.notes.find(n => n.requestId === input.requestId);
    if (replay) { if (replay.fingerprint !== fingerprint) throw new Error('This note request was already used for another adjustment.'); return next; }
    if (input.id && (!old || old.status !== 'Draft' || old.kind !== kind)) throw new Error('Only draft notes can be edited.');
    const doc = documentsFor(next, kind).find(d => d.id === input.docId), party = partyFor(next, kind, input.partyId);
    if (!doc || doc.partyId !== party.id || ['Draft', 'Void'].includes(doc.status)) throw new Error('Choose a posted invoice or bill for this party.');
    dateCheck(input.date); if (input.date < doc.issueDate || !input.reason?.trim()) throw new Error('Enter a reason and an adjustment date on or after the source document.');
    if (!['Credit Note', 'Debit Note'].includes(input.type) || !['Draft', 'Posted'].includes(input.status) || !positive(input.amount) || !Number.isSafeInteger(input.tax) || input.tax < 0 || input.tax > input.amount) throw new Error('Choose a note type/status, positive total, and a tax amount within the total.');
    const note = { ...input, fingerprint, kind, partyName: party.name, reason: input.reason.trim(), id: old?.id || idFor(kind === 'invoice' ? 'AR-NOTE' : 'AP-NOTE', next.v2.notes), history: [...(old?.history || []), { date: input.date, action: input.status === 'Posted' ? 'Posted' : old ? 'Draft edited' : 'Draft created' }] };
    if (input.status === 'Posted') {
      const latest = [doc.issueDate, ...doc.payments.map(p => p.date), ...(doc.credits || []).map(c => c.date), ...(doc.adjustments || []).map(a => a.date)].sort().at(-1);
      if (input.date < latest) throw new Error('Posting date cannot precede the latest document activity.');
      const credit = note.type === 'Credit Note'; if (credit && note.amount > outstanding(doc)) throw new Error('A credit cannot exceed the unpaid balance. Cash refunds require a separate workflow.');
      if (kind === 'invoice' && credit) { const taxAvailable = (doc.tax || 0) - (doc.credits || []).reduce((s, c) => s + (c.tax || 0), 0) + (doc.adjustments || []).reduce((s, a) => s + (a.taxDelta || 0), 0); if (note.tax > taxAvailable) throw new Error('Credit tax exceeds tax recorded on this document and its adjustments.'); }
      const amount = note.amount;
      const lines = notePostingLines(next, doc, kind, credit, note);
      note.entryId = postEntry(next, { date: note.date, reference: note.id, memo: `${note.type} · ${doc.id} · ${note.reason}`, source: 'adjustment-note', sourceId: note.id, lines });
      (doc.adjustments ||= []).push({ noteId: note.id, date: note.date, balanceDelta: credit ? -amount : amount, taxDelta: (credit ? -note.tax : note.tax) || 0, entryId: note.entryId });
    }
    if (old) Object.assign(old, note); else next.v2.notes.push(note);
  } else if (action.type === 'v2/reverseNote') {
    const note = next.v2.notes.find(n => n.id === action.id && n.kind === kind); if (!note || note.status !== 'Posted') throw new Error('Choose an unreversed posted note.');
    const doc = documentsFor(next, kind).find(d => d.id === note.docId); dateCheck(action.date);
    const latest = [note.date, ...doc.payments.map(p => p.date), ...(doc.credits || []).map(c => c.date), ...(doc.adjustments || []).map(a => a.date)].sort().at(-1);
    if (action.date < latest) throw new Error('Reversal cannot precede the latest document activity.');
    const delta = note.type === 'Credit Note' ? note.amount : -note.amount; if (outstanding(doc) + delta < 0) throw new Error('Reversing this debit would over-settle the document. Reverse/apply related settlements through a reviewed correction workflow first.');
    const entry = next.entries.find(e => e.id === note.entryId); note.reversalEntryId = postEntry(next, { date: action.date, reference: note.id, memo: `Reverse ${note.type} · ${note.docId}`, source: 'adjustment-reversal', sourceId: note.id, lines: entry.lines.map(l => line(l.accountId, l.credit, l.debit)) });
    (doc.adjustments ||= []).push({ noteId: note.id, reversal: true, date: action.date, balanceDelta: delta, taxDelta: (note.type === 'Credit Note' ? note.tax : -note.tax) || 0, entryId: note.reversalEntryId }); note.status = 'Reversed'; note.history.push({ date: action.date, action: 'Reversed', entryId: note.reversalEntryId });
  } else if (['v2/payment', 'v2/paymentDraft'].includes(action.type)) {
    const p = action.payment, party = partyFor(next, kind, p.partyId); dateCheck(p.date);
    if (!p.requestId || !['Bank transfer', 'Cash', 'Check'].includes(p.method)) throw new Error('A request identifier and supported payment method are required.');
    if (!Array.isArray(p.allocations)) throw new Error('Allocations must be a list.');
    const allocated = allocatedAmount(p), total = p.amount ?? allocated, cashId = p.cashAccountId || '1000';
    if (!positive(total) || allocated > total) throw new Error('Payment must be positive and allocated amounts cannot exceed its total.');
    if (!next.accounts.some(a => a.id === cashId && a.active && a.type === 'Asset' && a.group === 'Cash & bank')) throw new Error('Choose an active cash/bank account.');
    const fingerprint = JSON.stringify({ kind, partyId: p.partyId, date: p.date, method: p.method, reference: p.reference || '', cashId, total, allocations: p.allocations });
    const replay = next.v2.payments.find(x => x.requestId === p.requestId); if (replay && action.type === 'v2/payment') { if (replay.fingerprint !== fingerprint) throw new Error('This request was used for a different payment.'); return next; }
    validateAllocations(next, kind, party.id, p.allocations, p.date);
    if (action.type === 'v2/paymentDraft') {
      const old = next.v2.paymentDrafts.find(d => d.id === p.id); if (p.id && (!old || old.status !== 'Draft')) throw new Error('Only draft payments can be edited.');
      if (next.v2.paymentDrafts.some(d => d.requestId === p.requestId && d.id !== p.id)) throw new Error('This preparation request was already saved.');
      const draft = { ...p, kind, partyName: party.name, amount: total, cashAccountId: cashId, status: 'Draft', id: old?.id || idFor('PD-2026', next.v2.paymentDrafts) }; if (old) Object.assign(old, draft); else next.v2.paymentDrafts.push(draft); return next;
    }
    if (kind === 'bill' && accountBalance(next, cashId, p.date) < total) throw new Error('Insufficient cash balance on this payment date.');
    const unapplied = total - allocated, advance = unapplied ? advanceAccount(next, kind) : null;
    const lines = kind === 'invoice' ? [line(cashId, total), ...allocationControls(next, kind, p.allocations, false), ...(unapplied ? [line(advance, 0, unapplied)] : [])] : [...allocationControls(next, kind, p.allocations, true), ...(unapplied ? [line(advance, unapplied)] : []), line(cashId, 0, total)];
    const payment = { ...p, id: idFor(kind === 'invoice' ? 'RCP-2026' : 'SPAY-2026', next.v2.payments), kind, partyName: party.name, amount: total, cashAccountId: cashId, status: 'Posted', fingerprint, applications: [] };
    payment.entryId = postEntry(next, { date: p.date, reference: payment.id, memo: `${kind === 'invoice' ? 'Receipt from' : 'Payment to'} ${party.name}`, source: 'payment', sourceId: payment.id, lines });
    attachAllocations(next, kind, payment, p.allocations, payment.entryId, p.date); next.v2.payments.push(payment);
  } else if (action.type === 'v2/postPaymentDraft') {
    const draft = next.v2.paymentDrafts.find(d => d.id === action.id); if (!draft || draft.status !== 'Draft') throw new Error('Choose an unposted payment draft.');
    const posted = reduceTransactions(next, { type: 'v2/payment', kind: draft.kind, payment: draft }); const header = posted.v2.payments.find(p => p.requestId === draft.requestId); Object.assign(posted.v2.paymentDrafts.find(d => d.id === draft.id), { status: 'Posted', paymentId: header.id }); return posted;
  } else if (action.type === 'v2/applyPayment') {
    const payment = next.v2.payments.find(p => p.id === action.id && p.kind === kind); if (!payment) throw new Error('Choose a posted payment.');
    dateCheck(action.date); if (action.date < [payment.date, ...(payment.applications || []).map(a => a.date)].sort().at(-1)) throw new Error('Application date cannot precede payment activity.');
    if ((payment.applications || []).some(a => a.requestId === action.requestId)) throw new Error('This application was already recorded.');
    if (!action.requestId) throw new Error('An application identifier is required.'); validateAllocations(next, kind, payment.partyId, action.allocations, action.date);
    const amount = allocatedAmount(action); if (!positive(amount) || amount > unappliedAmount(payment)) throw new Error('Application exceeds the unapplied payment amount.');
    const advance = advanceAccount(next, kind), entryId = postEntry(next, { date: action.date, reference: payment.id, memo: `Apply unapplied balance · ${payment.id}`, source: 'payment-application', sourceId: payment.id, lines: kind === 'invoice' ? [line(advance, amount), ...allocationControls(next, kind, action.allocations, false)] : [...allocationControls(next, kind, action.allocations, true), line(advance, 0, amount)] });
    attachAllocations(next, kind, payment, action.allocations, entryId, action.date); payment.allocations.push(...action.allocations.map(a => ({ ...a, date: action.date, entryId }))); (payment.applications ||= []).push({ requestId: action.requestId, date: action.date, amount, entryId });
  } else return upgradeTransactions(reduceV2(next, action));
  return next;
}

export function seedReviewData(state) {
  if (state.v2.reviewFixture?.version === 1) return state;
  let next = upgradeTransactions(state); const paymentIds = [], noteIds = [], supportingDocs = [];
  for (const kind of ['invoice', 'bill']) {
    let party = partiesFor(next, kind).find(p => p.active && documentsFor(next, kind).some(d => d.partyId === p.id && outstanding(d) > 30000));
    if (!party) {
      next = reduceTransactions(next, { type: 'v2/party', kind, party: { name: kind === 'invoice' ? 'Demo · Makati Creative Studio' : 'Demo · Pasig Business Supplies', email: '', phone: '', address: '', terms: 30 } }); party = partiesFor(next, kind).at(-1);
    }
    const partyDocs = documentsFor(next, kind).filter(d => d.partyId === party.id && outstanding(d) > 30000);
    if (partyDocs.length < 2) {
      const document = { partyId: party.id, issueDate: TODAY, dueDate: '2026-11-25', demo: true, description: 'Demo review batch · supplementary services', reference: `DEMO-${kind}-SUPPORT`, accountId: next.accounts.find(a => a.type === 'Expense' && a.active)?.id, total: 1200000, status: kind === 'invoice' ? 'Sent' : 'Unpaid', items: [{ description: 'Demo review batch · supplementary services', quantity: 1, rate: 1200000 }], taxRate: 0 };
      next = reduceTransactions(next, { type: kind === 'invoice' ? 'v2/invoice' : 'v2/bill', kind, document }); supportingDocs.push(documentsFor(next, kind).at(-1).id);
    }
    const doc = documentsFor(next, kind).find(d => d.partyId === party.id && outstanding(d) > 30000);
    for (let j = 0; j < 4; j++) { next = reduceTransactions(next, { type: 'v2/note', kind, note: { partyId: party.id, docId: doc.id, type: j % 2 ? 'Debit Note' : 'Credit Note', date: TODAY, reason: `Demo · ${j % 2 ? 'Additional agreed service charge' : 'Price allowance for service adjustment'}`, amount: j % 2 ? 18000 : 12000, tax: 0, status: j < 2 ? 'Posted' : 'Draft', demo: true } }); noteIds.push(next.v2.notes.at(-1).id); }
    for (let i = 0; i < 18; i++) {
      const candidates = partiesFor(next, kind).filter(p => p.active && documentsFor(next, kind).some(d => d.partyId === p.id && outstanding(d) > 10000));
      const selected = i === 0 ? party : candidates[i % candidates.length] || party;
      const docs = documentsFor(next, kind).filter(d => d.partyId === selected.id && outstanding(d) > 10000), amount = 45000 + i * 3500;
      let remaining = i % 4 === 0 ? amount : i % 4 === 1 ? Math.floor(amount * .6) : i % 4 === 2 ? 0 : amount;
      const allocations = [];
      for (const d of docs) { if (!remaining) break; const share = i === 0 && docs.length > 1 && allocations.length === 0 ? Math.floor(remaining / 2) : remaining; const applied = Math.min(share, outstanding(d)); if (applied > 0) allocations.push({ docId: d.id, amount: applied }); remaining -= applied; }
      const payment = { requestId: `booksdotnet-review-v1-${kind}-${i}`, partyId: selected.id, date: TODAY, method: ['Bank transfer', 'Cash', 'Check'][i % 3], cashAccountId: '1000', amount, reference: `DEMO-${kind === 'invoice' ? 'AR' : 'AP'}-${String(i + 1).padStart(3, '0')}`, allocations, demo: true };
      next = reduceTransactions(next, { type: i < 14 ? 'v2/payment' : 'v2/paymentDraft', kind, payment }); paymentIds.push(i < 14 ? next.v2.payments.at(-1).id : next.v2.paymentDrafts.at(-1).id);
    }
  }
  next.v2.reviewFixture = { version: 1, date: TODAY, paymentIds, noteIds, supportingDocs }; return next;
}

