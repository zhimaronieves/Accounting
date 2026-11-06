# booksdotnet V3 — MCI Alignment

Independent V3 project copied from the existing V2 implementation. Original V1/V2 source and browser records remain unchanged.

## Preview

Run `npm run dev` and open http://127.0.0.1:5183/v3/dashboard . The local node_modules directory links to the existing installed packages; application source, Vite cache and storage are independent. For a standalone checkout, install the dependencies from package-lock.json instead.

## Scope

The sidebar exposes Dashboard, Accounts Receivable, Accounts Payable, Accounting, Banking, and Reports only. Masterfile, Configuration, Settings and Approval Workspace are not navigation destinations. Removed URLs resolve to the V3 Dashboard. The unchanged header Settings icon has no click handler, popup, panel or destination.

AR/AP preserve the existing listings, filters, date controls, aging links, CSV exports, pagination and record navigation. Only posted financial records are visible; drafts are retained internally. Create/edit/post/reverse/apply-payment actions are blocked in permissions and the V3 top-level reducer, not just hidden in the UI. The existing Accounting, Banking and reporting engines remain available according to the preserved user permissions.

Company information, accounting defaults, users, reference data, bank accounts, mappings and audit history remain in the accounting workspace. Their maintenance pages are not exposed in V3.

## Data isolation

The user approved a one-time copy of the V2 browser workspace and prototype directory. That private initialization snapshot is stored locally in `src/v3-initial-snapshot.json` (ignored by Git). V3 clones and upgrades it using the existing non-destructive upgrade path on first load. It never writes to V2 storage. Later V3 launches prefer the V3 saved workspace, not a new copy of V2. Original source IDs, entries and histories are retained; no posting actions were replayed to import them.

Workspace key: `booksdotnet-v3-mci-accounting-v1`. Directory key: `booksdotnet-v3-mci-prototype-users-v1`. Version/sidebar keys also have V3 namespaces. The separate port provides another browser-storage boundary.

This is a local prototype with a snapshot of posted records. No live Inventory Management synchronization, new Settings functionality or approval workspace has been added.

## Verification

`npm test` runs 65 checks covering V3 routes, permissions, read-only screens, preserved data, independent initialization, original-file checksums, Accounting/Banking posting and reconciliation, financial statements and shared primitives. `npm run build` produces the independent V3 bundle. Vite may report the existing bundle-size advisory.

The source comparison manifest is stored beside the project at `../booksdotnet-v3-original-source-manifest.json`. Browser QA verified the inactive Settings button on listing/detail screens, all three blocked Settings URLs, read-only posted invoice fields, preserved AR Aging/filter/export controls and editable manual journal creation.


## AR/AP source record review

All six detail pages follow the supplied Inventory reference's structure: module-specific three-column General Information, full-width Remarks, embedded contact/address blocks, correctly ordered item/detail/document tables, nested related credits, and compact right-aligned summaries. Customer Payments has Outstanding/Payments and Cash/Bank/Check tabs. Supplier Payments uses Bills and Payment Summary without the customer tab layout.

Status displays Posted for the posted demo records without rewriting their stored Sent/Unpaid status. Voided/reversed statuses remain intact. The header contains Back navigation, Attachment count and More. History expands from a narrow right-edge rail into a full-height, independently scrolling sidebar. Reference examples and technical source/snapshot banners are not shown in the application.

Refresh reloads the current V3 browser storage record; no Inventory API is connected. Existing PDF and XLSX exports remain available. Missing activity and attachments use simple empty states; no files or logs are fabricated. Historical payment-date amounts are shown only when saved, and unavailable values remain marked with a dash. The original posted data and initial private snapshot are unchanged.


### V3 shared document review panel
Customer Invoices and Supplier Bills have a collapsed-by-default right rail with History and Accounting tabs. The 520px desktop content panel independently scrolls; narrow screens use the record area. Accounting reads the existing linked journal and respects Accounting viewing permission. It never creates entries or changes postings. The other four AR/AP records retain their History panel.

AR/AP Posted badges use blue. Customer invoice settlement details and customer credit related-invoice footers are hidden without changing relationships. Verified bundled samples and explicitly marked demos receive presentation-only missing metadata and 3–5 item/credit examples when totals and taxes can be preserved. Unknown/production records are unchanged, and unavailable bank mappings remain unavailable. No generated history, attachments, payment allocations, or journals are added. Saved source data is unchanged.

