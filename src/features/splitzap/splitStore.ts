import { useCallback, useEffect, useState } from 'react';

export type Member = { id: string; name: string };

export type SplitMode = 'equal' | 'exact' | 'shares';

export type PersonalItem = {
  id: string;
  memberId: string;
  description: string;
  amount: number;
};

export type Expense = {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  paidBy: string;
  split: Record<string, number>;
  /** Optional memberId -> human label, used for exact allocations. */
  splitLabels?: Record<string, string>;
  mode: SplitMode;
  category: string;
  date: string;
  note?: string;
  personalItems?: PersonalItem[];
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

const KEY = 'splitzap.v2';
const LEGACY_KEY = 'splitzap.v1';

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

const emptyData = (me = uid()): SplitData => ({
  me,
  groups: [],
  expenses: [],
  settlements: [],
});

const EMPTY: SplitData = { me: 'me', groups: [], expenses: [], settlements: [] };

function normalize(data: SplitData): SplitData {
  return {
    me: data.me || uid(),
    groups: Array.isArray(data.groups) ? data.groups : [],
    expenses: Array.isArray(data.expenses)
      ? data.expenses.map((expense) => ({
          ...expense,
          splitLabels:
            expense.splitLabels && typeof expense.splitLabels === 'object'
              ? expense.splitLabels
              : {},
          personalItems: Array.isArray(expense.personalItems) ? expense.personalItems : [],
        }))
      : [],
    settlements: Array.isArray(data.settlements) ? data.settlements : [],
  };
}

function stripLegacyDemo(data: SplitData): SplitData {
  const demoDescriptions = new Set([
    'Beach shack dinner',
    'Airbnb 2 nights',
    'Cab from airport',
  ]);

  const demoGroupIds = new Set(
    data.groups
      .filter((group) => {
        if (group.name !== 'Goa Trip') return false;
        const names = group.members.map((member) => member.name).sort().join('|');
        if (names !== ['Aditi', 'Rohan', 'You'].sort().join('|')) return false;
        const descriptions = data.expenses
          .filter((expense) => expense.groupId === group.id)
          .map((expense) => expense.description);
        return descriptions.length >= 3 && [...demoDescriptions].every((item) => descriptions.includes(item));
      })
      .map((group) => group.id),
  );

  if (!demoGroupIds.size) return data;

  return {
    ...data,
    groups: data.groups.filter((group) => !demoGroupIds.has(group.id)),
    expenses: data.expenses.filter((expense) => !demoGroupIds.has(expense.groupId)),
    settlements: data.settlements.filter((settlement) => !demoGroupIds.has(settlement.groupId)),
  };
}

let listeners: Array<() => void> = [];
let cache: SplitData | null = null;

function read(): SplitData {
  if (cache) return cache;
  if (typeof window === 'undefined') return EMPTY;

  try {
    const current = window.localStorage.getItem(KEY);
    if (current) {
      cache = normalize(JSON.parse(current) as SplitData);
      return cache;
    }

    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed = normalize(JSON.parse(legacy) as SplitData);
      cache = stripLegacyDemo(parsed);
      window.localStorage.setItem(KEY, JSON.stringify(cache));
      return cache;
    }

    cache = emptyData();
  } catch {
    cache = emptyData();
  }

  return cache;
}

function write(next: SplitData) {
  cache = normalize(next);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
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

export function personalTotalOf(expense: Expense) {
  return (expense.personalItems ?? []).reduce(
    (sum, item) => sum + Math.max(0, Number(item.amount) || 0),
    0,
  );
}

export function sharedAmountOf(expense: Expense) {
  return Math.max(0, expense.amount - personalTotalOf(expense));
}

export function personalShareOf(expense: Expense, memberId: string) {
  return (expense.personalItems ?? [])
    .filter((item) => item.memberId === memberId)
    .reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
}

export function sharedShareOf(expense: Expense, memberId: string): number {
  const entries = Object.entries(expense.split).filter(([, value]) => value > 0);
  if (!entries.length) return 0;

  if (expense.mode === 'exact') return expense.split[memberId] ?? 0;

  const totalWeight = entries.reduce((sum, [, value]) => sum + value, 0);
  const weight = expense.split[memberId] ?? 0;
  const sharedAmount = sharedAmountOf(expense);

  return totalWeight ? (sharedAmount * weight) / totalWeight : 0;
}

export function shareOf(expense: Expense, memberId: string): number {
  return sharedShareOf(expense, memberId) + personalShareOf(expense, memberId);
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
