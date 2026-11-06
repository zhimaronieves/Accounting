# booksdotnet — Accounting workspace

React + Vite, Tailwind CSS, Lucide icons, Recharts, and locally bundled Poppins.

```powershell
npm.cmd install
npm.cmd run dev -- --port 5173
```

Open http://127.0.0.1:5173. Keep the terminal running while reviewing.

```powershell
npm.cmd test
npm.cmd run build
```

## Implemented modules

### UI versions

- **V1 — Original:** `/v1` (or `/v1/general-ledger`, `/v1/invoices`, etc.). Original sidebar, module screens, forms and base styles are preserved. The top bar adds only the requested version selector and its responsive space.
- **V2 — Updated:** `/v2/dashboard`. Seven parent menus; separate AR/AP document, payment and master-data screens; AR/AP aging and balance summaries under Reports.
- The selector persists `booksdotnet-ui-version`. Legacy URLs continue to resolve; explicit `/v1` and `/v2` URLs override the preference. Equivalent pages map across versions; unsupported destinations fall back to Dashboard. Explicit canonical paths also keep browser history version-aware.
- Both versions use one mounted `useWorkspace` and the existing `ledgerflow-accounting-v1` storage key. Additive migration supplies stable party IDs and V2 metadata without resetting journals, invoices, bills or payments. Original source snapshots and SHA-256 hashes are in the workspace's `work/versioning-baseline` directory.
- New code is organized under `src/versions/navigation.js` and `src/versions/v2/`. Existing components and accounting selectors are reused.

### V2 global navigation and prototype access

- V2's separate shell (`src/versions/v2/Shell.jsx`) contains global search, notifications, Settings navigation and user profile only. The original V1 navbar remains intact. Page titles, relevant date controls and module actions appear once inside the content area. Invoice payment-status, bill due-date and ledger debit/credit filters operate on their module data.
- Global search opens actual invoices, bills, customer/supplier histories and journal details, as well as accessible modules. Results, notifications, sidebar pages, direct routes, dashboards and mutation actions respect the selected prototype user's permissions.
- The V2 profile menu contains My Profile, My Role / Access Information, Switch User (Prototype), and UI Version (Prototype comparison). There is no V2 Sign Out because no authentication is connected. V1 retains its original demo behavior.
- Six sample roles are available through Switch User: System Administrator, Accounting Manager (default Alex Reyes), Accountant, AR Staff, AP Staff and Management / Viewer. Administrators receive Settings access and no automatic accounting posting rights. AR/AP dashboards and report tabs expose only their permitted scope. Viewer accounts cannot mutate records.
- System Administrator → Settings → Users & Permissions manages local users, roles, individual module/action permissions, report scopes and settings scopes. Add/edit/status changes require confirmation, duplicate emails are rejected, and at least one active access administrator must remain. Role defaults can be applied with confirmation and then customized independently of the role label. Last Login honestly displays “Not available · prototype”.
- Prototype users and the selected preview identity persist separately under `booksdotnet-prototype-users-v1`. Switching users never resets accounting records. The accounting storage key is unchanged. Invalid saved user data is preserved, and storage failures are disclosed.
- AP Staff can prepare/edit payment drafts without a ledger posting. Posting supplier payments requires both Post and Approve / Finalize. Authorized reviewers can confirm approval/posting once; balances are checked again before the single journal is created. Accountant defaults can prepare supplier payments but cannot approve them. Reconciliation finalization and other unconfigured approval workflows remain review prototypes.
- These are **client-side prototype controls**, not authentication or production authorization. V1 is an unrestricted comparison version and browser storage is user-editable. A production release needs server-enforced permissions and an authenticated identity. No backend exists in this project, and no new one is implied by this update.

### V2 workflows and limits

