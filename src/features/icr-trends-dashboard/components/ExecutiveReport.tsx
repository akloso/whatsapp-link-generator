import { useMemo } from 'react';
import type { ChartConfiguration } from 'chart.js';
import type { AnalyzedRow } from '../types';
import { buildPortfolioSummary } from '../logic/metrics';
import {
  adoptionCoverage,
  burdenByAccount,
  communicationUsage,
  healthDistribution,
  leadCapacityByAccount,
  leadTrendSeries,
  ragMix,
} from '../logic/trends';
import { AccountPriorityTable } from './AccountPriorityTable';
import { IcrChartCard } from './IcrChartCard';

const number = (value: number): string => value.toLocaleString('en-IN');
const percent = (value: number | null): string => value === null ? '—' : `${Math.round(value * 100)}%`;

const chartOptions = (horizontal = false): ChartConfiguration['options'] => ({
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: horizontal ? 'y' : 'x',
  plugins: { legend: { position: 'bottom' } },
  scales: horizontal ? { x: { beginAtZero: true } } : undefined,
});

type ExecutiveReportProps = {
  rows: AnalyzedRow[];
  sourceName: string;
};

export function ExecutiveReport({ rows, sourceName }: ExecutiveReportProps) {
  const summary = useMemo(() => buildPortfolioSummary(rows), [rows]);
  const leadCapacity = useMemo(() => leadCapacityByAccount(rows), [rows]);
  const rag = useMemo(() => ragMix(rows), [rows]);
  const trend = useMemo(() => leadTrendSeries(rows), [rows]);
  const burden = useMemo(() => burdenByAccount(rows), [rows]);
  const adoption = useMemo(() => adoptionCoverage(rows), [rows]);
  const communication = useMemo(() => communicationUsage(rows), [rows]);
  const distribution = useMemo(() => healthDistribution(rows), [rows]);

  const kpis = [
    { label: 'Portfolio health', value: `${summary.portfolioHealth}/100`, detail: 'Average latest account health' },
    { label: 'Clients reviewed', value: number(summary.accountCount), detail: 'Latest filtered account snapshots' },
    { label: 'Critical accounts', value: number(summary.criticalAccounts), detail: 'Red or health below 45' },
    { label: 'Lead utilisation', value: percent(summary.leadUtilisation), detail: 'Captured leads versus capacity' },
    { label: 'Unassigned leads', value: number(summary.unassigned), detail: 'Latest filtered backlog' },
    { label: 'Untouched leads', value: number(summary.untouched), detail: 'Latest filtered backlog' },
    { label: 'Overdue follow-ups', value: number(summary.overdue), detail: 'Latest filtered backlog' },
    { label: 'Product adoption', value: `${percent(summary.widgetAdoption)} / ${percent(summary.userAdoption)}`, detail: 'Widgets / users' },
    { label: 'Communication usage', value: number(summary.emailConsumed + summary.smsConsumed + summary.whatsappConsumed), detail: 'Email + SMS + WhatsApp consumed' },
  ];

  const leadCapacityConfig: ChartConfiguration = {
    type: 'bar',
    data: {
      labels: leadCapacity.map((item) => item.label),
      datasets: [
        { label: 'Captured leads', data: leadCapacity.map((item) => item.leads), backgroundColor: 'rgba(124, 58, 237, 0.75)' },
        { label: 'Subscribed capacity', data: leadCapacity.map((item) => item.capacity), backgroundColor: 'rgba(148, 163, 184, 0.55)' },
      ],
    },
    options: chartOptions(true),
  };

  const ragConfig: ChartConfiguration = {
    type: 'doughnut',
    data: {
      labels: rag.labels,
      datasets: [{ data: rag.values, backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#94a3b8'] }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
  };

  const trendConfig: ChartConfiguration = {
    type: 'line',
    data: {
      labels: trend.labels,
      datasets: [
        { label: 'Captured leads', data: trend.leads, borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,.12)', tension: 0.25 },
        { label: 'Subscribed capacity', data: trend.capacity, borderColor: '#64748b', borderDash: [6, 5], tension: 0.2 },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } },
  };

  const burdenConfig: ChartConfiguration = {
    type: 'bar',
    data: {
      labels: burden.map((item) => item.label),
      datasets: [
        { label: 'Unassigned', data: burden.map((item) => item.unassigned), backgroundColor: '#f97316' },
        { label: 'Untouched', data: burden.map((item) => item.untouched), backgroundColor: '#eab308' },
        { label: 'Overdue', data: burden.map((item) => item.overdue), backgroundColor: '#ef4444' },
      ],
    },
    options: { ...chartOptions(true), scales: { x: { stacked: true, beginAtZero: true }, y: { stacked: true } } },
  };

  const adoptionConfig: ChartConfiguration = {
    type: 'bar',
    data: { labels: adoption.labels, datasets: [{ label: 'Adoption %', data: adoption.values, backgroundColor: ['#8b5cf6', '#6366f1', '#0ea5e9'] }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } },
  };

  const communicationConfig: ChartConfiguration = {
    type: 'bar',
    data: { labels: communication.labels, datasets: [{ label: 'Consumed', data: communication.values, backgroundColor: ['#7c3aed', '#2563eb', '#16a34a', '#db2777'] }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
  };

  const distributionConfig: ChartConfiguration = {
    type: 'bar',
    data: { labels: distribution.labels, datasets: [{ label: 'Accounts', data: distribution.values, backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'] }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
  };

  return (
    <section className="space-y-5" aria-labelledby="executive-report-title">
      <div className="rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-700 to-indigo-700 p-6 text-white shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-100">Executive report</p>
        <h2 id="executive-report-title" className="mt-2 text-3xl font-bold">Portfolio health and operating risk</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-violet-100">{sourceName || 'ICR workbook'} · {summary.accountCount} account{summary.accountCount === 1 ? '' : 's'} represented in the current filters.</p>
      </div>

      {!rows.length ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">No rows match the selected filters. Adjust the filters to restore report data.</div>
      ) : null}

      {rows.length ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {kpis.map((kpi) => (
              <article key={kpi.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</p>
                <p className="mt-3 text-2xl font-bold text-slate-950">{kpi.value}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">{kpi.detail}</p>
              </article>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <IcrChartCard title="Lead capacity and utilisation" description="Latest captured leads against subscribed capacity by account." config={leadCapacityConfig} empty={!leadCapacity.length} />
            <IcrChartCard title="Account health mix" description="Latest RAG distribution across filtered accounts." config={ragConfig} empty={!rag.values.some(Boolean)} />
            <IcrChartCard title="Lead volume trend" description="Monthly captured leads and subscribed capacity." config={trendConfig} empty={!trend.labels.length} />
            <IcrChartCard title="Operational burden" description="Unassigned, untouched, and overdue workload by account." config={burdenConfig} empty={!burden.length} />
            <IcrChartCard title="Product adoption coverage" description="Average latest widget, user, and raw-data adoption." config={adoptionConfig} empty={!summary.accountCount} />
            <IcrChartCard title="Communication activity" description="Latest consumed communication credits across channels." config={communicationConfig} empty={!summary.accountCount} />
            <IcrChartCard title="Health-score distribution" description="Latest account health grouped into operating bands." config={distributionConfig} empty={!distribution.values.some(Boolean)} />
          </div>

          <AccountPriorityTable rows={rows} />
        </>
      ) : null}
    </section>
  );
}
