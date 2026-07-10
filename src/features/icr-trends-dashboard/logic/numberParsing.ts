import type { ParsedPair } from '../types';
import { isMissing, safe } from './normalize';

export const tokenNumbers = (value: unknown): number[] => {
  if (typeof value === 'number' && Number.isFinite(value)) return [value];
  if (isMissing(value)) return [];
  return safe(value)
    .replace(/,/g, '')
    .match(/-?\d+(?:\.\d+)?\s*[km]?/gi)?.map((token) => {
      const lower = token.toLowerCase().trim();
      const multiplier = lower.endsWith('m') ? 1_000_000 : lower.endsWith('k') ? 1_000 : 1;
      return Number.parseFloat(lower) * multiplier;
    }).filter(Number.isFinite) ?? [];
};

export const parseNum = (value: unknown): number | null => tokenNumbers(value)[0] ?? null;

export const parsePair = (value: unknown): ParsedPair => {
  const numbers = tokenNumbers(value);
  return {
    a: numbers[0] ?? null,
    b: numbers[1] ?? null,
    count: numbers.length,
    ambiguous: numbers.length > 2,
  };
};

export const ratio = (numerator: number | null | undefined, denominator: number | null | undefined): number | null => {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || !denominator) return null;
  return Number(numerator) / Number(denominator);
};

export const sum = (values: Array<number | null | undefined>): number => values.reduce<number>((total, value) => total + (Number.isFinite(value) ? Number(value) : 0), 0);
export const avg = (values: Array<number | null | undefined>): number | null => {
  const valid = values.filter((value): value is number => Number.isFinite(value));
  return valid.length ? sum(valid) / valid.length : null;
};
export const median = (values: Array<number | null | undefined>): number | null => {
  const valid = values.filter((value): value is number => Number.isFinite(value)).sort((a, b) => a - b);
  if (!valid.length) return null;
  const middle = Math.floor(valid.length / 2);
  return valid.length % 2 ? valid[middle] : (valid[middle - 1] + valid[middle]) / 2;
};