- Customers and suppliers: contact details, active status, payment terms, transaction history and derived outstanding balances. Master renames retain issued-document snapshots and stable transaction associations.
- Customer invoices: draft/edit/issue, tax and line items, immutable posting details, partial/full receipts, credit history and void/reissue for unallocated documents.
- Supplier bills: draft/edit/post under one document ID, duplicate supplier-reference validation, partial/full payments, supplier credits and void/reissue.
- Payments allocate to one or more posted documents for the same party. An aggregate payment creates exactly one balanced journal; inline allocations reference that journal. Legacy V1 payments appear once in V2 history. Request IDs prevent repeated submission; validation rejects overpayments, cross-party allocations, invalid dates and insufficient supplier-payment cash.
- Credit notes offset the **unpaid balance only** and retain the source posting. Customer tax credits use cumulative proportional centavo rounding; supplier credits offset the original expense. Refunds, crediting already-paid amounts and payment reversal are not implemented. Payment and credit history cannot be silently edited.
- Reports derive aging and party summaries from shared source documents and show the control-account reconciliation difference. Accounting screens and financial statements reuse existing functionality.
- Bank accounts and transactions are read-only views of existing cash/bank accounts and posted journal lines. No bank feed is connected. Reconciliation, tax filing and production authentication remain review items. The user directory and permissions are functional browser-local previews. Company information is an editable browser-local profile; accounting preferences reuse the existing preview dialog.
- All accounting dates retain the demo's October 26, 2026 snapshot. Data remains local to this browser/origin. This update does not import or modify anything in Figma.

| Module | Working features |
| --- | --- |
| Dashboard | Date-filtered KPIs, revenue/expense chart, expense allocation, searchable transactions |
| Chart of Accounts | Create/edit accounts, type/status filters, archive/restore zero-balance accounts, open account ledger |
| Journal Entries | Multi-line drafts, debit/credit validation, posting, draft editing/deletion, reversals with original history retained |
| General Ledger | Account selector, opening/closing balances, running balances, journal drill-down, CSV export |
| Accounts Receivable | Customer balances, aging buckets, partial/full receipts, payment history |
| Accounts Payable | Create vendor bills, detect duplicate vendor references, partial/full payments, aging, unpaid bill voids |
| Invoices | Line items, quantities/rates, configurable tax, drafts/issue/void, receipts, print layout, locally logged reminders |
| Financial Reports | Income statement, balance sheet, trial balance, direct cash flow, account drill-down, CSV export and print |

## Shared behavior

- Responsive sidebar: 256px expanded, 72px collapsed; icon tooltips; mobile navigation.
- Search, transaction type/status filters, pagination, and view-all toggle.
- Notifications with individual and bulk read actions; outside-click and Escape dismissal.
- Accounting preferences and account settings dialogs; editable profile; sign-out confirmation and demo return.
- Date presets and a custom range with Apply, Cancel, and invalid-range protection.
- Navigation supports direct module URLs and browser Back/Forward.
- All modules use the shared, double-entry accounting model in `src/accounting.js`.
- Money is stored as integer centavos. Only posted journals affect the books.
- Invoice issuance posts receivables/revenue/tax; receipts post cash/receivables. Bills post expenses/payables; payments post payables/cash.
- Receivable/payable control accounts cannot be bypassed with manual journals. Accrual adjustments use a separate accrued-expense account.
- Records persist in this browser under `ledgerflow-accounting-v1`. Browser storage belongs to the preview's origin; clearing it removes the saved demo records. Storage failures are shown in the app.
- CSV exports protect spreadsheet formula cells. Issuing invoices and logging reminders do not send email. Payment actions record demo entries and do not move real money.

The demo is frozen at October 26, 2026. The complete books include the original cash activity plus issued unpaid invoices and outstanding vendor bills. Fresh October totals are revenue ₱1,465,000, expenses ₱859,500, net profit ₱605,500, receivables ₱215,000, and payables ₱159,500. This differs from the initial dashboard because the full workspace now recognizes invoice and bill accruals. Dashboard totals and reports use the same posted books. Outstanding balances and aging are calculated as of the selected end date, including historical payment/void dates.

