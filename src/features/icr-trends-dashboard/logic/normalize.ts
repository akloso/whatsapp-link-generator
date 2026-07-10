import type { RagStatus } from '../types';

export const safe = (value: unknown): string => (value === null || value === undefined ? '' : String(value).trim());

export const nkey = (value: unknown): string =>
  safe(value).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();

export const isMissing = (value: unknown): boolean =>
  !safe(value) || /^(na|n\/a|none|null|not available|not visible|ns|-+)$/i.test(safe(value));

export const truncateCell = (value: unknown, max = 1000): string => {
  const text = safe(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
};

export const normalizeRag = (value: unknown): RagStatus => {
  const normalized = nkey(value);
  if (/green|healthy|good/.test(normalized)) return 'Green';
  if (/amber|yellow|watch|medium/.test(normalized)) return 'Amber';
  if (/red|critical|risk|bad/.test(normalized)) return 'Red';
  return 'Unknown';
};

export const canonicalClient = (name: unknown, id?: unknown): string => {
  const idValue = safe(id);
  if (idValue) return `id:${nkey(idValue)}`;
  return `name:${nkey(name)}`;
};

export const similarity = (a: unknown, b: unknown): number => {
  const left = nkey(a);
  const right = nkey(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.9;
  const aw = new Set(left.split(' '));
  const bw = new Set(right.split(' '));
  const inter = [...aw].filter((word) => bw.has(word)).length;
  const union = new Set([...aw, ...bw]).size;
  return union ? inter / union : 0;
};

export const headerMatchScore = (header: string, alias: string): number => {
  const score = similarity(header, alias);
  const h = nkey(header);
  const a = nkey(alias);
  if (score === 1) return 1;
  if (h.startsWith(a) || a.startsWith(h)) return Math.max(score, 0.88);
  return score;
};
