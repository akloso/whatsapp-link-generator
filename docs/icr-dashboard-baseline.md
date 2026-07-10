# ICR Trends Dashboard — Phase 0 Baseline

## 1. Prototype path, checksum, and size

- **Confirmed working branch:** `work` (the local repository contains only `work`; Git cannot create a branch with literal spaces such as `improve generator ui`).
- **Pull result:** no remote is configured in this checkout, so there was nothing to pull. Branch inspection showed no `origin/*` refs.
- **Prototype path:** `icr-intelligence-dashboard.html`.
- **Initial SHA-256:** `9b5b80b6f3687c16dc6c17b40faba28e862cf1a14317fd8423101e0538040bde`.
- **Size:** 130,639 bytes.
- **Entire file inspected:** yes; the file has 507 lines and the analysis covered the HTML, CSS, and JavaScript sections end-to-end.
- **Prototype file safety:** `git diff -- icr-intelligence-dashboard.html` remained empty and the final checksum matched the initial checksum.

## 2. External dependencies

| Library | Version | Primary CDN | Fallback CDN | Runtime behavior |
|---|---:|---|---|---|
| Chart.js | 4.4.7 | `https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js` | `https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.7/chart.umd.min.js` | Required for demo load and chart rendering. Demo load stops with a toast if `window.Chart` is missing. |
| SheetJS / xlsx | 0.18.5 | `https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js` | `https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js` | Required for workbook parsing and Clean CSV export. Upload stops with a toast if `window.XLSX` is missing. |

- Internet is required unless both CDN assets are cached by the browser. The prototype itself is standalone and can be opened through `file://`, but CDN scripts still require network/cache.
- No other external assets were found; styling, markup, and JavaScript are inline.

## 3. HTML structure inventory

- Fixed shell with sidebar navigation, topbar actions, upload strip, empty state, dashboard content, column-mapping modal, customization drawer, processing overlay, and toast.
- Views:
  - `reportView`: executive report, KPI cards, charts, insights, account-priority table, and custom charts.
  - `clientView`: client selector empty state plus full client-intelligence report.
  - `qualityView`: parser/data-quality statistics and validation table.
- Important IDs: `sidebar`, `mobileMenu`, `reportTitle`, `mappingBtn`, `settingsBtn`, `exportCsvBtn`, `printBtn`, `fileName`, `fileStats`, `sheetSelect`, `fileInput`, `demoBtn`, `clearDataBtn`, `dashboard`, `clientFilter`, `ragFilter`, `ownerFilter`, `rangePreset`, `fromDate`, `toDate`, `latestOnly`, `selectedRange`, `filterCount`, `executiveHeadline`, `executiveSummary`, `summaryChips`, `portfolioScore`, `kpis`, `accountTable`, `clientReportName`, `clientKpis`, `clientFindings`, `qualityStats`, `qualityTable`, `mappingModal`, `mappingRows`, `settingsDrawer`, `chartToggles`, `customFieldSelect`, `processingOverlay`, and `toast`.

## 4. CSS structure inventory

- Single inline stylesheet using CSS custom properties: `--bg`, `--panel`, `--panel-2`, `--muted`, `--text`, `--line`, `--accent`, `--accent-rgb`, `--good`, `--warn`, `--bad`, `--shadow`, and `--radius`.
- Main selector groups: reset/body, application shell, sidebar/nav, topbar/upload strip, buttons/forms, empty state, filters, report panels, responsive grid, score ring, KPI cards, charts, insights, tables, RAG badges, client-intelligence blocks, modal/drawer, processing overlay, toast, responsive breakpoints, and print rules.
- Responsive behavior is CSS-driven. At smaller widths the sidebar is transform-hidden until `.open` is toggled by the mobile menu.
- Print behavior is implemented by `@media print`, hiding sidebar/topbar/upload/filters/drawer/modal/toast and expanding printable content. `@page` requests landscape orientation.

## 5. JavaScript structure inventory

### Constants and state