This is a browser-local accounting demo, not a deployed production system. No backend, bank connection, real authentication, email delivery, or audit service is connected. Reports are demo statements. The accounting basis is fixed to accrual; profile and other preference controls are preview settings.

## Design review notes

Direction: Achromatic ledger, seed 302608100. The existing LedgerFlow brand takes precedence over the sheet's shell: requested fixed navbar, blue ledger mark, Inter, and #2563EB data accents are retained. One screen answers “How are our finances performing, and what needs attention?” Neutral chrome and right-aligned amounts keep attention on the ledger. The brand's ledger-bar mark and Philippine peso records identify the workspace.

## Verification

Data tests cover totals, chart/category reconciliation, percentage rounding, unique IDs, inclusive date boundaries, invalid dates, and comparison periods. Browser checks cover sidebar collapse, notification individual/bulk read actions, switching dropdowns, date presets, custom range Apply/invalid-range protection, search, type/status filtering, saved preferences, and sign-out Cancel/Confirm/Return.

Accounting tests additionally cover posted-book balance, trial-balance equality, cash-flow reconciliation, AR/AP agreement with their subledgers, posting restrictions, draft isolation, reversals, partial payments, overpayment rejection, invoice tax, duplicate bill references, historical voids, and expense credits. Browser tests exercised account creation and persistence, an unbalanced/balanced journal, ledger updates, invoice issuance and partial receipts, vendor bills and partial payments, aging, journal reversal, all four statements, and a real CSV download. Transaction testing used port 5174 to keep the review workspace on 5173 clean.

Desktop (1440px), tablet (768px), and phone (390px) layouts were visually reviewed. Inter loaded correctly and no browser errors were reported. The visual inspector's SVG-axis `edge-text` warning is a local-coordinate false positive; the ticks are inside the chart panel. Compact 11–12px metadata is retained for table IDs, timestamps, axes, and supporting text; principal labels and descriptions are 13px or larger.

New module layouts also pass the inspector with no failures. Account codes remain left-aligned as identifiers; monetary columns are right-aligned with tabular figures. Dense table metadata is intentionally 11–12px. On smaller screens, financial tables scroll inside their panels.

## Figma destination — do not import before approval

**The new accounting modules are code-only. No Figma import or write was performed for this module-completion request.** The import recorded below is the earlier, separately approved dashboard capture.

https://www.figma.com/design/gh7vwF03d8QO7g2JDFjriB?node-id=7-188

The approved dashboard was imported through Code to canvas into the existing Login page's canvas (`0:1`). Figma confirmed the imported frame at https://www.figma.com/design/gh7vwF03d8QO7g2JDFjriB?node-id=36-15. No new file was requested. React interactions do not automatically become Figma prototype connections; prototype wiring remains separate work.

Post-import inspection was blocked by the Starter-plan MCP call limit, and the embedded viewer could not validate its connection. Exact frame placement and naming are therefore not independently verified. To place it beside the preserved Login frame, select the imported frame in Figma and set X=1700, Y=100; the original Login frame is at X=100, Y=100 with width 1440. Name the imported frame `Dashboard — Default` if the capture used its default name.

The official Figma capture helper is served locally at `/figma-capture.js`. A capture URL is single-use; do not reload or reuse a consumed capture URL. Normal previewing uses http://127.0.0.1:5173/ without capture parameters.

## booksdotnet branding

Uses the supplied booksdotnet PNG logo, locally bundled Poppins (400/500/600), and primary blue #559CDA. The active navigation item uses the requested gradient: #559CDA 0%, #7BADFF 27%, #FFB58D 76%, #ED8028 100%. Active navigation labels, icons, and blue primary button labels are white as requested. Browser storage keys remain unchanged to retain saved records.

Desktop, tablet, and phone screenshots were visually reviewed. Poppins loaded successfully; no horizontal page overflow or broken images. Inspector exceptions: gradient fill is explicitly requested; the SVG axis text edge warning is a measurement false positive (visible ticks are inside the chart). Existing 11–12px metadata remains compact for the accounting tables.


