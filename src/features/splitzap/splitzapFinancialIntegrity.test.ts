import { describe, expect, it } from 'vitest';
import type { Expense, Group, SplitData } from './splitStoreV4';
import { inspectSharedSnapshotIntegrity, inspectSplitDataIntegrity } from './splitzapFinancialIntegrity';
import type { SharedGroupSnapshot } from './splitzapShared';

const group: Group = {
  id: 'g1',
  name: 'Goa Trip',
  emoji: '🏖️',
  currency: '₹',
  createdAt: '2026-08-26T00:00:00.000Z',
  members: [
    { id: 'a', name: 'Akash' },
    { id: 'b', name: 'Rahul' },
    { id: 'c', name: 'Aryan' },
    { id: 'd', name: 'Rohit' },
  ],
};

const selectiveExpense: Expense = {
  id: 'e500',
  groupId: 'g1',
  description: 'Dinner',
  amount: 500,
  baseAmount: 500,
  paidBy: 'a',
  split: { a: 1, b: 1, c: 1, d: 1 },
  mode: 'equal',
  category: 'food',
  date: '2026-08-26T00:00:00.000Z',
  selectiveItems: [{
    id: 'selective-150',
    description: 'Dessert',
    amount: 150,
    memberIds: ['a', 'b', 'c'],
    mode: 'equal',
    split: { a: 1, b: 1, c: 1 },
  }],
};

const snapshot = (expense: Expense): SharedGroupSnapshot => ({
  schemaVersion: 2,
  group,
  expenses: [expense],
  settlements: [],
  history: [],
});

describe('Splitzap financial integrity validation', () => {
  it('accepts the permanent selective-item regression example without changing its math', () => {
    expect(inspectSharedSnapshotIntegrity(snapshot(selectiveExpense))).toEqual([]);
  });

  it('blocks an expense when payer totals no longer equal the expense amount', () => {
    const broken: Expense = { ...selectiveExpense, payments: { a: 450 } };
    expect(inspectSharedSnapshotIntegrity(snapshot(broken)).map((issue) => issue.code)).toContain('expense-payment-total');
  });

  it('blocks an expense when split shares no longer conserve the expense total', () => {
    const broken: Expense = {
      ...selectiveExpense,
      selectiveItems: [],
      mode: 'exact',
      split: { a: 100, b: 100, c: 100, d: 100 },
    };
    expect(inspectSharedSnapshotIntegrity(snapshot(broken)).map((issue) => issue.code)).toContain('expense-share-total');
  });

  it('detects duplicate permanent financial IDs and orphaned records before cloud sync', () => {
    const duplicate = { ...selectiveExpense };
    const data: SplitData = {
      schemaVersion: 2,
      me: 'a',
      groups: [group],
      expenses: [selectiveExpense, duplicate, { ...selectiveExpense, id: 'orphan', groupId: 'missing' }],
      settlements: [],
      history: [],
      activity: [],
      preferences: { defaultCurrency: '₹', theme: 'system', reducedMotion: false },
    };
    const codes = inspectSplitDataIntegrity(data).map((issue) => issue.code);
    expect(codes).toContain('expense-id-duplicate-global');
    expect(codes).toContain('expense-orphan');
  });
});
