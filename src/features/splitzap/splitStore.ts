import { useCallback, useEffect, useState } from 'react';

export type Member = { id: string; name: string };

export type SplitMode = 'equal' | 'exact' | 'shares';

export type Expense = {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  paidBy: string;
  split: Record<string, number>;
  mode: SplitMode;
  category: string;
  date: string;
  note?: string;
};

export type Settlement = {
  id: string;
  groupId: string;
  from: string;
  to: string;
  amount: number;
  date: string;
};

export type Group = {
  id: string;
  name: string;
  emoji: string;
  currency: string;
  members: Member[];
  createdAt: string;
};

export type SplitData = {
  me: string;
  groups: Group[];
  expenses: Expense[];
  settlements: Settlement[];
};

const KEY = 'splitzap.v1';

export const CATEGORIES = [
  { id: 'general', label: 'General', emoji: '🧾' },
  { id: 'food', label: 'Food & drink', emoji: '🍜' },
  { id: 'stay', label: 'Stay', emoji: '🏠' },
  { id: 'travel', label: 'Travel', emoji: '✈️' },
  { id: 'transport', label: 'Transport', emoji: '🚕' },
  { id: 'fun', label: 'Fun', emoji: '🎉' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { id: 'bills', label: 'Bills', emoji: '💡' },
];

export const CURRENCIES = ['₹', '$', '€', '£', '¥'];

export const uid = () => Math.random().toString(36).slice(2, 10);

function seed(): SplitData {
  const meId = uid();
  const a = uid();
  const b = uid();
  const gid = uid();
  const now = new Date();
  const day = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();

  return {
    me: meId,
    groups: [
      {
        id: gid,
        name: 'Goa Trip',
        emoji: '🏖️',
        currency: '₹',
        createdAt: day(9),
        members: [
          { id: meId, name: 'You' },
          { id: a, name: 'Aditi' },
          { id: b, name: 'Rohan' },
        ],
      },
    ],
    expenses: [
      {
        id: uid(),
        groupId: gid,
        description: 'Beach shack dinner',
        amount: 2400,
        paidBy: meId,
        split: { [meId]: 1, [a]: 1, [b]: 1 },
        mode: 'equal',
        category: 'food',
        date: day(2),
      },
      {
        id: uid(),
        groupId: gid,
        description: 'Airbnb 2 nights',
        amount: 9000,
        paidBy: a,
        split: { [meId]: 1, [a]: 1, [b]: 1 },
        mode: 'equal',
        category: 'stay',
        date: day(5),
      },
      {
        id: uid(),
        groupId: gid,
        description: 'Cab from airport',
        amount: 1500,
        paidBy: b,
        split: { [meId]: 1, [a]: 1, [b]: 1 },
        mode: 'equal',
        category: 'transport',
        date: day(6),
      },
    ],
    settlements: [],
  };
}

let listeners: Array<() => void> = [];
let cache: SplitData | null = null;

const EMPTY: SplitData = { me: 'me', groups: [], expenses: [], settlements: [] };

function read(): SplitData {
  if (cache) return cache;
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as SplitData) : seed();
  } catch {
    cache = seed();
  }
  return cache!;
}

function write(next: SplitData) {
  cache = next;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  }
  listeners.forEach((listener) => listener());
}

export function useSplitData() {
  const [hydrated, setHydrated] = useState(false);
  const [data, setData] = useState<SplitData>(EMPTY);

  useEffect(() => {
    const initial = read();
    if (!window.localStorage.getItem(KEY)) write(initial);
    setData(initial);
    setHydrated(true);
    const listener = () => setData({ ...read() });
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((item) => item !== listener);
    };
  }, []);

  const update = useCallback((fn: (data: SplitData) => SplitData) => {
    write(fn({ ...read() }));
  }, []);

  return { data, update, hydrated };
}

export function shareOf(expense: Expense, memberId: string): number {
  const entries = Object.entries(expense.split).filter(([, value]) => value > 0);
  if (!entries.length) return 0;
  if (expense.mode === 'exact') return expense.split[memberId] ?? 0;
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  const weight = expense.split[memberId] ?? 0;
  return total ? (expense.amount * weight) / total : 0;
}

export function groupBalances(
  group: Group,
  expenses: Expense[],
  settlements: Settlement[],
): Record<string, number> {
  const balance: Record<string, number> = {};
  group.members.forEach((member) => (balance[member.id] = 0));

  expenses
    .filter((expense) => expense.groupId === group.id)
    .forEach((expense) => {
      balance[expense.paidBy] = (balance[expense.paidBy] ?? 0) + expense.amount;
      group.members.forEach((member) => {
        balance[member.id] = (balance[member.id] ?? 0) - shareOf(expense, member.id);
      });
    });

  settlements
    .filter((settlement) => settlement.groupId === group.id)
    .forEach((settlement) => {
      balance[settlement.from] = (balance[settlement.from] ?? 0) + settlement.amount;
      balance[settlement.to] = (balance[settlement.to] ?? 0) - settlement.amount;
    });

  return balance;
}

export type Debt = { from: string; to: string; amount: number };

export function simplify(balance: Record<string, number>): Debt[] {
  const debtors = Object.entries(balance)
    .filter(([, value]) => value < -0.01)
    .map(([id, value]) => ({ id, value: -value }))
    .sort((a, b) => b.value - a.value);
  const creditors = Object.entries(balance)
    .filter(([, value]) => value > 0.01)
    .map(([id, value]) => ({ id, value }))
    .sort((a, b) => b.value - a.value);

  const result: Debt[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex]!;
    const creditor = creditors[creditorIndex]!;
    const amount = Math.min(debtor.value, creditor.value);
    result.push({ from: debtor.id, to: creditor.id, amount });
    debtor.value -= amount;
    creditor.value -= amount;
    if (debtor.value < 0.01) debtorIndex += 1;
    if (creditor.value < 0.01) creditorIndex += 1;
  }

  return result;
}

export function money(amount: number, currency = '₹') {
  const value = Math.abs(amount);
  return `${currency}${value.toLocaleString(undefined, {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function categoryOf(id: string) {
  return CATEGORIES.find((category) => category.id === id) ?? CATEGORIES[0]!;
}
