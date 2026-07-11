import type { AnalyzedRow, ChartDefinition, PortfolioSummary } from '../types';
import { AccountPriorityTable } from './AccountPriorityTable';
import { IcrChartCard } from './IcrChartCard';

type Props = { sourceName: string; sourceType: string; rows: AnalyzedRow[]; summary: PortfolioSummary; charts: ChartDefinition[]; rangeLabel: string; filterError: string };
const pct = (value: number | null) => value === null ? '—' : `${Math.round(value * 100)}%`;
const num = (value: number | null | undefined) => value === null || value === undefined ? '—' : value.toLocaleString();
const healthLabel = (score: number | null) => score === null ? 'Not available' : score >= 85 ? 'Strong' : score >= 70 ? 'Stable' : score >= 40 ? 'Needs attention' : 'Critical';

export function ExecutiveReport({ sourceName, sourceType, rows, summary, charts, rangeLabel, filterError }: Props) {
  if (filterError) return <section className="icr-report icr-no-result" role="status"><h2>No report results</h2><p>{filterError}</p></section>;
  if (!rows.length) return <section className="icr-report icr-no-result" role="status"><h2>No report results</h2><p>No accounts match the selected filters. Adjust the filters or date range to continue.</p></section>;
  const portfolioHealth = summary.portfolioHealth === null ? null : Math.round(summary.portfolioHealth);
  return <section className="icr-report" aria-labelledby="icr-report-title">
    <header className="icr-report-header"><div><p className="icr-eyebrow">Executive Report</p><h2 id="icr-report-title">Portfolio analytics</h2><p>Source: {sourceName || 'Workbook'} {sourceType ? `(${sourceType.toUpperCase()})` : ''}. Period: {rangeLabel}.</p></div><div className="icr-score-panel"><span>Portfolio health</span><strong>{portfolioHealth ?? '—'}<small>/100</small></strong><em>{healthLabel(portfolioHealth)}</em><p>{summary.accountCount} account{summary.accountCount === 1 ? '' : 's'} · {summary.criticalAccounts} critical</p></div></header>
    <div className="icr-executive-summary"><h3>Executive summary</h3><p>{summary.criticalAccounts ? `${summary.criticalAccounts} critical account(s) need leadership attention.` : 'No critical accounts in the selected latest snapshot.'} Lead utilisation is {pct(summary.leadUtilisation)} and product adoption is {pct(summary.widgetAdoption)} for widgets, {pct(summary.userAdoption)} for users, and {pct(summary.rawAdoption)} for raw data.</p></div>
    <div className="icr-kpi-grid">
      <Kpi title="Portfolio health" value={portfolioHealth === null ? '—' : `${portfolioHealth}/100`} note={healthLabel(portfolioHealth)} /><Kpi title="Clients reviewed" value={summary.accountCount.toLocaleString()} note="Latest relevant accounts" /><Kpi title="Critical accounts" value={summary.criticalAccounts.toLocaleString()} note="Red RAG or health below 45" /><Kpi title="Lead utilisation" value={pct(summary.leadUtilisation)} note="Captured / subscribed capacity" /><Kpi title="Unassigned leads" value={num(summary.unassigned)} note="Latest account total" /><Kpi title="Untouched leads" value={num(summary.untouched)} note="Latest account total" /><Kpi title="Overdue follow-ups" value={num(summary.overdue)} note="Latest account total" /><Kpi title="Product adoption" value={pct(summary.widgetAdoption)} note={`Users ${pct(summary.userAdoption)} · Raw data ${pct(summary.rawAdoption)}`} /><Kpi title="Communication usage" value={num(summary.emailConsumed + summary.smsConsumed + summary.whatsappConsumed + summary.niaaConsumed)} note={`Email ${num(summary.emailConsumed)} · SMS ${num(summary.smsConsumed)} · WhatsApp ${num(summary.whatsappConsumed)} · NIAA ${num(summary.niaaConsumed)}`} />
    </div>
    <div className="icr-chart-grid">{charts.map((chart) => <IcrChartCard key={chart.id} chart={chart} />)}</div>
    <AccountPriorityTable rows={rows} />
  </section>;
}
function Kpi({ title, value, note }: { title: string; value: string; note: string }) { return <article className="icr-kpi-card"><span>{title}</span><strong>{value}</strong><p>{note || 'Not available'}</p></article>; }