- `FIELD_DEFS`: 29 canonical fields with keys, labels, aliases, required flags, and parser hints.
- `FIELD_BY_KEY`: lookup by field key.
- `CHART_LABELS`: 9 built-in chart labels.
- `defaults`: report title, accent, thresholds (`unassigned:20`, `untouched:35`, `overdue:12`, `adoption:55`), chart visibility, and `customCharts: []`.
- `CLIENT_METRICS`: 36 metric definitions grouped for client intelligence.
- `DEMO_ROWS`: 6 synthetic snapshots for `Northstar Academy (Demo)` from 2026-01-15 through 2026-06-15.
- Global state: `config`, `workbook`, `rawRows`, `headers`, `mapping`, `parsed`, `periodRows`, `filtered`, `charts`, `customCharts`, `sourceName`, and `activeView`.

### Function inventory and React extraction notes

| Function(s) | Responsibility | Inputs/outputs | State/DOM/API dependencies | Pure TS candidate | Future module | Required tests |
|---|---|---|---|---|---|---|
| `parseDate`, `tokenNumbers`, `parseNum`, `parsePair`, `normalizeRag`, `canonicalClient` | Normalize dates, numeric cells, pair cells, RAG, and client keys. | Raw values to typed primitives/objects. | None except `Date` and regex. | Yes | `logic/dateParsing.ts`, `logic/numberParsing.ts`, `logic/normalize.ts` | Mixed date formats, Indian/US dates, pair ambiguity, NA handling, RAG synonyms. |
| `similarity`, `headerMatchScore`, `autoMap`, `reconcileSavedMapping` | Match uploaded headers to canonical fields. | Header arrays and saved mappings to mapping object. | Reads `FIELD_DEFS`, `FIELD_BY_KEY`; saved mapping may contain uploaded headers. | Mostly | `logic/columnMapping.ts` | Exact alias, fuzzy match thresholds, duplicate field prevention, saved mapping reconciliation. |
| `detectCustomNumericHeaders`, `parseRows`, `addIssue` | Convert raw workbook rows into normalized row records and validation issues. | Raw rows + mapping to `{result, issues}`. | Reads field definitions, custom-header detection. | Yes | `logic/rowParser.ts` | Required missing values, warning rows, custom metrics, health/recommendation assignment. |
| `ratio`, `avg`, `median`, `sum`, `healthScore`, `recommendation` | Core metric calculations and recommendations. | Parsed row metrics to numbers/strings. | Reads `config.thresholds`. | Yes if thresholds passed in | `logic/metrics.ts` | Threshold edges, null metrics, health score clamps, recommendation precedence. |
| `latestByClient`, `linearSlope`, `stddev`, `trendInfo`, `volatilityInfo`, `metricRisk`, `metricAnalysis`, `correlation`, `topWords`, `fieldAnalysis`, `clientFindings` | Portfolio and client analytics. | Parsed rows to findings, trends, risks. | Some read `config.thresholds`; no DOM. | Yes with dependency injection | `logic/trends.ts`, `logic/diagnostics.ts` | Trend direction, volatility bands, correlation nulls, text stop words, finding order. |
| `inspectWorksheet`, `chooseBestWorksheet`, `handleWorkbook`, `loadSheet` | Workbook inspection, sheet scoring, reading workbook data. | File/workbook/sheet name to rows/mapping. | `XLSX`, `FileReader`, DOM updates, localStorage. | Split: worksheet scoring pure, IO browser-dependent | `services/workbookReader.ts`, `logic/worksheetDetection.ts` | Sheet scoring, multi-sheet recommendation, 50k row cap, XLSX missing behavior. |
| `generateFromMapping`, `requiredMappingsReady`, `hasDateMapping` | Apply mapping, persist aliases, parse rows, show dashboard. | Mapping UI + raw rows to parsed dashboard state. | DOM, localStorage, performance, processing overlay. | Split | `hooks/useIcrDashboardReducer.ts`, `logic/rowParser.ts` | Required mappings, duplicate mapping rejection, alias persistence exclusion policy. |
| `rowsForDateBounds`, `dateBounds`, `updateDateBounds`, `applyRangePreset`, `updatePeriodLabels`, `filterData`, `makeFilters`, `clientRowsInRange` | Date/rag/owner/client filtering. | Parsed rows + filter state to period/filtered rows. | DOM form controls; modifies globals. | Yes when state is explicit | `logic/filters.ts`, `components/ReportFilters.tsx` | All/latest/custom presets, latest snapshot behavior, invalid ranges. |
| `renderAll`, `renderHero`, `renderKpis`, `renderCharts`, `renderInsights`, `renderTable`, `renderQuality`, `renderClientIntelligence`, `renderMetricTable`, `renderFieldRegister`, `renderStatusGrid`, `renderAdvancedDiagnostics`, `renderCustomCharts` | Render report views and charts. | Parsed/filtered rows to DOM/Chart.js output. | Heavy DOM, Chart.js. | No; calculations can be extracted | Report components and `IcrChartCard.tsx` | Snapshot/component tests, chart prop generation tests, empty states. |
| `showProcessing`, `updateProcessing`, `hideProcessing`, `toast`, `setActiveView`, `buildMappingRows`, `applyMapping`, `clearAllData`, `loadDemo`, `showDashboard`, `openSettings`, `applyConfigToUi`, `applyTheme`, `applyChartVisibility`, `collectSettings` | UI workflow, modal/drawer, demo, settings, cleanup. | UI events to state/DOM effects. | DOM, localStorage, confirm, Chart destruction. | Mostly no | Components/hooks | Modal keyboard, settings persistence, clear-data state reset, theme update. |
| `download`, `exportCleanCsv` | Blob downloads and clean CSV export. | Data rows to downloaded CSV/JSON. | `Blob`, `URL`, anchor click, `XLSX.utils`. | CSV row shaping is pure; download is browser-dependent | `services/csvExport.ts`, `components/ExportControls.tsx` | Filename, MIME, column order, CSV injection, null/boolean formatting. |

