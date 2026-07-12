import type { DashboardViewContent } from '../types/dashboard';

type DashboardTopbarProps = {
  content: DashboardViewContent;
};

export function DashboardTopbar({ content }: DashboardTopbarProps) {
  return (
    <header className="icr-dashboard__topbar">
      <div>
        <p className="icr-dashboard__eyebrow">ICR Intelligence Workspace</p>
        <h2 id="icr-dashboard-title" className="icr-dashboard__title">{content.title}</h2>
        <p className="icr-dashboard__subtitle">{content.subtitle}</p>
      </div>
      <span className="icr-dashboard__phase-badge">Phase 2 local workbook parsing</span>
    </header>
  );
}
