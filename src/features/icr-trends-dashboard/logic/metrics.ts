import type { AnalyzedRow, ParsedRow, PortfolioSummary, RiskThresholds } from '../types';

export const DEFAULT_THRESHOLDS: RiskThresholds = {
  unassigned: 20,
  untouched: 35,
  overdue: 12,
  adoption: 55,
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const average = (values: Array<number | null | undefined>): number | null => {
  const valid = values.filter((value): value is number => Number.isFinite(value));
  return valid.length ? valid.reduce((total, value) => total + value, 0) / valid.length : null;
};

const sum = (values: Array<number | null | undefined>): number =>
  values.filter((value): value is number => Number.isFinite(value)).reduce((total, value) => total + value, 0);

export const healthScore = (row: ParsedRow): number => {
  let score = 100;
  if (row.rag === 'Red') score -= 35;
  else if (row.rag === 'Amber') score -= 20;

  if (row.unassignedRate !== null) score -= clamp(row.unassignedRate * 38, 0, 30);
  if (row.untouchedRate !== null) score -= clamp(row.untouchedRate * 32, 0, 28);
  if (row.overdueRate !== null) score -= clamp(row.overdueRate * 22, 0, 18);
  if (row.leadUtil !== null && row.leadUtil > 1.2) score -= clamp((row.leadUtil - 1) * 10, 0, 15);
  if (row.leadUtil !== null && row.leadUtil < 0.08) score -= 10;
  if (row.widgetAdoption !== null) score -= (1 - clamp(row.widgetAdoption, 0, 1)) * 10;
  if (row.userAdoption !== null) score -= (1 - clamp(row.userAdoption, 0, 1)) * 8;
  if (!row.dtcPlaced) score -= 6;
  if ((row.tickets ?? 0) > 5) score -= clamp(((row.tickets ?? 0) - 5) * 0.8, 0, 8);
  score -= ((100 - row.dataConfidence) / 100) * 8;

  return Math.round(clamp(score, 0, 100));
};

export const recommendation = (
  row: ParsedRow,
  health: number,
  thresholds: RiskThresholds = DEFAULT_THRESHOLDS,
): string => {
  const actions: string[] = [];
  if (row.rag === 'Red' || health < 45) actions.push('Run an executive recovery review');
  if (row.unassignedRate !== null && row.unassignedRate * 100 >= thresholds.unassigned) actions.push('Fix allocation logic and clear unassigned backlog');
  if (row.untouchedRate !== null && row.untouchedRate * 100 >= thresholds.untouched) actions.push('Launch untouched-lead recovery sprint');
  if (row.overdueRate !== null && row.overdueRate * 100 >= thresholds.overdue) actions.push('Close overdue follow-ups with owner-wise plan');
  if (!row.dtcPlaced) actions.push('Complete DTC / tracking implementation');
  if (row.widgetAdoption !== null && row.widgetAdoption * 100 < thresholds.adoption) actions.push('Activate subscribed widgets');
  if (row.userAdoption !== null && row.userAdoption * 100 < thresholds.adoption) actions.push('Run user-adoption training');
  if ((row.tickets ?? 0) > 5) actions.push('Review high ticket load');
  if (!actions.length && /upsell|cross-sell/i.test(`${row.actionable} ${row.opportunity}`)) actions.push('Convert identified upsell into a qualified plan');
  return actions[0] ?? 'Maintain cadence and validate next-quarter opportunity';
};

export const analyzeRows = (
  rows: ParsedRow[],
  thresholds: RiskThresholds = DEFAULT_THRESHOLDS,
): AnalyzedRow[] => rows.map((row) => {
  const health = healthScore(row);
  return { ...row, health, recommendation: recommendation(row, health, thresholds) };
});

export const latestByClient = <T extends ParsedRow>(rows: T[]): T[] => {
  const latest = new Map<string, T>();
  rows.forEach((row) => {
    const existing = latest.get(row._clientKey);
    const currentTime = row.timestamp?.getTime() ?? 0;
    const existingTime = existing?.timestamp?.getTime() ?? 0;
    if (!existing || currentTime > existingTime) latest.set(row._clientKey, row);
  });
  return [...latest.values()];
};

export const buildPortfolioSummary = (rows: AnalyzedRow[]): PortfolioSummary => {
  const latestRows = latestByClient(rows);
  const totalLeads = sum(latestRows.map((row) => row.leads));
  const totalCapacity = sum(latestRows.map((row) => row.subscribedLeads));
  return {
    accountCount: latestRows.length,
    portfolioHealth: Math.round(average(latestRows.map((row) => row.health)) ?? 0),
    criticalAccounts: latestRows.filter((row) => row.rag === 'Red' || row.health < 45).length,
    leadUtilisation: totalCapacity ? totalLeads / totalCapacity : null,
    unassigned: sum(latestRows.map((row) => row.unassigned)),
    untouched: sum(latestRows.map((row) => row.untouched)),
    overdue: sum(latestRows.map((row) => row.overdue)),
    widgetAdoption: average(latestRows.map((row) => row.widgetAdoption)),
    userAdoption: average(latestRows.map((row) => row.userAdoption)),
    rawAdoption: average(latestRows.map((row) => row.rawAdoption)),
    emailConsumed: sum(latestRows.map((row) => row.emailConsumed)),
    smsConsumed: sum(latestRows.map((row) => row.smsConsumed)),
    whatsappConsumed: sum(latestRows.map((row) => row.whatsappConsumed)),
    niaaConsumed: sum(latestRows.map((row) => row.niaaConsumed)),
  };
};
