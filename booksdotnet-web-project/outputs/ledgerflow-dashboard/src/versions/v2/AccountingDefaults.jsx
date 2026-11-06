import SearchableSelect from './SearchableSelect.jsx';
import { useState } from 'react';
import { Heading, ErrorText } from '../../module-ui.jsx';
import { Button } from '../../design-system/Button.jsx';
import { controlAccounts } from './masterfile.js';
import { usePageAccess } from './AccessContext.jsx';
export default function AccountingDefaults({state,commit,notify,openDialog}) {
 const access=usePageAccess(),[form,setForm]=useState(state.v2.accountingDefaults),[error,setError]=useState('');
 return <><Heading title="Accounting Configuration" description="PHP and accrual accounting. Default control accounts apply to future documents; existing postings retain their source accounts."/><section className="panel v2-settings-panel"><form className="module-form" onSubmit={e=>{e.preventDefault();const r=commit({type:'v2/accountingDefaults',defaults:form});if(r.ok){setError('');notify('Accounting defaults saved for future documents.');}else setError(r.error);}}>{[['invoice','receivableAccountId','Default Receivable Account'],['bill','payableAccountId','Default Payable Account']].map(([kind,key,label])=><div className="v2-field-grid" key={key}><label>{label}<SearchableSelect aria-label={label} value={form[key]} disabled={!access('manageConfiguration')} onChange={e=>setForm({...form,[key]:e.target.value})}>{controlAccounts(state,kind).map(a=><option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</SearchableSelect></label></div>)}<p className="field-help">A customer or supplier may explicitly override its corresponding control account. Fiscal-period locking and external synchronization are not connected.</p><ErrorText error={error}/><div className="module-actions"><Button type="submit" className="primary" disabled={!access('manageConfiguration')}>Save Defaults</Button><Button type="button" onClick={()=>openDialog('Accounting preferences')}>Other Preferences</Button></div></form></section></>;
}
