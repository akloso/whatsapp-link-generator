import type { AnalyzedRow, ParsedRow, PortfolioSummary, RagStatus, RiskThresholds } from '../types';

export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = { unassigned: 20, untouched: 35, overdue: 12, adoption: 55 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const validRatio = (value: number | null): number | null => (value !== null && Number.isFinite(value) && value >= 0 ? value : null);
const valueOrZero = (value: number | null) => (value !== null && Number.isFinite(value) && value > 0 ? value : 0);
const pct = (ratio: number | null) => ratio === null ? null : ratio * 100;

export const healthScore = (row: ParsedRow): number => {
  let score = 100;
  if (row.rag === 'Red') score -= 35;
  if (row.rag === 'Amber') score -= 20;

  score -= clamp((validRatio(row.unassignedRate) ?? 0) * 38, 0, 30);
  score -= clamp((validRatio(row.untouchedRate) ?? 0) * 32, 0, 28);
  score -= clamp((validRatio(row.overdueRate) ?? 0) * 22, 0, 18);

  const leadUtil = validRatio(row.leadUtil);
  if (leadUtil !== null && leadUtil > 1.2) score -= clamp((leadUtil - 1) * 10, 0, 15);
  if (leadUtil !== null && leadUtil < 0.08) score -= 10;

  score -= (1 - clamp(validRatio(row.widgetAdoption) ?? 0, 0, 1)) * 10;
  score -= (1 - clamp(validRatio(row.userAdoption) ?? 0, 0, 1)) * 8;
  if (row.dtcPlaced === false) score -= 6;
  if (row.tickets !== null && Number.isFinite(row.tickets) && row.tickets > 5) score -= clamp((row.tickets - 5) * 0.8, 0, 8);
  const confidence = clamp(row.dataConfidence, 0, 100);
  if (confidence < 95) score -= ((100 - confidence) / 100) * 8;
  return Math.round(clamp(score, 0, 100));
};

export const recommendation = (row: ParsedRow, health: number, thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS): string => {
  const unassigned = pct(validRatio(row.unassignedRate));
  const untouched = pct(validRatio(row.untouchedRate));
  const overdue = pct(validRatio(row.overdueRate));
  const widget = pct(validRatio(row.widgetAdoption));
  const user = pct(validRatio(row.userAdoption));
  const text = `${row.actionable} ${row.opportunity}`.toLowerCase();
  if (row.rag === 'Red' || health < 45) return 'Run an executive recovery review';
  if (unassigned !== null && unassigned >= thresholds.unassigned) return 'Fix allocation logic and clear unassigned backlog';
  if (untouched !== null && untouched >= thresholds.untouched) return 'Launch untouched-lead recovery sprint';
  if (overdue !== null && overdue >= thresholds.overdue) return 'Close overdue follow-ups with owner-wise plan';
  if (row.dtcPlaced === false) return 'Complete DTC / tracking implementation';
  if (widget !== null && widget < thresholds.adoption) return 'Activate subscribed widgets';
  if (user !== null && user < thresholds.adoption) return 'Run user-adoption training';
  if (row.tickets !== null && row.tickets > 5) return 'Review high ticket load';
  if (/(upsell|cross-sell)/.test(text)) return 'Convert identified upsell into a qualified plan';
  return 'Maintain cadence and validate next-quarter opportunity';
};

export const analyzeRows = (rows: ParsedRow[]): AnalyzedRow[] => rows.map((row) => {
  const health = healthScore(row);
  return { ...row, health, recommendation: recommendation(row, health) };
});

export const latestByClient = <T extends ParsedRow>(rows: T[]): T[] => {
  const selected = new Map<string, T>();
  rows.forEach((row) => {
    const current = selected.get(row._clientKey);
    const time = row.timestamp?.getTime() ?? Number.NEGATIVE_INFINITY;
    const currentTime = current?.timestamp?.getTime() ?? Number.NEGATIVE_INFINITY;
    if (!current || time > currentTime || (time === currentTime && row._row > current._row)) selected.set(row._clientKey, row);
  });
  return [...selected.values()];
};

const average = (values: Array<number | null>): number | null => {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
};

export const buildPortfolioSummary = (rows: AnalyzedRow[]): PortfolioSummary => {
  const latest = latestByClient(rows);
  const totalLeads = latest.reduce((sum, row) => sum + valueOrZero(row.leads), 0);
  const totalCapacity = latest.reduce((sum, row) => sum + valueOrZero(row.subscribedLeads), 0);
  return {
    accountCount: latest.length,
    portfolioHealth: average(latest.map((row) => row.health)),
    criticalAccounts: latest.filter((row) => row.rag === 'Red' || row.health < 45).length,
    leadUtilisation: totalCapacity > 0 ? totalLeads / totalCapacity : null,
    unassigned: latest.reduce((sum, row) => sum + valueOrZero(row.unassigned), 0),
    untouched: latest.reduce((sum, row) => sum + valueOrZero(row.untouched), 0),
    overdue: latest.reduce((sum, row) => sum + valueOrZero(row.overdue), 0),
    widgetAdoption: average(latest.map((row) => validRatio(row.widgetAdoption))),
    userAdoption: average(latest.map((row) => validRatio(row.userAdoption))),
    rawAdoption: average(latest.map((row) => validRatio(row.rawAdoption))),
    emailConsumed: latest.reduce((sum, row) => sum + valueOrZero(row.emailConsumed), 0),
    smsConsumed: latest.reduce((sum, row) => sum + valueOrZero(row.smsConsumed), 0),
    whatsappConsumed: latest.reduce((sum, row) => sum + valueOrZero(row.whatsappConsumed), 0),
    niaaConsumed: latest.reduce((sum, row) => sum + valueOrZero(row.niaaConsumed), 0),
  };
};

const ragRank = (rag: RagStatus) => ({ Red: 0, Amber: 1, Unknown: 2, Green: 3 })[rag];
export const sortPriorityRows = (rows: AnalyzedRow[]): AnalyzedRow[] => [...latestByClient(rows)].sort((a, b) =>
  a.health - b.health || ragRank(a.rag) - ragRank(b.rag) ||
  (valueOrZero(b.unassigned) + valueOrZero(b.untouched) + valueOrZero(b.overdue)) - (valueOrZero(a.unassigned) + valueOrZero(a.untouched) + valueOrZero(a.overdue)) ||
  a.clientName.localeCompare(b.clientName),
);
