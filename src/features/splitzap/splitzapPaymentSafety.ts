import type { Debt } from './splitStoreV4';

const UPI_RE = /^[a-z0-9][a-z0-9._-]{1,255}@[a-z0-9][a-z0-9._-]{1,63}$/i;

export function normalizeUpiId(value: string | null | undefined) {
  return String(value ?? '').trim().replace(/\s+/g, '').toLowerCase();
}

export function isValidUpiId(value: string | null | undefined) {
  return UPI_RE.test(normalizeUpiId(value));
}

export function upiIdFromQrValue(rawValue: string) {
  const raw = rawValue.trim();
  if (!raw) return null;
  if (isValidUpiId(raw)) return normalizeUpiId(raw);
  try {
    const url = new URL(raw);
    if (url.protocol.toLowerCase() !== 'upi:') return null;
    const id = normalizeUpiId(url.searchParams.get('pa'));
    return isValidUpiId(id) ? id : null;
  } catch {
    return null;
  }
}

export type SettlementAuthority = 'payer' | 'receiver-fallback' | null;

export function settlementAuthority(debt: Debt, currentMemberId: string, connectedMemberIds?: Set<string>): SettlementAuthority {
  if (debt.from === currentMemberId) return 'payer';
  if (debt.to === currentMemberId && connectedMemberIds && !connectedMemberIds.has(debt.from)) return 'receiver-fallback';
  return null;
}
