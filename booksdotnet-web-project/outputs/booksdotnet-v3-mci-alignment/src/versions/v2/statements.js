import { postedEntries, reportData } from '../../accounting.js';
import { equityStatement } from './equity.js';

const sum = values => values.reduce((a, b) => a + b, 0);
const normal = text => String(text || '').toLowerCase();
const cashGroups = {
  customers: ['Operating', 'Cash received from customers'],
  operatingReceipts: ['Operating', 'Other operating cash receipts'],
  suppliers: ['Operating', 'Cash payments to suppliers'],
  employees: ['Operating', 'Cash payments to employees'],
  operatingPayments: ['Operating', 'Other operating cash payments'],
  taxes: ['Operating', 'Taxes paid'],
  assetDisposals: ['Investing', 'Proceeds from asset disposals'],
  equipment: ['Investing', 'Purchases of property and equipment'],
  investmentSales: ['Investing', 'Proceeds from investments'],
  investmentPurchases: ['Investing', 'Purchases of investments'],
  loanProceeds: ['Financing', 'Loan proceeds'],
  loanRepayments: ['Financing', 'Loan repayments'],
  capital: ['Financing', 'Capital contributions'],
  drawings: ['Financing', 'Owner drawings / capital returns paid'],
};

// Counterpart-only allocation is reliable only when it does not also include noncash offsets.
export function cashFlowDetails(state, range, report = reportData(state, range)) {
  const cashIds = new Set(report.accounts.filter(a => a.group === 'Cash & bank').map(a => a.id));
  const amounts = {}, review = [];
  const add = (key, value, entry, reason) => {
    if (!value) return;
    if (!cashGroups[key]) { review.push({ entryId: entry.id, date: entry.date, amount: value, reason }); return; }
    amounts[key] = (amounts[key] || 0) + value;
  };
  function classify(account, amount) {
    const configured = account.cashFlowCategory || state.v2?.company?.cashFlowPolicy?.[account.id];
    if (configured) return configured;
    const group = normal(account.group), name = normal(account.name);
    if (/interest|dividend|investment/.test(name)) return null;
    if (account.type === 'Equity') return amount > 0 ? 'capital' : 'drawings';
    if (group === 'long-term liabilities' || group === 'borrowings') return amount > 0 ? 'loanProceeds' : 'loanRepayments';
    if (group === 'fixed assets' || group === 'noncurrent assets') return amount > 0 ? 'assetDisposals' : 'equipment';
    if (account.type === 'Revenue' && group === 'revenue') return amount > 0 ? 'customers' : 'operatingPayments';
    if (account.type === 'Expense') return amount > 0 ? 'operatingReceipts' : group === 'payroll' ? 'employees' : 'operatingPayments';
    if (account.id === '1100' || account.id === 'booksdotnet-customer-advances') return amount > 0 ? 'customers' : 'operatingPayments';
    if (account.id === '2000' || account.id === 'booksdotnet-supplier-prepayments') return amount < 0 ? 'suppliers' : 'operatingReceipts';
    if (account.id === '2100' && amount < 0) return 'taxes';
    return null;
  }
  for (const entry of postedEntries(state, range.end).filter(e => e.date >= range.start)) {
    const cash = sum(entry.lines.filter(l => cashIds.has(l.accountId)).map(l => l.debit - l.credit));
    if (!cash) continue;
    const others = entry.lines.filter(l => !cashIds.has(l.accountId) && l.debit !== l.credit);
    if (entry.cashFlowCategory) { add(entry.cashFlowCategory, cash, entry, 'Unknown configured cash flow category.'); continue; }
    const payment = state.v2?.payments?.find(p => p.entryId === entry.id);
    if (payment?.kind === 'invoice' && cash > 0) { add('customers', cash, entry); continue; }
    const paidBills = state.bills.filter(b => b.payments.some(p => p.entryId === entry.id));
    if ((payment?.kind === 'bill' || paidBills.length) && cash < 0) {
      const linkedTotal = sum(paidBills.flatMap(b => b.payments.filter(p => p.entryId === entry.id).map(p => p.amount)));
      if (linkedTotal > -cash || others.some(l => l.credit > l.debit)) {
        add(null, cash, entry, 'Supplier settlement includes noncash offsets; cash allocation needs review.'); continue;
      }
      let allocated = 0;
      for (const bill of paidBills) for (const p of bill.payments.filter(p => p.entryId === entry.id)) {
        const account = state.accounts.find(a => a.id === bill.accountId);
        const category = account ? classify(account, -p.amount) : null;
        const key = account?.type === 'Expense' && ['employees', 'operatingPayments'].includes(category) ? 'suppliers' : category;
        add(key, -p.amount, entry, `Review cash classification for ${bill.id}.`); allocated += p.amount;
      }
      add('suppliers', cash + allocated, entry); // Unallocated supplier advances remain operating cash payments.
      continue;
    }
    if (others.some(l => Math.sign(l.credit - l.debit) !== Math.sign(cash))) {
      add(null, cash, entry, 'Compound journal includes noncash offsets; cash allocation needs review.'); continue;
    }
    for (const line of others) {
      const account = state.accounts.find(a => a.id === line.accountId), amount = line.credit - line.debit;
      add(account ? classify(account, amount) : null, amount, entry, `${account?.code || line.accountId} ${account?.name || 'Unknown account'}: cash flow classification or accounting policy required.`);
    }
  }
  const groups = ['Operating', 'Investing', 'Financing'].map(activity => ({ activity, rows: Object.entries(cashGroups).filter(([key, [group]]) => group === activity && amounts[key]).map(([key, [, label]]) => ({ key, label, amount: amounts[key] })) }));
  groups.forEach(g => { g.total = sum(g.rows.map(r => r.amount)); });
  const unclassified = sum(review.map(r => r.amount)), net = report.closingCash - report.openingCash;
  return { groups, review, unclassified, net, beginning: report.openingCash, ending: report.closingCash, difference: net - sum(groups.map(g => g.total)) - unclassified };
}

