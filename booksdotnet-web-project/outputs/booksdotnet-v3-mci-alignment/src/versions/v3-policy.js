export const V3_MODULES = {
  Dashboard: ['Dashboard'],
  'Accounts Receivable': ['Customer Invoices', 'Customer Credits', 'Customer Payments'],
  'Accounts Payable': ['Supplier Bills', 'Supplier Credits', 'Supplier Payments'],
  Accounting: ['Chart of Accounts', 'Journal Entries', 'General Ledger'],
  Banking: ['Bank Accounts', 'Bank Transactions', 'Bank Reconciliation'],
  Reports: ['Financial Statements', 'Trial Balance', 'Receivables & Payables Reports', 'Account Reports', 'Tax Reports'],
};
export const isV3Page = page => Object.values(V3_MODULES).some(pages => pages.includes(page));
export const isInventoryModule = module => ['Accounts Receivable', 'Accounts Payable'].includes(module);

const inventoryWrites = new Set(['invoice','bill','payment','credit','sendInvoice','voidInvoice','voidBill','reminder',
  'v2/invoice','v2/bill','v2/payment','v2/paymentDraft','v2/postPaymentDraft','v2/applyPayment','v2/note','v2/reverseNote','v2/credit','v2/void']);
const removedPageWrites = new Set(['v2/company','v2/accountingDefaults','v2/configuration','v2/deleteConfiguration','v2/master','v2/party']);

export function assertV3Action(action) {
  if (inventoryWrites.has(action.type)) throw new Error('AR/AP transactions are read-only in V3. Maintain and post them in Inventory Management.');
  if (removedPageWrites.has(action.type)) throw new Error('This configuration page is not available in V3. Existing configuration is retained.');
}