Validation: 68 automated checks cover source/journal/allocation preservation, permission boundaries, six record layouts, V1/V2 isolation and protected Accounting/Banking/Reports files. Production build passes.


### V3 Inventory-aligned Sales and Purchasing listings
The sidebar and all six listing/detail/export titles now use Sales Invoices, Collection Receipts, Customer Credits, Bills, Payments Made and Supplier Debits under Sales/Purchasing. Routes and permission keys stay canonical for compatibility. Supplier Debits is a presentation label for the existing AP-reducing supplier credit notes (debit AP control); stored Credit Note classification, journal lines, IDs and signs are unchanged. Additional-charge Debit Notes are not silently substituted.

All four pages of the supplied table-listing reference were reviewed. Listings use the requested column order, per-column search/date/amount/value filters, sortable headers, full-width scroll containers, status last, document links, numbered pagination and filtered CSV exports. Requests/approval/create/edit/post controls are absent. Unposted, voided and reversed records are excluded from these listings without altering the saved books. Unknown EWT stays unavailable rather than becoming a fabricated zero. Payments Made Balance Amount is the payment's remaining unapplied amount; it is not the supplier bill balance. Credit/debit reductions display in parentheses, while CSV exports retain the original numeric source amounts.

The prior History/Accounting drawer, demo-only enrichment and read-only detail layouts remain. Validation: 72 tests pass, including canonical route/permission isolation, exact six-table columns, date/amount/filter mapping, supplier note posting semantics, V1/V2 hashes and protected Accounting/Banking/Reports files. Browser checks covered numeric sorting, filters, pagination, detail/back labels, Accounting drawer and wide-table overflow. Production build passes.


### V3 simplified listing headers
Purchasing now precedes Sales; all existing routes and submodule labels remain. The six read-only listings show only their title, description and a title-aligned More button. The table toolbar and listing-only header/global searches and date/aging shortcuts are hidden, without altering those controls on Accounting, Banking or Reports. Existing period filtering remains in effect; column filters, sorting, pagination and overflow stay intact. Hidden legacy global-search values cannot silently filter these listings.

More contains Refresh List, Clear Filters and Export CSV. Refresh reads and validates the saved V3 workspace without a page reload or storage write; errors retain displayed records. Clear Filters is disabled when inactive, clears column values and resets pagination. CSV uses the authorized, filtered rows and reference column order with numeric monetary values. The menu supports keyboard navigation, Escape, outside dismissal and focus restoration.

Payments and Adjustments is now hidden on both Bills and Sales Invoice details without changing settlement data or balances. Detail Attachment/More actions and the shared History/Accounting drawer are preserved. Validation: 74 tests pass; browser checks confirmed refresh, filters/clear, Bills section removal and the existing linked journal drawer. Production build passes.


### V3 final standalone listing layout
All six Sales/Purchasing listings now use Page Header → Standalone Table → Pagination. The opt-in standalone DataTable variant removes the outer card while retaining the table's single rounded border and internal dividers. Natural content height replaces the viewport-filling grid; filtering from five rows to two shrinks the table accordingly. Pagination sits 20px below the bordered scroll container and aligns with both edges. Existing page size and paging behavior are retained.

Status remains last; Posted badges fill their cell's content width, use 7px corners and #EBF6FA/#2879B8, and leave the cell background transparent. Workflow tabs remain absent. More actions, source values, filters, sorting, links and horizontal scrolling are unchanged. No record detail, History/Accounting drawer, Accounting, Banking or Reports files were modified for this refinement. Validation: 76 tests pass; browser measurements confirmed zero outer border/padding, exact pagination alignment, natural five/two-row height and badge sizing/colors. Production build passes.


### V3 parent accounts and subaccounts
Chart of Accounts Create/Edit now supports Make this a subaccount and a required searchable Parent Account selector. The optional parentId metadata supports nesting; existing accounts are not automatically reparented. Parents are active, same-type, cycle-safe accounts without direct journal/opening history or reserved mappings. Account relationships with history are locked. Removing or changing an unused relationship is supported; validation runs in the reducer as well as the form. Existing protected-code/type/classification rules remain.

Grouping status is derived from children, including archived children. Grouping accounts cannot receive new draft/posting lines or opening balances. Journal and bank posting selectors offer eligible leaves; existing historical journal displays and mappings are preserved. No manual posting-type field or Opening Balance UI was added. Bank GL links cannot point to grouping accounts.

