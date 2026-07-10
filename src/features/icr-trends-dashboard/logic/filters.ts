import type { AnalyzedRow, ReportFilterOptions, ReportFiltersState } from '../types';
import { latestByClient } from './metrics';

const startOfDay = (value: string): Date | null => value ? new Date(`${value}T00:00:00`) : null;
const endOfDay = (value: string): Date | null => value ? new Date(`${value}T23:59:59`) : null;

export const toIsoDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getDateBounds = (rows: AnalyzedRow[]): { min: Date; max: Date } | null => {
  const dates = rows.map((row) => row.timestamp).filter((date): date is Date => Boolean(date)).sort((a, b) => a.getTime() - b.getTime());
  return dates.length ? { min: dates[0], max: dates[dates.length - 1] } : null;
};

export const makeDefaultFilters = (rows: AnalyzedRow[]): ReportFiltersState => {
  const bounds = getDateBounds(rows);
  return {
    clientKey: 'all',
    rag: 'all',
    owner: 'all',
    rangePreset: 'all',
    from: bounds ? toIsoDate(bounds.min) : '',
    to: bounds ? toIsoDate(bounds.max) : '',
    latestOnly: false,
  };
};

export const makeFilterOptions = (rows: AnalyzedRow[]): ReportFilterOptions => ({
  clients: [...new Map(rows.map((row) => [row._clientKey, row.clientName || 'Unknown client'])).entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label)),
  rags: [...new Set(rows.map((row) => row.rag))].sort(),
  owners: [...new Set(rows.map((row) => row.owner).filter(Boolean))].sort(),
});

export const rangeForPreset = (
  preset: ReportFiltersState['rangePreset'],
  rows: AnalyzedRow[],
): Pick<ReportFiltersState, 'from' | 'to'> => {
  const bounds = getDateBounds(rows);
  if (!bounds) return { from: '', to: '' };
  const to = new Date(bounds.max);
  let from = new Date(bounds.min);

  if (preset === '30' || preset === '90' || preset === '180') {
    from = new Date(to);
    from.setDate(from.getDate() - (Number(preset) - 1));
    if (from < bounds.min) from = new Date(bounds.min);
  } else if (preset === 'ytd') {
    from = new Date(to.getFullYear(), 0, 1);
    if (from < bounds.min) from = new Date(bounds.min);
  }

  return { from: toIsoDate(from), to: toIsoDate(to) };
};

export const filterRows = (rows: AnalyzedRow[], filters: ReportFiltersState): AnalyzedRow[] => {
  const from = startOfDay(filters.from);
  const to = endOfDay(filters.to);
  let result = rows.filter((row) => {
    if (filters.clientKey !== 'all' && row._clientKey !== filters.clientKey) return false;
    if (filters.rag !== 'all' && row.rag !== filters.rag) return false;
    if (filters.owner !== 'all' && row.owner !== filters.owner) return false;
    if (from && (!row.timestamp || row.timestamp < from)) return false;
    if (to && (!row.timestamp || row.timestamp > to)) return false;
    return true;
  });
  if (filters.latestOnly) result = latestByClient(result);
  return result;
};
