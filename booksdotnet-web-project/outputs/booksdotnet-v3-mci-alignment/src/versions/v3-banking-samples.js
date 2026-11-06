import { upgradeBanking, reduceBanking, bankMovements } from './v2/banking.js';
import { reduceTransactions } from './v2/transactions.js';
import { isPostableAccount } from '../account-hierarchy.js';

// Prototype-only additive migration: never reuse an ambiguous historical bank GL.
export function withBankingSamples(workspace) {
  if (workspace.v2?.bankingSample?.version === 1) return workspace;
  let state = upgradeBanking(workspace);
  const actor = 'V3 Banking Sample', bankIds = [], entryIds = [];
  const apply = action => { state = reduceBanking(state, { ...action, actor }); };
  function account(name, type, group, start, parentId = null) {
    let code = start;
    while (state.accounts.some(a => a.code === String(code) || a.id === String(code))) code++;
    apply({ type:'account', account:{ code:String(code), name, type, group, parentId } });
    return state.accounts.at(-1);
  }
  const parent = state.accounts.find(a => a.id === '1000' && a.legacyPostingParent && a.active);
  const definitions = [
    ['Operating Checking', 'BDO', /BDO/i, 50000000, '9990-0000-0101'],
    ['Payroll Account', 'BPI', /Philippine Islands|BPI/i, 29000000, '9990-0000-0202'],
    ['Savings Account', 'Metrobank', /Metrobank/i, 75000000, '9990-0000-0303'],
  ];
  for (const [name, bankName, pattern, opening, number] of definitions) {
    let bank = state.v2.configuration.banks.find(b => b.active && pattern.test(b.name));
    if (!bank) {
      bank = {id:`V3-SAMPLE-${bankName}`,code:`V3-SAMPLE-${bankName}`,name:bankName,active:true,description:'Fictional V3 prototype reference'};
      state.v2.configuration.banks.push(bank);
    }
    const gl = account(`Cash in Bank — ${bankName} ${name}`, 'Asset', 'Cash & bank', 1040, parent?.id || null);
    let accountNumber = number;
    while (state.v2.bankAccounts.some(b=>b.bankId===bank.id && b.accountNumber.replace(/\D/g,'')===accountNumber.replace(/\D/g,''))) accountNumber += '0';
    apply({type:'v2/bankAccount',record:{name,bankId:bank.id,accountNumber,currency:'PHP',glAccountId:gl.id,active:true,description:'Fictional company bank account for the V3 prototype.'}});
    const companyBank = state.v2.bankAccounts.at(-1); bankIds.push(companyBank.id);
    apply({type:'account',account:gl,opening:{amount:opening,side:'Debit',date:'2026-10-01'}});
    entryIds.push(state.entries.at(-1).id);
  }
  const [bdo,bpi] = bankIds;
  // Imported source-module payments remain read-only in V3 and use their own journal once.
  for (const [kind,amount,reference] of [['invoice',2500000,'V3-SAMPLE-COLLECTION'],['bill',1500000,'V3-SAMPLE-SUPPLIER']]) {
    const party = state.v2[kind==='invoice'?'customers':'suppliers'].find(p=>p.active);
    if (!party) throw new Error('Sample banking payments require an active customer and supplier.');
    state = reduceTransactions(state,{type:'v2/payment',kind,payment:{requestId:reference,partyId:party.id,date:'2026-10-06',method:'Bank transfer',bankAccountId:bdo,bankAccountName:state.v2.bankAccounts.find(b=>b.id===bdo).name,cashAccountId:state.v2.bankAccounts.find(b=>b.id===bdo).glAccountId,amount,reference,allocations:[],demo:true}});
    entryIds.push(state.v2.payments.at(-1).entryId);
  }
  account('Cash in Bank — Additional Company Account','Asset','Cash & bank',1040,parent?.id||null);
  const cash = account('Petty Cash — Counter Withdrawals','Asset','Cash & bank',1090,parent?.id||null);
  const expense = account('Bank Service Charges','Expense','Others',5900);
  const income = account('Bank Interest Income','Revenue','Revenue',4900);
  const capital = state.accounts.find(a=>a.id==='booksdotnet-opening-balance-equity' && isPostableAccount(state.accounts,a));
  const transactions = [
    ['Direct Deposit',1000000,capital.id,'V3-SAMPLE-DEPOSIT','Additional owner funding'],
    ['Direct Withdrawal',500000,cash.id,'V3-SAMPLE-WITHDRAWAL','Counter withdrawal to petty cash'],
    ['Bank Charge',25000,expense.id,'V3-SAMPLE-CHARGE','Monthly bank service charge'],
    ['Bank Interest',50000,income.id,'V3-SAMPLE-INTEREST','Interest earned on operating funds'],
    ['Bank Transfer',3000000,'','V3-SAMPLE-TRANSFER','Payroll funding transfer'],
  ];
  for (const [type,amount,offsetAccountId,reference,description] of transactions) {
    apply({type:'v2/bankTransaction',record:{requestId:reference,type,bankAccountId:bdo,toBankAccountId:type==='Bank Transfer'?bpi:'',date:'2026-10-15',amount,offsetAccountId,reference,description,status:'Posted'}});
    entryIds.push(state.v2.bankTransactions.at(-1).entryId);
  }
  const reconciliationIds = [];
  for (const [index,bankAccountId] of bankIds.entries()) {
    const movements = bankMovements(state).filter(m=>m.bankAccountId===bankAccountId);
    const statement = movements.map((m,i)=>({id:`V3-SAMPLE-STATEMENT-${index}-${i}`,date:m.date,description:m.description,reference:m.reference,moneyIn:m.moneyIn,moneyOut:m.moneyOut}));
    const matches = statement.flatMap((row,i)=>index===0||index===1&&i===0?[{statementId:row.id,movementId:movements[i].id}]:[]);
    apply({type:'v2/reconciliation',complete:index===0,record:{bankAccountId,startDate:'2026-10-01',endDate:'2026-10-20',endingBalance:movements.reduce((n,m)=>n+m.amount,0),statement,matches,reviewed:index===0}});
    reconciliationIds.push(state.v2.reconciliations.at(-1).id);
  }
  state.v2.bankingSample = {version:1,bankIds,entryIds,reconciliationIds,description:'Fictional additive V3 banking sample; historical transactions and mappings are retained.'};
  return state;
}
