import { adjustmentName } from './credit-labels.js';
import { v2Routes } from '../navigation.js';
import { canPage } from './permissions.js';
export function searchWorkspace(state, user, query) {
  const q = query.trim().toLowerCase(), results = [];
  const add = (page, id, label, type, secondary, intent) => { if (canPage(user, page) && `${label} ${secondary || ''} ${type}`.toLowerCase().includes(q)) results.push({ key: `${type}-${id}`, page, label, type, secondary, intent }); };
  for (const page of Object.keys(v2Routes)) add(page, page, page, 'Module', '', null);
  if (q) {
    for (const b of state.v2.bankAccounts||[]) add('Bank Accounts',b.id,b.name,'Bank Account',b.currency,{recordId:b.id});
    for (const r of state.v2.reconciliations||[]) add('Bank Reconciliation',r.id,r.id,'Reconciliation',r.status,{recordId:r.id});
    for (const n of state.v2.notes || []) add(n.kind === 'invoice' ? 'Customer Credits' : 'Supplier Credits', n.id, n.id, adjustmentName(n.kind, n.type), n.partyName + ' · ' + n.type, { noteId: n.id });
    for (const p of state.v2.items || []) add('Items', p.id, `${p.code} · ${p.name}`, 'Item', p.category, { recordId:p.id });
    for (const p of state.v2.employees || []) add('Employees', p.id, `${p.code} · ${p.name}`, 'Employee', p.department, { recordId:p.id });
    for (const d of state.invoices) add('Customer Invoices', d.id, d.id, 'Invoice', `${d.customer} · ${d.status}`, { documentId: d.id });
    for (const d of state.bills) add('Supplier Bills', d.id, d.id, 'Bill', `${d.vendor} · ${d.reference} · ${d.status}`, { documentId: d.id });
    for (const p of state.v2.customers) add('Customers', p.id, p.name, 'Customer', p.email, { partyId: p.id });
    for (const p of state.v2.suppliers) add('Suppliers', p.id, p.name, 'Supplier', p.email, { partyId: p.id });
    for (const e of state.entries) add('Journal Entries', e.id, e.id, 'Journal', `${e.memo} · ${e.reference}`, { entryId: e.id });
  }
  return results.slice(0, 25);
}