export function equityMatrix(state, range, report = reportData(state, range)) {
  const legacy = equityStatement(state, range);
  const columns = report.accounts.filter(a => a.type === 'Equity').map(a => ({ id: a.id, label: a.name }));
  // Unclosed income is separate from a configured retained earnings account to avoid counting it twice.
  columns.push({ id: 'unclosed-earnings', label: 'Unclosed earnings' });
  const movements = ['Capital contributions', 'Owner drawings / capital returns', 'Other equity movements'];
  const values = Object.fromEntries(movements.map(label => [label, Object.fromEntries(columns.map(c => [c.id, 0]))]));
  for (const entry of postedEntries(state, range.end).filter(e => e.date >= range.start)) {
    const equityLines = entry.lines.filter(l => columns.some(c => c.id === l.accountId));
    const counterpart = entry.lines.filter(l => !columns.some(c => c.id === l.accountId) && (l.debit || l.credit));
    const contribution = counterpart.length && counterpart.every(l => state.accounts.find(a => a.id === l.accountId)?.type === 'Asset' && l.debit > 0);
    const drawing = counterpart.length && counterpart.every(l => state.accounts.find(a => a.id === l.accountId)?.type === 'Asset' && l.credit > 0);
    const label = contribution ? movements[0] : drawing ? movements[1] : movements[2];
    for (const l of equityLines) values[label][l.accountId] += l.credit - l.debit;
  }
  const row = (label, values, kind = 'detail') => ({ label, values, kind, total: sum(Object.values(values)) });
  const opening = Object.fromEntries(legacy.rows.map(r => [r.id, r.beginning]));
  const ending = Object.fromEntries(legacy.rows.map(r => [r.id, r.ending]));
  const profit = Object.fromEntries(columns.map(c => [c.id, c.id === 'unclosed-earnings' ? report.profit : 0]));
  const rows = [row('Beginning equity balance', opening, 'subtotal'), ...movements.filter(label => Object.values(values[label]).some(Boolean)).map(label => row(label, values[label])), row('Net income / (loss)', profit), row('Ending equity balance', ending, 'final')];
  return { columns, rows, profit: report.profit, total: legacy.totals.ending, difference: legacy.difference };
}

