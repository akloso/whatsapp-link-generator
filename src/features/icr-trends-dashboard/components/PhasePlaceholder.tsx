import { CircleDashed } from 'lucide-react';
import type { DashboardViewContent } from '../types/dashboard';

type PhasePlaceholderProps = {
  content: DashboardViewContent;
};

export function PhasePlaceholder({ content }: PhasePlaceholderProps) {
  return (
    <div className="icr-dashboard__placeholder">
      <CircleDashed className="icr-dashboard__placeholder-icon" aria-hidden="true" />
      <p className="icr-dashboard__empty-kicker">No workbook loaded</p>
      <h2 id="icr-dashboard-empty-title">{content.emptyTitle}</h2>
      <p>{content.emptyDescription}</p>
      <div className="icr-dashboard__placeholder-grid" aria-label={`Planned ${content.title} content`}>
        {content.futureItems.map((item) => (
          <article className="icr-dashboard__placeholder-card" key={item}>
            <h3>{item}</h3>
            <p>Reserved for a future phase after local workbook parsing is available.</p>
          </article>
        ))}
      </div>
    </div>
  );
}
