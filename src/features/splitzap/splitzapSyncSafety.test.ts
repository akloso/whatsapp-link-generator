import { describe, expect, it } from 'vitest';
import { buildSharedGroupSnapshot, sharedSnapshotHash } from './splitzapShared';
import type { Expense, Group, SplitData } from './splitStoreV4';
import { compactSnapshotFingerprint, preserveDirtyRemoteRow, preserveDirtySharedGroupsOnBootstrap } from './splitzapSyncSafety';
import { isValidUpiId, settlementAuthority, upiIdFromQrValue } from './splitzapPaymentSafety';

type Snapshot = { expenses: string[] };
type Row = { id: string; snapshot: Snapshot; revision: number };
const hash = (snapshot: Snapshot) => JSON.stringify(snapshot);

const group: Group = {
  id: 'g1', name: 'Trip', emoji: '✈️', currency: '₹', createdAt: '2026-08-22T00:00:00.000Z',
  sharedId: 'shared-1', sharedRevision: 7, sharedRole: 'member', myMemberId: 'me',
  members: [{ id: 'me', name: 'Akash' }, { id: 'friend', name: 'Rahul' }],
};
const oldExpense: Expense = {
  id: 'old-expense', groupId: 'g1', description: 'Old', amount: 100, paidBy: 'friend',
  split: { me: 1, friend: 1 }, mode: 'equal', category: 'general', date: '2026-08-22T00:00:00.000Z',
};
const newExpense: Expense = {
  id: 'new-120-expense', groupId: 'g1', description: '₹120 expense', amount: 120, paidBy: 'friend',
  split: { me: 1, friend: 1 }, mode: 'equal', category: 'general', date: '2026-08-22T01:00:00.000Z',
};
const data = (expenses: Expense[]): SplitData => ({
  schemaVersion: 2, me: 'me', myName: 'Akash', groups: [group], expenses, settlements: [], history: [], activity: [],
  preferences: { defaultCurrency: '₹', theme: 'system', reducedMotion: false },
});

describe('Splitzap shared-sync safety', () => {
  it('never lets a stale remote snapshot erase a newer unsynced local expense', () => {
    const confirmed: Snapshot = { expenses: ['old-expense'] };
    const local: Snapshot = { expenses: ['new-120-expense', 'old-expense'] };
    const staleRemote: Row = { id: 'shared-1', snapshot: confirmed, revision: 8 };
    const result = preserveDirtyRemoteRow(staleRemote, local, 7, hash(confirmed), hash);
    expect(result.dirty).toBe(true);
    expect(result.row.snapshot).toEqual(local);
    expect(result.row.revision).toBe(7);
  });

  it('accepts remote data when the local snapshot has no unsynced change', () => {
    const confirmed: Snapshot = { expenses: ['e1'] };
    const remote: Row = { id: 'shared-1', snapshot: { expenses: ['e1', 'e2'] }, revision: 9 };
    const result = preserveDirtyRemoteRow(remote, confirmed, 8, hash(confirmed), hash);
    expect(result.dirty).toBe(false);
    expect(result.row).toBe(remote);
  });

  it('preserves an unsynced shared expense across an app restart before cloud sync finishes', () => {
    const serverAccount = data([oldExpense]);
    const localAccount = data([newExpense, oldExpense]);
    const confirmedSnapshot = buildSharedGroupSnapshot(serverAccount, group.id);
    const confirmed = new Map([['shared-1', {
      revision: 7,
      fingerprint: compactSnapshotFingerprint(sharedSnapshotHash(confirmedSnapshot)),
    }]]);
    const result = preserveDirtySharedGroupsOnBootstrap(serverAccount, localAccount, confirmed, false);
    expect(result.dirtyIds.has('shared-1')).toBe(true);
    expect(result.data.expenses.map((expense) => expense.id)).toEqual(['new-120-expense', 'old-expense']);
  });

  it('does not promote unrelated local data when the shared snapshot is already confirmed', () => {
    const serverAccount = data([oldExpense]);
    const localAccount = { ...data([oldExpense]), myName: 'Wrong local name' };
    const confirmedSnapshot = buildSharedGroupSnapshot(serverAccount, group.id);
    const confirmed = new Map([['shared-1', {
      revision: 7,
      fingerprint: compactSnapshotFingerprint(sharedSnapshotHash(confirmedSnapshot)),
    }]]);
    const result = preserveDirtySharedGroupsOnBootstrap(serverAccount, localAccount, confirmed, false);
    expect(result.dirtyIds.size).toBe(0);
    expect(result.data.myName).toBe('Akash');
  });
});


describe('Splitzap settlement and UPI safety', () => {
  it('keeps active-user receivables view-only but lets a disconnected debtor be marked received', () => {
    const debt = { from: 'friend', to: 'me', amount: 120 };
    expect(settlementAuthority(debt, 'me', new Set(['me', 'friend']))).toBeNull();
    expect(settlementAuthority(debt, 'me', new Set(['me']))).toBe('receiver-fallback');
    expect(settlementAuthority({ ...debt, from: 'me', to: 'friend' }, 'me', new Set(['me', 'friend']))).toBe('payer');
  });

  it('accepts manual UPI IDs and extracts the payee from a UPI QR payload', () => {
    expect(isValidUpiId('Akash.Test@Bank')).toBe(true);
    expect(upiIdFromQrValue('upi://pay?pa=akash.test%40bank&pn=Akash')).toBe('akash.test@bank');
    expect(upiIdFromQrValue('https://example.com/qr')).toBeNull();
  });
});
