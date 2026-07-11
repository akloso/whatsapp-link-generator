import type { LucideIcon } from 'lucide-react';

export type DashboardView = 'executive' | 'client' | 'quality';

export type DashboardNavigationItem = {
  view: DashboardView;
  label: string;
  description: string;
  icon: LucideIcon;
};

export type DashboardViewContent = {
  title: string;
  subtitle: string;
  emptyTitle: string;
  emptyDescription: string;
  futureItems: string[];
};