### V2 financial statement and sidebar update

Financial Statements contains Income Statement, Statement of Changes in Equity, Balance Sheet, and Cash Flow Statement in that order. Trial Balance remains separate. Equity is read from posted equity-account debits/credits and unclosed earnings, with opening/closing balances and a balance-sheet reconciliation; drafts are excluded. Balance Sheet uses an independent As of Date input, while the other statements retain the period range. Print and CSV export remain permission-aware.

V2 removes the sidebar Help and bottom collapse entries. Its header has a keyboard-accessible circular chevron, hover/focus tooltips, touch visibility, and a persistent booksdotnet-v2-sidebar-collapsed preference. V1 is unchanged. Selected secondary menus use light blue with blue text.


### V2 adjustments, unapplied payments, and review fixtures

AR and AP each include Credit & Debit Notes between the document and payment menus. Customer-issued credits decrease AR and debits increase AR. Supplier documents received use credits to decrease AP and debit charges to increase AP. Drafts do not post; posted notes retain the original invoice/bill, balanced source journal, reason, tax amount, and activity history. Controlled reversals offset a note without editing its original posting. Credits cannot exceed unpaid balances; paid refunds are not implemented. Customer tax uses the existing output-tax account. Supplier tax is included in the expense adjustment, with no separate input-VAT recovery or BIR-authorized document/filing claim.

Payment totals now separate allocated and unapplied amounts. Unapplied customer money is held in a protected liability account; supplier advances are held in a protected prepayment asset account. Applying an advance creates a separate control-account transfer and a dated allocation history, with no second cash movement. Post and supplier approval permissions continue to apply. Legacy allocated payment histories remain visible once.

A once-only review fixture seeds 18 demo payments per side (14 posted and 4 draft), eight demo notes, and a clearly labeled supporting demo bill only when a second bill for the same supplier is needed to exercise multi-document allocation. Existing records are retained. Each fixture is marked Demo and uses stable request identifiers; a persisted reviewFixture marker prevents repeat seeding. All six roles use the existing shared accounting storage and retain their individual access restrictions.

V2 also uses a 360px maximum global search, no application footer, uniform dropdown chevrons and padding, count-based equal KPI columns, and lighter numbered-pagination borders. V1 visual rules remain unchanged. The additional source postings naturally update the shared books in both comparison versions.

Production tax review reference, specific to output VAT on uncollected receivables: [BIR RMC 65-2024 digest](https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2065-2024%20Digest.pdf). This prototype does not implement that tax recovery workflow.


### V2 table scrolling and financial statement presentation (29 October 2026)

V2 pages whose main content contains a listing now size the listing from the remaining viewport using flex/grid and `min-height: 0`. The title, actions, KPIs, table tools and pagination stay outside its scroll region; column headers stick inside it. Horizontal and vertical record scrolling share one container. The gap above the table and the page padding below it are both 24px (18px on phones). Reports, forms, dashboards and modal content keep natural scrolling. Short landscape/high-zoom viewports (540px high or less) fall back to document scrolling so fixed controls remain reachable rather than hiding the table or its pagination. These layout rules are scoped to V2; V1 has no new height constraints.

Financial Statements keeps the existing four-tab sequence, Income Statement default and separate Trial Balance. `src/versions/v2/statements.js` now supplies the account-based report rows used by screen and CSV:

