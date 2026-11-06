export const VERSION_KEY = 'booksdotnet-ui-version';
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
const equivalents = { Invoices: 'Customer Invoices', 'Accounts Receivable': 'Customer Invoices', 'Accounts Payable': 'Supplier Bills', 'Financial Reports': 'Financial Statements' };
export function equivalentPage(page, version) {
  const target = version === 'v2' ? v2Routes : v1Routes;
  if (target[page]) return page;
  const mapped = version === 'v2' ? equivalents[page] : { 'Customer Invoices': 'Invoices', 'Supplier Bills': 'Accounts Payable', 'Financial Statements': 'Financial Reports' }[page];
  return target[mapped] ? mapped : 'Dashboard';
}
export function resolveLocation(path, saved = 'v1') {
  path = ({ '/v2/receivables/customers': '/v2/masterfile/customers', '/v2/payables/suppliers': '/v2/masterfile/suppliers' })[path] || path;
  if (path.startsWith('/v2')) return { version: 'v2', active: Object.keys(v2Routes).find(n => v2Routes[n] === path) || 'Dashboard' };
  if (path === '/v1' || path.startsWith('/v1/')) { const old = path.slice(3) || '/'; return { version: 'v1', active: Object.keys(v1Routes).find(n => v1Routes[n] === old) || 'Dashboard' }; }
  const active = Object.keys(v1Routes).find(n => v1Routes[n] === path) || 'Dashboard';
  return saved === 'v2' ? { version: 'v2', active: equivalentPage(active, 'v2') } : { version: 'v1', active };
}
export function routeFor(version, page) { const path = (version === 'v2' ? v2Routes : v1Routes)[equivalentPage(page, version)]; return version === 'v1' ? `/v1${path === '/' ? '' : path}` : path; }


