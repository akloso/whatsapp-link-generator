import { ClipboardList } from 'lucide-react';
import type { DashboardViewContent } from '../types/dashboard';

type DashboardEmptyStateProps = {
  content: DashboardViewContent;
};

export function DashboardEmptyState({ content }: DashboardEmptyStateProps) {
  return (
    <div className="icr-dashboard__empty-state">
      <div className="icr-dashboard__empty-icon" aria-hidden="true">
        <ClipboardList />
      </div>
      <div>
        <p className="icr-dashboard__empty-kicker">No workbook loaded</p>
        <h2 id="icr-dashboard-empty-title">{content.emptyTitle}</h2>
        <p>{content.emptyDescription}</p>
        <ul className="icr-dashboard__future-list" aria-label="Planned executive report content">
          {content.futureItems.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>
    </div>
  );
}
