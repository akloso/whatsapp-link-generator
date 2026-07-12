import { BarChart3, ClipboardCheck, UsersRound } from 'lucide-react';
import type { DashboardNavigationItem, DashboardView, DashboardViewContent } from '../types/dashboard';

export const DEFAULT_DASHBOARD_VIEW: DashboardView = 'executive';

export const DASHBOARD_NAVIGATION: DashboardNavigationItem[] = [
  {
    view: 'executive',
    label: 'Executive Report',
    description: 'Portfolio-level summary and leadership review workspace.',
    icon: BarChart3,
  },
  {
    view: 'client',
    label: 'Client Intelligence',
    description: 'Client history, trends, and field-level findings.',
    icon: UsersRound,
  },
  {
    view: 'quality',
    label: 'Data Quality',
    description: 'Mapping confidence, parsing warnings, and missing values.',
    icon: ClipboardCheck,
  },
];

export const DASHBOARD_VIEW_CONTENT: Record<DashboardView, DashboardViewContent> = {
  executive: {
    title: 'Executive Report',
    subtitle: 'Prepare a private portfolio review space for ICR workbook insights.',
    emptyTitle: 'No workbook loaded',
    emptyDescription: 'The executive report will remain empty until workbook processing is enabled in Phase 2.',
    futureItems: ['Portfolio KPIs', 'Risk and health summaries', 'Account-level recommendations'],
  },
  client: {
    title: 'Client Intelligence',
    subtitle: 'Explore client history, latest health, and account-level trends from the parsed workbook.',
    emptyTitle: 'No workbook loaded',
    emptyDescription: 'Upload and parse a workbook to review client-level intelligence.',
    futureItems: ['Client history', 'Metric trends', 'Findings and field register'],
  },
  quality: {
    title: 'Data Quality',
    subtitle: 'Review mapping coverage, field completeness, and parsing diagnostics from the parsed workbook.',
    emptyTitle: 'No workbook loaded',
    emptyDescription: 'Upload and parse a workbook to inspect data-quality diagnostics.',
    futureItems: ['Mapping confidence', 'Parsing warnings', 'Missing or ambiguous values'],
  },
};
