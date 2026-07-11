# ICR Trends Dashboard Phase 0 Baseline

## 1. Baseline identity

- Prototype path: `icr-intelligence-dashboard.html`.
- Verified default branch: `main` (verified with `git remote show origin` after configuring the repository URL for push).
- Current branch analysed: `work`.
- Commit SHA used for analysis: `0a395de01b263b5282451680e970c52d1ad4af32`.
- SHA-256: `9b5b80b6f3687c16dc6c17b40faba28e862cf1a14317fd8423101e0538040bde`.
- File size: 130,639 bytes.
- `wc -l` reports 506 because it counts newline characters.
- The file ends with a newline, so its verified logical line count is 506 using the Phase 0 byte-counting formula.
- The SHA-256 and byte size match the frozen artifact exactly; this is not a content discrepancy.
- Analysis date: 2026-07-11.
- Frozen status: the prototype is a frozen reference artifact and must not be modified by Phase 0 or later extraction work; future implementation should protect it with checksum tests.

## 2. Executive summary

The prototype is a single-file browser report generator for ICR/customer-success workbook reviews. It loads SheetJS and Chart.js from CDNs, parses an uploaded `.xlsx`, `.xls`, or `.csv` workbook in the browser, maps workbook headers to a canonical ICR schema, normalises rows, calculates deterministic health scores, and renders an executive portfolio report, client-level intelligence, data-quality diagnostics, custom charts, CSV export, print/PDF output, and settings.

Current architecture is fully inline: HTML, global CSS, and an immediately invoked JavaScript function share one document. Runtime state is stored in closure variables (`workbook`, `rawRows`, `headers`, `mapping`, `parsed`, `filtered`, `periodRows`, `charts`, `customCharts`, `config`, `sourceName`, `activeView`) plus `localStorage` for configuration and alias mappings.

Primary workflow: user uploads a workbook or loads fictional demo data; the script reads sheets with SheetJS; scores worksheets; selects or asks for a worksheet; auto-maps columns; optionally opens a mapping modal; parses and normalises records; builds filters; renders KPIs, charts, recommendations, tables, data-quality output, and client intelligence.

Main risks are CDN dependency execution, use of obsolete prototype `xlsx@0.18.5`, unscoped global CSS, direct `innerHTML` rendering, persisted mapping/config data, CSV formula-injection exposure, no file size/type hard validation, browser-memory risk for large workbooks, limited accessibility, and lack of tests.

React extraction should preserve the prototype as a read-only behavioral baseline while moving pure logic first: constants/types, header matching, worksheet scoring, parsing, normalisation, scoring, recommendations, aggregation, filters, and chart-data builders. UI extraction should then wrap these in an internal route shell with local-only processing, dynamic dependency chunks, error boundaries, accessibility improvements, and privacy guardrails.

## 3. HTML structure

- Top-level document: `<!doctype html>`, `<html lang="en">`, light color scheme metadata, title, two external `<script>` tags, one inline `<style>`, and body content.
- App shell: `.app` grid with sticky/fixed sidebar and `<main>` content.
- Header: `.topbar` contains mobile menu, eyebrow, `#reportTitle`, `#reportSubtitle`, and actions `#mappingBtn`, `#settingsBtn`, `#exportCsvBtn`, `#printBtn`.
- Navigation: sidebar `.nav` has buttons keyed by `data-view`: `reportView`, `clientView`, `qualityView`. It includes nav counters `#clientReviewCount` and `#qualityNavCount`.
- Upload area: `.upload-strip` contains file identity (`#fileName`, `#fileStats`), hidden worksheet selector `#sheetSelect`, hidden file input `#fileInput` with `accept=.xlsx,.xls,.csv`, demo/clear/upload buttons, and a privacy note.
- Empty state: `#emptyState` explains parsing and demo behavior, with `#emptyUpload` and `#emptyDemo` buttons.
- Dashboard: `#dashboard` is hidden until data loads. It contains filter bar and three report views.
- Filters: `#clientFilter`, `#ragFilter`, `#ownerFilter`, `#rangePreset`, `#fromDate`, `#toDate`, `#latestOnly`, `#selectedRange`, `#filterCount`, `#availableRange`.
- Executive report: `#reportView` includes hero cards, `#executiveHeadline`, `#executiveSummary`, `#summaryChips`, score ring, `#kpis`, chart panels, insights, account table, custom chart host, and quality panel.
- Chart canvases: `#utilizationChart`, `#ragChart`, `#trendChart`, `#riskChart`, `#burdenChart`, `#adoptionChart`, `#communicationChart`, `#healthChart`, `#themeChart`; custom chart canvases are created dynamically.
- Tables: `#accountTable`, `#issueTable`, `#metricTable`, `#fieldRegister`.
- Client Intelligence: `#clientView` contains `#clientEmpty`, `#clientReport`, `#clientBanner`, `#clientKpis`, `#clientFindings`, `#metricTable`, `#statusGrid`, `#fieldRegister`, and `#advancedDiagnostics`.
- Data Quality: `#qualityView` contains explanatory copy and `#qualityPanel`.
- Mapping modal: `#mappingModal` with `#mappingRows`, `#applyMapping`, `#closeMapping`.
- Settings drawer: `#settingsDrawer` includes title/accent inputs, threshold fields, chart toggles, custom numeric chart controls, template import/export, save/reset/close controls.
- Processing overlay: `#processingOverlay`, `#processingTitle`, `#processingDetail`.
- Toast: `#toast`.
- Accessibility-relevant markup: uses semantic `nav`, `main`, `header`, `section`, `article`, labels for many controls, `aria-label` for worksheet/date period, and real buttons. Limitations: icon-only semantics are weak, modal/drawer lack focus trapping and `aria-modal`, dynamically injected charts lack table alternatives, and some status changes are not announced with live regions.

