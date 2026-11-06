export const documentControl = (doc, kind) => doc?.controlAccountId || (kind === 'invoice' ? '1100' : '2000');
export function allocationControls(state, kind, allocations, debit) {
  const grouped = new Map(), docs = kind === 'invoice' ? state.invoices : state.bills;
  for (const a of allocations) { const id = documentControl(docs.find(d => d.id === a.docId), kind); grouped.set(id, (grouped.get(id) || 0) + a.amount); }
  return [...grouped].map(([accountId, amount]) => ({ accountId, debit: debit ? amount : 0, credit: debit ? 0 : amount }));
}
function distribute(amount, weights) {
  const total = BigInt(weights.reduce((s,w)=>s+w.amount,0)), value=BigInt(amount);
  const shares=weights.map(w=>{const product=value*BigInt(w.amount);return {accountId:w.accountId,amount:Number(product/total),remainder:product%total};});
  let remaining=amount-shares.reduce((s,w)=>s+w.amount,0);
  for(const share of [...shares].sort((a,b)=>a.remainder===b.remainder?0:a.remainder>b.remainder?-1:1)) if(remaining-- > 0) share.amount++;
  return shares;
}
export function notePostingLines(state, doc, kind, credit, note) {
  const control = documentControl(doc, kind), source = state.entries.find(e=>e.id===doc.entryId), invoice = kind==='invoice';
  const weights = (source?.lines || []).filter(l=>l.accountId!==control && (invoice ? l.credit>0 && state.accounts.find(a=>a.id===l.accountId)?.type==='Revenue' : l.debit>0)).map(l=>({accountId:l.accountId,amount:invoice?l.credit:l.debit}));
  if (!weights.length) throw new Error('The source document posting is missing.');
  const controlDebit = invoice ? !credit : credit, otherDebit = !controlDebit;
  return [{accountId:control,debit:controlDebit?note.amount:0,credit:controlDebit?0:note.amount}, ...distribute(invoice?note.amount-note.tax:note.amount,weights).map(l=>({accountId:l.accountId,debit:otherDebit?l.amount:0,credit:otherDebit?0:l.amount})), ...(invoice&&note.tax?[{accountId:'2100',debit:credit?note.tax:0,credit:credit?0:note.tax}]:[])];
}
