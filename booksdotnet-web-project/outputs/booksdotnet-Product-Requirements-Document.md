# booksdotnet Product Requirements Document

Financial and Accounting Management System

Version 1.0 | 28 October 2026 | Status For stakeholder approval

Audience Product owner, finance lead, designers, engineers, quality assurance, and operations

This document defines the requirements for turning the existing booksdotnet accounting prototype into a reliable desktop web application. It covers the eight accounting modules, shared workflows, accounting controls, user permissions, data, integrations, design system, operational requirements, and release acceptance. The current implementation demonstrates the experience and accounting calculations; production authentication, server persistence, access control, and operational safeguards remain to be delivered.

## 1 Product summary

booksdotnet gives a small finance team one workspace for recording transactions, issuing invoices, recording customer receipts and supplier payments, tracing postings, and reviewing financial statements. Its core promise is that a transaction is entered once and consistently updates the relevant document, subledger, General Ledger, dashboard, and reports.

The current product was originally named LedgerFlow. The customer-facing brand is now booksdotnet. Legacy Figma filenames, source folders, identifiers, and the browser storage key still use LedgerFlow; changing them requires an explicit migration rather than a cosmetic replacement.

The first production release will support one organization at a time in the interface, Philippine pesos, accrual accounting, and the eight existing navigation modules. A user may belong to multiple organizations, but every request, record, report, and permission check must have an explicit organization scope. Consolidation, foreign exchange, statutory filing, payroll processing, inventory accounting, and bank payment execution are outside that release.

### 1 1 Product decisions

- Preserve the existing information architecture and booksdotnet visual direction. Improve implementation quality without adding unrelated modules.
- Use the posted journal as the source of truth for balances and reports. Drafts never affect the books.
- Preserve financial history through reversals and dated adjustments. Posted entries cannot be silently rewritten or deleted.
- Build production controls before accepting real accounting data. The browser-local demonstration is not the production persistence or security model.
- Treat all new production requirements and targets in this PRD as proposed until the relevant owner approves them.

## 2 Problem and outcomes

Finance staff need to answer three questions quickly: what happened, what is still unpaid, and whether the books agree. Disconnected spreadsheets and repeated entry make these answers slow and increase the chance that a customer balance, journal, and management report disagree.

The product must reduce repeated entry, make every balance traceable to source documents, surface collection and payment priorities, and prevent invalid postings before they affect reports. Management should be able to review financial performance without changing the underlying records.

### 2 1 Success measures

These are proposed pilot targets, not measured results. The product owner must confirm the pilot cohort, baseline, and measurement period before release.

| Measure | Proposed target | Measurement |
| --- | --- | --- |
| Posted journal integrity | 100 percent balanced and traceable | Database invariant checks and posting audit |
| Subledger reconciliation | Zero unexplained AR or AP differences | Daily and period close reconciliation |
| Core task completion | At least 90 percent without assistance | Moderated invoice, receipt, bill, and journal tasks |
| Reduction in repeated entry | At least 30 percent against the pilot baseline | Observe equivalent end to end workflows |
| Successful reporting periods | At least 95 percent reconciled before close | Close checklist and finance lead approval |
| Critical release defects | Zero open defects involving lost postings, access leakage, or incorrect balances | Release defect review |
| User confidence | At least 4 of 5 in pilot feedback | Survey after reconciliation and reporting tasks |

## 3 Users and permissions

### 3 1 Personas

The owner or finance manager reviews performance, overdue balances, and period results. The accountant maintains accounts, posts and reverses journals, handles exceptions, and closes periods. The bookkeeper prepares invoices, bills, and supporting records. The auditor needs read-only access to history, reports, and authorized exports. The organization administrator manages users and settings; administrative access alone must not imply permission to post financial transactions.

### 3 2 Proposed permission model

Permissions are server-enforced capabilities. Roles are convenient defaults, not authorization logic hardcoded into buttons. A user can hold more than one role. The current preview has one simulated administrator and does not enforce this matrix.

| Capability | Owner or manager | Accountant | Bookkeeper | Auditor | Administrator |
| --- | --- | --- | --- | --- | --- |
| View dashboard and reports | Yes | Yes | Assigned | Yes | Assigned |
| Prepare document and journal drafts | Assigned | Yes | Yes | No | Assigned |
| Post invoices bills receipts and journals | Assigned | Yes | No by default | No | No by default |
| Reverse or void posted transactions | Assigned | Yes | No | No | No by default |
| Maintain Chart of Accounts | Assigned | Yes | No | No | No by default |
| Close or reopen periods | Approve | Assigned | No | No | No by default |
| Export financial records | Yes | Yes | Assigned | Assigned | No by default |
| Manage users and organization settings | Assigned | No by default | No | No | Yes |
| Review audit history | Yes | Yes | Own actions only | Yes | Security events only |

Read, create, post, reverse, export, period control, and user management must be separate permissions. A denied API call must fail even if a client sends it directly. The release configuration must identify who may review their own work; an approval workflow is not implied by the existence of roles.

## 4 Scope and delivery boundaries

### 4 1 Production release scope

The release includes authentication and organization membership, the eight accounting modules, minimal customer and vendor records inside existing workflows, reporting, search and numbered pagination, auditability, secure persistence, backups, operational monitoring, and an editable shared design system. Customer and vendor setup need not become separate sidebar modules.

### 4 2 Deferred scope