## 4. CSS structure

CSS is fully inline and global. It is organised roughly as design tokens, reset/base selectors, shell/navigation, buttons/forms, upload/filter bars, cards/KPIs/grids, tables, modal/drawer/toast/overlay, report views, client intelligence, data quality, mobile breakpoints, and print rules.

- Variables/design tokens: `:root` defines background, panel, line, text, muted, accent, RGB accent, semantic colors, radius, and shadow.
- Typography: body uses Inter/system UI stack; uppercase eyebrow labels and small table headers establish hierarchy.
- Colours: light UI with accent gradients; semantic green/warn/red/purple/blue are reused in charts and statuses.
- Layout: `.app` grid, `.hero` grid, `.kpis` grid, `.grid` 12-column grid, many component-level grids, flex topbar/filter/action rows.
- Breakpoints: max-width 1180 adjusts KPI/client grids and spans; 860 switches app to block layout and sidebar to off-canvas; 520 stacks KPIs and filters and hides button text; print hides controls and forces printable layout.
- Component groups: `.btn`, `.upload-strip`, `.filterbar`, `.hero-card`, `.kpi`, `.panel`, `.chart-wrap`, `.data-table`, `.quality-grid`, `.modal`, `.drawer`, `.toast`, `.processing-overlay`, `.client-*`, `.metric-*`, `.field-*`, `.diagnostics`.
- Global selectors/integration risks: `*`, `html`, `body`, `button,input,select`, `select,input[...]`, `@media print`, and unscoped class names (`.panel`, `.grid`, `.hidden`, `.btn`, `.muted`) can collide with the application. During extraction, all prototype styles should be scoped under `.icr-dashboard` or converted to CSS modules/Tailwind component classes. Print rules must be route-scoped.

## 5. JavaScript function inventory

The script is an IIFE from approximately lines 193-503. Major inventory:

