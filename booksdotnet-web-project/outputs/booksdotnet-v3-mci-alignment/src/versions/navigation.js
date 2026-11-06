import { displayPage, canonicalPage } from './v3-labels.js';
export const VERSION_KEY = 'booksdotnet-v3-ui-version';
export const v1Routes = { Dashboard: '/', 'Chart of Accounts': '/accounts', 'Journal Entries': '/journal-entries', 'General Ledger': '/general-ledger', 'Accounts Receivable': '/accounts-receivable', 'Accounts Payable': '/accounts-payable', Invoices: '/invoices', 'Financial Reports': '/financial-reports' };
export const v2Groups = [
  { name: 'Dashboard', icon: 'LayoutDashboard', pages: ['Dashboard'] },
  { name: 'Masterfile', icon: 'FolderOpen', pages: ['Items', 'Customers', 'Suppliers', 'Employees'] },
  { name: 'Accounts Receivable', icon: 'ArrowDownLeft', pages: ['Customer Invoices', 'Customer Credits', 'Customer Payments'] },
  { name: 'Accounts Payable', icon: 'ArrowUpRight', pages: ['Supplier Bills', 'Supplier Credits', 'Supplier Payments'] },
  { name: 'Accounting', icon: 'BookOpen', pages: ['Chart of Accounts', 'Journal Entries', 'General Ledger'] },
  { name: 'Banking', icon: 'Landmark', pages: ['Bank Accounts', 'Bank Transactions', 'Bank Reconciliation'] },
  { name: 'Reports', icon: 'FileBarChart2', pages: ['Financial Statements', 'Trial Balance', 'Receivables & Payables Reports', 'Account Reports', 'Tax Reports'] },
  { name: 'Configuration', icon: 'SlidersHorizontal', pages: ['Item Configuration', 'Nature of Business', 'Customer Groups', 'Organizational Settings', 'Banks', 'Payment Terms'] },
  { name: 'Settings', icon: 'Settings', pages: ['Company Information', 'Accounting Configuration', 'Users & Permissions'] },
];
export const v2Routes = { 'Item Configuration':'/v2/configuration/items', 'Nature of Business':'/v2/configuration/nature-of-business', 'Customer Groups':'/v2/configuration/customer-groups', 'Organizational Settings':'/v2/configuration/organization', Banks:'/v2/configuration/banks', 'Payment Terms':'/v2/configuration/payment-terms', Dashboard: '/v2/dashboard', 'Customer Invoices': '/v2/receivables/invoices', 'Customer Payments': '/v2/receivables/payments', Items: '/v2/masterfile/items', Employees: '/v2/masterfile/employees', Customers: '/v2/masterfile/customers', 'Supplier Bills': '/v2/payables/bills', 'Supplier Payments': '/v2/payables/payments', Suppliers: '/v2/masterfile/suppliers', 'Chart of Accounts': '/v2/accounting/accounts', 'Journal Entries': '/v2/accounting/journals', 'General Ledger': '/v2/accounting/ledger', 'Bank Accounts': '/v2/banking/accounts', 'Bank Transactions': '/v2/banking/transactions', 'Bank Reconciliation': '/v2/banking/reconciliation', 'Financial Statements': '/v2/reports/statements', 'Trial Balance': '/v2/reports/trial-balance', 'Receivables & Payables Reports': '/v2/reports/receivables-payables', 'Account Reports': '/v2/reports/accounts', 'Tax Reports': '/v2/reports/tax', 'Company Information': '/v2/settings/company', 'Accounting Configuration': '/v2/settings/accounting', 'Users & Permissions': '/v2/settings/users', 'Customer Credits': '/v2/receivables/notes', 'Supplier Credits': '/v2/payables/notes' };
// V3 keeps the copied permission schema, while exposing only its approved pages.
export const v3Groups = ['Dashboard','Accounts Payable','Accounts Receivable','Accounting','Banking','Reports'].map(name=>v2Groups.find(g=>g.name===name)).map(g=>({...g,name:displayPage(g.name),pages:g.name==='Accounts Receivable'?['Customer Invoices','Customer Payments','Customer Credits']:g.name==='Accounts Payable'?['Supplier Bills','Supplier Payments','Supplier Credits']:g.pages}));
const visiblePages = new Set(v3Groups.flatMap(g => g.pages));
for (const page of Object.keys(v2Routes)) {
  if (!visiblePages.has(page)) delete v2Routes[page];
  else v2Routes[page] = v2Routes[page].replace('/v2/','/v3/');
}
export function equivalentPage(page) { page=canonicalPage(page); return visiblePages.has(page) ? page : 'Dashboard'; }
export function resolveLocation(path) {
  return { version:'v2', active:Object.keys(v2Routes).find(page=>v2Routes[page]===path)||'Dashboard' };
}
export function routeFor(version,page) { return v2Routes[equivalentPage(page)]; }