Bank feeds and bank reconciliation, online payment collection or money movement, payroll calculation, inventory and purchasing, fixed asset depreciation, multi-currency accounting, consolidated statements, automated statutory returns, advanced approval routing, budgets, recurring journals, OCR, and advanced analytics are deferred. Credit notes, refunds, unapplied receipts, attachments, and email delivery must be explicitly prioritized before implementation; they are not available merely because a receipt or invoice can be recorded.

### 4 3 Status and priority definitions

**Demo** means the current React experience implements the behavior with browser-local data. **Partial** means a visual or limited interaction exists without production controls. **Required** means a proposed production requirement, not an implemented capability. **Deferred** means outside the initial production release.

**P0** is required to accept real data or complete a core workflow safely. **P1** improves efficiency after core correctness and security. **P2** is a later enhancement. Final sequencing and dates require engineering estimates and owner approval.

## 5 Current system baseline

| Area | Current state | Production gap |
| --- | --- | --- |
| Dashboard | Demo with computed KPIs charts and filters | Server queries authorization freshness and scale |
| Chart of Accounts | Demo create edit archive restore and ledger drilldown | Durable unique accounts and server validation |
| Journal Entries | Demo drafts posting reversals and balanced validation | Atomic posting period locks permissions audit |
| General Ledger | Demo opening movement and closing balances | Server pagination complete historical queries |
| Accounts Receivable | Demo aging balances and partial receipts | Durable customers allocations and concurrency |
| Accounts Payable | Demo bills aging and partial payments | Durable vendors bill review and payment controls |
| Invoices | Demo drafts issue void print and local reminders | Server numbering rendering and delivery decisions |
| Financial Reports | Demo four financial statements and CSV | Authorized reproducible reporting and close controls |
| Login and identity | Figma login design and simulated profile or sign out | Real identity sessions recovery and role enforcement |
| Settings and notifications | Partial preview settings and local read states | Durable preferences event delivery and permissions |
| Persistence | One browser origin using localStorage | Server database tenancy migrations and recovery |
| Figma library | Editable imported showcase | Native components variants styles variables and instance connections remain unverified |

The demo date is fixed at 26 October 2026. Fresh October sample totals are revenue PHP 1,465,000, expenses PHP 859,500, net profit PHP 605,500, receivables PHP 215,000, and payables PHP 159,500. These figures are test fixtures, not business results or production opening balances. Monetary values use integer centavos in the model.

## 6 Navigation and shared experience

**UX01 P0** Keep the navigation order Dashboard, Chart of Accounts, Journal Entries, General Ledger, Accounts Receivable, Accounts Payable, Invoices, and Financial Reports. Preserve direct routes and browser Back and Forward behavior. Permission changes must remove unavailable actions and protect their routes.

**UX02 P0** Provide a 256px expanded sidebar and a 72px collapsed rail on desktop. Collapsed icons must have accessible names and tooltips. Smaller screens use an explicitly opened navigation drawer and must not obscure the active task.

**UX03 P0** The fixed top bar shows the page title, context, selected period, notifications, settings, and profile. Opening one menu closes conflicting menus. Escape closes the topmost dismissible overlay and restores focus to its trigger.

**UX04 P0** Support Today, Last 7 Days, Last 30 Days, This Month, Last Month, This Year, and a custom inclusive range. Apply commits the range and refreshes dependent content; Cancel preserves the applied range. Invalid dates and start after end require inline errors. Production uses the organization date and calendar, not the demo constant.

**UX05 P0** Search and filters must combine predictably, expose a reset action, and reset pagination to page one when the result set changes. Every table shows record counts and clickable page numbers with a clear current-page state, previous and next controls, and ellipses for large page counts. An empty result has no fictitious page number.

**UX06 P0** Distinguish loading, no records, no matching results, permission denied, network failure, and unavailable service. Retain entered values after recoverable errors. A success message appears only after the authoritative operation commits.

**UX07 P1** Preserve useful list filters during drilldown and return navigation. Reports and exports must visibly state the applied organization, range, currency, and status filters.

## 7 Identity and organization requirements

**AUTH01 P0** Authenticate users through a production identity service. Support email sign in, password reset, secure session expiry, and explicit sign out. Use generic authentication failures that do not reveal whether an email address is registered. Do not store passwords or session secrets in localStorage.

**AUTH02 P0** Enforce organization membership and capability checks on every read and write. Organization IDs supplied by clients must be verified against the authenticated membership. Switching organizations clears prior organization data from the visible workspace and caches.

**AUTH03 P0** Reauthenticate before sensitive security changes and require multi-factor authentication for privileged production roles. Exact MFA methods and identity provider selection are implementation decisions requiring security approval.

**AUTH04 P0** Disable revoked or inactive memberships promptly, invalidate affected sessions, and record security events. Users must not modify their own posting or export privileges.

**AUTH05 P0** Password visibility controls must be accessible buttons aligned at the right edge of the input. Authentication must support password managers, paste, and keyboard operation. Sign-out confirmation must offer Cancel and Sign Out and clearly communicate whether unsaved work will be discarded.

**Acceptance** A read-only auditor calling a posting endpoint receives an authorization failure with no accounting mutation. A user with access to organization A cannot retrieve organization B records by changing an identifier. Sign out invalidates the server session rather than only hiding the dashboard.

## 8 Dashboard requirements

**DASH01 P0** Show Total Revenue, Total Expenses, Net Profit, and Outstanding Invoices. Revenue and expenses derive from posted activity in the selected range. Outstanding invoices use unpaid balances as of the selected end date, including documents issued before the range start.