| Function / logic | Lines | Purpose | Inputs | Outputs | Side effects | DOM/state dependencies | React extraction destination |
|---|---:|---|---|---|---|---|---|
| `$`, `$$` | 195 | Query helpers | selector, optional element | node/list | none | `document` | UI utilities or avoid in React |
| `pct`, `clamp`, `safe`, `nkey`, `isMissing`, `escapeHtml`, `hexToRgb` | 197-203 | Formatting/sanitisation helpers | primitive values | strings/numbers | none | none | `logic/format.ts`, `logic/text.ts` |
| Demo data/constants | 205-248 | Defines synthetic rows, field definitions, metrics, chart labels, defaults | none | constants | none | none | `constants/`, `demo-data/`, `types/` |
| State variables | 249 | Holds runtime workbook/report/chart state | none | mutable closure state | central mutable state | all render functions | `hooks/useIcrDashboardState` reducer/store |
| `loadConfig` | 300 | Reads saved config and merges defaults | `localStorage.icrConfig` | config | catches parse errors | localStorage | `services/configStorage.ts` with privacy review |
| `saveConfig` | 301 | Persists config | `config` | none | writes localStorage, toast | localStorage, `#toast` | settings service/action |
| `toast` | 302 | Shows transient message | message | none | mutates `#toast`, timeout | `#toast` | Toast component |
| `download` | 303 | Browser file download | name, content, MIME | none | creates Blob/object URL/anchor | DOM, URL API | `services/download.ts` |
| `nextFrame` | 304 | Async frame yield | none | Promise | requestAnimationFrame | browser API | UI async utility |
| Processing helpers | 305-307 | Show/update/hide overlay | title/detail | none | DOM class/text mutation | overlay IDs | Loading component state |
| `parseDate` | 309 | Converts Date, Excel serial, ISO-ish strings, and `dd/mm/yyyy` strings | cell value | Date/null | uses `XLSX.SSF` | `window.XLSX` | `logic/dateParsing.ts` |
| `tokenNumbers`, `parseNum`, `parsePair` | 310-312 | Extract numbers, k/m suffixes, pairs, ambiguity | cell value | number/null or pair object | none | none | `logic/numberParsing.ts` |
| `normalizeRag` | 313 | Maps raw RAG text to Green/Amber/Red/Purple/Unknown | cell value | status | none | none | `logic/normalise.ts` |
| `similarity`, `headerMatchScore` | 314-321 | Scores header/alias similarity | header, alias | score | none | none | `logic/headerMatching.ts` |
| `autoMap` | 322-329 | Maps headers to canonical fields via exact and fuzzy scores | headers | mapping object | none | `FIELD_DEFS` | `logic/columnMapping.ts` |
| `canonicalClient` | 330 | Builds stable client key | parsed row | key | none | parsed row | `logic/clientIdentity.ts` |
| `detectCustomNumericHeaders` | 332-336 | Finds unmapped headers with numeric parse coverage | rows, map | header list | none | raw rows | `logic/customMetrics.ts` |
| `parseRows` | 337-353 | Converts raw rows to normalised records and warnings | rows, mapping | `{result, issues}` | adds row warnings/custom values | FIELD defs/helpers | `logic/parseRows.ts` |
| `addIssue` | 354 | Adds parse warning | row, key, raw, issue, resolution, list | none | mutates warnings/list | row warnings | `logic/dataQuality.ts` |
| `ratio`, `avg`, `median`, `sum` | 355-358 | Numeric reducers | arrays/numbers | number/null | none | none | `logic/stats.ts` |
| `healthScore` | 359 | Calculates 0-100 health score | parsed row | integer score | none | config thresholds indirectly for recs only | `logic/healthScore.ts` |
| `recommendation` | 360 | Returns semicolon-joined action text | parsed row | string | none | `config.thresholds` | `logic/recommendations.ts` |
| `latestByClient` | 362 | Latest row per client key | rows | rows | none | timestamp/client key | `logic/snapshots.ts` |
| Date/filter helpers | 363-371 | Computes bounds, preset ranges, labels, filtered rows | DOM filter values | filtered arrays/date labels | mutates DOM/state | parsed/filter controls | `hooks/useIcrFilters.ts` |
| `renderAll` | 373 | Top-level render coordinator | none | none | many DOM/chart updates | parsed/filtered/Chart/views | React route render tree |
| `renderHero`, `renderKpis` | 374-375 | Executive headline/KPIs | rows | HTML/text | DOM innerHTML/text | rows | Executive components + selectors |
| `baseOptions`, `chart`, `renderCharts` | 377-388 | Chart.js options, lifecycle, datasets | rows/trendRows | Chart instances | destroys/creates charts | canvases, `charts` | chart components/data builders |
| `shortName`, `compact`, `groupMonths`, `themeCounts` | 390-393 | Chart helpers | values/rows | labels/groups | none | rows | `logic/chartData.ts` |
| `renderInsights`, `renderTable`, `numCell`, `renderQuality` | 395-398 | Insight cards, account table, quality panel | rows | HTML | innerHTML, event binding | filters/parsed/mapping | Executive/DataQuality components |
| `setActiveView` | 401 | Switches view | view id | none | DOM classes, invokes render | `activeView` | router/tab state |
| Client analytics helpers | 402-431 | Client row selection, metric specs, formatting, trends, volatility, sparklines, field analysis, status cards, correlation, findings | rows/specs/headers | HTML/objects | mostly none except render functions | mappings/parsed/config | `logic/clientIntelligence.ts`, components |
| `renderClientIntelligence` | 432 | Renders selected client view | none | none | DOM text/HTML/chart updates | filter state/parsed | Client route component |
| Custom chart functions | 434-436 | Detect fields, render selector/options/custom charts | rows/trendRows | Chart instances | DOM/chart mutations | config/customCharts | Custom charts module |
| Mapping functions | 438-452 | Builds mapping UI, validates required mappings, stores alias mapping, parses dataset | UI/raw rows | boolean | localStorage, overlay, DOM, parsed state | mapping modal | Upload/mapping workflow |
| `clearAllData` | 453 | Resets uploaded state | none | none | confirm, destroys charts, resets DOM/state | all state | reducer reset action |
| Worksheet functions | 455-478 | Inspects sheets, scores best sheet, reads workbook, loads sheet | workbook/file/sheet name | report state | FileReader, SheetJS, DOM, localStorage | `workbook`, `sheetSelect` | `services/workbookService.ts` |
| `loadDemo` | 480 | Loads fictional demo data | none | none | state/DOM/chart updates | `DEMO_ROWS` | demo loader |
| `showDashboard` | 481 | Enables report UI | none | none | DOM class/button states | dashboard IDs | route component state |
| `exportCleanCsv` | 483 | Exports normalised CSV | filtered/parsed | download | Blob/object URL | `download` | `services/csvExport.ts` |
| Settings functions | 485-489 | Opens/applies/collects theme/settings/chart visibility | form values | config | DOM/local config | drawer inputs | settings components/hooks |
| Event wiring | 491-501 | Upload, filters, settings, template import/export, custom chart, nav, Escape | DOM events | none | many side effects | all controls | component event handlers |
| `applyTheme` invocation | 502 | Initialises theme/title/chart visibility | none | none | DOM style/text | config | app init effect |

Significant anonymous handlers include upload button/file input triggers, filter changes, date changes, latest-only toggle, settings save/reset/accent/title updates, template import/export with `FileReader`, custom chart addition/removal, nav switching, mobile menu toggle, and Escape dismissal.

## 6. External dependencies