## 6. Runtime baseline: fictional demo

Runtime method: static source inspection plus a Node VM execution of the prototype's own pure parsing/calculation functions with DOM, Chart, and localStorage stubs. After review feedback, `playwright` was installed with `npm install --no-save playwright@latest`, but browser installation failed because `npx playwright install chromium` was blocked by the environment with `403 Domain forbidden` from `cdn.playwright.dev`; screenshots therefore remain unavailable in this container.

### File state

- Displayed filename after demo: `Northstar Academy (Demo)`.
- File statistics: `1 fictional account · 6 dated snapshots · synthetic numbers`.
- Source rows: 6.
- Detected accounts: 1.
- Available date range: Jan 15, 2026 – Jun 15, 2026.
- Selected date range: all available dates on initial demo load.
- Latest Snapshot checkbox: unchecked by `loadDemo()`.

### Exact demo row/calculation baseline

| Date | RAG | Health | Leads | Subscribed | Unassigned | Untouched | Overdue | Widgets | Users | Raw data | Tickets | METS |
|---|---|---:|---:|---:|---:|---:|---:|---|---|---:|---:|---:|
| 2026-01-15 | Red | 10 | 2,800 | 10,000 | 960 | 1,400 | 520 | 1/3 | 4/8 | 5,000 | 12 | 18,000 |
| 2026-02-15 | Amber | 42 | 3,900 | 10,000 | 760 | 1,100 | 460 | 1/3 | 5/8 | 7,200 | 9 | 16,500 |
| 2026-03-15 | Amber | 65 | 5,100 | 10,000 | 420 | 720 | 280 | 2/3 | 6/8 | 11,000 | 6 | 14,800 |
| 2026-04-15 | Green | 95 | 6,500 | 10,000 | 210 | 380 | 160 | 3/3 | 7/8 | 16,500 | 4 | 13,100 |
| 2026-05-15 | Green | 99 | 7,800 | 10,000 | 95 | 180 | 72 | 3/3 | 8/8 | 22,000 | 2 | 11,400 |
| 2026-06-15 | Green | 100 | 9,100 | 10,000 | 22 | 60 | 30 | 3/3 | 8/8 | 28,500 | 1 | 9,800 |

Latest snapshot values:

