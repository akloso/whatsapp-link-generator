import { ShieldCheck } from 'lucide-react';
import { DASHBOARD_NAVIGATION } from '../constants/navigation';
import type { DashboardView } from '../types/dashboard';

type DashboardSidebarProps = {
  activeView: DashboardView;
  onViewChange: (view: DashboardView) => void;
};

export function DashboardSidebar({ activeView, onViewChange }: DashboardSidebarProps) {
  return (
    <aside className="icr-dashboard__sidebar" aria-label="ICR dashboard">
      <div className="icr-dashboard__brand">
        <span className="icr-dashboard__brand-mark" aria-hidden="true">ICR</span>
        <div>
          <p className="icr-dashboard__brand-kicker">Zapora internal</p>
          <h1 className="icr-dashboard__brand-title">ICR Trends Dashboard</h1>
        </div>
      </div>

      <nav className="icr-dashboard__nav" aria-label="ICR dashboard views">
        {DASHBOARD_NAVIGATION.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.view;

          return (
            <button
              key={item.view}
              type="button"
              className="icr-dashboard__nav-button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onViewChange(item.view)}
            >
              <Icon className="icr-dashboard__nav-icon" aria-hidden="true" />
              <span>
                <span className="icr-dashboard__nav-label">{item.label}</span>
                <span className="icr-dashboard__nav-description">{item.description}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="icr-dashboard__privacy-card">
        <ShieldCheck aria-hidden="true" />
        <p>Workbook data stays in your browser.</p>
      </div>
    </aside>
  );
}
