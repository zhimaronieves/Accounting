> **Latest status:** The editable Code to Canvas gallery was successfully imported after direct approval. Imported frame: https://www.figma.com/design/gh7vwF03d8QO7g2JDFjriB?node-id=423-15. This is a raw editable-frame capture; native component sets, semantic style registration and instance integration are still pending. Earlier blocked-import notes below are historical.
# booksdotnet — Design System & Components

## Delivery status — 28 October 2026

The React showcase is implemented at **http://127.0.0.1:5173/design-system**.

- 17 requested categories, 101 component families, 609 documented specimens.
- Actual locally bundled Poppins 400/500/600, supplied booksdotnet logo, #559CDA, approved gradient, white active navigation and blue-button labels.
- Six button styles × three sizes × six states, icon variants, 96 field specimens, selectors, navigation, cards, tables, overlays, feedback, controls, pagination and accounting compositions.
- Working React playground: form validation, checkbox, toggle, tabs, accordion, action menu, native confirmation modal, toast, table search and export.
- Shared code: application and showcase use `design-system/Button.jsx`; playground reuses the existing `DataTable`, `Badge`, and `Modal`. No accounting records or user flows were changed.

**No Figma library has been imported, built, or connected in this task.** The connected file is still the intended destination: https://www.figma.com/design/gh7vwF03d8QO7g2JDFjriB

Two independent blockers were established:

1. Figma's Starter-plan MCP limit blocks native library reads/writes after one initial inspection. No repeated restricted native calls were attempted after this was established.
2. Automatic approval review rejected Code to Canvas twice, citing the previous code-first/no-paste instruction and requiring trusted confirmation for the external mutation. No browser, plugin, or indirect import was used to bypass that rejection.

An initial read confirmed the original page `Login` (`0:1`), Login frame `7:188`, Dashboard frame `36:15`, and existing `LedgerFlow / Colors` collection. Existing screens remain untouched. The Community reference could not be opened by the web tool; organization follows the detailed 17-category inventory in the brief rather than an unverified copy of that kit.

## Source and maintenance