- Client: `Northstar Academy (Demo)` / `DEMO-001`.
- Owner: `Demo CS Owner`; manager: `Demo Manager`.
- RAG: Green.
- Health score: 100.
- Recommendation: `Maintain cadence and validate next-quarter opportunity`.
- Lead utilisation: 91%.
- Unassigned rate: 0.24%.
- Untouched rate: 0.66%.
- Overdue rate: 0.33%.
- Widget adoption: 100%; user adoption: 100%; raw-data utilisation: 57%.
- Latest action: `Prepare QBR and formalise expansion proposal`.
- Opportunity: `AI voice pilot and renewal expansion`.

Expected KPI cards are generated from latest/filtered portfolio state: portfolio health, clients reviewed, critical accounts, lead utilisation, unassigned leads, untouched leads, overdue follow-ups, product adoption, and communication usage. For this demo portfolio the key values resolve to one account, 100/100 latest portfolio health, 0 critical accounts, 91% lead utilisation, 22 unassigned leads, 60 untouched leads, 30 overdue follow-ups, 100% widgets/users, and latest channel usage of 2,950 email, 920 SMS, and 2,460 WhatsApp credits consumed.

## 7. Chart baseline

| Chart | Type | Labels | Datasets / demo values | Sorting/filter behavior |
|---|---|---|---|---|
| Lead capacity and utilisation | Horizontal bar | `Northstar Academy...` | Captured leads 9,100; subscribed capacity 10,000 | Latest rows by client, sorted by lead utilisation and sliced to top 12. Respects filters. |
| Account health mix | Doughnut | Green/Amber/Red/Unknown | Latest demo = Green: 1, Amber: 0, Red: 0, Unknown: 0 | Latest rows by client. Respects filters. |
| Lead volume trend | Line | Jan–Jun 2026 months | Leads: 2,800, 3,900, 5,100, 6,500, 7,800, 9,100; capacity 10,000 each month | Uses period rows, grouped by month. Respects date filters. |
| Operational risk matrix | Scatter | Account point | x=unassigned rate, y=untouched rate, latest point approx 0.24% / 0.66% | Latest rows; higher-right is riskier. Respects filters. |
| Operational burden by account | Stacked horizontal bar | Account | Unassigned 22; untouched 60; overdue 30 | Latest rows sorted by combined backlog. Respects filters. |
| Product adoption coverage | Bar | Widgets, Users, Raw data | Widgets 100%, users 100%, raw data 57% | Average latest-row ratios across filtered accounts. |
| Communication activity | Bar | Email, SMS, WhatsApp, NIAA | 2,950; 920; 2,460; 165 consumed | Latest-row consumed counts summed across filtered accounts. |
| Health-score distribution | Bar | 0–39, 40–69, 70–84, 85–100 | Latest demo = 85–100: 1 | Latest rows. |
| Recurring action themes | Bar | Top words | Demo themes include automation, counsellor, licences, widget, allocation, voice, pilot, QBR | Text extracted from opportunity/actionable fields, stop words removed. |
| Custom numeric charts | Bar or line | Custom field/client labels | No custom numeric charts by default; `METS Balance` is mapped as a known metric, not custom. | User-added custom numeric specs are sorted descending, sliced to 12, then reversed for horizontal display. |

## 8. Client Intelligence baseline

Selecting `Northstar Academy (Demo)` should show:

- Heading: `Northstar Academy (Demo)`.
- Summary: complete analysis of 6 review snapshots from Jan 15, 2026 to Jun 15, 2026, preserving populated inputs in the field register.
- Health score: `100`.
- RAG badge: `Green`.
- Banner metadata: client ID `DEMO-001`, owner `Demo CS Owner`, latest review `Jun 15, 2026`, health change `+90`.
- KPI cards: Review snapshots `6`; Latest RAG `Green`; Lead utilisation `91%`; Unassigned `22`; Untouched `60`; User adoption `100%`.
- Prioritised findings: current calculated health is 100/100; unassigned lead rate 0%; untouched lead rate 1%; product adoption signal; commercial opportunity recorded; latest committed action.
- Numerical metric count: 36 client metrics.
- Populated source-field count: 29 mapped source columns for demo.
- Status cards: tracking code placed, flow healthy, modules not utilised shows `NA`, unassigned reason captured, owner and manager captured.
- Advanced diagnostics: trend, volatility, correlation, and contradiction checks render from client history.