**DASH02 P0** Compute comparisons against the preceding equivalent inclusive period and label the comparison. A zero prior amount shows a clear no-baseline message instead of an infinite or misleading percentage. An expense increase must not be styled as favorable merely because it is positive.

**DASH03 P0** Show a Revenue versus Expenses chart and an Expense Breakdown chart. The line chart must reflect signed period activity; expense credits must remain credits. A donut must not draw negative slices. If credits exist, explain the relationship between positive expense allocations and the net total.

**DASH04 P0** Display recent transactions with date, reference, description, account, type, amount, and status. Search, type and status filters, View all, and numbered pagination must operate on the same underlying result set.

**DASH05 P1** Allow users to drill from a KPI or transaction into a filtered source list or journal with the period preserved. Show refresh time and a recoverable error if a panel fails rather than presenting stale figures as current.

**Acceptance** Issuing a PHP 10,000 invoice increases period revenue and AR by PHP 10,000, without increasing cash. Receiving PHP 4,000 reduces AR and increases cash by PHP 4,000 without recognizing revenue a second time. Dashboard and financial statements reconcile to the same posted dataset.

## 9 Chart of Accounts requirements

**COA01 P0** Maintain code, name, account type, classification, active status, and control-account designation. The current demo uses four-digit codes and Asset, Liability, Equity, Revenue, and Expense types. Production code format and account templates require finance approval before migration.

**COA02 P0** Enforce organization-level uniqueness of account codes and preserve stable internal account IDs when display names change. Referenced account codes, types, and classifications cannot be changed casually; any permitted reclassification requires an explicit governed migration.

**COA03 P0** Allow authorized users to edit eligible account details, archive zero-balance unprotected accounts without pending draft references, and restore archived accounts. Archiving preserves history and prevents new postings. System control accounts cannot be archived through ordinary user actions.

**COA04 P0** Provide search, type and status filters, balances as of the selected end date, CSV export, and account-specific General Ledger drilldown. Display account identifiers as text and financial balances using consistent normal-balance conventions.

**Acceptance** An archived account remains visible in historical journals and reports but cannot be selected for a new posting. Attempting to reuse an existing code is rejected by both service and database controls.

## 10 Journal Entries requirements

**JE01 P0** A journal contains a date, reference, description, source, and at least two account lines. Each line has one non-negative debit or credit amount. A line cannot contain both. Drafts may be incomplete but must remain syntactically valid and never affect balances.

**JE02 P0** Before posting, require active accounts, valid date, an open period, positive balanced totals, valid integer centavos, and posting permission. Reject empty lines, missing descriptions, and direct manual postings to AR and AP control accounts.

**JE03 P0** Assign a unique journal number on authoritative commit. A journal header, lines, source document update, and audit event must commit atomically. A retry must not create a second posting.

**JE04 P0** Posted journal values are immutable. Corrections use a dated reversal that swaps debits and credits, preserves the original, and records the original and reversal references. Prevent duplicate reversals. Source-generated entries must be corrected through their source workflow.

**JE05 P0** Authorized users may edit or delete an unposted manual draft. Record deletion of a draft in the audit trail without leaving orphaned references. Deletion of posted entries is prohibited.

**JE06 P1** Provide journal search, date and status filters, a debit and credit total, clear out-of-balance feedback, source links, and CSV export. Draft editing must detect stale versions rather than overwrite another user's changes.

**Acceptance** A draft with debit PHP 2,500 and credit PHP 2,000 cannot post. Correcting the credit to PHP 2,500 allows one atomic posting. Reversing it preserves both records and offsets the financial effect in the reversal period.

## 11 General Ledger requirements

**GL01 P0** Let users select an account and inclusive date range. Show opening balance before the start date, period debits, period credits, closing balance, and transaction-level running balances. Opening balance must exclude movements on the start date.

**GL02 P0** Include posted entries only and order deterministically by accounting date and authoritative posting sequence. Search may hide rows but must not recalculate a fictitious running balance from the visible subset.

**GL03 P0** Provide journal drilldown, reference and source context, debit and credit columns, a visible normal-balance label, authorized CSV export, and numbered pagination. Debits increase assets and expenses; credits increase liabilities, equity, and revenue. Abnormal signed balances must remain visible.

**GL04 P0** A paginated response must include opening and running balance context computed by the server. Page two must continue the ledger rather than restarting from zero.

**Acceptance** Owner capital account 3000 opens October at PHP 2,450,000 credit. A PHP 150,000 cash contribution and PHP 50,000 equipment contribution increase it to PHP 2,650,000. A PHP 25,000 return of capital produces a PHP 2,625,000 closing credit balance. Search, pagination, and export must preserve that accounting result.

## 12 Accounts Receivable requirements

**AR01 P0** Show customer balances, issued documents, due dates, unpaid amounts, payment history, and derived Sent, Partial, Paid, and Overdue labels. Overdue is a time-based condition and may coexist with a partial payment; it must not erase payment history.

**AR02 P0** Age outstanding balances as of the selected end date into Current, 1 to 30 days, 31 to 60 days, 61 to 90 days, and more than 90 days. Use the due date, exclude drafts and effective voids, and include only payments posted by that date. A document due on the as-of date remains current.

**AR03 P0** Record a full or partial receipt against an issued invoice. Capture receipt date, amount, method, reference, receiving cash account, and actor. Require a positive amount not exceeding the current outstanding amount. Receipt recording does not execute a bank transaction.

**AR04 P0** Post debit Cash and credit AR for the allocated receipt. Update the invoice, customer balance, journal, dashboard, and audit record in one transaction. Two simultaneous receipts cannot overpay the same invoice.