- Chart.js version: `4.4.7`.
- Chart.js loading method: CDN script from jsDelivr with `onerror` fallback to cdnjs UMD bundle.
- SheetJS/xlsx version: prototype loads `xlsx@0.18.5`.
- SheetJS loading method: CDN script from jsDelivr with `onerror` fallback to cdnjs full minified bundle.
- CDN dependencies: jsDelivr and cdnjs for both libraries. No subresource integrity or CSP is present.
- Fonts: CSS requests `Inter` by name but no webfont is loaded; browser falls back to system UI if Inter is unavailable.
- Icons: Unicode/text glyphs are embedded directly; no icon library.
- Browser APIs: File input, FileReader, Blob, URL.createObjectURL/revokeObjectURL, localStorage, requestAnimationFrame, performance.now, confirm, window.print, Canvas through Chart.js, Date/Intl, structuredClone.
- Security concerns: third-party CDN code execution, no SRI, obsolete SheetJS, direct `innerHTML`, persisted mapping/config, formula/CSV injection risk, and console error logging for read failures.
- Production suitability: single-file prototype is not production-suitable. Prototype xlsx 0.18.5 must not be used in production. Future implementation requires official SheetJS 0.20.3 and exact Chart.js 4.4.7. Phase 0 must not install either dependency.

## 7. Workbook workflow

- Upload entry point: `#uploadBtn` and `#emptyUpload` click hidden `#fileInput`; `#fileInput.onchange` passes the selected file to `handleWorkbook`.
- Supported file formats: UI accept attribute allows `.xlsx`, `.xls`, `.csv`; actual handling delegates to `XLSX.read` regardless of extension.
- File validation: absent beyond browser accept hint and `window.XLSX` availability. No explicit MIME/extension/size validation.
- File reading: `FileReader.readAsArrayBuffer(file)`; `reader.onerror` toasts failure.
- Workbook creation: `XLSX.read(arrayBuffer,{type:'array',cellDates:true})`.
- Worksheet discovery: `workbook.SheetNames.map(inspectWorksheet)`.
- Worksheet recommendation: sheet scores are sorted descending; top sheet is auto-loaded.
- Manual worksheet selection: `#sheetSelect` is populated and unhidden; changing it calls `loadSheet`.
- Header extraction: `loadSheet` reads rows with `sheet_to_json(defval:null, raw:false)`, then headers are unique keys from first 50 rows.
- Automatic mapping: `autoMap(headers)` exact-matches then fuzzy-matches aliases; saved aliases may reconcile.
- Manual mapping: if required mappings or date confidence are insufficient, `#mappingModal` opens with one select per header.
- Parsing: `generateFromMapping` calls `parseRows`, then builds filters and renders.
- Normalisation: `parseRows` creates canonical fields, rates, custom numeric fields, warnings, health, and recommendations.
- Dataset readiness: auto-generates only when required client/RAG mappings and date mapping are present at configured confidence.
- Reset/clear: `clearAllData` confirms, destroys charts, clears state, hides dashboard, resets labels, filter options, and disables actions.
- Errors/loading: processing overlay and toast messages are used. Workbook-level errors are partly caught; worksheet load catches and logs `console.error(err)`.
- Incomplete behavior: no robust file validation, no password/unsupported-format handling, no cancellation, no progress for large files, and no hard memory limits.

## 8. Worksheet-selection logic

`inspectWorksheet(name)` examines at most rows 0-30 and columns 0-60 using `XLSX.utils.sheet_to_json(..., raw:false)`. It collects unique headers from up to 25 preview rows, auto-maps those headers, and scores:

- `mapped.length * 3` for mapped fields with score >= 0.62.
- `exact.length * 2` for exact matches.
- `min(estimatedRows, 200) / 40` row-volume bonus.
- +30 if `clientName` detected.
- +25 if `rag` detected.
- +20 if `timestamp` detected.
- +10 if `leadPair` detected.
- +5 if `owner` detected.
- +35 if client name, RAG, and timestamp are all present.
- -30 if fewer than 5 headers.
- -20 if estimated rows fewer than 3.

Validity is `clientName && rag`; date is not required for validity but affects score and auto-generation readiness. `chooseBestWorksheet` sorts by score descending and returns the first sheet. If no valid best sheet exists, the prototype still attempts to load the best sheet and relies on mapping validation later.

## 9. Column-mapping logic

Canonical fields are defined in `FIELD_DEFS`: clientId, clientName, timestamp, rag, owner, manager, leadPair, leads, subscribedLeads, unassigned, untouched, overdue, activeWidgets, subscribedWidgets, activeUsers, subscribedUsers, activeRawData, subscribedRawData, dtcStatus, trackingStatus, openTickets, closedTickets, emailConsumed, smsConsumed, whatsappConsumed, niaaConsumed, opportunity, actionable, unassignedReason, notDelivered, notUtilised, negativeFeedback.

- Required fields: `clientName` and `rag` only.
- Date requirement: `hasDateMapping()` separately requires timestamp score >= 0.62 for automatic generation; manual generation can proceed after required fields are mapped even if date is absent.
- Header aliases: each field has label plus aliases for exact/fuzzy matching.
- Matching: `autoMap` first exact-normalises label/aliases using `nkey`; then fuzzy scores remaining headers using `headerMatchScore`. Score >= .86 maps automatically; score >= .62 is marked `review`; otherwise ignored.
- Normalisation: `nkey` lowercases, replaces `&` with `and`, removes non-alphanumerics, and trims.
- User overrides: mapping modal allows each uploaded header to map to one canonical field or be ignored. Duplicate canonical mappings are rejected by clearing later duplicates and showing a toast.
- Saved aliases: `icrAliasMapping` can reapply saved field choices when valid and not conflicting with exact mapped fields.
- Missing required behavior: missing required fields block generation and toast `Map required field: ...`.
- Validation limitations: no type preview validation before parsing, no schema versioning, and saved alias mapping can persist workbook header names.

