import { FIELD_DEFS } from '../constants/fields';
import { HEADER_AUTO_THRESHOLD, HEADER_REVIEW_THRESHOLD } from '../constants/thresholds';
import type { CanonicalFieldKey } from '../types/icr';
import type { HeaderMapping } from '../types/mapping';
import { normaliseHeader, safeString } from './normaliseHeader';

export function similarity(a: unknown, b: unknown): number {
  const as = new Set(normaliseHeader(a).split(' ').filter((x) => x.length > 1));
  const bs = new Set(normaliseHeader(b).split(' ').filter((x) => x.length > 1));
  if (!as.size || !bs.size) return 0;
  let intersect = 0;
  as.forEach((x) => { if (bs.has(x)) intersect += 1; });
  return intersect / Math.max(as.size, bs.size);
}

export function headerMatchScore(header: unknown, alias: unknown): number {
  const h = normaliseHeader(header);
  const a = normaliseHeader(alias);
  if (!h || !a) return 0;
  if (h === a) return 1;
  if ((h.includes(a) || a.includes(h)) && Math.min(h.length, a.length) >= 6) return 0.94;
  const ht = new Set(h.split(' '));
  const at = new Set(a.split(' '));
  const common = [...ht].filter((x) => at.has(x)).length;
  const union = new Set([...ht, ...at]).size || 1;
  return Math.max(similarity(h, a), (common / union) * 0.96);
}

type BestMatch = { key: CanonicalFieldKey; score: number };

export function matchHeaders(headers: readonly unknown[]): HeaderMapping {
  const out: Record<string, HeaderMapping[string]> = {};
  const usedHeaders = new Set<string>();
  const usedFields = new Set<CanonicalFieldKey>();
  const rawHeaders = headers.map(safeString).filter(Boolean);

  rawHeaders.forEach((header) => { out[header] = { sourceHeader: header, key: '', score: 0, status: 'ignore' }; });

  FIELD_DEFS.forEach((field) => {
    let match = '';
    for (const header of rawHeaders) {
      if (usedHeaders.has(header)) continue;
      if ([field.label, ...field.aliases].some((alias) => normaliseHeader(header) === normaliseHeader(alias))) {
        match = header;
        break;
      }
    }
    if (match) {
      out[match] = { sourceHeader: match, key: field.key, score: 1, status: usedFields.has(field.key) ? 'duplicate' : 'auto' };
      usedHeaders.add(match);
      usedFields.add(field.key);
    }
  });

  rawHeaders.forEach((header) => {
    if (usedHeaders.has(header)) return;
    let bestKey: CanonicalFieldKey | null = null;
    let bestScore = -1;
    const alternatives: BestMatch[] = [];
    FIELD_DEFS.forEach((field) => {
      if (usedFields.has(field.key)) return;
      const score = Math.max(...[field.label, ...field.aliases].map((alias) => headerMatchScore(header, alias)));
      if (score >= HEADER_REVIEW_THRESHOLD) alternatives.push({ key: field.key, score });
      if (score > bestScore || (score === bestScore && (bestKey === null || field.key < bestKey))) {
        bestKey = field.key;
        bestScore = score;
      }
    });
    alternatives.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
    if (bestKey !== null && bestScore >= HEADER_REVIEW_THRESHOLD) {
      const ambiguous = alternatives.length > 1 && Math.abs(alternatives[0].score - alternatives[1].score) < 0.001;
      out[header] = { sourceHeader: header, key: ambiguous ? '' : bestKey, score: bestScore, status: ambiguous ? 'ambiguous' : bestScore >= HEADER_AUTO_THRESHOLD ? 'auto' : 'review', alternatives };
      if (!ambiguous) usedFields.add(bestKey);
    }
  });

  const seen = new Map<CanonicalFieldKey, string>();
  rawHeaders.forEach((header) => {
    const mapped = out[header];
    if (!mapped.key) return;
    const first = seen.get(mapped.key);
    if (first) out[header] = { ...mapped, status: 'duplicate' };
    else seen.set(mapped.key, mapped.sourceHeader);
  });
  return out;
}

export const autoMap = matchHeaders;