**AR05 P1** Support a customer statement and authorized export. Unallocated receipts, customer credits, refunds, write-offs, and multi-invoice allocations require separately approved workflows before being accepted as production records.

**Acceptance** An invoice for PHP 15,000 with a PHP 5,000 receipt has PHP 10,000 outstanding. A further PHP 10,000 receipt marks it paid. A PHP 10,000.01 allocation is rejected. An as-of report before the first receipt still shows the original outstanding amount.

## 13 Accounts Payable requirements

**AP01 P0** Maintain vendor, vendor reference, bill date, due date, description, expense account, total, payment history, and outstanding amount. Detect duplicate vendor references within an organization using trimmed and normalized values; reference reuse after a void requires an approved policy.

**AP02 P0** Posting an eligible bill debits the selected expense account and credits AP. The current demo posts upon bill creation; production must separate preparation from posting when the user's role cannot post. A bill draft must not affect balances.

**AP03 P0** Record partial or full supplier payments with date, method, paying cash account, reference, and actor. Prevent invalid dates, non-positive amounts, overpayment, and unauthorized posting. The existing demo rejects insufficient cash; production overdraft handling is a finance policy decision and must not change silently.

**AP04 P0** Payment posting debits AP and credits Cash atomically with the allocation. Age outstanding vendor balances using the same inclusive as-of rules as AR.

**AP05 P0** A bill with payments cannot be directly voided in the initial release. A permitted unpaid-bill void posts an offsetting entry on the void date and preserves the original history. Payment reversals and corrections require a separately defined controlled workflow.

**Acceptance** A PHP 4,500 bill followed by a PHP 1,500 payment leaves PHP 3,000 in both its payable balance and corresponding subledger contribution. A second submission of the original vendor reference is rejected without a second journal.

## 14 Invoice requirements

**INV01 P0** An invoice includes a stable customer, optional delivery email, issue and due dates, line descriptions, quantities, unit rates, configured tax treatment, notes, currency, and a unique document number. Due date cannot precede issue date.

**INV02 P0** Support Draft, Issued, and Void lifecycle states. Sent is currently a demo label for issuance; production must distinguish accounting issuance from actual email delivery. Partial, Paid, and Overdue are derived from allocations and due dates rather than independently editable statuses.

**INV03 P0** Saving or editing a draft does not post. Issuing a validated invoice debits AR for the gross amount, credits revenue for the subtotal, and credits the configured tax liability for applicable tax. Server totals prevail over client totals.

**INV04 P0** Issued financial content is immutable. An unpaid invoice may be voided only with permission and a dated offsetting posting. An invoice with receipts cannot be voided through that action. Preserve the original number, customer, totals, and correction history.

**INV05 P0** Provide searchable registers, customer/date/status filters, numbered pagination, document detail, payment history, print or downloadable invoice output, and authorized exports. Production invoice output must use versioned templates and preserve the issued document snapshot.

**INV06 P1** A reminder action must report whether it logged a reminder or actually sent one. The demo logs locally and sends nothing. If delivery is added, require consent and delivery settings, an idempotent job, delivery results, failure recovery, and an audit record.

**Acceptance** Two service units at PHP 1,500 yield a PHP 3,000 subtotal. For an explicitly configured illustrative 12 percent rate, tax is PHP 360 and total is PHP 3,360. This is a calculation fixture, not a determination of the customer's required tax treatment.

## 15 Financial Reports requirements

**REP01 P0** Provide an income statement, balance sheet, trial balance, and direct cash flow statement. Every report identifies organization, period or as-of date, PHP currency, accrual basis, generation time, and relevant filters. Drafts and unissued documents are excluded.

**REP02 P0** The income statement reports period revenue, expenses, and net profit. The balance sheet reports cumulative assets, liabilities, equity, and accumulated earnings as of the selected date. Presentation of retained earnings and closing entries must not count earnings twice.

**REP03 P0** The trial balance reports debit and credit balances without hiding unusual account signs. Debits must equal credits. A discrepancy blocks publication as a reconciled report and generates an actionable diagnostic.

**REP04 P0** Classify cash movements into operating, investing, and financing categories through account configuration approved by the finance lead. Non-cash contributions and transfers between cash accounts must not be counted as cash inflows or outflows. Opening cash plus classified net movements must equal closing cash.

**REP05 P0** Support drilldown to the account ledger and journal, print output, and CSV export. Generate a report and its export from the same authoritative query or snapshot; displayed and exported totals must agree.

**REP06 P1** Support comparison periods and report snapshots for closed periods. Reopening a period must flag affected snapshots as superseded without silently overwriting published evidence.

**Acceptance** Assets equal liabilities plus equity including accumulated earnings. Trial balance totals agree. AR and AP control accounts reconcile to their subledgers at the same as-of date. Cash flow reconciles to cash-account opening and closing balances.

## 16 Settings notifications and period controls

**SET01 P0** Maintain organization identity, base currency, fiscal-year start, time zone, document numbering, default posting accounts, and approved accounting preferences. PHP and accrual are the initial supported currency and basis. A setting that would reinterpret posted history must be locked or changed through a migration.

**SET02 P0** Separate profile edits from organization settings. Validate names and email values server-side. Profile changes do not grant capabilities. The current profile and fiscal preferences are preview interactions rather than production master-data configuration.

**NOT01 P0** Create notifications from authorized business events such as overdue balances or failed exports. Persist recipient and read state. Support individual and bulk mark-as-read, an accurate unread count, a clear empty state, and navigation to the permitted source record.

