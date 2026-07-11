import type { AnalyzedRow, DateRangePreset, RagStatus, ReportFilterOptions, ReportFiltersState } from '../types';
import { latestByClient } from './metrics';

export const DEFAULT_REPORT_FILTERS: ReportFiltersState = { clientKey: 'all', rag: 'all', owner: 'all', rangePreset: 'all', from: '', to: '', latestOnly: true };

const dateKey = (date: Date) => date.toISOString().slice(0, 10);
const parseInputDate = (value: string): Date | null => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime()) ? date : null;
};

export const getReportFilterOptions = (rows: AnalyzedRow[]): ReportFilterOptions => ({
  clients: [...new Map(rows.map((row) => [row._clientKey, { key: row._clientKey, label: `${row.clientName || 'Unnamed client'}${row.clientId ? ` (${row.clientId})` : ''}` }])).values()].sort((a, b) => a.label.localeCompare(b.label)),
  rags: (['Green', 'Amber', 'Red', 'Unknown'] as RagStatus[]).filter((rag) => rows.some((row) => row.rag === rag)),
  owners: [...new Set(rows.map((row) => row.owner.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
});

const latestTimestamp = (rows: AnalyzedRow[]): Date | null => rows.reduce<Date | null>((latest, row) => {
  if (!row.timestamp) return latest;
  return !latest || row.timestamp.getTime() > latest.getTime() ? row.timestamp : latest;
}, null);

export const resolveDateRange = (rows: AnalyzedRow[], filters: ReportFiltersState): { from: Date | null; to: Date | null; label: string; error: string } => {
  const anchor = latestTimestamp(rows);
  if (filters.rangePreset === 'all') return { from: null, to: null, label: 'All available dates', error: '' };
  if (filters.rangePreset === 'custom') {
    const from = parseInputDate(filters.from);
    const to = parseInputDate(filters.to);
    if ((filters.from && !from) || (filters.to && !to)) return { from: null, to: null, label: 'Invalid custom range', error: 'Enter valid custom dates.' };
    if (from && to && from.getTime() > to.getTime()) return { from: null, to: null, label: 'Invalid custom range', error: 'From date must be on or before To date.' };
    return { from, to, label: `${from ? dateKey(from) : 'Start'} to ${to ? dateKey(to) : 'latest'}`, error: '' };
  }
  if (!anchor) return { from: null, to: null, label: 'No dated rows available', error: '' };
  const to = new Date(anchor);
  const from = new Date(anchor);
  if (filters.rangePreset === 'ytd') from.setMonth(0, 1);
  else from.setDate(from.getDate() - Number(filters.rangePreset) + 1);
  return { from, to, label: `${presetLabel(filters.rangePreset)} (${dateKey(from)} to ${dateKey(to)})`, error: '' };
};

export const presetLabel = (preset: DateRangePreset): string => ({ all: 'All dates', '30': 'Last 30 days', '90': 'Last 90 days', '180': 'Last 180 days', ytd: 'Year to date', custom: 'Custom range' })[preset];

export const applyReportFilters = (rows: AnalyzedRow[], filters: ReportFiltersState): { rows: AnalyzedRow[]; rangeLabel: string; error: string; preSnapshotRows: AnalyzedRow[] } => {
  let filtered = rows;
  // Filtering order is intentionally stable: client, RAG, owner, workbook-relative date range, then latest snapshot per remaining client.
  if (filters.clientKey !== 'all') filtered = filtered.filter((row) => row._clientKey === filters.clientKey);
  if (filters.rag !== 'all') filtered = filtered.filter((row) => row.rag === filters.rag);
  if (filters.owner !== 'all') filtered = filtered.filter((row) => row.owner === filters.owner);
  const range = resolveDateRange(filtered, filters);
  if (range.error) return { rows: [], rangeLabel: range.label, error: range.error, preSnapshotRows: [] };
  if (range.from || range.to) {
    filtered = filtered.filter((row) => {
      if (!row.timestamp) return false;
      const time = row.timestamp.getTime();
      return (!range.from || time >= range.from.getTime()) && (!range.to || time <= range.to.getTime());
    });
  }
  const preSnapshotRows = filtered;
  return { rows: filters.latestOnly ? latestByClient(filtered) : filtered, rangeLabel: range.label, error: '', preSnapshotRows };
};
