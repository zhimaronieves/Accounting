// Hierarchy metadata never creates ledger lines or stored roll-up balances.
export const hasChildren=(accounts,id)=>accounts.some(a=>a.parentId===id);
export const isPostableAccount=(accounts,a)=>Boolean(a?.active&&(!hasChildren(accounts,a.id)||a.legacyPostingParent===true));
export function descendantIds(accounts,id){const found=new Set(),visit=parent=>{for(const a of accounts.filter(a=>a.parentId===parent)){if(found.has(a.id)||a.id===id)continue;found.add(a.id);visit(a.id);}};visit(id);return found;}
export function directAccountActivity(state,id){const a=state.accounts.find(a=>a.id===id);return state.entries.some(e=>e.lines.some(l=>l.accountId===id))||Boolean(a?.openingBalance||a?.openingDebit||a?.openingCredit);}
export function branchHasHistory(state,id){return [id,...descendantIds(state.accounts,id)].some(key=>directAccountActivity(state,key));}
export function groupingRestriction(state,id){
 const a=state.accounts.find(a=>a.id===id);
 if(a?.legacyPostingParent===true)return '';
 if(directAccountActivity(state,id))return 'This account has existing transactions or opening balances and cannot be converted into a grouping account. Please review its current balance and transaction history.';
 const defaults=state.v2?.accountingDefaults||{};
 if(a?.protected||state.v2?.bankAccounts?.some(b=>b.glAccountId===id)||Object.values(defaults).includes(id)||[...(state.v2?.customers||[]),...(state.v2?.suppliers||[])].some(p=>p.controlAccountId===id)||state.v2?.items?.some(i=>[i.incomeAccountId,i.purchaseAccountId].includes(id)))return 'This account is reserved or mapped for transactions and must remain a posting account.';
 return '';
}
export function assertAccountHierarchy(accounts){
 for(const a of accounts){const seen=new Set([a.id]);let child=a;while(child.parentId){const parent=accounts.find(p=>p.id===child.parentId);if(!parent)throw new Error('Choose an existing parent account.');if(seen.has(parent.id))throw new Error('An account cannot be its own parent or form a circular hierarchy.');if(parent.type!==child.type)throw new Error('Parent and subaccount must have the same account type.');seen.add(parent.id);child=parent;}}
}
export function validateAccountRelationship(state,input){
 const old=state.accounts.find(a=>a.id===input.id),candidate={...old,...input,id:old?.id||input.code,parentId:input.parentId||null};
 if(candidate.parentId!==null&&typeof candidate.parentId!=='string')throw new Error('Choose a valid parent account.');
 const accounts=state.accounts.filter(a=>a.id!==candidate.id).concat(candidate);assertAccountHierarchy(accounts);
 if(hasChildren(accounts,candidate.id)&&(candidate.openingBalance||candidate.openingDebit||candidate.openingCredit))throw new Error('Opening balances cannot be assigned directly to grouping accounts.');
 const changed=(old?.parentId||null)!==candidate.parentId;
 if(changed&&old&&(old.protected||branchHasHistory(state,old.id)))throw new Error('The parent relationship is locked because this account or its descendants have journal history, opening balances, or system protection. Historical classifications are preserved.');
 if(candidate.parentId&&changed){const parent=state.accounts.find(a=>a.id===candidate.parentId);if(!candidate.active&&old)throw new Error('Restore this account before assigning a parent.');if(!parent?.active)throw new Error('Choose an active parent account.');const reason=groupingRestriction(state,parent.id);if(reason)throw new Error('Unable to Assign Subaccount: '+reason);}
 return candidate.parentId;
}
export function eligibleParentAccounts(state,account){return state.accounts.filter(parent=>{if(!parent.active||parent.type!==account.type||parent.id===(account.id||account.code)||descendantIds(state.accounts,account.id||account.code).has(parent.id))return false;return !groupingRestriction(state,parent.id);});}
export function rollupBalance(accounts,id){const ids=descendantIds(accounts,id);ids.add(id);return accounts.filter(a=>ids.has(a.id)).reduce((sum,a)=>sum+(a.balance||0),0);}
export function accountOptionLabel(accounts,a){const names=[a.name],seen=new Set([a.id]);let parent=accounts.find(p=>p.id===a.parentId);while(parent&&!seen.has(parent.id)){seen.add(parent.id);names.unshift(parent.name);parent=accounts.find(p=>p.id===parent.parentId);}return `${a.code} — ${names.join(' › ')}`;}
export function accountTreeGroups(rows,{query='',sort={key:'',direction:1},expanded=new Set(),filter=()=>true,filterActive=false,collapsed=new Set()}){
 const matches=new Set(rows.filter(r=>filter(r)&&String(r.search||`${r.code} ${r.name} ${r.type} ${r.group}`).toLowerCase().includes(query.toLowerCase())).map(r=>r.id)),included=new Set(matches);
 for(const id of matches){let r=rows.find(a=>a.id===id),seen=new Set();while(r?.parentId&&!seen.has(r.parentId)){seen.add(r.parentId);included.add(r.parentId);r=rows.find(a=>a.id===r.parentId);}}
 const compare=(a,b)=>{const key=sort.key||'code',av=a[key]??'',bv=b[key]??'';return (sort.key?sort.direction:1)*(typeof av==='number'?av-bv:String(av).localeCompare(String(bv),undefined,{numeric:true}));};
 const visit=(a,depth)=>{const children=rows.filter(r=>r.parentId===a.id&&included.has(r.id)).sort(compare),open=Boolean(expanded.has(a.id)||(query.trim()||filterActive)&&!collapsed.has(a.id));return [{...a,__depth:depth,__group:hasChildren(rows,a.id),__expanded:open,__context:!matches.has(a.id)},...(open?children.flatMap(c=>visit(c,depth+1)):[])];};
 return rows.filter(r=>included.has(r.id)&&(!r.parentId||!rows.some(a=>a.id===r.parentId))).sort(compare).map(a=>({id:a.id,visible:visit(a,0)}));
}

