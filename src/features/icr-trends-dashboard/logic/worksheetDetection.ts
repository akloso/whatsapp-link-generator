import type { RawRow, WorksheetInfo } from '../types';
import { autoMap } from './columnMapping';
import { nkey } from './normalize';

export const MAX_WORKSHEETS = 50;
export const MAX_COLUMNS = 250;
export const MAX_ROWS = 50_000;

export type WorksheetCandidate = {
  name: string;
  rows: RawRow[];
  estimatedRows?: number;
};

export const headersFromRows = (rows: RawRow[], maxColumns = MAX_COLUMNS): string[] =>
  [...new Set(rows.slice(0, 50).flatMap((row) => Object.keys(row)))].slice(0, maxColumns);

export const inspectWorksheet = ({ name, rows, estimatedRows }: WorksheetCandidate): WorksheetInfo => {
  const headers = headersFromRows(rows);
  const mapping = autoMap(headers);
  const mapped = Object.values(mapping).filter((entry) => entry.key && entry.score >= 0.62);
  const exact = Object.values(mapping).filter((entry) => entry.key && entry.score === 1);
  const keys = new Set(mapped.map((entry) => entry.key));
  const normalizedName = nkey(name);
  let score = mapped.length * 3 + exact.length * 2 + Math.min(estimatedRows ?? rows.length, 200) / 40;

  if (keys.has('clientName')) score += 10;
  if (keys.has('rag')) score += 8;
  if (keys.has('timestamp')) score += 6;
  if (keys.has('leadPair')) score += 5;
  if (keys.has('owner')) score += 3;
  if (/form responses|icr|account|data|report/.test(normalizedName)) score += 4;
  if (/config|setting|helper|readme|summary|dashboard/.test(normalizedName)) score -= 8;
  if ((estimatedRows ?? rows.length) < 2) score -= 8;
  if (headers.length < 4) score -= 6;

  const recommendation: WorksheetInfo['recommendation'] = score >= 22 ? 'Recommended' : score >= 12 ? 'Viable' : 'Low confidence';
  const warnings: string[] = [];
  if (headers.length >= MAX_COLUMNS) warnings.push(`Only the first ${MAX_COLUMNS} columns were inspected.`);
  if ((estimatedRows ?? rows.length) > MAX_ROWS) warnings.push(`Only the first ${MAX_ROWS.toLocaleString()} rows will be parsed.`);
  return { name, estimatedRows: estimatedRows ?? rows.length, columnCount: headers.length, score, recommendation, warnings };
};

export const chooseBestWorksheet = (worksheets: WorksheetCandidate[]): { best: WorksheetInfo | null; inspected: WorksheetInfo[] } => {
  const inspected = worksheets.slice(0, MAX_WORKSHEETS).map(inspectWorksheet).sort((a, b) => b.score - a.score);
  return { best: inspected[0] ?? null, inspected };
};
