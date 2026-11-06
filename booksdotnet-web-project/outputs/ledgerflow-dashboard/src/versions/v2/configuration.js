import { upgradeMasterfile, reduceMasterfile, nextCode } from './masterfile.js';
import { CONFIG, refRows, validateRef } from './configuration-data.js';
export function upgradeConfiguration(state) {
 const next=upgradeMasterfile(state); next.v2.configuration ||= {};
 const cfg=next.v2.configuration;
 const seed=(key,rows)=>{ if(!cfg[key]) cfg[key]=rows.map((r,i)=>({id:`${CONFIG[key].prefix}-${String(i+1).padStart(4,'0')}`,code:`${CONFIG[key].prefix}-${String(i+1).padStart(4,'0')}`,description:({categories:'Catalog classification',uoms:'Quantity unit',natures:'Business classification',customerGroups:'Customer classification',branches:'Company branch',departments:'Organizational department',positions:'Employee position',banks:'Bank reference',terms:'Payment term'})[key],active:true,...(typeof r==='string'?{name:r}:r)})); };
 seed('categories',['Accounting services','Professional services','Office supplies','Equipment','Software']);
 seed('uoms',[['Pieces','pc'],['Box','box'],['Pack','pack'],['Kilogram','kg'],['Hour','hr'],['Service','service'],['Month','month'],['Engagement','engagement'],['Ream','ream'],['Unit','unit'],['Session','session']].map(([name,abbreviation])=>({name,abbreviation})));
 seed('natures',['Manufacturing','Retail','Wholesale','Professional Services','Construction','Technology Services']);
 seed('customerGroups',['Retail Customers','Corporate Customers','Wholesale Customers']);
 seed('branches',[{name:'Makati',company:next.v2.company?.name || 'booksdotnet'},{name:'Quezon City',company:next.v2.company?.name || 'booksdotnet'}]);
 seed('departments',cfg.branches.flatMap(b=>['Finance','Operations','Administration'].map(name=>({name,branchId:b.id}))));
 seed('positions',['Accounting Officer','Operations Coordinator','Office Administrator','Accounting Assistant']);
 seed('banks',[{name:'BDO Unibank',bankBranch:'Makati'},{name:'Bank of the Philippine Islands',bankBranch:'Ayala'},{name:'Metrobank',bankBranch:''},{name:'Land Bank of the Philippines',bankBranch:''}]);
 seed('terms',[0,15,30,45,60].map(days=>({name:days?`Net ${days}`:'Due on Receipt',days,description:days?`Payment due ${days} calendar days after document date.`:'Payment due on the document date.'})));
 // Preserve existing free-text values once as stable configuration references; never touch posted documents.
 const link=(r,field,key,name,extra={})=>{if(r[field]!==undefined)return; if(!name){r[field]='';return;} let match=cfg[key].find(x=>x.name.toLowerCase()===String(name).trim().toLowerCase() && (!extra.branchId || x.branchId===extra.branchId)); if(!match){const code=nextCode(CONFIG[key].prefix,cfg[key]);match={id:code,code,name:String(name).trim(),description:'Migrated existing reference',active:true,...extra};cfg[key].push(match);} r[field]=match.id;};
 for(const r of next.v2.items){link(r,'categoryId','categories',r.category);if(r.uomId===undefined){const u=cfg.uoms.find(u=>[u.name,u.abbreviation].some(v=>v?.toLowerCase()===r.uom?.toLowerCase()));if(u)r.uomId=u.id;else link(r,'uomId','uoms',r.uom||'Service',{abbreviation:r.uom||'service'});}}
 for(const d of [...next.invoices,...next.bills])for(const l of d.items||[])if(l.uom&&!cfg.uoms.some(u=>u.abbreviation===l.uom||u.name===l.uom)){const code=nextCode('UOM',cfg.uoms);cfg.uoms.push({id:code,code,name:l.uom,abbreviation:l.uom,description:'Historical document unit',active:true});}
 for(const r of [...next.v2.customers,...next.v2.suppliers]) {link(r,'natureId','natures',r.nature); if(r.paymentTermId===undefined){let term=cfg.terms.find(t=>t.days===Number(r.terms));if(!term){const code=nextCode('TERM',cfg.terms);term={id:code,code,name:`Net ${r.terms}`,days:Number(r.terms),description:'Migrated existing terms',active:true};cfg.terms.push(term);}r.paymentTermId=term.id;} }
 for(const r of next.v2.customers) if(r.customerGroupId===undefined)r.customerGroupId='';
 for(const r of next.v2.employees){link(r,'branchId','branches',r.branch,{company:next.v2.company?.name||'booksdotnet'});link(r,'departmentId','departments',r.department,{branchId:r.branchId});link(r,'positionId','positions',r.position);}
 next.v2.bankAccountReferences ||= {};
 return next;
}
export function reduceConfiguration(state,action) {
 const next=upgradeConfiguration(state);
 if(action.type==='v2/configuration') {
  const spec=CONFIG[action.key]; if(!spec)throw new Error('Unknown configuration type.');
  const rows=refRows(next,action.key), input=action.record, old=rows.find(r=>r.id===input.id);
  if(input.id&&!old)throw new Error('Configuration record no longer exists.');
  if(old&&input.code!==old.code)throw new Error('Record codes cannot be changed.');
  const code=old?.code||nextCode(spec.prefix,rows);
  if(!old && input.code && input.code!==code)throw new Error('The proposed code is already used or out of date. Reopen New Record.');
  const r={...input,id:old?.id||code,code,name:String(input.name||'').trim(),description:String(input.description||'').trim()};
  if(!r.name || typeof r.active!=='boolean')throw new Error('Name and a valid status are required.');
  if(rows.some(x=>x.id!==r.id&&x.code.toLowerCase()===code.toLowerCase()))throw new Error('Record code already exists.');
  if(rows.some(x=>x.id!==r.id&&x.name.toLowerCase()===r.name.toLowerCase()&&(action.key!=='departments'||x.branchId===r.branchId)))throw new Error('A record with this name already exists.');
  if(action.key==='uoms'&&!String(r.abbreviation||'').trim())throw new Error('Unit abbreviation is required.');
  if(action.key==='branches'&&!String(r.company||'').trim())throw new Error('Company is required.');
  if(action.key==='departments')validateRef(next,'branches',r.branchId,old?.branchId);
  if(action.key==='terms'){r.days=Number(input.days);if(!Number.isInteger(r.days)||r.days<0||r.days>365)throw new Error('Due date rule must be a whole number of calendar days from 0 to 365.');}
  if(old)Object.assign(old,r);else rows.push(r);return next;
 }
 if(action.type==='v2/bankReference'){
  const account=next.accounts.find(a=>a.id===action.accountId&&a.group==='Cash & bank');if(!account)throw new Error('Choose an existing cash or bank ledger account.');
  const old=next.v2.bankAccountReferences[account.id];validateRef(next,'banks',action.bankId,old?.bankId);
  next.v2.bankAccountReferences[account.id]={bankId:action.bankId||'',accountNumber:String(action.accountNumber||'').trim(),currency:'PHP'};return next;
 }
 return upgradeConfiguration(reduceMasterfile(next,action));
}