**PER01 P0** Maintain open and closed accounting periods. Posting and reversal dates must be in an open period. Reopening requires permission, a reason, an audit event, and finance approval according to the organization's policy. The current prototype does not implement period locking.

**PER02 P0** The close checklist verifies balanced journals, AR/AP agreement, cash reconciliation, reviewed drafts, unresolved exceptions, and approved financial reports. Closing does not automatically create unexplained income, expense, or equity adjustments.

## 17 Accounting invariants and calculations

### 17 1 Monetary and posting rules

**ACC01 P0** Store PHP amounts as integer centavos using a server representation that cannot lose precision. Validate safe ranges at every boundary. Do not use binary floating-point totals as the authoritative ledger amount. Define quantity precision, tax rounding order, discount treatment, and document limits before production; the demo currently uses positive whole-number invoice quantities.

**ACC02 P0** Total debits equal total credits for every posted journal and for the ledger. Zero-value journals cannot post. A line has either a debit or a credit. A system source document and its posted journal cannot diverge after a partial failure.

**ACC03 P0** Use separate document lifecycle, posting lifecycle, and payment allocation facts. Labels such as Partial or Overdue must be recomputed from those facts. Do not rely on a manually set Paid flag as proof of settlement.

**ACC04 P0** Each source operation has a unique posting relationship and idempotency key. No financial operation can be applied twice because of retries, double clicks, delayed network responses, or concurrent clients.

**ACC05 P0** Accounting dates are date-only values interpreted in the organization calendar. Technical timestamps are stored in UTC and displayed with a clear time zone. The demo's fixed date must never become a production business-date rule.

**ACC06 P0** Historical balances include only documents, payments, voids, and reversals effective by the chosen date. Backdated transactions follow period and authorization policy and may require report regeneration. The demo's chronological receipt-entry restriction is a known limitation; production must validate balances using effective dates and concurrency controls.

### 17 2 Posting templates

| Event | Debit | Credit | Timing |
| --- | --- | --- | --- |
| Issue invoice | Accounts Receivable gross amount | Revenue subtotal and applicable tax liability | Issue commit |
| Customer receipt | Receiving cash account | Accounts Receivable | Receipt posting |
| Supplier bill | Approved expense account | Accounts Payable | Bill posting |
| Supplier payment | Accounts Payable | Paying cash account | Payment posting |
| Cash capital contribution | Cash | Owner capital | Journal posting |
| Equipment capital contribution | Equipment asset | Owner capital | Journal posting without cash flow |
| Return of capital | Owner capital | Cash | Authorized journal posting |
| Reverse or void eligible entry | Original credit accounts | Original debit accounts | Effective reversal or void date |

Classification of owner distributions, tax accounts, report line items, and cash flow categories requires finance approval. The product must not infer statutory treatment from these demonstration templates.

## 18 Cross module workflows

### 18 1 Invoice through collection

Prepare a draft, validate customer and line values, issue with permission, commit AR/revenue/tax and audit history, display the invoice in receivables, record a partial or full receipt, and update cash, allocation, document labels, ledger, and reports. A failed issue or receipt leaves no partial financial effect. Email delivery, when implemented, runs after the accounting commit and cannot decide whether the posting exists.

### 18 2 Bill through payment

Prepare the vendor bill, detect duplicates, review its account and dates, post with permission, include it in AP and aging, record a payment, and update cash and payable balances atomically. Payment recording remains separate from real bank execution.

### 18 3 Journal correction

Open the original posting, review its source and affected accounts, choose the source-specific correction action or an allowed manual reversal, supply an open-period date and reason, and post the offset once. Preserve bidirectional references and verify the corrected ledger and period reports.

### 18 4 Period close

Resolve posting exceptions, reconcile control accounts, review report totals, obtain the required sign off, and lock the period. An attempted posting into a closed period returns a clear error and leaves all data unchanged. Reopening follows the governed path rather than modifying the lock directly in the client.

## 19 Data requirements

| Entity | Minimum production fields and relationships |
| --- | --- |
| Organization | Stable ID name currency time zone fiscal-year start settings version |
| User and Membership | Identity ID organization ID role or capabilities active status timestamps |
| Account | Stable ID organization code name type classification control designation active status version |
| Journal and JournalLine | Header ID number effective date source state actor and immutable posted lines with account ID debit and credit |
| Customer and Vendor | Stable organization-scoped ID display name contact data optional approved tax details active status |
| Invoice and InvoiceLine | Header customer dates currency lifecycle totals version and source lines with snapshot descriptions quantities rates and tax calculation |
| Bill | Vendor reference dates expense allocation lifecycle total version and posting reference |
| Payment and Allocation | Receipt or payment ID date amount method cash account document allocation reference actor and journal ID |
| AccountingPeriod | Organization start end open or closed state closed by and reopen history |
| AuditEvent | Actor organization action entity IDs timestamp reason correlation ID and appropriate before or after values |
| Notification | Recipient organization event source read state and timestamps |
| ExportJob and ReportSnapshot | Request scope permission context query version status generated artifact retention and checksum |

**DATA01 P0** Apply organization-scoped foreign keys, uniqueness constraints, amount constraints, and immutable posting rules in the database. Human-readable document numbers are not primary keys. Numbers must not be reused after voiding; any reservation or gap policy must be documented.

**DATA02 P0** Snapshot issued customer names, line descriptions, document terms, and applicable configuration so later master-data edits do not silently rewrite issued evidence. Preserve stable references to the underlying master records.

