import { useState } from 'react';
import { DashboardShell } from './components/DashboardShell';
import { DEFAULT_DASHBOARD_VIEW } from './constants/navigation';
import type { DashboardView } from './types/dashboard';
import './icr-trends-dashboard.css';

export function IcrTrendsDashboardRoute() {
  const [activeView, setActiveView] = useState<DashboardView>(DEFAULT_DASHBOARD_VIEW);

  // Phase 1 guardrail: keep this route shell-only. Do not add file reading, persistence, network, or SheetJS usage here.
  return <DashboardShell activeView={activeView} onViewChange={setActiveView} />;
}