## 10. Parsing logic

- Sheet-to-row conversion: `XLSX.utils.sheet_to_json(ws,{defval:null,raw:false})`; all cell values are stringified by SheetJS except dates when converted earlier in workbook read.
- Header handling: row object keys are SheetJS-derived headers; first 50 rows determine header list.
- Empty-row handling: `sheet_to_json` generally omits fully empty rows; `parseRows` skips rows where no mapped/raw values become meaningful.
- Cell-type handling: values are treated through `safe`, `parseDate`, `parseNum`, `parsePair`, `normalizeRag`, and status text helpers.
- Date parsing: accepts Date objects, Excel serials through `XLSX.SSF.parse_date_code`, JavaScript-parseable dates, and slash/dash day-month-year variants. Invalid/missing date returns null and generates warnings when mapped.
- Numeric parsing: extracts first numeric token; supports commas inside numbers and `k`/`m` suffixes.
- Percentage parsing: ratios are calculated from parsed numerators/denominators, not from percent strings as canonical percentages except numeric token extraction.
- Boolean/status parsing: DTC/tracking status use raw text matching such as placed/live/yes/done/enabled/active/implemented versus not/no/pending.
- Pair parsing: values like `1937/119` become first and second numeric tokens; ambiguity is flagged when more than two numbers or very long comma-free digit strings appear.
- Invalid values: missing values become null/Unknown; parse warnings are collected in `_warnings` and quality issue list.
- Limits: soft warning toast for more than 50,000 rows; no hard abort or streaming.
- Error handling: row-level warnings exist; worksheet exceptions are caught and logged; parsing itself has limited defensive isolation.

## 11. Normalisation logic

- Client ID: string-trimmed; numeric IDs are used for canonical key `id:<id>`.
- Client name: string-trimmed; fallback `Unknown client`; used for key if ID absent after stripping common suffixes.
- Snapshot date: parsed to `timestamp`; null if absent/invalid.
- RAG: normalised to Red, Amber, Purple, Green, or Unknown.
- CS owner/manager: trimmed text or empty.
- Leads/capacity/utilisation: either `leadPair` provides captured/subscribed pair or individual `leads` and `subscribedLeads` fields do; `leadUtil = leads/subscribedLeads` when denominator non-zero.
- Unassigned/untouched/overdue: parsed numeric counts; rates divide by captured leads when finite and non-zero.
- Widget adoption/user adoption/raw-data adoption: active/subscribed numerator/denominator ratios, null when denominator unavailable/zero.
- DTC status: text mapped to true/false/null based on positive/negative status wording.
- Tracking status: similar true/false/null implementation status detection.
- Ticket counts: open and closed tickets parsed as numbers.
- Communication usage: email, SMS, WhatsApp, and NIAA consumed values parsed as numbers and summed/aggregated later.
- Opportunity/actionable fields: preserved as text for recommendations/themes/field register; not deeply structured.
- Negative/unassigned/not delivered/not utilised feedback: preserved as text and analysed for words/changes.
- Custom numeric fields: unmapped headers with numeric coverage become `_custom` metrics.
- Missing values: `isMissing` treats blanks, `na`, `n/a`, `none`, `null`, `not available`, `not visible`, `ns`, and dash-only values as missing.
- Unknown values: RAG Unknown, null numeric/date/status values, and warning entries where applicable.

## 12. Filter behavior

Available filters are client, RAG status, CS owner, period preset, custom from/to dates, and latest-client-snapshot checkbox.

- Option generation: `makeFilters` builds client options from latest row per client sorted by name; owner options from non-missing owners sorted alphabetically.
- Date filters: `dateBounds` considers current client/RAG/owner filters; date controls enable only if dated rows exist. Presets support all, 30, 90, 180 days, YTD, and custom.
- Filter order: base rows -> client/RAG/owner -> date bounds -> `periodRows` snapshot -> optional latest by client.
- Latest-row behavior: `latestByClient` picks max timestamp per client; undated rows compare as zero and may be superseded by dated rows.
- Latest-client-snapshot behavior: enabled by default; after date filtering, it collapses to one latest row per client.
- Reset behavior: changing client/RAG/owner calls `updateDateBounds(true)` and then filters. Clearing data resets all controls/options.
- Empty-result behavior: charts/tables render with empty arrays; some KPIs show zero/blank; no dedicated filtered-empty panel beyond record count.

## 13. Health scoring

Prototype formula in `healthScore(r)`:

- Start at 100.
- RAG penalties: Red -35, Amber -20, Purple -12, Green/Unknown no explicit penalty.
- If `unassignedRate` is not null: subtract `clamp(unassignedRate * 38, 0, 30)`.
- If `untouchedRate` is not null: subtract `clamp(untouchedRate * 34, 0, 26)`.
- If `overdueRate` is not null: subtract `clamp(overdueRate * 30, 0, 20)`.
- If `leadUtil` is finite and `< 0.5`: subtract 10.
- If `widgetAdoption` is finite and `< 0.5`: subtract 8.
- If `userAdoption` is finite and `< 0.45`: subtract 7.
- If `rawAdoption` is finite and `< 0.45`: subtract 6.
- If DTC is explicitly false: subtract 6.
- If tracking is explicitly false: subtract 5.
- If open tickets exceed closed tickets: subtract 5.
- Clamp final value to [0,100] and round to nearest integer.