**DATA03 P0** Use explicit entity versions for editable records. The service must reject stale updates and return enough context for users to refresh or resolve the conflict. Posted records use controlled correction events rather than ordinary update endpoints.

**DATA04 P0** Define retention, deletion, and legal-hold requirements before onboarding real organizations. User removal must preserve attribution of financial actions. Do not purge posted history through general account deletion.

## 20 Architecture and service contracts

The proposed production architecture consists of a React client, an authenticated application API, a transactional database, an asynchronous job worker for exports and optional notifications, and protected artifact storage. Server-side services own validation, authorization, posting, and report calculation. The client displays and validates for usability but cannot establish financial correctness on its own.

### 20 1 Representative service operations

| Operation | Contract expectations |
| --- | --- |
| Create or update draft | Validate permission and version return persisted entity and version |
| Post journal or issue document | Require idempotency key revalidate amounts accounts period and permission commit all related records atomically |
| Record receipt or payment | Lock or serialize allocation validate outstanding amount commit allocation cash posting and audit together |
| Reverse or void | Require permission reason valid date and original reference prevent repeated corrections |
| Query ledger or report | Require organization scope date semantics deterministic sort filters pagination and authoritative totals |
| Export records | Authorize both request and download preserve query context track job state and protect artifact access |
| Close or reopen period | Check capabilities prerequisites and reason record a durable audit event |

API paths and vendor selections belong in the technical design. All commands must return stable machine-readable error codes plus user-safe messages. An idempotent retry of an already committed request returns its original outcome; a reused key with a different payload is rejected. Asynchronous jobs must be safely retryable and observable.

### 20 2 Integration boundaries

Identity, email, storage, and monitoring providers require approved configuration and failure handling. A failed optional email job must not roll back an issued invoice. Payment methods in the initial release describe recorded transactions and do not authorize a transfer. No bank credentials or payment gateway secrets belong in the browser. External integrations require their own scope, permissions, test environments, and acceptance gates.

## 21 Nonfunctional requirements

**NFR01 P0 Security** Encrypt traffic and stored sensitive data, apply least privilege, protect secrets, defend against injection and cross-site scripting, and limit authentication abuse. Perform independent authorization and tenant-isolation tests. Logs must exclude passwords, tokens, unnecessary contact information, and raw financial payloads.

**NFR02 P0 Auditability** Record posting, reversal, void, draft deletion, permissions, settings, period changes, exports, and failed sensitive actions. Audit records must be append-only from normal application roles, searchable by authorized users, and correlated with the financial operation. An ordinary user cannot erase audit history.

**NFR03 P0 Integrity and recovery** Use transactions, constraints, backups, and tested restore procedures. Proposed service targets are recovery point no more than 15 minutes and recovery time no more than 4 hours; infrastructure cost and finance owners must approve them. A successful backup job alone is not proof that restoration works.

**NFR04 P0 Availability** Target 99.9 percent monthly production availability excluding an explicitly agreed maintenance policy. This is a proposed service objective, not an existing SLA. Monitor failed postings, reconciliation exceptions, job delays, and service errors with an operational escalation path.

**NFR05 P0 Performance** For an agreed pilot profile of 10,000 accounts, 100,000 documents, 1,000,000 journal lines, and 25 concurrent users per organization, target ordinary paginated reads below 2 seconds at p95, posting below 3 seconds at p95, and standard report requests below 5 seconds or an explicit background job. Measure with realistic indexes, permissions, and network conditions. Confirm this sizing assumption before implementation.

**NFR06 P0 Accessibility** Target WCAG 2.2 AA for the production UI. Provide semantic controls, visible focus, keyboard navigation, accessible names, validation near fields, focus restoration, and non-color status cues. The approved white labels on light blue and gradient fills require a contrast review and an accessible treatment approved by design; the brand preference must not be assumed to satisfy the target.

**NFR07 P0 Responsive behavior** Desktop is primary, with 1440 by 900 as the reference workspace. Test 1280, 1440, tablet, and 375px phone widths. Tables may scroll inside their containers while the page and essential actions remain usable. Menus, dialogs, pagination, and focus must not be clipped by fixed navigation.

**NFR08 P0 Browser and localization** Support current organization-approved Chrome, Edge, Firefox, and Safari versions defined in the release test matrix. Format PHP amounts and dates consistently. Support organization calendar and time zone without altering stored date-only accounting values.

**NFR09 P0 Export safety** Quote CSV values correctly, neutralize spreadsheet formula injection in text fields, preserve leading zeros in identifiers through documented export conventions, and enforce download authorization. Exports must never include a different organization's rows.

**NFR10 P1 Observability** Track operation latency, denial rates, posting failures, job failures, restore results, and reconciliation status without exposing financial contents in general analytics. Distinguish transient network errors from permanent validation failures in the interface and support tooling.

## 22 Design system requirements

**DS01 P0** Use the supplied booksdotnet logo with its original proportions and Poppins 400, 500, and 600. Primary brand blue is #559CDA; background #F8FAFC, surface #FFFFFF, primary text #0F172A, secondary text #64748B, and default border #E2E8F0. Semantic feedback colors must follow the existing source palette.

**DS02 P0** Active navigation uses the approved gradient stops #559CDA at 0 percent, #7BADFF at 27 percent, #FFB58D at 76 percent, and #ED8028 at 100 percent, with white text and icons. Primary blue buttons also use white labels and icons. Outline buttons use neutral gray borders, labels, and icons. Provide both filled and outlined icon-only controls with accessible names.

