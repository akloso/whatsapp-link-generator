import { describe, expect, it } from 'vitest';
import {
  groupBalances,
  memberIdFor,
  personalSettlementBuckets,
  shareOf,
  simplify,
  type Expense,
  type Group,
  type Settlement,
} from './splitStoreV4';

const group: Group = {
  id: 'g1',
  name: 'Test group',
  emoji: '👥',
  currency: '₹',
  createdAt: '2026-08-16T00:00:00.000Z',
  members: [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
    { id: 'c', name: 'C' },
    { id: 'd', name: 'D' },
  ],
};

const expense = (overrides: Partial<Expense> = {}): Expense => ({
  id: 'e1',
  groupId: group.id,
  description: 'Test',
  amount: 500,
  baseAmount: 500,
  paidBy: 'a',
  payments: { a: 500 },
  split: { a: 1, b: 1, c: 1, d: 1 },
  splitLabels: {},
  mode: 'equal',
  category: 'general',
  date: '2026-08-16T00:00:00.000Z',
  personalItems: [],
  selectiveItems: [],
  additionalCharges: [],
  receiptItems: [],
  ...overrides,
});

const shares = (item: Expense) => group.members.map((member) => shareOf(item, member.id, group.members.map((entry) => entry.id)));
const expectMoney = (actual: number, expected: number) => expect(actual).toBeCloseTo(expected, 8);

