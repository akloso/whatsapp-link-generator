import { useMemo, useState } from 'react';
import { buildAccountPriorityRows } from '../logic/accountPriority';
import { buildHealthDistribution, buildPortfolioSummary, buildRecommendationSummary } from '../logic/portfolioMetrics';
import { activeFilterCount, applyReportFilters, clearReportFilters, deriveReportFilterOptions, reconcileReportFilters } from '../logic/reportSelectors';
import type { IcrWorkbookState } from '../hooks/useIcrWorkbook';
import type { ReportFilterState, ReportSortState } from '../types/report';
import { AccountPriorityTable } from './AccountPriorityTable';
import { ChartsSection } from './ChartsSection';
import { DataQualitySummary } from './DataQualitySummary';
import { HealthSummary } from './HealthSummary';
import { PortfolioSummaryCards } from './PortfolioSummaryCards';
import { RecommendationSummary } from './RecommendationSummary';
import { ReportEmptyState } from './ReportEmptyState';
import { ReportFilters } from './ReportFilters';
export function ExecutiveReport({state}:{state:IcrWorkbookState}){ const [filters,setFilters]=useState<ReportFilterState>(clearReportFilters()); const [sort,setSort]=useState<ReportSortState>({key:'priority',direction:'asc'}); const options=useMemo(()=>deriveReportFilterOptions(state.rows),[state.rows]); const safeFilters=useMemo(()=>reconcileReportFilters(filters,options),[filters,options]); const filtered=useMemo(()=>applyReportFilters(state.rows,safeFilters),[state.rows,safeFilters]); const summary=useMemo(()=>buildPortfolioSummary(filtered,state.issues),[filtered,state.issues]); const health=useMemo(()=>buildHealthDistribution(filtered),[filtered]); const recs=useMemo(()=>buildRecommendationSummary(filtered),[filtered]); const priorityRows=useMemo(()=>buildAccountPriorityRows(filtered,sort),[filtered,sort]); const clear=()=>setFilters(clearReportFilters()); if(!state.rows.length) return <><ReportEmptyState reason="zero-valid-rows" /><DataQualitySummary state={state} /></>; return <div className="icr-dashboard__report"><h2 id="icr-dashboard-workspace-title">Executive report</h2><p className="icr-dashboard__phase-note">Phase 3B uses parsed workbook rows, prototype health scoring, recommendations, filters, latest-client snapshots, and local Chart.js visualizations. Exports and persistence remain intentionally excluded.</p><ReportFilters filters={safeFilters} options={options} activeCount={activeFilterCount(safeFilters)} resultCount={filtered.length} onChange={setFilters} onClear={clear} />{!filtered.length?<><ReportEmptyState reason="filtered-empty" onClearFilters={clear} /><DataQualitySummary state={state} /></>:<><PortfolioSummaryCards summary={summary} /><div className="icr-dashboard__two-column"><HealthSummary distribution={health} /><RecommendationSummary summary={recs} /></div><ChartsSection latestRows={filtered} allRows={state.rows} filters={safeFilters} /><AccountPriorityTable rows={priorityRows} sort={sort} onSort={setSort} /><DataQualitySummary state={state} /></>}</div>; }
