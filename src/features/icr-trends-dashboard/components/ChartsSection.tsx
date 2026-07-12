import { useMemo } from 'react';
import { applyReportFilters } from '../logic/reportSelectors';
import { buildExecutiveChartModels } from '../logic/chartSelectors';
import type { NormalisedRow } from '../types/icr';
import type { ReportFilterState } from '../types/report';
import { IcrChartCard } from './IcrChartCard';
export function ChartsSection({latestRows,allRows,filters}:{latestRows:NormalisedRow[];allRows:NormalisedRow[];filters:ReportFilterState}){ const historicalRows=useMemo(()=>applyReportFilters(allRows,{...filters,latestOnly:false}),[allRows,filters]); const charts=useMemo(()=>buildExecutiveChartModels(latestRows,historicalRows),[latestRows,historicalRows]); return <section aria-labelledby="icr-charts-title" className="icr-dashboard__charts-section"><div className="icr-dashboard__section-heading"><h2 id="icr-charts-title">Visual analytics</h2><p>Charts use the same filtered report rows; the trend uses filtered historical rows with valid dates.</p></div><div className="icr-dashboard__charts-grid">{charts.map((chart)=><IcrChartCard key={chart.kind} model={chart} />)}</div></section>; }