**DS03 P0** Keep input prefix icons at the leading edge and trailing icons, suffixes, and validation indicators aligned to the right padding. Values expand between them. Focus, filled, disabled, read-only, error, and success states must remain distinguishable without changing component bounds unexpectedly.

**DS04 P0** Maintain one Figma page named Design System & Components with the 17 agreed categories. Convert existing imported elements in place into native main Components and Component Sets; do not paste the gallery again or use duplicate ordinary frames as substitutes for reusable components.

**DS05 P0** Register Color, Text, and applicable Effect Styles and a Design Tokens variable collection for colors, spacing, radius, dimensions, and border widths. Apply styles and bind variables to components. Use semantic names such as color/action/primary and Color/Text/Primary. Reuse identical definitions; do not add shadows to flat cards or add an unsupported dark theme.

**DS06 P0** Expose text, visibility, variant, and icon-swap properties where useful. Avoid unnecessary variant combinations. Add native interactive states where supported and distinguish them from React behavior. Existing screens must use matching component instances while preserving layout, content, icons, labels, visual overrides, and existing interactions.

**DS07 P0** Verify actual Component and Component Set types, instance relationships, style IDs, and variable bindings. Change a main component, style, and variable in a controlled test and confirm intended references update, then revert the test change. A visually correct screenshot is not acceptance evidence for native reuse.

The current local showcase contains 17 categories, 101 families, and 609 specimens. Its Code to Canvas import is an editable visual reference. Native conversion, registry application, placement, and instance propagation must be inspected and verified before the Figma deliverable is considered complete.

## 23 Testing and acceptance strategy

### 23 1 Mandatory scenarios

| Scenario | Required result | Traceability |
| --- | --- | --- |
| Unauthorized posting and cross-organization ID access | Denied with zero data mutation | AUTH02 JE02 NFR01 |
| Unbalanced journal and empty posting | Rejected before commit | JE01 JE02 ACC02 |
| Duplicate click or network retry | One financial effect and original response | JE03 ACC04 |
| Simultaneous receipts above remaining balance | At most the valid allocation commits | AR03 AR04 DATA03 |
| Partial supplier payment and duplicate bill | Correct AP and cash no duplicate accrual | AP01 AP03 AP04 |
| Void after report date | Earlier report remains historically correct | ACC06 INV04 AP05 |
| Start-date ledger posting and page two | Opening excludes start day running balance continues | GL01 GL04 |
| Credit expense in selected period | Signed total and non-negative donut slices reconcile | DASH03 REP02 |
| Closed-period posting and reopening | Denied or governed and audited | PER01 PER02 |
| Cash transfer and equipment contribution | No fictitious external cash movement | REP04 ACC02 |
| Invoice tax and rounding boundary | Exact centavo totals and balanced journal | INV03 ACC01 |
| Empty search and numbered pagination | Accurate count no phantom page keyboard usable | UX05 UX06 |
| Export with formula-like text and unauthorized download | Safe cells and enforced authorization | NFR09 |
| Storage service failure or process interruption | No partial posting and clear retry outcome | JE03 NFR03 |
| Shared Figma component and token edit | Connected instances update with overrides preserved | DS04 DS07 |

### 23 2 Quality evidence

Unit tests cover money, dates, posting invariants, report reconciliation, historical balances, state derivation, pagination, and design-token definitions. Integration tests cover database transactions, authorization, audit records, idempotency, exports, and period control. End to end tests cover the eight modules and the complete invoice, collection, bill, payment, reversal, and reporting workflows.

Finance acceptance uses a controlled reference ledger with approved expected journals and statements. Security acceptance includes tenant isolation and privilege escalation tests. Accessibility and visual QA cover keyboard and screen-reader behavior, reduced motion, responsive layouts, error recovery, and long or translated values. Operations acceptance includes a restore exercise and incident rehearsal.

The current code baseline has 18 recorded passing automated checks and a successful production bundle build. These checks validate the demonstration and its source definitions; they do not establish production security, database behavior, regulatory suitability, or native Figma completeness.

## 24 Migration and onboarding

**MIG01 P0** Onboarding establishes organization identity, currency, fiscal year, time zone, user roles, account template, numbering, and approved opening balances. A finance owner signs off the opening trial balance before ordinary posting begins.

**MIG02 P0** Any import must offer a dry run, row-level validation, duplicate checks, a reconciliation summary, and a controlled commit or rollback. Reject orphaned accounts, unsupported dates, unbalanced opening entries, and inconsistent customer or vendor balances. Imports must be idempotent.

**MIG03 P0** Never copy localStorage demo records into production automatically. Clearly separate demonstration organizations, seeded records, production records, and test environments. Clearing browser data must not delete server-side production records.

**MIG04 P0** Preserve references and audit attribution during code, account, or product-name migrations. Renaming LedgerFlow identifiers, storage keys, or templates must include an explicit compatibility and rollback plan.

## 25 Delivery plan and release gates

### 25 1 Delivery stages

| Stage | Scope | Exit condition |
| --- | --- | --- |
| A Product and accounting decisions | Requirements finance rules permission model and approved designs | Owners approve unresolved P0 decisions |
| B Production foundation | Identity organization isolation database audit atomic posting and recovery | Security integrity concurrency and restore checks pass |
| C Core accounting workflows | All eight modules server-backed documents receipts payments and reports | Reference ledger and end to end acceptance pass |
| D Controlled pilot | Realistic migration supervised use and monitored period close | Finance sign off user task targets and no critical defects |
| E General availability | Operational ownership support process documentation and production controls | Release checklist approved and rollback verified |

