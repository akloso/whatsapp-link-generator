import { describe, expect, it } from 'vitest';
import { buildSharedGroupSnapshot, sharedSnapshotHash, type SharedGroupSnapshot } from './splitzapShared';
import type { Expense, Group, Settlement, SplitData } from './splitStoreV4';
import {
  buildSharedEntityBaseline,
  compactSnapshotFingerprint,
  preserveDirtyRemoteRow,
  preserveDirtySharedGroupsOnBootstrap,
  reconcileSharedGroupSnapshots,
} from './splitzapSyncSafety';
import { isValidUpiId, settlementAuthority } from './splitzapPaymentSafety';

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

const sharedSnapshot = (expenses: Expense[], settlements: Settlement[] = []): SharedGroupSnapshot => ({
  schemaVersion: 2,
  group: { ...group, sharedId: undefined, sharedRevision: undefined, sharedRole: undefined, myMemberId: undefined },
  expenses,
  settlements,
  history: [],
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

  it('auto-merges non-overlapping expense additions from two devices', () => {
    const baselineSnapshot = sharedSnapshot([oldExpense]);
    const localExpense: Expense = { ...newExpense, id: 'local-120' };
    const remoteExpense: Expense = { ...newExpense, id: 'remote-80', amount: 80, description: 'Remote ₹80' };
    const result = reconcileSharedGroupSnapshots(
      buildSharedEntityBaseline(baselineSnapshot),
      sharedSnapshot([localExpense, oldExpense]),
      sharedSnapshot([remoteExpense, oldExpense]),
    );
    expect(result.conflicts).toEqual([]);
    expect(result.snapshot?.expenses.map((expense) => expense.id)).toEqual(expect.arrayContaining(['old-expense', 'local-120', 'remote-80']));
  });

  it('refuses to silently choose a winner when both devices edit the same expense differently', () => {
    const baselineSnapshot = sharedSnapshot([oldExpense]);
    const local = { ...oldExpense, description: 'Local edit' };
    const remote = { ...oldExpense, description: 'Remote edit' };
    const result = reconcileSharedGroupSnapshots(
      buildSharedEntityBaseline(baselineSnapshot),
      sharedSnapshot([local]),
      sharedSnapshot([remote]),
    );
    expect(result.snapshot).toBeNull();
    expect(result.conflicts).toEqual([{ entityType: 'expense', entityId: 'old-expense' }]);
  });

  it('merges an expense change on one device with a settlement recorded on another', () => {
    const baselineSnapshot = sharedSnapshot([oldExpense]);
    const local = { ...oldExpense, note: 'Dinner details' };
    const payment: Settlement = {
      id: 'payment-1', groupId: 'g1', from: 'me', to: 'friend', amount: 50, date: '2026-08-22T02:00:00.000Z',
    };
    const result = reconcileSharedGroupSnapshots(
      buildSharedEntityBaseline(baselineSnapshot),
      sharedSnapshot([local]),
      sharedSnapshot([oldExpense], [payment]),
    );
    expect(result.conflicts).toEqual([]);
    expect(result.snapshot?.expenses[0]?.note).toBe('Dinner details');
    expect(result.snapshot?.settlements).toEqual([payment]);
  });
});


describe('Splitzap settlement and UPI safety', () => {
  it('keeps active-user receivables view-only but lets a disconnected debtor be marked received', () => {
    const debt = { from: 'friend', to: 'me', amount: 120 };
    expect(settlementAuthority(debt, 'me', new Set(['me', 'friend']))).toBeNull();
    expect(settlementAuthority(debt, 'me', new Set(['me']))).toBe('receiver-fallback');
    expect(settlementAuthority({ ...debt, from: 'me', to: 'friend' }, 'me', new Set(['me', 'friend']))).toBe('payer');
  });

  it('accepts valid manual UPI IDs and rejects malformed values', () => {
    expect(isValidUpiId('Akash.Test@Bank')).toBe(true);
    expect(isValidUpiId('not-a-upi-id')).toBe(false);
    expect(isValidUpiId('')).toBe(false);
  });
});
