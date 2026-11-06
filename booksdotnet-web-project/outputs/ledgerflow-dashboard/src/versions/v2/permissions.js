import { v2Groups } from '../navigation.js';
export const DIRECTORY_KEY = 'booksdotnet-prototype-users-v1';
export const PERMISSIONS = ['view', 'create', 'edit', 'post', 'approve', 'reverse', 'export', 'manageUsers', 'manageConfiguration'];
export const PERMISSION_LABELS = { view: 'View', create: 'Create', edit: 'Edit', post: 'Post', approve: 'Approve / Finalize', reverse: 'Reverse', export: 'Export', manageUsers: 'Manage Users', manageConfiguration: 'Manage Configuration' };
export const ROLES = ['System Administrator', 'Accounting Manager', 'Accountant', 'Accounts Receivable Staff', 'Accounts Payable Staff', 'Management / Viewer'];
export const REPORT_SCOPES = { ar: 'Receivables reports', ap: 'Payables reports', financial: 'Financial statements & trial balance', accounts: 'Account reports', tax: 'Tax reports prototype' };
export const SETTINGS_SCOPES = { company: 'Company Information', accounting: 'Accounting Configuration', users: 'Users & Permissions' };
export const MASTER_SCOPES = ['Items', 'Customers', 'Suppliers', 'Employees'];
const MASTER_RIGHTS = ['view', 'create', 'edit', 'export'];
function masterDefaults(user) {
  const admin = user.permissions?.Settings?.manageConfiguration && user.role === ROLES[0], viewer = user.role === ROLES[5];
  const masterfilePermissions = Object.fromEntries(MASTER_SCOPES.map(page => { const source = page === 'Customers' ? 'Accounts Receivable' : page === 'Suppliers' ? 'Accounts Payable' : 'Accounting'; return [page, Object.fromEntries(MASTER_RIGHTS.map(right => [right, Boolean(admin || viewer && right === 'view' || user.permissions?.[source]?.view && user.permissions[source][right] && (page !== 'Employees' || [ROLES[1], ROLES[2]].includes(user.role)))]))]; }));
  return { masterfilePermissions, masterRights: Object.fromEntries(PERMISSIONS.map(right => [right, MASTER_RIGHTS.includes(right) && MASTER_SCOPES.some(page => masterfilePermissions[page][right])])) };
}
export const canMaster = (user, page, right = 'view') => Boolean(can(user, 'Masterfile', right) && user.masterfilePermissions?.[page]?.view && user.masterfilePermissions[page][right]);
export const moduleFor = page => v2Groups.find(g => g.pages.includes(page))?.name;
export function roleDefaults(role) {
  const permissions = Object.fromEntries(v2Groups.map(g => [g.name, Object.fromEntries(PERMISSIONS.map(p => [p, false]))]));
  const grant = (module, ...rights) => rights.forEach(p => { permissions[module][p] = true; });
  grant('Dashboard', 'view'); let reportAccess = [], settingsAccess = [];
  if (role === ROLES[0]) { grant('Settings', 'view', 'create', 'edit', 'manageUsers', 'manageConfiguration'); settingsAccess = ['company', 'accounting', 'users']; }
  if ([ROLES[1], ROLES[2]].includes(role)) {
    for (const module of ['Accounts Receivable', 'Accounts Payable', 'Accounting']) grant(module, 'view', 'create', 'edit', 'post', 'export');
    grant('Banking', 'view'); grant('Reports', 'view', 'export'); reportAccess = Object.keys(REPORT_SCOPES);
    if (role === ROLES[1]) { for (const module of ['Accounts Receivable', 'Accounts Payable', 'Accounting', 'Banking']) grant(module, 'approve', 'reverse'); grant('Settings', 'view', 'manageConfiguration'); settingsAccess = ['accounting']; }
  }
  if (role === ROLES[3]) { grant('Accounts Receivable', 'view', 'create', 'edit', 'post', 'export'); grant('Reports', 'view', 'export'); reportAccess = ['ar']; }
  if (role === ROLES[4]) { grant('Accounts Payable', 'view', 'create', 'edit', 'export'); grant('Reports', 'view', 'export'); reportAccess = ['ap']; }
  if (role === ROLES[5]) { grant('Reports', 'view', 'export'); reportAccess = ['financial', 'ar', 'ap']; }
  if ([ROLES[0], ROLES[1]].includes(role)) grant('Configuration', 'view', 'create', 'edit', 'export', 'manageConfiguration');
  else if ([ROLES[2], ROLES[5]].includes(role)) grant('Configuration', 'view');
  const master = masterDefaults({ permissions, role }); permissions.Masterfile = master.masterRights;
  return { permissions, reportAccess, settingsAccess, masterfilePermissions: master.masterfilePermissions };
}
export function createDirectory() {
  const people = [['Lena', 'Santos'], ['Alex', 'Reyes'], ['Marco', 'Cruz'], ['Sofia', 'Garcia'], ['Nico', 'Reyes'], ['Isabel', 'Lim']];
  return { schema: 1, selectedId: 'USR-2', users: ROLES.map((role, i) => ({ id: `USR-${i + 1}`, firstName: people[i][0], lastName: people[i][1], email: `${people[i][0].toLowerCase()}@booksdotnet.example`, role, status: 'Active', lastLogin: null, ...roleDefaults(role) })) };
}
export const userName = user => `${user.firstName} ${user.lastName}`;
export const can = (user, module, right = 'view') => Boolean(user?.status === 'Active' && user.permissions?.[module]?.view && user.permissions[module][right]);
export function canPage(user, page) {
  const module = moduleFor(page); if (!module || !can(user, module)) return false;
  if (module === 'Masterfile') return canMaster(user, page);
  if (page === 'Receivables & Payables Reports') return user.reportAccess?.some(x => ['ar', 'ap'].includes(x));
  if (['Financial Statements', 'Trial Balance'].includes(page)) return user.reportAccess?.includes('financial');
  if (page === 'Account Reports') return user.reportAccess?.includes('accounts');
  if (page === 'Tax Reports') return user.reportAccess?.includes('tax');
  if (module === 'Settings') { const scope = Object.keys(SETTINGS_SCOPES).find(k => SETTINGS_SCOPES[k] === page); return user.settingsAccess?.includes(scope) && (scope !== 'users' || can(user, 'Settings', 'manageUsers')); }
  return true;
}
export const reportTabs = user => [ ...(user.reportAccess?.includes('ar') ? ['AR Aging', 'Customer Balance Summary'] : []), ...(user.reportAccess?.includes('ap') ? ['AP Aging', 'Supplier Balance Summary'] : []) ];
export function assertActionAllowed(user, action, state) {
  let module, rights = [];
  const kind = ['v2/bill', 'bill', 'voidBill'].includes(action.type) ? 'bill' : ['v2/invoice', 'invoice', 'sendInvoice', 'voidInvoice', 'reminder'].includes(action.type) ? 'invoice' : action.kind === 'bill' ? 'bill' : 'invoice';
  const operational = kind === 'invoice' ? 'Accounts Receivable' : 'Accounts Payable';
  if (action.type === 'v2/configuration') { const existing=state.v2.configuration?.[action.key]?.some(r=>r.id===action.record.id); if (!can(user,'Configuration',existing?'edit':'create')) throw new Error('Configuration permission required.'); return; }
  if (action.type==='v2/bankTransaction') {const old=state.v2.bankTransactions?.find(t=>t.id===action.record.id||t.requestId===action.record.requestId);const right=old||action.record.legacyDraftEntryId?'edit':'create';if(!can(user,'Banking',right)||action.record.status==='Posted'&&!can(user,'Banking','post'))throw new Error('Banking '+right+(action.record.status==='Posted'?' + Post':'')+' permission required.');return;}
  if (action.type==='v2/deleteBankTransactionDraft') {if(!can(user,'Banking','edit'))throw new Error('Banking Edit permission required.');return;}
  if (action.type==='v2/bankAccount') { const right=state.v2.bankAccounts?.some(b=>b.id===action.record.id)?'edit':'create'; if(!can(user,'Banking',right))throw new Error('Banking '+right+' permission required.');return; }
  if (action.type==='v2/bankMapping') {if(!can(user,'Banking','edit'))throw new Error('Banking Edit permission required.');return;}
  if (action.type==='v2/reconciliation') {const right=state.v2.reconciliations?.some(r=>r.id===action.record.id)?'edit':'create';if(!can(user,'Banking',right)||action.complete&&!can(user,'Banking','approve'))throw new Error('Banking '+right+(action.complete?' + Approve / Finalize':'')+' permission required.');return;}
  if (action.type === 'v2/bankReference') { if (!can(user,'Banking','edit')) throw new Error('Banking Edit permission required.'); return; }
  if (action.type === 'v2/master') { const right = state.v2[({ Items: 'items', Customers: 'customers', Suppliers: 'suppliers', Employees: 'employees' })[action.page]]?.some(r => r.id === action.record.id) ? 'edit' : 'create'; if (!canMaster(user, action.page, right)) throw new Error('Masterfile access denied: ' + right + ' permission required for ' + action.page); return; }
  if (action.type === 'v2/party') { if (!canMaster(user, kind === 'invoice' ? 'Customers' : 'Suppliers', state.v2[kind === 'invoice' ? 'customers' : 'suppliers'].some(p=>p.id===action.party.id) ? 'edit' : 'create')) throw new Error('Masterfile permission required.'); module = 'Masterfile'; rights = [state.v2[kind === 'invoice' ? 'customers' : 'suppliers'].some(p => p.id === action.party.id) ? 'edit' : 'create']; }
  else if (['invoice', 'v2/invoice', 'bill', 'v2/bill'].includes(action.type)) {
    module = operational; const doc = action.document || action.invoice || action.bill;
    rights = [state[kind === 'invoice' ? 'invoices' : 'bills'].some(d => d.id === doc.id) ? 'edit' : 'create']; if (action.type === 'bill' || doc.status !== 'Draft') rights.push('post');
  } else if (['payment', 'v2/payment'].includes(action.type)) { module = operational; rights = ['create', 'post', ...(kind === 'bill' ? ['approve'] : [])]; }
  else if (action.type === 'v2/note') { module = operational; rights = [state.v2.notes?.some(n => n.id === action.note.id) ? 'edit' : 'create', ...(action.note.status === 'Posted' ? ['post'] : [])]; }
  else if (action.type === 'v2/reverseNote') { module = operational; rights = ['reverse', 'post']; }
  else if (action.type === 'v2/applyPayment') { module = operational; rights = ['edit', 'post', ...(kind === 'bill' ? ['approve'] : [])]; }
  else if (action.type === 'v2/paymentDraft') { module = operational; rights = [action.payment.id ? 'edit' : 'create']; }
  else if (action.type === 'v2/postPaymentDraft') { const draft = state.v2.paymentDrafts?.find(d => d.id === action.id); module = draft?.kind === 'bill' ? 'Accounts Payable' : 'Accounts Receivable'; rights = ['post', ...(draft?.kind === 'bill' ? ['approve'] : [])]; }
  else if (['v2/credit', 'v2/void', 'voidInvoice', 'voidBill'].includes(action.type)) { module = action.type === 'voidBill' ? 'Accounts Payable' : operational; rights = ['reverse', 'post']; }
  else if (action.type === 'sendInvoice') { module = 'Accounts Receivable'; rights = ['post']; }
  else if (action.type === 'reminder') { module = 'Accounts Receivable'; rights = ['edit']; }
  else if (action.type === 'account') { module = 'Accounting'; rights = [action.account.id && state.accounts.some(a => a.id === action.account.id) ? 'edit' : 'create']; }
  else if (action.type === 'archiveAccount') { module = 'Accounting'; rights = ['edit']; }
  else if (action.type === 'v2/bankJournal') { module = 'Banking'; rights = [state.entries.some(e => e.id === action.entry.id) ? 'edit' : 'create', ...(action.entry.status === 'Posted' ? ['post'] : [])]; }
  else if (action.type === 'journal') { module = 'Accounting'; rights = [state.entries.some(e => e.id === action.entry.id) ? 'edit' : 'create', ...(action.entry.status === 'Posted' ? ['post'] : [])]; }
  else if (['postJournal', 'reverseJournal', 'deleteDraft'].includes(action.type)) { module = 'Accounting'; rights = [{ postJournal: 'post', reverseJournal: 'reverse', deleteDraft: 'edit' }[action.type]]; }
  else if (action.type === 'v2/accountingDefaults') { module='Settings'; rights=['manageConfiguration']; if (!canPage(user,'Accounting Configuration')) throw new Error('Configuration access denied.'); }
  else if (action.type === 'v2/company') { module = 'Settings'; rights = ['manageConfiguration']; if (!canPage(user, 'Company Information')) throw new Error('Company configuration is not permitted for this user.'); }
  else throw new Error('This action is not authorized in the V2 prototype.');
  if (['journal','v2/bankJournal'].includes(action.type)) { const controls=new Set([...state.invoices,...state.bills].map(d=>d.controlAccountId).filter(Boolean)); for(const p of [...state.v2.customers,...state.v2.suppliers]) if(p.controlAccountId) controls.add(p.controlAccountId); for(const id of Object.values(state.v2.accountingDefaults||{})) controls.add(id); if(action.entry.lines.some(l=>controls.has(l.accountId))) throw new Error('Use source documents for controlled receivables and payables.'); }
  if (['journal', 'postJournal', 'reverseJournal', 'deleteDraft'].includes(action.type) && (action.entry?.bankTransaction || state.entries.find(e => e.id === (action.entry?.id || action.id))?.bankTransaction)) module = 'Banking';
  if (!rights.every(right => can(user, module, right))) throw new Error(`Access denied: ${rights.map(r => PERMISSION_LABELS[r]).join(' + ')} permission required for ${module}.`);
}
export function validateDirectory(directory) {
  if (directory?.schema !== 1 || !Array.isArray(directory.users) || !directory.users.length) throw new Error('Saved prototype users could not be loaded.');
  if (new Set(directory.users.map(u => u.id)).size !== directory.users.length) throw new Error('Duplicate prototype user IDs.');
  for (const user of directory.users) if (!user.permissions?.Configuration) { const manage=Boolean(user.permissions?.Settings?.view && user.permissions.Settings.manageConfiguration); user.permissions.Configuration=Object.fromEntries(PERMISSIONS.map(p=>[p, p==='view' ? manage || [ROLES[2],ROLES[5]].includes(user.role) : ['create','edit','export','manageConfiguration'].includes(p) && manage])); }
  for (const user of directory.users) if (!user.permissions?.Masterfile || !user.masterfilePermissions) { const defaults = masterDefaults(user); user.permissions.Masterfile ||= defaults.masterRights; user.masterfilePermissions ||= defaults.masterfilePermissions; }
  for (const u of directory.users) if (!MASTER_SCOPES.every(page => MASTER_RIGHTS.every(right => typeof u.masterfilePermissions?.[page]?.[right] === 'boolean'))) throw new Error('Saved masterfile permissions are invalid.');
  for (const u of directory.users) if (!u.firstName?.trim() || !u.lastName?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.email) || !ROLES.includes(u.role) || !['Active', 'Inactive'].includes(u.status) || !v2Groups.every(g => PERMISSIONS.every(p => typeof u.permissions?.[g.name]?.[p] === 'boolean')) || !Array.isArray(u.reportAccess) || !u.reportAccess.every(s => Object.hasOwn(REPORT_SCOPES, s)) || !Array.isArray(u.settingsAccess) || !u.settingsAccess.every(s => Object.hasOwn(SETTINGS_SCOPES, s))) throw new Error('Saved prototype user details are invalid.');
  return directory;
}
export function updateUser(directory, actor, proposed) {
  if (!canPage(actor, 'Users & Permissions') || !can(actor, 'Settings', 'manageUsers')) throw new Error('Manage Users permission is required.');
  const next = structuredClone(directory), old = next.users.find(u => u.id === proposed.id);
  const user = { ...proposed, firstName: proposed.firstName.trim(), lastName: proposed.lastName.trim(), email: proposed.email.trim().toLowerCase(), id: old?.id || `USR-${Math.max(...next.users.map(u => Number(u.id.split('-').at(-1)))) + 1}`, lastLogin: old?.lastLogin || null };
  if (next.users.some(u => u.id !== user.id && u.email.toLowerCase() === user.email)) throw new Error('A user with this email address already exists.');
  if (old) Object.assign(old, user); else next.users.push(user);
  validateDirectory(next);
  if (!next.users.some(u => canPage(u, 'Users & Permissions') && can(u, 'Settings', 'manageUsers'))) throw new Error('Keep at least one active user with Manage Users access.');
  return next;
}