## 9. Data Quality baseline

- Parser confidence: 100% for all six demo rows.
- Mapped columns: 29.
- Total columns: 29.
- Warning count: 0.
- Missing mapped-value percentage: 0% for the synthetic demo rows.
- Unmapped columns: 0.
- Validation table: should show mapped fields with source column, parser status, missing count/percentage, and sample values; no row-level warnings expected for demo.

## 10. Interaction results

| # | Test | Classification | Notes/defects |
|---:|---|---|---|
| 1 | View demo account | Working | `loadDemo()` seeds six rows and renders dashboard. |
| 2 | Executive Report tab | Working | `setActiveView('reportView')` toggles active view. |
| 3 | Client Intelligence tab | Working | Empty state until a client is selected. |
| 4 | Data Quality tab | Working | Renders quality stats/table. |
| 5 | Select demo client | Working | Client report renders six snapshots. |
| 6 | Change RAG filter | Working | Updates date bounds and filtered data. |
| 7 | Change CS owner filter | Working | Owner options derive from parsed rows. |
| 8 | Change date preset | Working | Presets set from/to fields and filter. |
| 9 | Set custom date range | Working | Date inputs set preset to custom and filter. |
| 10 | Toggle Latest client snapshot | Working | Filters to latest per client when checked. |
| 11 | Open Column Mapping | Working | Builds mapping rows and opens modal. |
| 12 | Close Column Mapping | Working | Close button hides modal. |
| 13 | Reset automatic mapping | Working | Re-runs `autoMap(headers)`. |
| 14 | Apply mapping | Working | Parses rows and persists alias mapping. |
| 15 | Open Customize | Working | Opens settings drawer. |
| 16 | Change report title | Working | Live-updates title, persists on save. |
| 17 | Change accent colour | Working | Updates CSS variables. |
| 18 | Change risk thresholds | Working | Recalculates health/recommendations on save. |
| 19 | Hide/show charts | Working | Chart panels toggle via config. |
| 20 | Add custom chart | Partially working | Works only when extra unmapped numeric fields exist; default demo has none. |
| 21 | Remove custom chart | Working when present | Remove button splices config and re-renders. |
| 22 | Save settings | Working | Writes `icrConfig`. |
| 23 | Reset settings | Working | Removes `icrConfig`; does not clear alias mapping. |
| 24 | Export template | Working with caveat | Includes mapping and can expose uploaded source column names. |
| 25 | Import valid template | Working | Merges config/mapping and re-applies if data loaded. |
| 26 | Import invalid template | Partially working | Invalid JSON is caught; structurally dangerous JSON is not sanitized. |
| 27 | Clear data | Working | Clears workbook data and removes `icrAliasMapping`; leaves `icrConfig`. |
| 28 | Reload demo | Working | Re-seeds synthetic rows. |
| 29 | Escape while modal open | Working | Hides mapping modal. |
| 30 | Escape while drawer open | Working | Hides settings drawer. |
| 31 | Mobile navigation | Working/needs visual QA | JS toggles sidebar `.open`; no browser screenshots captured. |
| 32 | Click account-priority row | Working | Sets client filter and opens client view. |

## 11. LocalStorage behavior

| Key | Structure | Read | Written | Removed | Risk |
|---|---|---|---|---|---|
| `icrConfig` | Report config: title, accent, thresholds, chart visibility, custom chart specs. | At startup by `loadConfig()`. | `saveConfig()` after settings save or custom chart changes. | Reset settings only. | Can contain custom chart field names from uploaded workbooks; title may reveal company/report context. |
| `icrAliasMapping` | Object keyed by uploaded header names, values include canonical field key/status/score. | `loadSheet()` before reconciliation. | `generateFromMapping()`. | `clearAllData()`. | High: contains uploaded source column names/workbook schema and should not persist in React unless user explicitly exports a local template. |

