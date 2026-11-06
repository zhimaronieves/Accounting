// The same two-line instruction drives the preview and the existing journal engine.
export const BANK_TRANSACTION_TYPES = ['Direct Deposit', 'Direct Withdrawal', 'Bank Charge', 'Bank Interest', 'Bank Transfer'];

export function offsetAccounts(state, type, bankAccountId) {
  const controls = new Set(['1100', '2000', 'booksdotnet-customer-advances', 'booksdotnet-supplier-prepayments']);
  for (const row of [...state.invoices, ...state.bills, ...state.v2.customers, ...state.v2.suppliers]) if (row.controlAccountId) controls.add(row.controlAccountId);
  for (const [key, id] of Object.entries(state.v2.accountingDefaults || {})) if (/receivable|payable/i.test(key)) controls.add(id);
  const bankGLs = new Set((state.v2.bankAccounts||[]).map(b => b.glAccountId));
  return state.accounts.filter(a => a.active && !controls.has(a.id) && !bankGLs.has(a.id)
    && (type !== 'Bank Charge' || a.type === 'Expense') && (type !== 'Bank Interest' || a.type === 'Revenue'));
}

export function defaultOffset(state, type) {
  const eligible = offsetAccounts(state, type), configured = state.v2.accountingDefaults?.[type === 'Bank Charge' ? 'bankChargesAccountId' : 'interestIncomeAccountId'];
  return eligible.find(a => a.id === configured)?.id || eligible.find(a => (type === 'Bank Charge' ? /bank.*(charge|fee)/i : /interest.*income|income.*interest/i).test(a.name))?.id || '';
}

export function bankTransactionLines(state, record) {
  const bank = (state.v2.bankAccounts||[]).find(b => b.id === record.bankAccountId);
  const validBank = b => b?.active && state.accounts.some(a => a.id === b.glAccountId && a.active && a.type === 'Asset' && a.group === 'Cash & bank');
  if (!BANK_TRANSACTION_TYPES.includes(record.type)) throw new Error('Choose a transaction type.');
  if (!validBank(bank)) throw new Error('Choose an active company bank account with an active bank GL.');
  if (!Number.isSafeInteger(record.amount) || record.amount <= 0 || record.amount > 100000000000) throw new Error('Enter a positive amount with no more than two decimal places.');
  const amount = record.amount;
  if (record.type === 'Bank Transfer') {
    const destination = (state.v2.bankAccounts||[]).find(b => b.id === record.toBankAccountId);
    if (!validBank(destination) || destination.id === bank.id) throw new Error('Choose a different active destination bank account.');
    if (destination.currency !== bank.currency) throw new Error('Transfers require accounts using the same currency.');
    return [{ accountId: destination.glAccountId, bankAccountId: destination.id, debit: amount, credit: 0 }, { accountId: bank.glAccountId, bankAccountId: bank.id, debit: 0, credit: amount }];
  }
  const offset = offsetAccounts(state, record.type, bank.id).find(a => a.id === record.offsetAccountId);
  if (!offset) throw new Error(record.type === 'Bank Charge' ? 'Choose a valid Bank Charges Expense account.' : record.type === 'Bank Interest' ? 'Choose a valid Interest Income account.' : 'Choose an active offset account. Use AR/AP for controlled balances and Bank Transfer for company bank transfers.');
  const incoming = ['Direct Deposit', 'Bank Interest'].includes(record.type);
  const bankLine = { accountId: bank.glAccountId, bankAccountId: bank.id, debit: incoming ? amount : 0, credit: incoming ? 0 : amount };
  const offsetLine = { accountId: offset.id, debit: incoming ? 0 : amount, credit: incoming ? amount : 0, ...(offset.group === 'Cash & bank' ? { nonBankCash: true } : {}) };
  return incoming ? [bankLine, offsetLine] : [offsetLine, bankLine];
}

export const bankTransactionFingerprint = r => JSON.stringify(['type', 'bankAccountId', 'toBankAccountId', 'date', 'amount', 'reference', 'description', 'offsetAccountId'].map(key => r[key] ?? ''));

export function movementSourceLabel(state, entry, payment) {
  if (entry.bankTransactionId) return state.v2.bankTransactions?.find(t => t.id === entry.bankTransactionId)?.type === 'Bank Transfer' ? 'Bank Transfer' : 'Manual Bank Transaction';
  if (payment) return payment.kind === 'bill' || state.bills.some(d => d.payments?.some(p => p.entryId === entry.id)) ? 'Supplier Payment' : 'Customer Payment';
  if (entry.reversalOf) return 'Journal Reversal';
  if (entry.bankTransaction) return 'Manual Bank Transaction';
  return ({ manual: 'Journal Entry', invoice: 'Customer Invoice', bill: 'Supplier Bill', opening: 'Opening Balance', payment: 'Payment', 'seed-capital': 'Owner Capital', seed: 'Ledger Posting', 'adjustment-note': 'Credit / Debit Note' })[entry.source] || 'Ledger Posting';
}

// Only simple legacy bank drafts can be converted without guessing their accounting.
export function legacyBankDraft(state, entry) {
  if (!entry?.bankTransaction || entry.status !== 'Draft' || entry.lines.length !== 2) return null;
  const bankLine = entry.lines.find(l => (state.v2.bankAccounts||[]).some(b => b.glAccountId === l.accountId));
  if (!bankLine || !(bankLine.debit || bankLine.credit)) return null;
  const bank = (state.v2.bankAccounts||[]).find(b => b.glAccountId === bankLine.accountId), other = entry.lines.find(l => l !== bankLine);
  if (bankLine.debit !== other.credit || bankLine.credit !== other.debit) return null;
  const destination = (state.v2.bankAccounts||[]).find(b => b.glAccountId === other.accountId);
  const from = destination && bankLine.debit ? destination : bank, to = destination && bankLine.debit ? bank : destination;
  return { legacyDraftEntryId: entry.id, type: destination ? 'Bank Transfer' : bankLine.debit ? 'Direct Deposit' : 'Direct Withdrawal', bankAccountId: from.id, toBankAccountId: to?.id || '', offsetAccountId: destination ? '' : other.accountId, amount: bankLine.debit || bankLine.credit, date: entry.date, reference: entry.reference || '', description: entry.memo || '', status: 'Draft' };
}