No calendar delivery dates are committed by this PRD. Engineering must estimate stages after decisions, dependencies, and staffing are known. P1 improvements must not postpone unresolved P0 integrity or security work.

### 25 2 Release checklist

- Finance approves posting templates, rounding, account classifications, period policy, and sample expected statements.
- All P0 requirements have passing evidence, and there are no unresolved critical accounting or access-control defects.
- Server persistence, permission enforcement, idempotency, concurrency handling, audit history, backups, and restore are operational.
- Reports reconcile with the ledger and subledgers under normal, historical, void, reversal, and concurrent scenarios.
- User documentation explains draft versus posted behavior, receipt recording versus bank execution, correction workflows, and support escalation.
- Monitoring, access reviews, incident response, migration rollback, and support ownership are assigned.
- The design system is accepted based on native reuse evidence, and production controls meet the approved accessibility target.

## 26 Risks dependencies and decisions

| Risk or dependency | Consequence | Required control or owner |
| --- | --- | --- |
| Prototype mistaken for production | Loss of real records or false security expectations | Product and engineering enforce environment separation |
| Concurrent or retried posting | Duplicate journals or over-allocation | Engineering transactional and idempotency controls |
| Undefined accounting or tax treatment | Incorrect statements or document outputs | Finance approval before affected release |
| Overbroad permissions or tenant leakage | Unauthorized financial access | Security and engineering authorization tests |
| Historical queries use current status | Incorrect prior-period balances | Finance and QA effective-date fixtures |
| Figma visual frames mistaken for reusable components | Inconsistent maintenance and false design completion | Design verifies native types references and propagation |
| White text over light brand colors | Failure of the accessibility target | Design-approved accessible treatment and measured review |
| Backup succeeds but restore fails | Unrecoverable financial records | Operations restore rehearsal and monitored recovery |

### 26 1 Decisions required before production

**DEC01 Product owner** Confirm pilot customer profile, organization model, role defaults, authorized capabilities, and the priority of P1 features.

**DEC02 Finance lead** Approve account templates, fiscal-year behavior, posting dates, period locks, reopens, reversal policy, cash flow mappings, and earnings presentation. Confirm whether overdrafts are permitted.

**DEC03 Finance and compliance owners** Determine applicable invoice content, tax configuration, tax and rounding rules, retention, privacy, and reporting obligations for the intended organizations. No statutory certification or filing functionality is implied by this PRD.

**DEC04 Design and product owners** Resolve brand-label contrast, approve any accessible treatment, complete native Figma conversion, and approve responsive controls without changing established accounting flows.

**DEC05 Engineering and security leads** Select identity, database, hosting, storage, monitoring, and deployment patterns; confirm sizing, recovery targets, support hours, and security release criteria.

**DEC06 Product and finance owners** Decide whether initial production supports bill drafts, multi-invoice allocations, unapplied funds, credit notes, refunds, write-offs, attachments, and actual email delivery. If deferred, the interface must prevent unsupported transactions and clearly explain the boundary.

## 27 Ownership and approval

The product owner owns scope and priorities. The finance lead owns accounting policy and expected results. The design lead owns the UI, accessibility treatments, and native Figma library. Engineering owns architecture, implementation, integrity controls, and migrations. QA owns traceable evidence and defect reporting. Security approves access and data protection. Operations owns deployment, backups, monitoring, and incident readiness.

Approval requires named owners for each role, resolution of P0 decisions, a signed scope baseline, and an accepted release evidence package. Business approval does not substitute for finance, security, or operational acceptance.

## 28 Reference artifacts and glossary

### 28 1 Reference artifacts

- Current application source: outputs/ledgerflow-dashboard/src/App.jsx, Modules.jsx, ModuleForms.jsx, module-ui.jsx, accounting.js, data.js, and useWorkspace.js.
- Accounting and UI verification: accounting.test.js, data.test.js, and design-system catalog, pagination, and foundations tests.
- Brand and component definitions: design-system/tokens.js, foundations.js, catalog.js, and Showcase.jsx.
- Local application: http://127.0.0.1:5173/ and component showcase http://127.0.0.1:5173/design-system while the development server runs.
- Existing Figma file: https://www.figma.com/design/gh7vwF03d8QO7g2JDFjriB
- Imported editable showcase: https://www.figma.com/design/gh7vwF03d8QO7g2JDFjriB?node-id=423-15
- Native conversion requirements and current handoff: outputs/ledgerflow-dashboard/DESIGN_SYSTEM_HANDOFF.md and work/design-system-state-20261028.json.

### 28 2 Glossary

| Term | Meaning |
| --- | --- |
| Posted journal | Validated immutable record that changes the ledger |
| Draft | Editable preparation record excluded from balances |
| Control account | General Ledger account reconciled to a managed subledger such as AR or AP |
| Subledger | Document and allocation detail supporting a control-account balance |
| Accrual basis | Recognition based on the effective accounting event rather than only cash movement |
| As of date | Inclusive accounting date used to reconstruct balances and aging |
| Reversal | Linked offsetting posting that preserves original history |
| Void | Controlled source-document cancellation with a dated financial offset when already posted |
| Idempotency | Retrying the same request does not create an additional financial effect |
| Native component | Actual Figma Component or Component Set supporting reusable instances |
| Shared style | Registered Figma style referenced by elements rather than a visual specimen |
| Variable binding | A property linked to a native reusable token whose edits can propagate |
