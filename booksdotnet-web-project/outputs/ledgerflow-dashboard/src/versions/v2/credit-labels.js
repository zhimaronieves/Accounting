export const creditName = kind => kind === 'invoice' ? 'Customer Credit' : 'Supplier Credit';
export const adjustmentName = (kind, type) => type === 'Debit Note' ? `${kind === 'invoice' ? 'Customer' : 'Supplier'} Debit Note` : creditName(kind);
export const formalNoteType = (kind, type) => kind === 'bill' && type === 'Credit Note' ? 'Supplier Credit Note' : type;
