// Display names only; canonical route and permission keys remain stable.
const labels={'Accounts Receivable':'Sales','Accounts Payable':'Purchasing','Customer Invoices':'Sales Invoices','Customer Payments':'Collection Receipts','Supplier Bills':'Bills','Supplier Payments':'Payments Made','Supplier Credits':'Supplier Debits'};
export const displayPage=page=>labels[page]||page;
export const canonicalPage=page=>Object.keys(labels).find(key=>labels[key]===page)||page;
export const singularPage=page=>({'Sales Invoices':'Sales Invoice','Collection Receipts':'Collection Receipt','Customer Credits':'Customer Credit','Bills':'Bill','Payments Made':'Payment Made','Supplier Debits':'Supplier Debit'}[displayPage(page)]||displayPage(page));