// Inspect references throughout the saved workspace before removing a sample record.
export function accountDependencies(state,id,{ignoreChildParents=false}={}) {
 const refs=[];
 const scan=(value,path)=>{
   if(value===id){refs.push(path);return;}
   if(Array.isArray(value))value.forEach((v,i)=>scan(v,`${path}[${i}]`));
   else if(value&&typeof value==='object')for(const [key,v] of Object.entries(value))scan(v,`${path}.${key}`);
 };
 for(const [key,value]of Object.entries(state))if(key!=='accounts'&&key!=='hierarchyReconciliation')scan(value,key);
 for(const a of state.accounts){
   if(a.id===id){if(a.protected||a.openingBalance||a.openingDebit||a.openingCredit)refs.push(`accounts.${id}.protection/opening`);continue;}
   for(const [key,value]of Object.entries(a))if(!(ignoreChildParents&&key==='parentId'))scan(value,`accounts.${a.id}.${key}`);
 }
 return refs;
}
export const SAMPLE_ACCOUNT_GROUPS=[
 ['1000','Cash & Bank','Asset','Cash & bank',[['1010','Cash on Hand'],['1020','BDO Checking Account'],['1030','BPI Savings Account']]],
 ['1100','Accounts Receivable','Asset','Current assets',[['1110','Trade Receivables'],['1120','Other Receivables']]],
 ['1200','Office Equipment','Asset','Fixed assets',[['1210','Computer Equipment'],['1220','Furniture & Fixtures']]],
 ['1300','Prepaid Expenses','Asset','Current assets',[['1310','Prepaid Rent'],['1320','Prepaid Insurance']]],
 ['1400','Supplier Prepayments','Asset','Current assets',[['1410','Supplier Advances'],['1420','Other Supplier Deposits']]],
 ['2000','Accounts Payable','Liability','Current liabilities',[['2010','Trade Payables'],['2020','Other Payables']]],
 ['2100','Tax Payable','Liability','Current liabilities',[['2110','VAT Payable'],['2120','Withholding Tax Payable']]],
 ['2200','Business Loan','Liability','Long-term liabilities',[['2210','Current Portion of Loan'],['2220','Long-term Loan Payable']]],
 ['3000','Equity','Equity','Equity',[["3010","Owner's Capital"],['3020','Retained Earnings']]],
 ['4000','Revenue','Revenue','Revenue',[['4010','Sales Revenue'],['4020','Service Revenue']]],
 ['5000','Operating Expenses','Expense','Operations',[['5010','Rent Expense'],['5020','Utilities Expense'],['5030','Salaries Expense']]],
];
const priorSampleHeadings={'3000':'Owner capital','4000':'Service revenue','5000':'Payroll Expense'};
const sampleChildGroups={'2210':'Current liabilities','5010':'Operations','5020':'Utilities','5030':'Payroll'};
export function reconcileSampleHierarchy(state,{renameHeadings=false}={}) {
 if(state.hierarchyReconciliation?.version===2){
   if(!renameHeadings||state.hierarchyReconciliation.headingRenameReviewed)return state;
   const next=structuredClone(state),approved=priorSampleHeadings;
   for(const [code,name]of SAMPLE_ACCOUNT_GROUPS.filter(([code])=>Object.hasOwn(approved,code))){
     const a=next.accounts.find(a=>a.code===code);
     if(a?.name===approved[code]){next.hierarchyReconciliation.renamed.push({id:a.id,from:a.name,to:name});a.name=name;}
     if(a?.name===name)next.hierarchyReconciliation.issues=next.hierarchyReconciliation.issues.filter(issue=>!issue.startsWith(`${code}: retained existing heading`));
   }
   for(const [code,group]of Object.entries(sampleChildGroups)){const child=next.accounts.find(a=>a.code===code),parent=next.accounts.find(a=>a.id===child?.parentId);if(child&&parent&&child.group===parent.group&&!directAccountActivity(next,child.id))child.group=group;}
   next.hierarchyReconciliation.headingRenameReviewed=true;
   return next;
 }
 const next=structuredClone(state),issues=[],removed=[],renamed=[];
 const duplicate=next.accounts.find(a=>a.code==='1001'),cash=next.accounts.find(a=>a.code==='1000');
 if(duplicate&&cash){
   const children=next.accounts.filter(a=>a.parentId===duplicate.id);
   const refs=accountDependencies(next,duplicate.id,{ignoreChildParents:true});
   if(next.cashHierarchySampleVersion!==1||duplicate.name!=='Cash & Bank'||duplicate.type!=='Asset'||duplicate.group!=='Cash & bank')refs.push('not the recognized duplicate sample record');
   if(children.some(a=>!['1010','1020','1030'].includes(a.code)||branchHasHistory(next,a.id)||accountDependencies(next,a.id,{ignoreChildParents:true}).length))refs.push('dependent or unexpected subaccounts');
   if(refs.length)issues.push(`1001 retained: dependencies require reconciliation (${refs.join(', ')}).`);
   else {children.forEach(a=>a.parentId=cash.id);next.accounts=next.accounts.filter(a=>a.id!==duplicate.id);removed.push(duplicate.code);}
 }
 for(const [code,name,type,group,children] of SAMPLE_ACCOUNT_GROUPS){
   let parent=next.accounts.find(a=>a.code===code);
   if(parent&&(parent.type!==type||!parent.active)){issues.push(`${code}: incompatible or inactive existing account; children were not assigned.`);continue;}
   if(parent&&![name,priorSampleHeadings[code]].filter(Boolean).some(n=>n.toLowerCase()===parent.name.toLowerCase())){issues.push(`${code}: code belongs to a different existing account (${parent.name}); this sample group was skipped.`);continue;}
   if(!parent){parent={id:code,code,name,type,group,active:true,protected:false,parentId:null};next.accounts.push(parent);}
   if(parent.name!==name){
     if(parent.name.toLowerCase()===name.toLowerCase()||renameHeadings){renamed.push({id:parent.id,from:parent.name,to:name});parent.name=name;}
     else issues.push(`${code}: retained existing heading ${parent.name}; requested heading ${name} requires confirmation.`);
   }
   if(groupingRestriction(next,parent.id))parent.legacyPostingParent=true;
   for(const [childCode,childName]of children){
     const existing=next.accounts.find(a=>a.code===childCode||a.id===childCode);
     if(existing){if(existing.name!==childName||existing.type!==type||existing.parentId!==parent.id)issues.push(`${childCode}: existing account or relationship retained; no automatic reassignment.`);continue;}
     if(next.accounts.some(a=>a.id===childCode)){issues.push(`${childCode}: account ID conflict.`);continue;}
     next.accounts.push({id:childCode,code:childCode,name:childName,type,group:sampleChildGroups[childCode]||group,active:true,protected:false,parentId:parent.id});
   }
 }
 assertAccountHierarchy(next.accounts);
 next.hierarchyReconciliation={version:2,issues,removed,renamed,headingRenameReviewed:renameHeadings,policy:'Preserve direct historical postings and mapped posting behavior until explicit allocation is reconciled. No journals or mappings changed.'};
 return next;
}