- `src/design-system/tokens.js`: brand colors, typography scale, spacing, radii, dimensions and button state colors.
- `src/design-system/tokens.css`: generated CSS custom properties corresponding to export syntax.
- `src/design-system/catalog.js`: the single declarative inventory used by both rendering paths.
- `src/design-system/Showcase.jsx`: editable code gallery and live playground.
- `scripts/build-figma-library.mjs`: packages catalog, supplied brand image, and 36 Lucide SVGs for the native builder.
- `scripts/figma-library-runtime.js`: proposed native Figma construction logic.
- `figma-library-builder/inventory.json`: full family and variant naming inventory.

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run prepare:figma-library
```

The showcase is lazy loaded; it does not add its gallery code to the accounting app's initial bundle. The existing Recharts bundle-size advisory remains.

## Finish the Code to Canvas transfer — after explicit confirmation

1. Capture only `/design-system` into existing file `gh7vwF03d8QO7g2JDFjriB` using `generate_figma_design`.
2. Create exactly one new page and name it **Design System & Components**. Do not use the existing Login page as the capture parent. Do not create a new file.
3. Verify text, SVG icons, shapes, and nested layouts remain editable. A captured visual gallery is not proof of native component sets, variables or instance links.
4. Inspect the imported page's layout, type, bounds and section count. Leave both existing screens and their current overrides intact.

The `data-h2d-ignore` live playground is intentionally excluded from the static capture: the deterministic specimens are the Figma source. React application logic does not automatically become Figma prototype logic.

## Native Figma builder — prepared, not executed or Figma-verified

The local builder is an optional continuation for native operations when available. Its JavaScript passes syntax checks; the actual Figma runtime, layout, property bindings, and prototypes have **not** been executed or verified. Do not describe the output as a completed native library before running and auditing it.

After approval to modify the file:

1. In Figma Desktop, create a local development plugin and retain the Figma-assigned plugin ID. Figma assigns plugin IDs; the supplied manifest's `REPLACE_WITH_FIGMA_ASSIGNED_PLUGIN_ID` is deliberately a placeholder. See [Figma's manifest documentation](https://developers.figma.com/docs/plugins/manifest/).
2. Run `node scripts/build-figma-library.mjs YOUR_FIGMA_ASSIGNED_PLUGIN_ID`, or copy the generated `code.js` into the plugin folder and use its legitimate manifest with `documentAccess: dynamic-page` and no network permissions.
3. First rename the Code to Canvas import page to **Design System & Components**. The builder reuses exactly that page; if it is absent it creates one. Do not run it against an unnamed import page and accidentally leave an extra page.
4. Run the plugin in the intended file. It is designed to create semantic variables aliased to primitives, scoped variables with WEB syntax, Poppins text styles, elevation style, editable Lucide icon components, variant sets, exposed label/icon properties, and gallery instances. Main definitions live to the right of the review frame on the same page.
5. Review its reported IDs/counts, warning list, and all 17 sections. Confirm text and shapes are editable, variants are separated, properties work, variables are bound, and no samples overflow.
6. Test hover/pressed/focus, selection, open/closed, and expansion Change-to links. These are proposed component-state interactions, not a substitute for accounting app business logic.
7. Only after the native gallery passes QA, remove the now-redundant Code to Canvas reference frame. Do not remove any pre-existing Login or Dashboard nodes. The builder deliberately performs no deletion.

The builder refuses to duplicate a completed native gallery. If a failure leaves a partial build, inspect it and the error before retrying. No successful native result is assumed from the source code alone.

## Existing-screen instance integration — pending

No existing screen node has been replaced. This is a separate operation requiring available native Figma editing and visual verification.

| Existing UI | Proposed reusable component | Preserve |
| --- | --- | --- |
| Sign In / primary actions | Button / Primary | Exact size, position, label, icon visibility, existing paint and typography overrides, prototype targets |
| Text, password, search and money fields | Input / corresponding type | Value, placeholder, helper/error copy, dimensions and current styles |
| Sidebar items and top navigation | Navigation / Sidebar item; Top bar | Active module, labels, original coordinates, nested layouts and menu targets |
| KPI and content cards | Card / KPI; Standard | Values, deltas, content and current spacing |
| Transactions | Table / Header; Row; Cell | All row text, financial values, widths, alignment, status and actions |
| Date filter, notifications, profile | Select / Date picker; Notification / Dropdown; Navigation / User profile | Current selected period, state, content and prototype behavior |
| Overlays | Dialog / corresponding type | Labels, destructive intent, default focus and actions |

The existing Figma screens predate the current booksdotnet/Poppins app branding. Replacing components without explicit style overrides could redesign them; retain their current appearance while connecting or leave the node pending until it can be audited.

## Verification evidence

- 18 tests passed: accounting reconciliation, posting safeguards, subledgers, historical balances, catalog identity/axis coverage, all button size-state combinations, white primary labels, and export token/geometry validation.
- Vite production build passed.
- Browser: all 17 sections and 591 specimens render; Poppins loads; no broken images or overflowing desktop preview cells; no console errors.
- Browser interaction checks passed for toggle, tab, confirmation dialog, toast and filtered table.
- Existing app: Chart of Accounts loads with retained sample balances; New account opens and closes normally after shared-button extraction.
- Figma verification remains pending. Do not infer native component or prototype success from the browser tests.

## Component refinements

Added outlined icon-only buttons in all three sizes and six states. Outline button borders, labels, and icons use the neutral gray token. Shared numbered pagination replaces fractional page indicators in both dashboard transactions and module tables; it supports first/last boundaries, empty records, direct page selection, and bounded ellipses for large page counts. Input values flex to reserve trailing icons at the right padding in both React and the prepared native builder. All changes in this refinement are local code; Figma has not been modified.


## Native styles and variables — requested extension

Status: **prepared source only; zero new Figma registrations or bindings verified**. A fresh native-access check again returned the Starter-plan MCP limit. No additional native calls were made after that result.

`src/design-system/foundations.js` and `figma-library-builder/style-registry-plan.json` define:

- 25 semantic Color roles, including Color/Text/Primary, Color/Background/Surface, Color/Border/Default, semantic feedback, and interactive treatments. Semantic variables alias the existing source palette with explicit scopes and WEB code syntax.
- Actual Paint Style registration logic. Identical solid paint definitions are reused, and semantic Color variables remain independently addressable for role-specific changes.
- 24 Text roles covering display, page heading, H1–H6, body sizes, labels, captions, buttons, table headers/cells/amounts, helper/validation copy, dialog title and metrics. These resolve to 16 distinct role definitions; identical properties share one registered style and an explicit alias map rather than duplicate styles. Each includes Poppins family, size, weight, pixel line height and pixel letter spacing. Additional unique utility styles cover specimen-only typography.
- Three Effect definitions: source dropdown/popover shadows, source modal shadow, and a focus ring. Cards remain flat. Dropdowns and popovers share their identical effect definition.
- The existing spacing, radius, component dimension, border-width, and font variables remain included. Only the supported Light theme is planned.

The builder applies native Text Styles, semantic color variables, spacing/radius/border bindings, gradient-stop variables and Effect Style IDs to components that it constructs. It avoids node-level font-variable overrides that would prevent a shared Text Style edit from propagating. Existing styles are reused by name or matching properties and are not overwritten merely because code differs; role aliases report the resolved IDs.

If a completed native gallery already exists, registration source preserves it and reports that old bindings require an audit. It does **not** silently restyle existing screens or claim to connect their elements. Existing-screen application, visual comparison, instance replacement, and change-propagation tests are still pending native access.

After running the native operations, verify actual registered Paint/Text/Effect styles, variable collections/scopes/aliases, style IDs and bound-variable IDs on representative components and screens. Then change a shared style and a variable, confirm all intended references update, and undo the temporary changes. Code tests and syntax checks are not substitutes for that Figma validation.
