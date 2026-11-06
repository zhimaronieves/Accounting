export const TODAY = '2026-10-26';
export const money = (value, decimals = 0) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
export const shortDate = (value) => new Date(`${value}T12:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
const iso = d => d.toISOString().slice(0, 10);
const date = s => new Date(`${s}T12:00:00Z`);
const addDays = (s, amount) => { const d = date(s); d.setUTCDate(d.getUTCDate() + amount); return iso(d); };
export function presetRange(name) {
  const end = TODAY;
  if (name === 'Today') return { start: end, end, label: name };
  if (name === 'Last 7 Days') return { start: addDays(end, -6), end, label: name };
  if (name === 'Last 30 Days') return { start: addDays(end, -29), end, label: name };
  if (name === 'Last Month') return { start: '2026-09-01', end: '2026-09-30', label: name };
  if (name === 'This Year') return { start: '2026-01-01', end, label: name };
  return { start: '2026-10-01', end, label: 'This Month' };
}
export function isValidRange(start, end) {
  const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(date(s).getTime()) && iso(date(s)) === s;
  return Boolean(start && end && validDate(start) && validDate(end) && start <= end);
}
const october = [
  [26, 'Invoice payment · Mercado Foods', 'Accounts Receivable', 'Income', 125000, 'Completed', 'Revenue'],
  [25, 'October team payroll', 'Payroll Expense', 'Expense', 350000, 'Completed', 'Payroll'],
  [24, 'Office lease · BGC', 'Rent Expense', 'Expense', 85000, 'Pending', 'Operations'],
  [23, 'Invoice payment · Tala Creative', 'Accounts Receivable', 'Income', 85000, 'Completed', 'Revenue'],
  [22, 'Cloud hosting & software', 'Software Expense', 'Expense', 24000, 'Completed', 'Operations'],
  [21, 'October digital campaign', 'Marketing Expense', 'Expense', 64000, 'Completed', 'Marketing'],
  [20, 'Retainer · Northline Logistics', 'Service Revenue', 'Income', 210000, 'Completed', 'Revenue'],
  [18, 'Professional consulting fees', 'Professional Fees', 'Expense', 52000, 'Completed', 'Others'],
  [17, 'Project milestone · Isla Ventures', 'Service Revenue', 'Income', 160000, 'Completed', 'Revenue'],
  [15, 'Electricity, water & internet', 'Utilities Expense', 'Expense', 27000, 'Completed', 'Utilities'],
  [14, 'Invoice payment · Bayan Retail', 'Accounts Receivable', 'Income', 97500, 'Completed', 'Revenue'],
  [12, 'Equipment maintenance', 'Repairs & Maintenance', 'Expense', 65000, 'Completed', 'Operations'],
  [10, 'Consulting · Sariwa Organics', 'Service Revenue', 'Income', 132500, 'Completed', 'Revenue'],
  [9, 'Contractor payroll', 'Payroll Expense', 'Expense', 80000, 'Completed', 'Payroll'],
  [6, 'Project payment · Pacific Works', 'Service Revenue', 'Income', 250000, 'Completed', 'Revenue'],
  [5, 'Client visits & transportation', 'Travel Expense', 'Expense', 18000, 'Completed', 'Others'],
  [3, 'Business insurance', 'Insurance Expense', 'Expense', 20000, 'Completed', 'Others'],
  [2, 'Invoice payment · Kubo Living', 'Accounts Receivable', 'Income', 190000, 'Completed', 'Revenue'],
];
// Fixed demonstration snapshot; replace this dataset with ledger records when a backend is added.
export const transactions = Array.from({ length: 10 }, (_, index) => {
  const month = index + 1;
  const scale = month === 10 ? 1 : 0.56 + month * 0.039;
  return october.map(([day, description, account, type, amount, status, category], row) => ({
    id: `TXN-2026-${String(month * 100 + 99 - row).padStart(4, '0')}`,
    date: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    description, account, type, amount: Math.round(amount * scale / 100) * 100,
    status: month === 10 ? status : 'Completed', category,
  }));
}).flat().sort((a, b) => b.date.localeCompare(a.date));
export const invoices = [35000, 28000, 22000, 18000, 15000, 17000, 12000, 14000, 16000, 10000, 13000, 15000].map((amount, i) => ({
  id: `INV-2026-${String(i + 1).padStart(3, '0')}`, amount,
  date: `2026-10-${String(i * 2 + 1).padStart(2, '0')}`, overdue: i < 2 || i === 7,
}));
export const initialNotifications = [
  { id: 1, title: 'Customer invoice issued', description: 'INV-2026-001 for Mercado Foods is awaiting payment.', time: '2 min ago', icon: 'invoice', read: false },
  { id: 2, title: 'Draft journal needs review', description: 'The payroll accrual draft is ready for review.', time: '18 min ago', icon: 'journal', read: false },
  { id: 3, title: 'Your monthly report is ready', description: 'September financial statements are available.', time: '1 hr ago', icon: 'report', read: false },
  { id: 4, title: 'An invoice is overdue', description: 'INV-2026-008 is past its payment due date.', time: '2 hr ago', icon: 'invoice', read: false },
];
export const categoryColors = ['#559cda', '#7aade0', '#9cc3e8', '#c0d9f0', '#dfeaf6'];
export function getSummary(range, dataset = transactions) {
  const rows = dataset.filter(t => t.date >= range.start && t.date <= range.end);
  const revenue = rows.filter(t => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0);
  const expenses = rows.filter(t => t.type === 'Expense').reduce((sum, t) => sum + t.amount, 0);
  const open = invoices.filter(i => i.date >= range.start && i.date <= range.end);
  const breakdown = ['Payroll', 'Operations', 'Utilities', 'Marketing', 'Others'].map((name, index) => ({ name, value: rows.filter(t => t.type === 'Expense' && t.category === name).reduce((sum, t) => sum + t.amount, 0), color: categoryColors[index] }));
  // Allocate rounding remainders so displayed category percentages total exactly 100.0%.
  const shares = breakdown.map(c => expenses ? c.value / expenses * 1000 : 0);
  const units = shares.map(Math.floor);
  const remainder = expenses ? 1000 - units.reduce((a, b) => a + b, 0) : 0;
  shares.map((n, i) => ({ i, fraction: n - units[i] })).sort((a, b) => b.fraction - a.fraction).slice(0, remainder).forEach(({ i }) => units[i]++);
  breakdown.forEach((c, i) => c.percentage = units[i] / 10);
  return { rows, revenue, expenses, profit: revenue - expenses, outstanding: open.reduce((sum, i) => sum + i.amount, 0), invoiceCount: open.length, overdue: open.filter(i => i.overdue).length, breakdown };
}
export function comparisonRange(range) {
  const duration = Math.round((date(range.end) - date(range.start)) / 86400000) + 1;
  const end = addDays(range.start, -1);
  return { start: addDays(end, -duration + 1), end };
}
export function chartData(range, dataset = transactions) {
  const daily = (date(range.end) - date(range.start)) / 86400000 < 40;
  const data = new Map();
  for (let cursor = range.start; cursor <= range.end; cursor = addDays(cursor, 1)) {
    const key = daily ? cursor : cursor.slice(0, 7);
    if (!data.has(key)) data.set(key, { date: key, label: date(cursor).toLocaleDateString('en-PH', daily ? { month: 'short', day: 'numeric' } : { month: 'short' }), Revenue: 0, Expenses: 0 });
  }
  for (const row of getSummary(range, dataset).rows) { const group = data.get(daily ? row.date : row.date.slice(0, 7)); group[row.type === 'Income' ? 'Revenue' : 'Expenses'] += row.amount; }
  return [...data.values()];
}