Missing data generally avoids that penalty except RAG Unknown receives no penalty. `Number.isFinite` guards several ratios; rates only check `!== null`, so `NaN` should be avoided upstream by ratio returning null. Infinity is avoided by denominator checks. Future approved requirements must not silently replace this formula; differences must be recorded in implementation specs.

## 14. Recommendation rules

`recommendation(r)` appends messages in this exact precedence:

1. `Run an executive recovery review` if RAG is Red or health < 45.
2. `Fix allocation logic for unassigned leads` if unassigned rate percentage >= configured unassigned threshold.
3. `Drive follow-up discipline for untouched leads` if untouched rate percentage >= configured untouched threshold.
4. `Escalate overdue lead closure` if overdue rate percentage >= configured overdue threshold.
5. `Improve product adoption` if the minimum of widget/user/raw adoption percentages is below configured adoption threshold.
6. `Complete DTC/tracking implementation` if DTC or tracking is explicitly false.
7. Fallback `Maintain cadence and monitor next review` if no rule matched.

Returned text joins rules with `; `. Thresholds are user-configurable in settings. This is deterministic, not AI-generated, despite UI wording. Future requirements may use different approved priority logic; those differences must be documented explicitly.

## 15. Charts

- Lead capacity and utilisation: horizontal/vertical bar (prototype `bar`) from latest rows with finite `leadUtil`, sorted descending by utilisation, top 12 then reversed; labels shortened client names; datasets captured leads and subscribed capacity; lifecycle destroys previous chart.
- Account health mix: doughnut from latest rows, counts Green/Amber/Red/Purple/Unknown; legend shown by default Chart.js options.
- Lead volume trend: line chart from `groupMonths(periodRows)`; monthly captured leads and subscribed capacity sums; labels `Mon YYYY`; trendRows include period rows before latest-only collapse.
- Operational risk matrix: bubble/scatter-like bubble chart from rows with unassigned/untouched rates; x untouched %, y unassigned %, radius by sqrt leads; tooltip includes client/health.
- Operational burden by account: stacked or grouped bar of top 10 accounts by unassigned+untouched+overdue, reversed for display.
- Product adoption coverage: bar chart for average widget, user, raw data, and DTC placement percentages.
- Communication activity: doughnut/bar-style chart of summed Email, SMS, WhatsApp, NIAA consumed values.
- Health score distribution: bar chart of Critical 0-39, Watch 40-59, Stable 60-79, Strong 80-100 counts.
- Recurring action themes: horizontal bar of regex-counted terms from recommendation/action fields; sorted top eight then reversed.
- Custom metric charts: user-selected extra numeric fields; monthly averages from period/trend rows; chart type chosen in settings.

Empty-state behavior is inconsistent: Chart.js receives empty datasets or zero counts; there is no accessible textual fallback per chart. Lifecycle handling destroys charts before recreation. Accessibility limitations: canvas-only visuals, no data tables per chart, no ARIA descriptions, and color-dependent meaning.

## 16. Executive Report

- KPI cards: generated from filtered/latest rows for account count, median lead utilisation, high-risk accounts, untouched leads, overdue leads, DTC/tracking coverage, and related summaries.
- Calculations: use `avg`, `median`, `sum`, rates, health score, and latest snapshots. Portfolio score is average health rounded.
- Portfolio summaries: deterministic text in hero based on red/amber counts, high-risk count, total leads, and average score.
- Filters: report respects client/RAG/owner/date/latest filters.
- Tables: account table sorted ascending by health (worst first), rows clickable to switch to client intelligence.
- Priority logic: insights pick top untouched, top unassigned, low adoption, RAG/health concerns, and theme counts using rule-based heuristics.
- Latest-row logic: default report uses latest client snapshot after date filtering.
- Recommendations: account table displays `r.recommendation` generated by rule precedence above.

## 17. Client Intelligence

- Client selection: requires a specific client in `#clientFilter`; otherwise shows `#clientEmpty`.
- Client history: `clientRowsInRange` returns all parsed rows for the selected client within date bounds, sorted by original parse order/date behavior.
- Trends: metric table computes latest, previous, change, trend label, volatility, coverage, min/max/average, sparkline SVG, and analysis text.
- Findings: `clientFindings` compares latest and first health, flags high current risk, and includes adoption/operational cues.
- Recommendations: uses latest row recommendation and metric-level risk wording.
- Client-specific tables: metric table and field register show canonical and raw uploaded fields.
- Client-specific charts: custom charts can include selected custom fields; core client view primarily uses sparklines rather than large Chart.js panels.

## 18. Data Quality