export function financialStatements(state, range) {
  const report = reportData(state, range), warnings = [];
  const row = (label, amount, kind = 'detail', accountId) => ({ label, amount, kind, accountId });
  const section = label => row(label, null, 'section');
  const subtotal = (label, amount) => row(label, amount, 'subtotal');
  const major = (label, amount) => row(label, amount, 'major');
  const final = (label, amount) => row(label, amount, 'final');
  const accountRow = (a, period = false) => row(`${a.code} · ${a.name}`, period ? a.period : a.balance, 'detail', a.id);
  const accounts = type => report.accounts.filter(a => a.type === type && a.balance !== 0);
  const periodAccounts = type => report.accounts.filter(a => a.type === type && a.period !== 0);
  const income = [], revenue = periodAccounts('Revenue'), expenses = periodAccounts('Expense');
  const otherRevenue = revenue.filter(a => normal(a.group) === 'other income');
  const tradingRevenue = revenue.filter(a => !otherRevenue.includes(a));
  const cost = expenses.filter(a => ['cost of sales', 'cost of goods sold'].includes(normal(a.group)));
  const tax = expenses.filter(a => ['income tax', 'income tax expense'].includes(normal(a.group)));
  const otherExpenses = expenses.filter(a => ['other expenses', 'finance costs'].includes(normal(a.group)));
  const operating = expenses.filter(a => ![...cost, ...tax, ...otherExpenses].includes(a));
  const total = (items, period = true) => sum(items.map(a => period ? a.period : a.balance));
  const incomeGroup = (label, items, totalLabel) => { if (!items.length) return; income.push(section(label), ...items.map(a => accountRow(a, true)), subtotal(totalLabel, total(items))); };
  incomeGroup('Revenue', tradingRevenue, 'Total revenue');
  incomeGroup('Cost of sales', cost, 'Total cost of sales');
  const gross = total(tradingRevenue) - total(cost);
  if (cost.length) income.push(major('Gross profit / (loss)', gross));
  incomeGroup('Operating expenses', operating, 'Total operating expenses');
  income.push(major('Operating income / (loss)', gross - total(operating)));
  incomeGroup('Other income', otherRevenue, 'Total other income');
  incomeGroup('Other expenses', otherExpenses, 'Total other expenses');
  if (otherRevenue.length || otherExpenses.length || tax.length) income.push(major('Income before tax', report.profit + total(tax)));
  incomeGroup('Income tax expense', tax, 'Total income tax expense');
  income.push(final('Net income / (loss)', report.profit));

  const balance = [];
  function balanceGroup(type, label, currentGroups, noncurrentGroups) {
    const items = accounts(type), current = items.filter(a => currentGroups.includes(normal(a.group))), noncurrent = items.filter(a => noncurrentGroups.includes(normal(a.group))), unknown = items.filter(a => !current.includes(a) && !noncurrent.includes(a));
    for (const [heading, list] of [[`Current ${label}`, current], [`Noncurrent ${label}`, noncurrent], [`Unclassified ${label} — review required`, unknown]]) {
      if (heading.startsWith('Unclassified') && !list.length) continue;
      balance.push(section(heading), ...list.map(a => accountRow(a)), subtotal(`Total ${heading.toLowerCase()}`, total(list, false)));
    }
    if (unknown.length) warnings.push(`Missing current/noncurrent classification: ${unknown.map(a => `${a.code} ${a.name}`).join(', ')}. These balances remain included in totals.`);
  }
  balance.push(section('ASSETS'));
  balanceGroup('Asset', 'Assets', ['cash & bank', 'current assets'], ['fixed assets', 'noncurrent assets']);
  balance.push(final('Total Assets', report.assets), section('LIABILITIES'));
  balanceGroup('Liability', 'Liabilities', ['current liabilities'], ['long-term liabilities', 'noncurrent liabilities']);
  balance.push(major('Total Liabilities', report.liabilities), section('Equity'), ...accounts('Equity').map(a => accountRow(a)), row('Accumulated unclosed earnings', report.retained), major('Total Equity', report.equity + report.retained), final('Total Liabilities and Equity', report.liabilities + report.equity + report.retained));
  const equity = equityMatrix(state, range, report), cash = cashFlowDetails(state, range, report), cashRows = [];
  for (const group of cash.groups) cashRows.push(section(`Cash Flows from ${group.activity} Activities`), ...group.rows.map(r => row(r.label, r.amount)), subtotal(`Net Cash from ${group.activity} Activities`, group.total));
  if (cash.review.length) cashRows.push(section('Unclassified cash movements — review required'), ...cash.review.map(r => row(`${r.entryId} · ${r.reason}`, r.amount)), subtotal('Net unclassified cash movements', cash.unclassified));
  cashRows.push(major('Net Increase / (Decrease) in Cash and Cash Equivalents', cash.net), row('Beginning Cash and Cash Equivalents', cash.beginning, 'detail'), final('Ending Cash and Cash Equivalents', cash.ending));
  return { report, income, balance, equity, cash, cashRows, warnings, balanceDifference: report.assets - report.liabilities - report.equity - report.retained };
}
