import { DASHBOARD_VIEW_CONTENT } from '../constants/navigation';
import type { DashboardView } from '../types/dashboard';
import { DashboardEmptyState } from './DashboardEmptyState';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardTopbar } from './DashboardTopbar';
import { PhasePlaceholder } from './PhasePlaceholder';
import { UploadPanel } from './UploadPanel';

type DashboardShellProps = {
  activeView: DashboardView;
  onViewChange: (view: DashboardView) => void;
};

export function DashboardShell({ activeView, onViewChange }: DashboardShellProps) {
  const content = DASHBOARD_VIEW_CONTENT[activeView];

  return (
    <div className="icr-dashboard">
      <a className="icr-dashboard__skip-link" href="#icr-dashboard-main">Skip to dashboard content</a>
      <DashboardSidebar activeView={activeView} onViewChange={onViewChange} />
      <main id="icr-dashboard-main" className="icr-dashboard__main" aria-labelledby="icr-dashboard-title">
        <DashboardTopbar content={content} />
        <UploadPanel />
        <section className="icr-dashboard__workspace" aria-labelledby="icr-dashboard-empty-title">
          {activeView === 'executive' ? (
            <DashboardEmptyState content={content} />
          ) : (
            <PhasePlaceholder content={content} />
          )}
        </section>
        <p className="icr-dashboard__sr-only" role="status" aria-live="polite">
          {content.title} view selected.
        </p>
      </main>
    </div>
  );
}