- Income: conditional cost-of-sales, other-income/expense and tax sections, operating income and net income; no invented categories or balances.
- Equity: movement rows across configured equity-account columns, plus a separate unclosed-earnings component. The same posted-period profit as the Income Statement is used, and ending equity is checked against the Balance Sheet.
- Balance Sheet: current/noncurrent assets and liabilities based on actual account classifications, equity, single-rule subtotals and double-rule final amounts. Unknown classifications remain included and are flagged for review.
- Cash Flow: supported direct receipts/payments, activity subtotals, opening/net/closing cash and reconciliation. Bank transfers and noncash-only postings are excluded. Supplier allocations can trace to bill accounts. Compound journals with noncash offsets and policy-sensitive/unknown items are displayed separately for review, not silently assigned. Optional existing-data `cashFlowCategory` or `company.cashFlowPolicy[accountId]` mappings are honored; this does not add a policy editor or claim reporting-framework compliance. See the [IFRS Foundation IAS 7 overview](https://www.ifrs.org/issued-standards/list-of-standards/ias-7-statement-of-cash-flows/) for the distinction between direct cash receipts/payments and noncash activity.

All reports use the configured company name, dates and PHP basis. Reductions use parentheses, Details and Totals are distinct, and exports use the same report rows and review notes. Print CSS targets named A4 pages with repeated headers, compact monochrome styling, wrapping descriptions, and nonbreaking amount/total rows.

Validation: accounting tests cover matching income/equity profit, equity roll-forward, the Balance Sheet equation, cash reconciliation, multiple periods/snapshots, drafts/future entries, missing classifications, noncash journals, policy mappings, equipment settlements and advance applications. Browser checks covered AR/AP, Journals, General Ledger, Banking and Trial Balance, row-only scrolling, sticky headers, pinned pagination and mobile sizing. The live saved books showed PHP593,800 income on both Income Statement and equity, PHP6,378,800 ending equity with zero difference, and PHP5,835,000 ending cash. These observations are not hardcoded expectations: sample and saved books can differ.

Historical PDF discrepancy: the prior PHP593,800 / PHP602,750 pair was not available as source PDFs or their ledger snapshots, and the exact PHP8,950 difference could not be independently attributed. Current screen/export paths now share one report model and period; reconciliation tests guard against divergence. The four Accountdemy images mentioned in the brief were also absent; implementation follows the supplied written structural requirements. CSV was downloaded and inspected. In-app printing did not expose a usable preview, and installed-browser automation was stopped because the current URL could not be verified; generated A4 PDFs remain visually unverified.

### Customer / Supplier Credits and single-column reports (29 October 2026)

This update supersedes the preceding Details/Totals presentation and combined Credit & Debit Notes page terminology. AR now has Customer Invoices, Customer Credits, Customer Payments and Customers; AP has Supplier Bills, Supplier Credits, Supplier Payments and Suppliers. Existing `/v2/receivables/notes` and `/v2/payables/notes` URLs are retained. No accounting record migration, deletion, re-posting or permission grants are performed.

Credit listings show only credit records, including legacy credits, with source document, party, number, date, amount, status and actions. Their forms lock the type to Credit Note (Supplier Credit Note in supplier-facing detail copy). Draft editing, posting, history and controlled reversal continue through the same reducers. Source invoice/bill actions expose Add Customer Charge / Add Supplier Charge for debit notes; existing debit drafts and posted note links remain accessible from source history and global search. They do not appear in the credit creation form or a separate sidebar menu.

Income Statement, Balance Sheet and Cash Flow Statement now use Particulars plus one right-aligned Amount (PHP) column, including CSV. Equity retains its configured component matrix. Ordinary rows have no gridlines; subtotals and major totals use single rules; final amounts use a thin single top rule and double underline. The final Total Equity amount is double-underlined. A4 print CSS uses the same table markup and explicitly retains total rules. Reporting methods and calculation formulas are unchanged; no exchange-rate or other unsupported cash movements were added.

Verification: credit UI render tests cover credit-only lists without record mutation, default locked credit forms, legacy debit draft editing, retained URLs and role scopes, search, and single-column Income Statement markup. Existing accounting and reconciliation tests remain in place. Live browser checks confirmed column counts 2 / 4 / 2 / 2, no ordinary row borders, and double underlines on final totals for Income / Equity / Balance Sheet / Cash Flow. Current saved books still reconcile at PHP593,800 period income, PHP6,378,800 equity and PHP5,835,000 ending cash. Isolated localhost:5177 checks posted a customer credit and saved/posted a supplier credit draft with the new success messages; these QA records were not added to the main localhost:5173 workspace. The single-column CSV was downloaded and inspected. The attachment contained text only, so the referenced screenshot images could not be matched directly. Generated PDFs remain visually unverified in this environment; the shared A4 print rules are implemented.

### Masterfile and page-based record management (30 October 2026)

V2 navigation now has eight parents: Dashboard; Accounts Receivable (invoices, credits, payments); Accounts Payable (bills, credits, payments); Masterfile (Items, Customers, Suppliers, Employees); Accounting; Banking; Reports; Settings. Customers and Suppliers use canonical `/v2/masterfile/customers` and `/v2/masterfile/suppliers` routes; their earlier AR/AP URLs still resolve to the same records. Items and Employees are at `/v2/masterfile/items` and `/v2/masterfile/employees`. No Products & Services menu or parallel customer/supplier catalogs were introduced.

`masterfile.js` enriches existing `v2.customers` / `v2.suppliers` records in place by ID and supplies a single Items catalog and an Employees reference list when absent. Upgrade replay preserves existing catalogs and posted accounting documents. Masterfile CRUD does not post journals. Codes are generated and locked; activity history, validation, active/inactive handling, optional local images (PNG/JPEG/WebP, up to 500 KB), search, sorting, status/category/type/branch/department filters and pagination are supported. Customer/supplier contacts support inline editing, removal and at most one primary contact. Billing/shipping synchronization, registered/display names, tax metadata, terms and optional control-account overrides share one form across create/view/edit. Outstanding and overdue balances and related records come from the existing books, not manually entered totals.

`RecordPage.jsx` provides full-page records with a simple back link, sticky heading/actions, native posting/discard confirmations, browser Back / unload protection, URL create/view/edit state, normalized dirty checks and retained listing state. Masterfile tabs remain mounted so entering Contacts or Address does not discard other fields. Restoring original values does not trigger a discard warning. Primary invoices, bills, credits, payments, journals and bank transactions use this page layout; lookups, account configuration dialogs and confirmations retain their appropriate smaller interaction patterns. General Ledger journal drill-down uses the V2 journal page. V1 follows its original branch and styling.

Invoice and bill lines copy item ID/code, description, UOM, price, tax rate and posting-account defaults from the shared catalog, retaining manual lines and editable transaction-specific values. Normal lookup only offers active, available-for-sale / available-for-purchase items. Posted lines remain snapshots. Bills can use configured expense or asset accounts; physical products are not automatically expensed. Purchase tax remains included in cost; separate recoverable input VAT and withholding postings are not introduced. Accounting Configuration now saves receivable/payable defaults for future documents; masterfile overrides are optional. Itemized invoices, bills, credit adjustments, payments and advance applications follow their source accounts. Credit allocation uses integer-centavo distribution; original postings, reversals and allocation history remain intact. Unsupported legacy edits to catalog-based drafts / payments using custom control accounts direct the user to V2 rather than posting against incorrect accounts.

Masterfile role permissions are additive and scoped per record type. Existing customer/supplier rights migrate from their former AR/AP scopes. Managers/accountants can manage configured master data; AR Staff retain customer access and AP Staff retain supplier access; Viewer remains read-only; Items and Employees have independently configurable record rights beneath the Masterfile module permission. The user editor includes those scopes. No transaction posting or Banking creation rights are silently granted: bank creation/edit/post controls require the existing configured Banking rights. Manual bank records must contain a cash/bank line and remain balanced; posted source transactions cannot be overwritten through a bank view. Prototype switching remains browser-local, not authentication or a server authorization boundary.

Validation completed: 85 tests pass and the production build succeeds. New checks cover additive/idempotent migration, existing record snapshots, generated codes, contacts/addresses, employee/item CRUD without postings, multi-account line posting, asset purchases, control-account overrides, credits/payments/applications, defaults, role migration, bank draft/post behavior, page form markup, source URLs and normalized unsaved changes. Browser checks in isolated localhost:5178 created all four masterfile types; issued a catalog invoice; saved/edited/posted a bill; posted a credit and payment; saved/edited a journal draft; exercised native confirmations, browser Back, search/filter/sort/pagination retention, Viewer read-only behavior and AR scope isolation. Phone-width checks measured document width equal to viewport width (375px) and a sticky record header while the main form scrolled. The main localhost:5173 books remained at PHP593,800 period income, PHP6,378,800 ending equity and PHP5,835,000 cash, with zero statement reconciliation differences and no QA records added there.

Inventory reference images were not present in the attachment; layouts follow the supplied written structure. ERP synchronization, backend authentication, inventory quantities/valuation, payroll processing, employee cash advances and other excluded modules are not implemented. Data continues to use the existing browser-local workspace and its storage/error handling. Generated PDF output remains outside this update's visual verification.

### Configuration, controlled lookups, and direct record editing (30 October 2026)

V2 navigation now follows Dashboard, Masterfile, Accounts Receivable, Accounts Payable, Accounting, Banking, Reports, Configuration, Settings. V1 routes and presentation remain unchanged.

Configuration contains Item Configuration (Categories, Units of Measure), Nature of Business, Customer Groups, Organizational Settings (Branches, Departments, Positions), Banks, and Payment Terms. All reference types have seeded examples, stable IDs, generated codes, active/inactive state, compact full-page creation/editing, searchable/sortable listings, CSV export where permitted, and keyboard-accessible row navigation. Status is the rightmost column and remains visible during horizontal scrolling. Masterfile and Configuration listings no longer have Actions columns.

Customers, suppliers, items, employees, invoice/bill drafts, and bank account references use the shared configuration collections. Existing text values migrate once into references without changing posted documents, accounts, or journals. Lookup labels resolve by ID, so renaming references updates their displayed names. Inactive references are retained on existing records and excluded from new choices. Department options follow the selected branch; positions remain independent. Large lookup lists include an explicit search field.

Masterfile and Configuration rows open directly in edit mode when permitted, otherwise read-only. Successful saves retain the identifier, remain on the record page, reset the dirty baseline, and display a notification. Back navigation preserves listing search, filters, sort, pagination, and the originating configuration tab. Restoring original values counts as unchanged. Save Changes requires actual valid changes, and navigation with unsaved changes prompts for discard. Configuration records have no destructive deletion operation.

Payment terms store a calendar-day rule (0 to 365 days). New invoices and bills inherit an active term, calculate suggested due dates from document dates, and support transaction-specific overrides. Editing configuration or catalog defaults never recalculates posted amounts. Selected document units are associated with original line identities when retaining inactive references.

Configuration Banks are institution references. Banking Bank Accounts continue using actual Chart of Accounts cash/bank accounts and ledger-derived balances; editable reference metadata attaches a configured bank and account number to the existing account ID. This operation requires Banking Edit permission and never posts journals. Existing Banking permission assignments are preserved. Configuration rights migrate from existing configuration-management privileges; accountant/viewer defaults are read-only. Users & Permissions includes the new module.

Validation: 98 tests pass and the production build succeeds (existing nonblocking bundle-size warning remains). Browser QA on an isolated local origin covered create/update-in-place, direct keyboard row activation, restored-value dirty detection, tab preservation, page-two return, viewer restrictions, employee dependency filtering, term/date recalculation and overrides, item-to-UOM/account copying, and 375px layout containment. Main preview: http://127.0.0.1:5173/v2/configuration/items . QA sample mutations were confined to port 5178. Data remains browser-local; no backend authentication, external bank feeds, inventory valuation, payroll, or Figma import was added.

### V2 unified searchable dropdowns and Masterfile form corrections

Replaced the permanent search-plus-select layout with one reusable V2 SearchableSelect. Closed fields show only their selected label (or placeholder) and a single chevron. Opening a field displays search and selectable options in a positioned top-layer overlay, including keyboard navigation, selection checks, Escape/outside-click dismissal, empty results, and selected-option scrolling. Hidden native selects retain existing required-field validation and dirty-state snapshots; their proxies are excluded from keyboard and accessibility navigation. Read-only fieldsets remain enforced. The shared component now serves configuration references, Masterfile account defaults, invoice/bill line accounts, journal/bank transaction accounts, credit-note parties/source documents, payment parties/cash accounts, accounting defaults, and the V2 General Ledger account selector. Fixed status/type/method filters remain native selections. V1 retains its original selector behavior.

Customer Group is no longer displayed on Customer Create/Edit forms; its existing records and saved references remain intact. Customer and Supplier forms now group Same as Registered Name directly beneath Display Name, aligned to the field with a 10px gap. Checked names stay synchronized and read-only; unchecking preserves the text. Item Image and Customer Logo upload panels are absent from those Masterfile pages. Supplier and Employee image controls remain available. Existing saved image data was preserved.

Validation: all 102 tests pass and the production build succeeds (existing bundle-size advisory only). Isolated browser QA verified unified search/selection, required lookup errors, persisted selections after reopening, item/customer creation and editing, checked/unchecked and empty-name behavior, restored-value dirty detection, supplier name behavior, table overlays, General Ledger selection, search-only navigation without discard prompts, and read-only lookups. The main preview has no unsaved edits. A 375px CSS viewport had no horizontal page overflow and the open menu stayed within the viewport. V1 rendering and accounting/data regression tests remain passing. The previously created review ZIP remains a snapshot from before this UI correction.


### V2 connected Banking workflow

- Configuration → Banks supplies institution references. Banking → Bank Accounts stores company accounts, masked account numbers, and a unique Cash & bank GL link. Create the dedicated GL in Chart of Accounts first; historical `1000` remains a shared cash posting account.
- Bank balances and movements are derived from posted ledger lines. Bank transfer/check payments in AR/AP require a company bank account and use its linked GL. Cash payments use a nonbank cash GL. Existing postings are preserved; missing historical mappings require evidence-based review, and mixed `1000` activity needs a justified separate reclassification rather than an arbitrary bank assignment.
- Bank Reconciliation supports manual statement rows, suggested and explicitly confirmed one-to-one matches, unmatching, outstanding items carried into later periods, and centavo-precision adjusted balances. The first statement starts from zero and must include genuine opening activity; later statements carry the last completed balance forward.
- Completion requires a valid statement roll-forward, no unmatched statement entries or mapping issues, zero adjusted difference, reviewed outstanding items, and Banking Approve / Finalize permission. It saves an immutable summary and match snapshots, completion user/time and history. Completion does not create a journal. Completed periods cannot be reopened or overlapped; reconciled manual postings require a separate dated correction rather than reversal.
- Existing role defaults are unchanged. A prototype administrator must explicitly assign Banking Create/Edit/Post rights to users who need them; Approve / Finalize is required for completion. No new access is granted automatically.
- V2 transactions share Create/Edit/View form layouts. Posted financial fields render as static readable values, with saved line values, notes, totals and history. V1 UI and core accounting reducers are unchanged.
- This remains a browser-local accounting prototype. There is no live bank connection, CSV statement import, production authentication, or grouped/partial reconciliation matching.

`npm test` includes the Banking workflow scenario (BDO account, genuine opening funding transfer, ₱5,000 supplier payment and reconciliation), unmatched charges, outstanding checks, duplicate matching, inactive references, permissions and snapshot preservation.


Browser walkthrough verified on 2026-11-03 in the isolated `localhost:5180` demo after approval: company account `BANK-0001` (BDO Operating Account / GL 1010), funding journal `JE-2026-0234` (₱10,000), supplier payment `SPAY-2026-0029` / `JE-2026-0235` (₱5,000 allocated to `BILL-2026-0001`), and completed reconciliation `REC-0001`. Both statement rows were explicitly matched, unmatch/rematch was checked, adjusted balances were ₱5,000 with zero difference, completed fields had no native editing controls, and the journal listing remained at 71 posted + 1 draft after completion. The main `localhost:5173` financial records and existing users were not used for these demo postings.