- Validation rules: required field presence, parse warnings for invalid dates/numbers/pairs, missing mapped-cell counts, unmapped header counts.
- Missing-field checks: missing values across mapped fields are counted for quality percentage.
- Issue register: `addIssue` records row number, client, field, raw value, issue, and resolution.
- Parsing confidence: derived from mapped versus unmapped headers, missing cells, and issue counts; not a formal statistical confidence.
- Data-quality calculations: total cells = parsed rows * mapped column count; missing counts are mapped field values that satisfy `isMissing`.
- Limitations: no workbook schema validation, no duplicate-client/date warnings, no formula detection, no strict type thresholds, and no persistence privacy review for alias mapping.

## 19. Export functions

- CSV: `exportCleanCsv` builds normalised rows from `filtered` or all `parsed`, serialises via `Object.values(...).map(JSON.stringify).join(',')`, and downloads `icr-clean-export.csv` as `text/csv`. Browser APIs: Blob, URL.createObjectURL, anchor click. Includes workbook-derived client data. Privacy risk: local download is user-initiated but sensitive. Injection risk: no formula-injection neutralisation for cells starting with `=`, `+`, `-`, or `@`.
- PDF/Print: `#printBtn` calls `window.print()` and relies on `@media print`; button label says Export PDF but browser print dialog controls output. Includes visible report data. Privacy risk: user may print/save sensitive data.
- Image: no explicit image export is implemented.
- Clipboard: no clipboard export is implemented.
- Configuration/template export: `#exportTemplate` downloads `icr-report-template.json` containing `version`, `config`, and `mapping`. Mapping may include uploaded header names and therefore possible client/workbook metadata.
- Template import: `#templateInput` reads JSON with FileReader and applies `config`/`mapping`. No schema validation beyond JSON parse and field existence.

## 20. Settings and customisation

- Threshold settings: unassigned, untouched, overdue, and adoption thresholds as numeric inputs; used by recommendations and metric risk.
- Labels: report title editable through `#titleInput`.
- Colours: accent color editable through color input and CSS variables.
- Chart settings: visibility toggles generated from `CHART_LABELS`; custom numeric chart selection supports extra field, title, and chart type.
- Template settings: import/export JSON template for config and mapping.
- Saved configuration: `icrConfig` in localStorage stores title, accent, thresholds, chart visibility, and custom chart definitions.
- Reset behavior: reset restores defaults and removes `icrConfig`; it does not remove `icrAliasMapping`.
- Validation: minimal; numeric inputs use fallback defaults with unary `+`; color/title are not deeply validated.

## 21. Persistence behavior

- `localStorage.icrConfig`: read in `loadConfig`, written in `saveConfig`, removed by reset. Stores user configuration only, not workbook rows. Allowed future use only if it never includes workbook-derived data and has explicit privacy messaging.
- `localStorage.icrAliasMapping`: written in `generateFromMapping`, read in `loadSheet`, not removed by reset/clear. Stores uploaded header names mapped to canonical fields; header names may be workbook-derived metadata. Privacy impact is medium; future implementation should avoid persisting workbook-derived headers by default or require explicit opt-in.
- `sessionStorage`: no usage found.
- `IndexedDB`: no usage found.
- Cookies: no usage found.
- URLs/query parameters: no usage found for persistence or data transfer.
- Workbook-derived rows/client values are not intentionally persisted, but exported CSV/print/template mapping can expose data locally.

## 22. Privacy and security risks

- Workbook-data transmission: no fetch/Supabase/webhook/analytics calls were found; processing is local in browser memory.
- Persistence: config and alias mapping use localStorage; alias mapping may contain workbook-derived header metadata.
- Logging: worksheet load catch calls `console.error(err)`; this should not include row data but malformed library errors may contain metadata.
- Analytics/external processors: none implemented, but CDN scripts are external processors executing in page context.
- CDN dependencies: jsDelivr/cdnjs without SRI/CSP create supply-chain risk.
- DOM injection: many `innerHTML` writes use `escapeHtml` for dynamic values in most places, but all call sites must be audited during React extraction.
- `dangerouslySetInnerHTML`: not present in prototype, and future implementation must not use it.
- Formula injection: CSV export does not neutralise spreadsheet formulas.
- File metadata exposure: `sourceName=file.name` is shown in UI; filename can contain sensitive client information.
- Malformed files: no robust validation/sandboxing around SheetJS parsing.
- Oversized files: soft toast after 50,000 rows but still parses; memory/resource exhaustion possible.
- Unsupported formats: browser accept hint only; errors surface as generic toasts.

Future workbook processing must remain entirely inside the browser. Workbook-derived data must not be transmitted, persisted, logged, or included in analytics.

## 23. React extraction plan

1. Internal route shell: add route only in approved later phase, scoped `.icr-dashboard`, lazy load feature bundle.
2. Feature state: reducer/store for workbook state, mapping, filters, settings, chart config, and view state.
3. Upload workflow: controlled file input, drag/drop only when approved, validation, cancellation, local-only privacy copy.
4. Workbook service: dynamic import official SheetJS 0.20.3, parse in browser, isolate errors, optionally use Web Worker for large files.
5. Parsing: pure tested modules for date/number/pair/status parsing.
6. Normalisation: pure row normaliser with typed output and warning model.
7. Pure analytics logic: scoring, recommendations, aggregations, trends, quality metrics.
8. Filters: hook/selectors for options, date bounds, latest snapshots.
9. Charts: dynamic exact Chart.js 4.4.7 chunk, React chart components, dataset builders, accessible table summaries.
10. Executive Report: presentational components for hero, KPIs, insights, charts, and table.
11. Client Intelligence: client selector integration, history metrics, findings, field register, diagnostics.
12. Data Quality: issue register, quality summary, parsing confidence caveats.
13. Exports: safe CSV with formula neutralisation, print route styles, template import/export with schema validation.
14. Settings: validated controls, no workbook-derived persistence by default.
15. Error boundaries: workbook parse, chart render, and feature route boundaries.
16. Privacy controls: no network calls for workbook data, no analytics payloads, no storage of rows/client values.
17. Accessibility: focus management, modal semantics, live regions, keyboard flow, canvas alternatives.