Persistence test expectations:

1. Load demo: `icrAliasMapping` is written after generation; `icrConfig` remains default unless settings saved.
2. Change settings and refresh: `icrConfig` persists title/accent/thresholds/chart visibility/custom charts.
3. Clear data: removes `icrAliasMapping` but leaves `icrConfig`.
4. Reset settings: removes `icrConfig`; does not remove `icrAliasMapping` unless clear data was also used.

## 12. Export results

### Clean CSV

- Filename: `icr-cleaned-data-<fromDate-or-start>-to-<toDate-or-end>.csv`.
- MIME type: `text/csv;charset=utf-8`.
- Download mechanism: `Blob` + `URL.createObjectURL()` + temporary anchor click + delayed revocation.
- Export source: `filtered` rows when non-empty, otherwise all parsed rows.
- Columns: `review_date`, `client_name`, `client_id`, `rag`, `health_score`, `leads_captured`, `leads_subscribed`, `lead_utilisation`, `unassigned_leads`, `unassigned_applications`, `untouched_leads`, `overdue_followups`, `active_widgets`, `subscribed_widgets`, `active_users`, `subscribed_users`, `dtc_placed`, `cs_owner`, `cs_manager`, `tickets`, `mets_balance`, `health_recommendation`, `data_confidence`.
- Row count for full demo: 6.
- Date format: ISO `YYYY-MM-DD`.
- Boolean format: JavaScript boolean values are passed to SheetJS; expected CSV output is `TRUE`/`FALSE` or stringified boolean depending SheetJS behavior.
- Missing values: empty strings.
- Formula-injection protection: none observed; fields are not prefixed/escaped for cells beginning with `=`, `+`, `-`, or `@`.

### Template export/import

- Filename: `icr-report-template.json`.
- Structure: `{ "version": 1, "config": { ... }, "mapping": { ... } }`.
- Version: `1`.
- Exposes uploaded source column names through `mapping` keys.
- Valid template import merges `config` with defaults and assigns `mapping` directly.
- Invalid JSON is caught and reports `Invalid template file`.
- Empty object and unexpected fields are accepted without schema validation.
- `__proto__`, `constructor`, and `prototype` keys are not explicitly blocked; React migration should validate and sanitize imported JSON.

### Print/PDF

- Export PDF uses `window.print()`.
- Print opens the browser print dialog in a real browser.
- Print CSS hides navigation/controls and requests landscape.
- Active view behavior: only non-hidden DOM content should print cleanly; because hidden views remain in DOM, this requires browser verification during migration.
- Charts are canvas-based; print capture depends on browser canvas printing support.
- Wide tables may require landscape and may clip if table wrappers are not handled by print CSS.

## 13. Responsive findings

Browser screenshots could not be captured even after installing the Playwright package, because the required Chromium browser download was blocked by the environment (`403 Domain forbidden` from `cdn.playwright.dev`). The following findings are source/CSS based:

- 320/360/390/430px: sidebar becomes off-canvas; mobile menu toggles `.open`. Tables use horizontal overflow containers, which is acceptable. Risk areas are topbar action wrapping, dense filter/date controls, mapping modal width, and drawer usable height.
- 768px: grid collapses to fewer columns; charts and tables should remain usable.
- 1024px: sidebar and dashboard grids should fit, but table width still scrolls inside wrappers.
- 1440px: intended desktop layout with 12-column grid and side navigation.
- Acceptable horizontal scrolling: account table, metric table, field register, quality table.
- Potential broken page-level overflow to verify: mapping modal at 320px, settings drawer at 320px, chart canvases inside nested grid.

## 14. Prototype bug register