The existing account table has indented expandable rows, ancestor context for searches/filters, sibling sorting and top-level-account pagination that keeps a branch together. Related parent links and child-account rows support navigation. Parent balances are calculated from posted descendant balances as of the selected date. The existing report/ledger functions retain direct account balances, so Trial Balance and financial statement totals do not add grouping roll-ups a second time.

Validation: 86 tests pass, including standalone/nested creation, reparent/removal, cycle/type/inactive checks, zero-net/opening/draft history protection, grouping posting rejection, leaf postings, date roll-ups, report reconciliation, tree/filter rendering and original V1/V2 file hashes. Production build passes. Browser validation checked the required searchable selector with an unsaved example; it was discarded and the existing 21-account workspace remained unchanged. Test journals/accounts were created only in memory.


### V3 Chart of Accounts and grouped General Ledger
Chart of Accounts retains its columns, forms, hierarchy rules, search/filter/sort/export controls and top-level pagination. Its four KPI cards are removed; hierarchy chevrons and indentation now sit beside account names. Parent detail View Ledger links can open the consolidated ledger. Journal Entries retains its existing columns and multi-line form, with its KPI cards removed. Journal listing Amount remains total debit, not both sides combined.

General Ledger defaults to All Accounts with no global summary cards. Optional searchable account selection supports grouping parents, leaves, standalone and archived accounts for reporting. Parent sections consolidate descendants without rendering duplicate parent postings. Individual movement tables default collapsed. Each section shows opening, debits, credits and closing balances; the four existing summary cards appear only for a specific selection. All Accounts paginates ten top-level branches, keeping children together. Expanded individual accounts paginate 25 movements, while balances/totals and CSV exports use the complete selected period. The seven movement columns contain no redundant Account column. Journal references open their existing detail pages.

The model reuses ledgerRows for posted-only chronological movements, immediate pre-period opening balances and debit/credit-normal running balances. CSV adds account identifiers and explicit opening/transaction/closing row types, omits grouping roll-ups, and exports all filtered movements regardless of visible page. No source records, hierarchy assignments or postings were changed.

Validation: 94 tests pass, including date cutoffs, chronological posting order, credit-normal balances, nested consolidation, filtered CSV completeness, pagination-independent totals, conditional cards and Journal Entry amounts. Browser checks confirmed collapsed defaults, searchable selection, credit-normal owner-capital movements, account/transaction pagination, and card removal from Chart of Accounts and Journal Entries. Production build passes. Original V1/V2 hashes and the private source snapshot remain unchanged.


### V3 compact ledger and completed account form (supersedes the previous ledger layout)
The General Ledger now uses one continuous compact hierarchy. There is no large Account Filter, global KPI section or per-account four-column summary panel. Search accounts lives inside the ledger container; date selection and Export CSV remain in the page header. Only parents or accounts with period movements/nonzero brought-forward balances have chevrons. Parent rows show descendants; posting rows expand the seven-column transaction table with Opening Balance, full Period Totals and Closing Balance. Independent account expansion, top-level paging, movement paging and complete-period CSV are retained. Search preserves ancestor context and never duplicates postings.

With explicit user approval, the V3 workspace adds 1001 Cash & Bank and zero-balance children 1010 Cash on Hand, 1020 BDO Checking Account and 1030 BPI Savings Account. Historical 1000 Cash & bank stays unchanged. The atomic, idempotent sample action refuses conflicting existing codes instead of overwriting records; it runs once through the normal authorized commit path on Chart of Accounts. No existing journals or bank mappings are reassigned.

The page-based New Account form now includes full-width Description and a separate Opening Balance section with amount (default 0.00), Debit/Credit and a conditionally required As of Date. Account type sets the normal-side default. A nonzero amount creates a balanced posted account-opening journal against a dedicated protected Opening Balance Equity leaf, selecting a free 3900–3999 code without overwriting existing accounts. Posting permission is required. History/protected/grouping accounts cannot receive unsafe opening edits; ordinary detail edits do not duplicate opening journals. Existing postings remain immutable.

