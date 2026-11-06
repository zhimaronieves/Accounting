export const CONFIG_PAGES = { 'Item Configuration':['categories','uoms'], 'Nature of Business':['natures'], 'Customer Groups':['customerGroups'], 'Organizational Settings':['branches','departments','positions'], Banks:['banks'], 'Payment Terms':['terms'] };
export const CONFIG = {
 categories:{label:'Categories',singular:'Category',prefix:'CAT'}, uoms:{label:'Units of Measure',singular:'Unit of Measure',prefix:'UOM'},
 natures:{label:'Nature of Business',singular:'Nature of Business',prefix:'NOB'}, customerGroups:{label:'Customer Groups',singular:'Customer Group',prefix:'CG'},
 branches:{label:'Branches',singular:'Branch',prefix:'BR'}, departments:{label:'Departments',singular:'Department',prefix:'DEP'}, positions:{label:'Positions',singular:'Position',prefix:'POS'}, banks:{label:'Banks',singular:'Bank',prefix:'BNK'}, terms:{label:'Payment Terms',singular:'Payment Term',prefix:'TERM'}
};
export const refRows = (state,key) => state.v2?.configuration?.[key] || [];
export const refName = (state,key,id,fallback='') => refRows(state,key).find(r=>r.id===id)?.name || fallback;
export function validateRef(state,key,id,previous,required=false) {
 if (!state.v2.configuration) return;
 if (!id) { if(required) throw new Error(`Choose a ${CONFIG[key].singular.toLowerCase()}.`); return; }
 const row=refRows(state,key).find(r=>r.id===id);
 if (!row || !row.active && id!==previous) throw new Error(`Choose an active ${CONFIG[key].singular.toLowerCase()} from configuration.`);
}
export function suggestedDueDate(state,termId,date) {
 const term=refRows(state,'terms').find(r=>r.id===termId); if(!term || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
 const d=new Date(`${date}T00:00:00Z`); if(Number.isNaN(d.getTime())) return date;
 d.setUTCDate(d.getUTCDate()+Number(term.days)); return d.toISOString().slice(0,10);
}
export function validateMasterRefs(state,page,r,old) {
 if(!state.v2.configuration) return;
 const fields=page==='Items' ? [['categories','categoryId'],['uoms','uomId',true]] : page==='Employees' ? [['branches','branchId',true],['departments','departmentId',true],['positions','positionId',true]] : [['natures','natureId'],['terms','paymentTermId',true],...(page==='Customers'?[['customerGroups','customerGroupId']]:[])];
 for(const [key,field,required] of fields) validateRef(state,key,r[field],old?.[field],required);
 if(page==='Employees') { const dept=refRows(state,'departments').find(d=>d.id===r.departmentId); if(dept?.branchId && dept.branchId!==r.branchId && !(old?.branchId===r.branchId && old?.departmentId===r.departmentId)) throw new Error('Choose a department assigned to the selected branch.'); }
 for(const [key,field] of fields) { const legacy={categories:'category',uoms:'uom',natures:'nature',branches:'branch',departments:'department',positions:'position'}[key]; if(legacy) r[legacy]=refName(state,key,r[field]); }
 if(r.paymentTermId) r.terms=refRows(state,'terms').find(t=>t.id===r.paymentTermId).days;
}

export const priorDocumentLine=(doc,line,index)=>doc?.items?.find(l=>l.lineId && l.lineId===line.lineId) || (doc?.items?.every(l=>!l.lineId) ? doc.items[index] : undefined);

export const activePaymentTerm=(state,preferred)=>{const terms=refRows(state,'terms').filter(t=>t.active);return terms.find(t=>t.id===preferred)?.id || terms.find(t=>t.days===30)?.id || terms[0]?.id || '';};