| Priority | Area | Reproduction | Expected | Actual | Likely cause | Migration impact | Must fix? |
|---|---|---|---|---|---|---|---|
| High | Security/export | Export CSV with uploaded text beginning `=`, `+`, `-`, `@` | Spreadsheet-safe cells | No formula-injection guard | Raw values passed through SheetJS | Security issue in React export | Yes |
| High | Template import | Import JSON containing `__proto__`, `constructor`, or `prototype` | Reject/sanitize dangerous keys | No explicit sanitization/schema validation | Direct object merge/assignment | Prototype pollution/config corruption risk | Yes |
| High | Privacy | Upload workbook, map columns, inspect localStorage | No workbook-derived schema persists by default | `icrAliasMapping` stores source headers | Convenience alias cache | Potential client/schema leakage | Yes |
| Medium | Dependency resilience | Block Chart.js CDN and load demo | Graceful non-chart fallback | Demo cannot load; toast only | Hard dependency on Chart.js | React should lazy-load/fallback | Recommended |
| Medium | Export robustness | Click Clean CSV before SheetJS loaded | Graceful fallback/export disabled | Export depends on `XLSX.utils` | SheetJS is global dependency | Add guard and tests | Yes |
| Medium | Mobile UX | Open mapping/settings at 320px | Fully usable no page overflow | Needs visual verification; modal/drawer likely tight | Dense fixed components | Could hurt mobile launch quality | Verify/fix |
| Low | Settings reset | Clear data vs reset settings | Clear privacy-sensitive settings as expected | Clear data leaves report config; reset leaves aliases if data not cleared | Separate concerns | Documented behavior; decide product policy | Decide |
| Low | Branch naming | Requested branch with spaces | Exact branch should be visible | Local checkout only has `work`; spaces invalid as Git branch literal | Harness branch abstraction | Reporting only | No |

## 15. Security findings

- No server upload occurs; workbook processing is local in browser.
- CDN dependencies execute third-party code and require network/cache unless bundled in React later.
- `innerHTML` is used extensively; most data interpolation goes through `escapeHtml`, but migration should prefer React rendering rather than string HTML.
- Template import lacks schema validation and dangerous-key filtering.
- CSV export lacks formula-injection protection.
- localStorage can persist uploaded headers and custom field names.
- No authentication or authorization exists in prototype; do not add it in Phase 1 unless separately scoped.

## 16. Source-to-React extraction map

