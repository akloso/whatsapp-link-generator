import type { AnalyzedRow } from '../types';
import { latestByClient } from './metrics';

export type SeriesPoint = { label: string; values: number[] };

const monthLabel = (date: Date): string => date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

export const leadTrendSeries = (rows: AnalyzedRow[]): { labels: string[]; leads: number[]; capacity: number[] } => {
  const byMonth = new Map<string, { date: Date; leads: number; capacity: number }>();
  rows.forEach((row) => {
    if (!row.timestamp) return;
    const key = `${row.timestamp.getFullYear()}-${String(row.timestamp.getMonth() + 1).padStart(2, '0')}`;
    const current = byMonth.get(key) ?? { date: new Date(row.timestamp.getFullYear(), row.timestamp.getMonth(), 1), leads: 0, capacity: 0 };
    current.leads += row.leads ?? 0;
    current.capacity += row.subscribedLeads ?? 0;
    byMonth.set(key, current);
  });
  const ordered = [...byMonth.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
  return {
    labels: ordered.map((item) => monthLabel(item.date)),
    leads: ordered.map((item) => item.leads),
    capacity: ordered.map((item) => item.capacity),
  };
};

export const ragMix = (rows: AnalyzedRow[]): { labels: string[]; values: number[] } => {
  const latest = latestByClient(rows);
  const labels = ['Green', 'Amber', 'Red', 'Unknown'];
  return { labels, values: labels.map((label) => latest.filter((row) => row.rag === label).length) };
};

export const burdenByAccount = (rows: AnalyzedRow[]) => latestByClient(rows)
  .sort((a, b) => ((b.unassigned ?? 0) + (b.untouched ?? 0) + (b.overdue ?? 0)) - ((a.unassigned ?? 0) + (a.untouched ?? 0) + (a.overdue ?? 0)))
  .slice(0, 12)
  .map((row) => ({
    label: row.clientName,
    unassigned: row.unassigned ?? 0,
    untouched: row.untouched ?? 0,
    overdue: row.overdue ?? 0,
  }));

export const adoptionCoverage = (rows: AnalyzedRow[]): { labels: string[]; values: number[] } => {
  const latest = latestByClient(rows);
  const average = (values: Array<number | null>): number => {
    const valid = values.filter((value): value is number => Number.isFinite(value));
    return valid.length ? Math.round((valid.reduce((total, value) => total + value, 0) / valid.length) * 100) : 0;
  };
  return {
    labels: ['Widgets', 'Users', 'Raw data'],
    values: [average(latest.map((row) => row.widgetAdoption)), average(latest.map((row) => row.userAdoption)), average(latest.map((row) => row.rawAdoption))],
  };
};

export const communicationUsage = (rows: AnalyzedRow[]): { labels: string[]; values: number[] } => {
  const latest = latestByClient(rows);
  const total = (selector: (row: AnalyzedRow) => number | null): number => latest.reduce((sum, row) => sum + (selector(row) ?? 0), 0);
  return {
    labels: ['Email', 'SMS', 'WhatsApp', 'NIAA'],
    values: [total((row) => row.emailConsumed), total((row) => row.smsConsumed), total((row) => row.whatsappConsumed), total((row) => row.niaaConsumed)],
  };
};

export const healthDistribution = (rows: AnalyzedRow[]): { labels: string[]; values: number[] } => {
  const latest = latestByClient(rows);
  return {
    labels: ['0–39', '40–69', '70–84', '85–100'],
    values: [
      latest.filter((row) => row.health < 40).length,
      latest.filter((row) => row.health >= 40 && row.health < 70).length,
      latest.filter((row) => row.health >= 70 && row.health < 85).length,
      latest.filter((row) => row.health >= 85).length,
    ],
  };
};

export const leadCapacityByAccount = (rows: AnalyzedRow[]) => latestByClient(rows)
  .sort((a, b) => (b.leadUtil ?? -1) - (a.leadUtil ?? -1))
  .slice(0, 12)
  .map((row) => ({ label: row.clientName, leads: row.leads ?? 0, capacity: row.subscribedLeads ?? 0 }));