Validation: 100 tests pass, including opening journal balancing across all account types, opposite-normal balances, historical/retry/grouping protection, invalid-date atomicity, offset code conflicts, approval-sample history preservation, permissions, ledger search and V1/V2 source hashes. Production build passes (existing bundle-size advisory remains). Browser checks verified the saved actual hierarchy, independent expand/collapse, searchable eligible parents, type-dependent balance defaults, conditional required date, unsaved-change discard and embedded opening/totals/closing values. No additional opening transactions were posted to the main preview for testing.


### V3 complete sample hierarchy correction
The shared account dataset now has the eleven requested major account groups and 25 actual child accounts. A controlled idempotent metadata migration replaces the unused recognized 1001 sample parent with 1000, checks all workspace references, journal/draft lines, opening fields, protection, mappings and child dependencies before removal, and reports conflicts without overwriting or moving dependent accounts. Additional required accounts are preserved. Approved heading changes (3000 Equity, 4000 Revenue and 5000 Operating Expenses) are audited; stable IDs, existing classifications, journals, documents and mappings remain unchanged.

Existing persistent balances are NOT redistributed to newly created children. Parents with history or reserved mappings are explicitly marked legacy posting parents; they retain existing posting behavior until legitimate allocations are reconciled. Their displayed balance includes direct and descendant postings once. Ordinary account actions cannot grant or revoke this exception. Unused pure grouping accounts still reject direct postings. CoA marks legacy parents and explains the pending reconciliation. Parent chevrons navigate only the hierarchy; account rows still open details.

General Ledger uses the same hierarchy and now exposes each affected parent's direct historical ledger in a clearly named expandable section, alongside real child account rows. Direct historical entries remain chronological, with original IDs and opening/running/closing balances. CSV includes those direct entries exactly once, plus child entries; ancestor context from child-only search does not export unrelated parent movements. Pagination keeps whole branches together. No journal transactions are created, deleted, or reassigned by the migration.

Validation: 108 tests cover every sample group, dependency-blocked removal, conflicting parent/child codes, preservation of journals/mappings/report totals, approved heading renames, controlled legacy posting, normal-side child movements and zero siblings, full Trial Balance reconciliation, and legacy-parent CSV completeness. Child movement examples run only in memory; the persistent sample children start at zero. Browser checks exercised all eleven CoA parent controls and all eleven GL parent controls across pages, row/detail navigation and saving unused sample child classifications, plus the preserved equipment opening/period/closing ledger. V1/V2 source integrity tests remain green. Historical attribution is still a reconciliation task; no balances were arbitrarily assigned merely for demonstration.


### V3 Chart of Accounts visual refinement
The listing column order is Account Name, Account Code, Account Type, Classification, Balance, Status; CSV follows the same order. Name-side chevrons, indentation, row navigation, search/filter/sort/export and branch pagination remain. Only parent names receive semibold emphasis; other parent cells stay regular weight. Expanded parents use a subtle background. Direct-posting administration notes are in account details, with listing-wide guidance collapsed under Account hierarchy notes.

New/Edit Account now shares a centered 88%-width page container capped at 1360px, aligning the sticky header and actions with both cards. Account Information uses Name/Code then Type/Classification, conditional searchable parent selection and full-width Description. Cards have 28px padding and a measured 24px separation; equal grid columns use 24px gaps. Opening Balance retains its half-width As of Date and its original controls/validation. Long technical guidance moved into keyboard-accessible native help disclosures, dismissible with Escape. Existing opening and history locks remain unchanged. Mobile uses 20px card padding and a single-column grid.

Validation: 108 tests and production build pass. Browser measurements confirmed regular parent cells/semibold names, retained internal table scrolling, centered desktop width, equal columns, full-width Description, 24px card gap and narrow-screen layout without document horizontal overflow. Browser checks exercised hierarchy expansion, row-to-Edit navigation, searchable parent controls, keyboard help, disabled historical opening fields and unsaved-change discard. No account records or journals were saved for this layout refinement. Accounting reducers, relationships, calculations and V1/V2 were not modified.


### V3 single-level General Ledger (supersedes the nested ledger presentation)
General Ledger now lists Account Name, Account Code, Opening Balance and Closing Balance in one flat account table. Each account has one independently controlled expansion that directly shows Date, Journal, Description, Reference, Debit, Credit and Running Balance. There are no nested account groups, Direct historical postings accordions, repeated opening/closing rows, period-total rows or technical reconciliation labels in this view. Empty posting accounts expand to an explicit no-movements state while retaining correct row balances.

