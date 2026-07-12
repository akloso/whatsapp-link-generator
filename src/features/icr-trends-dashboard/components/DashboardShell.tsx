import { useEffect, useRef } from 'react';
import { DASHBOARD_VIEW_CONTENT } from '../constants/navigation';
import { useIcrWorkbook } from '../hooks/useIcrWorkbook';
import type { DashboardView } from '../types/dashboard';
import { ColumnMappingPanel } from './ColumnMappingPanel';
import { DashboardErrorState } from './DashboardErrorState';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardTopbar } from './DashboardTopbar';
import { ClientIntelligenceView } from './ClientIntelligenceView';
import { DataQualityView } from './DataQualityView';
import { ExecutiveReport } from './ExecutiveReport';
import { ProcessingState } from './ProcessingState';
import { WorkbookUpload } from './WorkbookUpload';
import { WorksheetSelector } from './WorksheetSelector';

type DashboardShellProps = { activeView: DashboardView; onViewChange: (view: DashboardView) => void; };
export function DashboardShell({ activeView, onViewChange }: DashboardShellProps) {
  const content = DASHBOARD_VIEW_CONTENT[activeView];
  const workbook = useIcrWorkbook();
  const workspaceRef = useRef<HTMLElement>(null);
  useEffect(()=>{ if(workbook.state.stage!=='idle') workspaceRef.current?.focus(); },[workbook.state.stage]);
  const ready=workbook.state.stage==='ready';
  return <div className="icr-dashboard"><a className="icr-dashboard__skip-link" href="#icr-dashboard-main">Skip to dashboard content</a><DashboardSidebar activeView={activeView} onViewChange={onViewChange} /><main id="icr-dashboard-main" className="icr-dashboard__main" aria-labelledby="icr-dashboard-title"><DashboardTopbar content={content} /><WorkbookUpload state={workbook.state} onFile={workbook.selectFile} onReset={workbook.reset} /><ProcessingState state={workbook.state} /><section ref={workspaceRef} tabIndex={-1} className="icr-dashboard__workspace" aria-labelledby="icr-dashboard-workspace-title">{workbook.state.stage==='error' ? <DashboardErrorState message={workbook.state.error ?? 'Workbook processing failed.'} onReset={workbook.reset} /> : workbook.state.stage==='selectingWorksheet' ? <WorksheetSelector candidates={workbook.state.candidates} selectedIndex={workbook.state.selectedWorksheetIndex} onSelect={workbook.selectWorksheet} onContinue={workbook.reviewSelectedWorksheet} onReset={workbook.reset} /> : workbook.state.stage==='mapping' && workbook.selected ? <ColumnMappingPanel headers={workbook.selected.headers} mapping={workbook.state.mapping} validation={workbook.validation} onChange={workbook.updateMapping} onBack={()=>workbook.state.selectedWorksheetIndex!==null&&workbook.selectWorksheet(workbook.state.selectedWorksheetIndex)} onConfirm={workbook.parseSelectedWorksheet} onReset={workbook.reset} error={workbook.state.error} /> : ready ? (activeView==='executive'?<ExecutiveReport state={workbook.state} />:activeView==='client'?<ClientIntelligenceView state={workbook.state} />:<DataQualityView state={workbook.state} />) : <div className="icr-dashboard__empty-state"><h2 id="icr-dashboard-workspace-title">Choose a workbook to begin</h2><p>Select a local Excel workbook to detect worksheets, review mappings, and parse rows in your browser only.</p></div>}</section><p className="icr-dashboard__sr-only" role="status" aria-live="polite">{content.title} view selected. Workbook stage: {workbook.state.stage}.</p></main></div>;
}
