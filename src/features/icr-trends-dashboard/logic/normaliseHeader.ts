export function safeString(value: unknown): string { return value === null || value === undefined ? '' : String(value).trim(); }
export function isMissing(value: unknown): boolean { const s = safeString(value); return !s || /^(na|n\/a|none|null|not available|not visible|ns|-+)$/i.test(s); }
export function normaliseHeader(value: unknown): string { return safeString(value).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim(); }