describe('Splitzap calculation regression suite', () => {
  it('maps a signed-in account to its canonical member inside a shared group', () => {
    const sharedGroup: Group = { ...group, sharedId: 'shared-1', sharedRole: 'member', myMemberId: 'c' };
    expect(memberIdFor(sharedGroup, { me: 'device-user-id' })).toBe('c');
    expect(memberIdFor(group, { me: 'a' })).toBe('a');
  });

  it('splits an equal expense across all participants', () => {
    shares(expense()).forEach((value) => expectMoney(value, 125));
  });

  it('handles the ₹500 case with a ₹150 item shared by only three people', () => {
    const item = expense({
      selectiveItems: [{ id: 's1', description: 'Special item', amount: 150, memberIds: ['a', 'b', 'c'], mode: 'equal', split: { a: 1, b: 1, c: 1 } }],
    });
    const [a, b, c, d] = shares(item);
    expectMoney(a, 137.5); expectMoney(b, 137.5); expectMoney(c, 137.5); expectMoney(d, 87.5);
  });

  it('keeps personal items personal while splitting the remaining amount', () => {
    const [a, b, c, d] = shares(expense({ personalItems: [{ id: 'p1', memberId: 'a', description: 'Personal', amount: 100 }] }));
    expectMoney(a, 200); expectMoney(b, 100); expectMoney(c, 100); expectMoney(d, 100);
  });

  it('supports exact shared splits', () => {
    const [a, b, c, d] = shares(expense({ mode: 'exact', split: { a: 200, b: 150, c: 100, d: 50 } }));
    expectMoney(a, 200); expectMoney(b, 150); expectMoney(c, 100); expectMoney(d, 50);
  });

  it('supports percentage shared splits', () => {
    const [a, b, c, d] = shares(expense({ amount: 1000, baseAmount: 1000, payments: { a: 1000 }, mode: 'percentage', split: { a: 40, b: 30, c: 20, d: 10 } }));
    expectMoney(a, 400); expectMoney(b, 300); expectMoney(c, 200); expectMoney(d, 100);
  });

  it('supports exact selective-item allocation', () => {
    const [a, b, c, d] = shares(expense({ selectiveItems: [{ id: 's1', description: 'Drinks', amount: 150, memberIds: ['a', 'b'], mode: 'exact', split: { a: 100, b: 50 } }] }));
    expectMoney(a, 187.5); expectMoney(b, 137.5); expectMoney(c, 87.5); expectMoney(d, 87.5);
  });

  it('supports percentage selective-item allocation', () => {
    const [a, b, c, d] = shares(expense({ amount: 600, baseAmount: 600, payments: { a: 600 }, selectiveItems: [{ id: 's1', description: 'Upgrade', amount: 200, memberIds: ['a', 'b'], mode: 'percentage', split: { a: 75, b: 25 } }] }));
    expectMoney(a, 250); expectMoney(b, 150); expectMoney(c, 100); expectMoney(d, 100);
  });

  it('distributes additional charges equally among people with responsibility', () => {
    const [a, b, c, d] = shares(expense({ amount: 500, baseAmount: 400, payments: { a: 500 }, additionalCharges: [{ id: 'x', description: 'Service', amount: 100, distribution: 'equal' }] }));
    expectMoney(a, 125); expectMoney(b, 125); expectMoney(c, 125); expectMoney(d, 125);
  });

  it('distributes proportional charges according to base responsibility', () => {
    const [a, b, c, d] = shares(expense({ amount: 500, baseAmount: 400, payments: { a: 500 }, mode: 'exact', split: { a: 200, b: 100, c: 100 }, additionalCharges: [{ id: 'x', description: 'Tax', amount: 100, distribution: 'proportional' }] }));
    expectMoney(a, 250); expectMoney(b, 125); expectMoney(c, 125); expectMoney(d, 0);
  });

  it('credits multiple payers correctly', () => {
    const item = expense({ amount: 600, baseAmount: 600, payments: { a: 400, b: 200 }, split: { a: 1, b: 1, c: 1 } });
    const balances = groupBalances(group, [item], []);
    expectMoney(balances.a, 200); expectMoney(balances.b, 0); expectMoney(balances.c, -200); expectMoney(balances.d, 0);
    expect(simplify(balances)).toEqual([{ from: 'c', to: 'a', amount: 200 }]);
  });

  it('nets chained original obligations into the current simplified settlement', () => {
    const chainGroup: Group = {
      ...group,
      members: [
        { id: 'adarsh', name: 'Adarsh' },
        { id: 'madhav', name: 'Madhav' },
        { id: 'aryan', name: 'Aryan' },
      ],
    };
    const lunchDown: Expense = {
      ...expense(),
      id: 'lunch-down',
      groupId: chainGroup.id,
      description: 'Lunch down',
      amount: 90,
      baseAmount: 90,
      paidBy: 'madhav',
      payments: { madhav: 90 },
      mode: 'exact',
      split: { adarsh: 90 },
    };
    const lunchGg: Expense = {
      ...expense(),
      id: 'lunch-gg',
      groupId: chainGroup.id,
      description: 'Lunch gg',
      amount: 250,
      baseAmount: 250,
      paidBy: 'aryan',
      payments: { aryan: 250 },
      mode: 'equal',
      split: { madhav: 1, aryan: 1 },
    };
    const balances = groupBalances(chainGroup, [lunchDown, lunchGg], []);
    expectMoney(balances.adarsh, -90);
    expectMoney(balances.madhav, -35);
    expectMoney(balances.aryan, 125);
    expect(simplify(balances)).toEqual([
      { from: 'adarsh', to: 'aryan', amount: 90 },
      { from: 'madhav', to: 'aryan', amount: 35 },
    ]);
  });

  it('only exposes settlement actions for the signed-in debtor while keeping receivables view-only', () => {
    const balances = { a: -100, b: 60, c: 40, d: 0 };
    const mine = personalSettlementBuckets(balances, 'a');
    expect(mine.payable).toEqual([
      { from: 'a', to: 'b', amount: 60 },
      { from: 'a', to: 'c', amount: 40 },
    ]);
    expect(mine.receivable).toEqual([]);
    const creditor = personalSettlementBuckets(balances, 'b');
    expect(creditor.payable).toEqual([]);
    expect(creditor.receivable).toEqual([{ from: 'a', to: 'b', amount: 60 }]);
  });

  it('reduces balances after a partial settlement without changing the expense', () => {
    const item = expense({ amount: 600, baseAmount: 600, payments: { a: 400, b: 200 }, split: { a: 1, b: 1, c: 1 } });
    const settlements: Settlement[] = [{ id: 'pay1', groupId: group.id, from: 'c', to: 'a', amount: 50, date: '2026-08-16T01:00:00.000Z' }];
    const balances = groupBalances(group, [item], settlements);
    expectMoney(balances.a, 150); expectMoney(balances.c, -150);
    expect(simplify(balances)).toEqual([{ from: 'c', to: 'a', amount: 150 }]);
  });

  it('preserves the total for a complex expense to rounding tolerance', () => {
    const item = expense({
      amount: 1099.99,
      baseAmount: 999.99,
      payments: { a: 700, b: 399.99 },
      personalItems: [{ id: 'p1', memberId: 'd', description: 'Dessert', amount: 99.99 }],
      selectiveItems: [{ id: 's1', description: 'Drinks', amount: 300, memberIds: ['a', 'b', 'c'], mode: 'percentage', split: { a: 50, b: 30, c: 20 } }],
      additionalCharges: [{ id: 'x', description: 'Tax', amount: 100, distribution: 'proportional' }],
    });
    expectMoney(shares(item).reduce((sum, value) => sum + value, 0), 1099.99);
  });
});
