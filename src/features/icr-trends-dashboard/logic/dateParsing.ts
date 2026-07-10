import { isMissing, safe } from './normalize';

export const parseDate = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(epoch.getTime() + value * 86400000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (isMissing(value)) return null;
  const text = safe(value);
  const slash = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (slash) {
    const first = Number(slash[1]);
    const second = Number(slash[2]);
    const year = Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]);
    const month = first > 12 ? second - 1 : first - 1;
    const day = first > 12 ? first : second;
    const date = new Date(year, month, day, Number(slash[4] || 0), Number(slash[5] || 0), Number(slash[6] || 0));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const isoDate = (date: Date | null): string => date ? date.toISOString().slice(0, 10) : '';