## 24. Suggested module structure

Do not create these files in Phase 0. Suggested future structure:

```text
src/features/icr-trends-dashboard/
  IcrTrendsDashboardRoute.tsx
  components/
    DashboardShell.tsx
    UploadPanel.tsx
    MappingModal.tsx
    FilterBar.tsx
    ExecutiveReport/
    ClientIntelligence/
    DataQuality/
    SettingsDrawer.tsx
    charts/
  logic/
    headerMatching.ts
    worksheetScoring.ts
    parseDate.ts
    parseNumber.ts
    normaliseRow.ts
    healthScore.ts
    recommendations.ts
    filters.ts
    snapshots.ts
    aggregations.ts
    chartData.ts
    dataQuality.ts
    csvSafety.ts
  services/
    workbookService.ts
    csvExportService.ts
    templateService.ts
    configStorage.ts
  hooks/
    useIcrDashboardState.ts
    useWorkbookUpload.ts
    useIcrFilters.ts
    useChartLifecycle.ts
  types/
    icr.ts
    workbook.ts
    mapping.ts
  constants/
    fields.ts
    thresholds.ts
    chartLabels.ts
  demo-data/
    demoRows.ts
  accessibility/
    chartDescriptions.ts
    focusManagement.ts
  __tests__/
    *.test.ts
```

## 25. Required tests

- File validation for extension, MIME, empty file, oversized file, password/unsupported workbooks, and CSV handling.
- Worksheet recommendation scoring, tie/fallback behavior, and invalid-sheet behavior.
- Header extraction from sparse/duplicate headers.
- Column mapping exact/fuzzy thresholds, aliases, duplicate canonical fields, saved mapping policy.
- Parsing for dates, numbers, pairs, percentages, statuses, empty rows, invalid values, and large files.
- Normalisation for every canonical field and missing/unknown values.
- Date handling across Excel serials, time zones, ambiguous `dd/mm/yyyy`, invalid dates.
- Health scoring exact penalties, clamps, rounding, NaN/Infinity/missing handling.
- Recommendation precedence and threshold customisation.
- Filtering, date presets, latest snapshots, owner/RAG/client options.
- Portfolio summaries, KPI calculations, priority sorting, issue counts.
- Chart data builders for all core/custom charts and empty datasets.
- Privacy restrictions: no network calls, no workbook-row persistence, no analytics/logging of rows/client data.
- Metadata handling for filenames and header mappings.
- Responsive layout at key breakpoints.
- Accessibility for keyboard navigation, modal focus, labels, live regions, chart alternatives.
- Dynamic dependency chunks for SheetJS and Chart.js exact versions.
- Prototype checksum protection for `icr-intelligence-dashboard.html`.

## 26. Browser-testing limitations

Static checks completed in Phase 0 include file checksum/size/line checks, source inspection, dependency scans, lint/typecheck/build, diff checks, and npm audit. Checks requiring a real browser include file-picker behavior, drag-and-drop if later added, Canvas rendering fidelity, Chart.js fallback CDN behavior, print/PDF output, responsive layout, memory use on large files, performance under large workbooks, screen-reader announcements, keyboard focus traps, and browser-specific FileReader/SheetJS parsing differences. Browser tooling availability was not used for interactive verification in Phase 0.

## 27. Phase extraction map

- Phase 1: route shell when approved, scoped styles, static UI decomposition, constants/types, privacy guardrails, checksum test, no workbook parser until approved.
- Phase 1.1: pure logic extraction and tests for header matching, worksheet scoring, parsing helpers, scoring, recommendations, filters, chart data.
- Phase 2: browser-only workbook upload service with official SheetJS 0.20.3, mapping workflow, normalisation, data-quality warnings.
- Phase 3: Chart.js 4.4.7 visualisations, executive report, client intelligence, exports, settings, accessibility hardening.
- Later approved phases: workers/performance, advanced diagnostics, richer export formats, persisted user preferences with privacy review, automated browser tests, design-system integration.

## 28. Known unknowns

- Some minified one-line functions require careful semantic porting despite complete inspection.
- Ambiguous field mappings may overmatch similar business headers.
- Date parsing is browser-dependent for non-ISO strings.
- Status text mapping may misclassify nuanced implementation states.
- CSV export injection protections are absent.
- Alias mapping persistence may violate stricter future privacy rules.
- Large workbook behavior, memory ceilings, and UI responsiveness are untested.
- CDN fallback behavior is network/browser dependent.
- Accessibility behavior for modals, drawers, toasts, and charts requires manual assistive-tech testing.