The read-only postingLedger model reuses ledgerRows and the same saved account records. Leaf accounts, retained legacy posting accounts, archived account history and any parent with legitimate direct posted lines appear once with their own direct balances. Pure grouping parents are excluded; no consolidated balances are mixed into individual account rows. Existing CoA group drill-through links select a flat list of eligible posting descendants, while a posting-account link selects that account's own ledger. CoA hierarchy and account-detail reconciliation notices are unchanged.

Search, date controls, CSV and account pagination remain. Transaction paging uses already-calculated running balances across the complete period. CSV preserves its explicit opening/transaction/closing metadata format, exports every filtered movement regardless of visible page and never adds a parent roll-up. No journal, account, relationship, mapping or reconciliation status is changed by rendering/exporting the ledger.

Validation: 109 tests pass, including flat account eligibility, debit/credit normal balances, before-period opening cutoffs, chronological posted movements, archived history, zero-movement accounts with nonzero balances, legacy direct entries appearing once, account/group drill-through, CSV completeness, pagination-independent running balances and full migrated-ledger reconciliation to the Trial Balance. Production build passes. Browser checks verified the exact four-column order/right alignment, direct and independent expansion, empty states, search, account paging and journal navigation. Office Equipment shows 450,000 opening plus a 50,000 posting to 500,000 closing; the prior period has no movements and preserves 450,000 on both sides. Browser console was clean. CoA, Journal Entries, financial reducers, saved books and original V1/V2 sources were not modified by this change.


### V3 Sales Invoice / Supplier Bill Accounting panel refinement
Both source-document Accounting views use the same refined content component. Journal Entry, Date and Status rows retain existing typography/link styling with aligned right-hand values and consistent spacing. The existing Posted element/class keeps its blue #EBF6FA background and #2879B8 text, with 4px/10px padding and the existing 7px radius convention. Shared panel width (564px), Accounting header, rail colors/width, HISTORY/ACCOUNTING tabs and collapse behavior are unchanged.

Journal lines now have a subtle outer border, 8px radius, full horizontal/vertical dividers and consistent padding. Code remains above account name; Debit/Credit and totals stay right-aligned. The Total row uses the existing ground surface and semibold typography, with a stronger top divider. Scoped fixed-layout table rules remove the former minimum width; long content can wrap within the existing panel. Existing design-system tokens have matching fallback values because the component-catalog token stylesheet is not mounted on every application route.

The compact balance indicator includes a Lucide check-circle, Balanced label and actual matching amount. It reuses existing success/success-soft colors, with a truthful warning message/icon for non-balanced data. linkedSourceJournal and all financial calculations are unchanged. Missing-journal/access-denied behavior remains.

Validation: 109 tests and production build pass. Existing Accounting tests verify linked journal amounts, visibility and state immutability, plus actual balanced supporting text and an unbalanced test-only fixture. Browser checks confirmed the 564px panel, Poppins, unchanged blue Posted colors, 1px table border/8px radius and zero horizontal overflow for invoice and bill. Actual totals are 35,000 for INV-2026-001 and 85,000 for BILL-2026-0001. History/Accounting switching and collapse/reopen work; journal links retain the correct V3 destination. Browser console was clean. No accounting records were edited; History, main record layouts and original V1/V2 source files remain unchanged.


### V3 Status header consistency
The shared sticky Status-column rule no longer forces its white body-cell surface onto header cells. Body-cell backgrounds retain their original rule, and Status headers use the table's existing header-surface variable with an opaque surface fallback so sticky labels cannot bleed through while scrolling. Inventory listings expose their existing #F8FAFC header color through that same variable; their other headers retain the exact existing color. Other table surfaces, badge colors, fonts, spacing, widths, sticky behavior and sorting handlers are unchanged. This is a scoped CSS correction in the isolated V3 project.

Validation: 109 tests and production build pass. Browser audit verified matching effective header backgrounds, typography, borders and alignment in 12 tables across the six Sales/Purchasing listings, Chart of Accounts, Journal Entries, Bank Accounts, Bank Transactions, Bank Reconciliation and Dashboard. All six inventory listings retain #F8FAFC headers and their unchanged blue Posted badges. Existing white-header table themes retain their matching white surfaces. Status sorting still updates its arrow. No data or functionality changed; original V1/V2 source integrity tests remain green.


