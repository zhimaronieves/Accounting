import { canonicalPage } from '../v3-labels.js';
import { paymentRecords } from './accounting.js';
import { allNotes } from './transactions.js';

export function inventoryRecords(state, page) {
  page=canonicalPage(page);
  const kind = page.startsWith('Customer') ? 'invoice' : 'bill';
  const posted = new Set(state.entries.filter(e => e.status === 'Posted').map(e => e.id));
  if (page.endsWith('Payments')) return paymentRecords(state, kind).filter(r => posted.has(r.entryId)).map(r => ({ ...r, status:'Posted' }));
  if (page.endsWith('Credits')) return allNotes(state, kind).filter(r => r.type === 'Credit Note' && ['Posted','Reversed'].includes(r.status) && posted.has(r.entryId));
  return state[kind === 'invoice' ? 'invoices' : 'bills'].filter(r => !['Draft'].includes(r.status) && posted.has(r.entryId));
}

// Filtering the view preserves every record in the persisted accounting workspace.
export function inventoryViewState(state) {
  const posted = new Set(state.entries.filter(e => e.status === 'Posted').map(e => e.id));
  return { ...state,
    invoices: inventoryRecords(state, 'Customer Invoices'),
    bills: inventoryRecords(state, 'Supplier Bills'),
    v2: { ...state.v2,
      notes: state.v2.notes.filter(n => ['Posted','Reversed'].includes(n.status) && posted.has(n.entryId)),
      payments: state.v2.payments.filter(p => posted.has(p.entryId)),
      paymentDrafts: [],
    },
  };
}
