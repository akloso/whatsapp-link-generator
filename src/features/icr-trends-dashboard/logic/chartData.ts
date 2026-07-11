import type { AnalyzedRow, ChartDefinition } from '../types';
import { latestByClient } from './metrics';

const n = (value: number | null) => (value !== null && Number.isFinite(value) && value > 0 ? value : 0);
const pct = (value: number | null) => Math.round(n(value) * 100);
const colors = ['#7c3aed', '#06b6d4', '#f59e0b', '#ef4444'];
const short = (name: string) => name.length > 28 ? `${name.slice(0, 25)}…` : name;

export const buildChartData = (rows: AnalyzedRow[], trendRows: AnalyzedRow[]): ChartDefinition[] => {
  const latest = latestByClient(rows);
  const topUtil = [...latest].sort((a, b) => n(b.leadUtil) - n(a.leadUtil)).slice(0, 12);
  const burden = [...latest].sort((a, b) => (n(b.unassigned) + n(b.untouched) + n(b.overdue)) - (n(a.unassigned) + n(a.untouched) + n(a.overdue))).slice(0, 12);
  const monthly = new Map<string, { leads: number; capacity: number }>();
  trendRows.filter((row) => row.timestamp).forEach((row) => {
    const key = row.timestamp!.toISOString().slice(0, 7);
    const item = monthly.get(key) ?? { leads: 0, capacity: 0 };
    item.leads += n(row.leads);
    item.capacity += n(row.subscribedLeads);
    monthly.set(key, item);
  });
  const months = [...monthly.keys()].sort();
  const ragLabels = ['Green', 'Amber', 'Red', 'Unknown'];
  const adoption = [avg(latest.map((row) => row.widgetAdoption)), avg(latest.map((row) => row.userAdoption)), avg(latest.map((row) => row.rawAdoption))].map(pct);
  const healthBuckets = [latest.filter((r) => r.health <= 39).length, latest.filter((r) => r.health >= 40 && r.health <= 69).length, latest.filter((r) => r.health >= 70 && r.health <= 84).length, latest.filter((r) => r.health >= 85).length];

  return [
    { id: 'lead-capacity', title: 'Lead capacity and utilisation', type: 'bar', horizontal: true, labels: topUtil.map((r) => short(r.clientName)), datasets: [{ label: 'Captured leads', data: topUtil.map((r) => n(r.leads)), backgroundColor: '#7c3aed' }, { label: 'Subscribed capacity', data: topUtil.map((r) => n(r.subscribedLeads)), backgroundColor: '#c4b5fd' }], summary: topUtil.map((r) => `${r.clientName}: ${n(r.leads).toLocaleString()} leads of ${n(r.subscribedLeads).toLocaleString()} capacity`).join('; ') },
    { id: 'health-mix', title: 'Account health mix', type: 'doughnut', labels: ragLabels, datasets: [{ label: 'Accounts', data: ragLabels.map((rag) => latest.filter((r) => r.rag === rag).length), backgroundColor: ['#16a34a', '#f59e0b', '#dc2626', '#64748b'] }], summary: ragLabels.map((rag) => `${rag}: ${latest.filter((r) => r.rag === rag).length}`).join('; ') },
    { id: 'lead-trend', title: 'Lead volume trend', type: 'line', labels: months, datasets: [{ label: 'Captured leads', data: months.map((m) => monthly.get(m)?.leads ?? 0), borderColor: '#7c3aed', backgroundColor: '#7c3aed' }, { label: 'Subscribed capacity', data: months.map((m) => monthly.get(m)?.capacity ?? 0), borderColor: '#06b6d4', backgroundColor: '#06b6d4' }], summary: months.map((m) => `${m}: ${(monthly.get(m)?.leads ?? 0).toLocaleString()} leads`).join('; ') },
    { id: 'operational-burden', title: 'Operational burden', type: 'bar', horizontal: true, stacked: true, labels: burden.map((r) => short(r.clientName)), datasets: [{ label: 'Unassigned', data: burden.map((r) => n(r.unassigned)), backgroundColor: '#f59e0b' }, { label: 'Untouched', data: burden.map((r) => n(r.untouched)), backgroundColor: '#ef4444' }, { label: 'Overdue', data: burden.map((r) => n(r.overdue)), backgroundColor: '#7c2d12' }], summary: burden.map((r) => `${r.clientName}: ${n(r.unassigned)} unassigned, ${n(r.untouched)} untouched, ${n(r.overdue)} overdue`).join('; ') },
    { id: 'product-adoption', title: 'Product adoption coverage', type: 'bar', labels: ['Widgets', 'Users', 'Raw data'], datasets: [{ label: 'Adoption %', data: adoption, backgroundColor: colors }], summary: `Widgets: ${adoption[0]}%; Users: ${adoption[1]}%; Raw data: ${adoption[2]}%` },
    { id: 'communication', title: 'Communication activity', type: 'bar', labels: ['Email', 'SMS', 'WhatsApp', 'NIAA'], datasets: [{ label: 'Consumed', data: [sum(latest.map((r) => r.emailConsumed)), sum(latest.map((r) => r.smsConsumed)), sum(latest.map((r) => r.whatsappConsumed)), sum(latest.map((r) => r.niaaConsumed))], backgroundColor: colors }], summary: `Email: ${sum(latest.map((r) => r.emailConsumed)).toLocaleString()}; SMS: ${sum(latest.map((r) => r.smsConsumed)).toLocaleString()}; WhatsApp: ${sum(latest.map((r) => r.whatsappConsumed)).toLocaleString()}; NIAA: ${sum(latest.map((r) => r.niaaConsumed)).toLocaleString()}` },
    { id: 'health-distribution', title: 'Health-score distribution', type: 'bar', labels: ['0–39', '40–69', '70–84', '85–100'], datasets: [{ label: 'Accounts', data: healthBuckets, backgroundColor: ['#dc2626', '#f59e0b', '#06b6d4', '#16a34a'] }], summary: `0–39: ${healthBuckets[0]}; 40–69: ${healthBuckets[1]}; 70–84: ${healthBuckets[2]}; 85–100: ${healthBuckets[3]}` },
  ];
};

const avg = (values: Array<number | null>) => {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
};
const sum = (values: Array<number | null>): number => values.reduce<number>((total, value) => total + n(value), 0);