### V3 account form metadata and shared multiline fields
New/Edit/View Account keeps Name/Code, Type/Classification, Parent Account/Subsidiary Type and a full-width Description in that order. Parent Account is permanently visible, searchable and optional (None), with the existing compatible-parent, history and cycle restrictions retained. Subsidiary Type has the fourteen requested options and persists as validated account metadata only. It does not create accounts, journal entries or subsidiary workflows.

Shared V3 textareas use a 110px default height, 100px minimum and vertical-only resizing. Account Description, journal/bank transaction descriptions, bank-account descriptions, notes, remarks, evidence and reasons retain their existing character limits and handlers. Read-only multiline fields preserve newlines and remain read-only. Short fields and table-cell descriptions are unchanged. Opening Balance structure, required-date rules, grouping restrictions and balanced posting behavior are unchanged.

Validation: 111 V3 tests and production build pass. Tests cover metadata persistence, newline/JSON round trips, Edit/View hydration, invalid metadata rejection, no financial side effects and original V1/V2 source integrity. Browser checks verified aligned Parent/Subsidiary controls, all options, multiline input, a native resize from 110px to 185px without width changes or overlap, the retained 24px section gap, read-only invoice Remarks and the unsaved-changes guard. No saved financial records were modified. The optional legacy V2 credit-ui suite has 21 passing checks and four failures reflecting established V3 differences (removed Masterfile, V2 routes and editable AR/AP workflows); that suite is not part of V3's supported test command.


### V3 Banking workflow completion and additive sample records
Accounting Manager defaults and the one-time V3 directory migration enable Banking View/Create/Edit/Post/Approve/Export; other roles and existing posting/reconciliation checks remain. New Bank Transaction and New Reconciliation no longer depend on a nonempty bank-account dataset to open. Missing prerequisites are explained within creation forms and remain enforced by field and reducer validation. The three listing setup panels are removed. Existing headings, filters, sorting, pagination, clickable rows, badges and Status header styling remain.

A V3-only load migration adds three distinct company banks with fictional numbers and new posting-level Cash in Bank GLs. No existing bank GLs, historical cash movements, bank mappings, documents or saved financial records are reassigned or overwritten. Code/number collisions allocate new sample identities. A version marker persists the seed once. Original records remain intact; the additive sample journals naturally appear in reports and balances. Failure to initialize samples retains the loaded books and reports the error.

The sample balances are BDO Operating Checking PHP485,250, BPI Payroll PHP320,000 and Metrobank Savings PHP750,000. Opening funding is balanced against Opening Balance Equity. Customer collection PHP25,000 and supplier advance PHP15,000 are new imported sample source payments, unapplied to historical documents; each uses its original source journal once. Other samples demonstrate deposit, petty-cash withdrawal, service charge, interest and a two-leg interbank transfer. Separate Cash in Bank leaves are linked one-to-one; petty cash and cash on hand are excluded from new bank links. An additional unused bank GL is provided for demonstrating account creation.

Reconciliation samples use actual sample movement IDs: BDO Completed with all entries matched, BPI In Progress with an unmatched statement item, Metrobank Draft. Existing REC numbering and Completed status naming are retained. Reconciliation forms now include the shared searchable/paginated Book Transactions table and continue supporting explicit one-to-one matches, reviewed outstanding items, statement roll-forward validation, duplicate/overlap guards and immutable completion snapshots. A zero Difference alone cannot finalize a reconciliation. Long transaction descriptions use the shared vertically resizable textarea.

Validation: all 117 tests and the production build pass (the existing large-bundle warning remains). Tests cover additive/idempotent migration, preservation under code collisions, exact balances, unique GL links, balanced journals, source-payment nonduplication, transfer legs, legacy mapping preservation, role permissions, draft/post replay protection, missing prerequisites, reconciliation completion/duplicate guards and creation pages with an empty dataset. Original V1/V2 integrity checks pass.

Browser verification opened all three New pages in the main 5183 preview and confirmed persisted sample balances after reload. A separate localhost:5184 test preview saved a fictional bank account, saved and posted a PHP1,000 transaction through confirmation, saved a reconciliation Draft, explicitly matched its statement row, saved In Progress and completed it as read-only with PHP0 difference. Those additional QA records did not enter the main preview. Both browser consoles were clean. Screenshots: ../v3-banking-accounts.jpg, ../v3-banking-transactions.jpg and ../v3-banking-reconciliation.jpg. Manual statement entry and one-to-one matching remain; no real bank connection is provided.