| Destination file | Prototype moved/replaced | Responsibility | Inputs/outputs/types | Pure/browser | Phase | Required tests |
|---|---|---|---|---|---|---|
| `IcrTrendsDashboardPage.tsx` | Page shell around full prototype | Route page wrapper only | None -> JSX | Browser | 1 | Route render smoke. |
| `IcrDashboard.tsx` | Main shell, global orchestration, empty/dashboard states | Own dashboard reducer, compose components | `IcrDashboardState`, events | Browser | 1 | Demo load flow, view switching. |
| `IcrDashboard.css` | Inline `<style>` selectors | Scoped dashboard styles | CSS classes/vars | Browser | 1 | Visual/responsive regression. |
| `types.ts` | Row/mapping/config shapes | Shared types | `FieldDef`, `ParsedRow`, `IcrConfig`, `MappingEntry` | Pure | 1 | Type compilation. |
| `constants/fieldDefinitions.ts` | `FIELD_DEFS`, `FIELD_BY_KEY`, `CLIENT_METRICS`, `CHART_LABELS`, defaults | Canonical schema | constants | Pure | 1 | Snapshot constants. |
| `services/workbookReader.ts` | `handleWorkbook`, `loadSheet` IO portions | Read XLSX/CSV files | `File` -> workbook/rows | Browser/SheetJS | 2 | Workbook fixtures, no library guard. |
| `services/csvExport.ts` | `exportCleanCsv`, `download` | Clean CSV generation/download | rows+filters -> Blob | Split | 2 | Filename, row count, injection guard. |
| `logic/normalize.ts` | `normalizeRag`, `canonicalClient`, `safe`, `nkey`, `isMissing` | String normalization | unknown -> strings/keys | Pure | 1 | Synonyms, missing tokens. |
| `logic/dateParsing.ts` | `parseDate`, `displayDate`, `isoDate` | Date parsing/display | unknown -> Date/string | Pure | 1 | Formats/time zones. |
| `logic/numberParsing.ts` | `tokenNumbers`, `parseNum`, `parsePair`, `ratio`, aggregators | Numeric parsing | strings -> numbers/pairs | Pure | 1 | Pair ambiguity, commas, NA. |
| `logic/worksheetDetection.ts` | `inspectWorksheet`, `chooseBestWorksheet` scoring | Select best sheet | workbook metadata -> sheet score | Mostly pure | 2 | Multi-sheet fixtures. |
| `logic/columnMapping.ts` | `similarity`, `headerMatchScore`, `autoMap`, `reconcileSavedMapping` | Header mapping | headers/schema -> mapping | Pure with sanitization | 1 | Thresholds, duplicates, saved aliases. |
| `logic/rowParser.ts` | `parseRows`, `addIssue`, custom numeric detection | Parsed rows/issues | raw rows+mapping -> parsed | Pure | 1 | Demo fixture, warning cases. |
| `logic/filters.ts` | date/filter functions | Filter parsed rows | state+rows -> filtered | Pure | 1 | Presets/latest/custom. |
| `logic/metrics.ts` | `healthScore`, `recommendation`, KPI calculations | Portfolio/client metrics | rows+thresholds -> metrics | Pure | 1 | Demo expected values. |
| `logic/trends.ts` | `linearSlope`, `stddev`, `trendInfo`, `volatilityInfo`, `correlation` | Trends/diagnostics math | numeric series -> descriptors | Pure | 1 | Edge/null/flat series. |
| `logic/diagnostics.ts` | `metricRisk`, `metricAnalysis`, `fieldAnalysis`, `clientFindings`, `topWords` | Findings and field intelligence | rows -> findings | Pure | 1 | Ordering/severity. |
| `logic/reportConfig.ts` | `loadConfig`, `saveConfig`, `collectSettings` logic | Validate/sanitize config | storage JSON -> config | Split | 1 | localStorage migration, malicious JSON. |
| `hooks/useIcrDashboardReducer.ts` | Global state variables and mutating workflow | Predictable dashboard state | actions -> state | Pure reducer + effects | 1 | Reducer transitions. |
| `hooks/useIcrReportConfig.ts` | config state/localStorage | Config persistence | config -> storage | Browser | 1 | Save/reset. |
| Component files | Corresponding HTML sections and render functions | Presentational/interactive UI | typed props/events -> JSX | Browser | 1–2 | Component smoke, accessibility, responsive. |

Component mapping highlights:

- `WorkbookUpload.tsx`: upload strip, file input, demo/clear buttons.
- `WorksheetSelector.tsx`: sheet dropdown.
- `ColumnMappingModal.tsx`: mapping modal, reset/apply controls.
- `ProcessingOverlay.tsx`: overlay.
- `ReportFilters.tsx`: client/RAG/owner/date/latest filters.
- `ReportNavigation.tsx`: sidebar/mobile nav.
- `ExecutiveReport.tsx`: hero, KPIs, insights, account table, built-in charts.
- `ClientIntelligenceReport.tsx`: banner, findings, metric table, field table, diagnostics.
- `DataQualityReport.tsx`: quality stats and validation table.
- `CustomizationDrawer.tsx`: title/accent/threshold/chart/custom controls.
- `ExportControls.tsx`: CSV/template/print actions.
- `IcrToast.tsx`: toast state instead of direct DOM mutation.

## 17. Phase 1 readiness decision

**Ready with conditions.** The prototype is complete enough to migrate, but Phase 1 must explicitly address security/privacy and testability gaps rather than copying the standalone implementation wholesale.

Recommended Phase 1 scope:

1. Add `/icr-trends-dashboard` route and page wrapper only after constants/types/pure logic are extracted and covered by tests.
2. Implement React state via reducer and typed config hook.
3. Port constants and pure parsing/metrics/filter/diagnostics logic first; lock demo baseline tests to the values in this document.
4. Build initial UI with demo data and no package additions until dependency strategy is approved.
5. Add SheetJS/Chart.js only in the phase where workbook upload/charts are implemented.
6. Sanitize template import, avoid persisting uploaded headers by default, and protect CSV exports from formula injection.
7. Complete browser QA screenshots for mobile breakpoints and print before production release.
