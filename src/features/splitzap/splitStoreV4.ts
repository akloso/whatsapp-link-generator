import { useCallback, useEffect, useState } from 'react';

export type Member = { id: string; name: string };
export type SplitMode = 'equal' | 'exact' | 'percentage';
export type ChargeDistribution = 'equal' | 'proportional';

export type PersonalItem = {
  id: string;
  memberId: string;
  description: string;
  amount: number;
};

export type AdditionalCharge = {
  id: string;
  description: string;
  amount: number;
  distribution: ChargeDistribution;
};

export type Expense = {
  id: string;
  groupId: string;
  description: string;
  /** Grand total including additional charges. */
  amount: number;
  /** Amount entered before additional charges. Legacy expenses fall back to amount. */
  baseAmount?: number;
  /** Primary/legacy payer. Multiple payer expenses additionally use payments. */
  paidBy: string;
  payments?: Record<string, number>;
  split: Record<string, number>;
  splitLabels?: Record<string, string>;
  mode: SplitMode;
  category: string;
  date: string;
  note?: string;
  personalItems?: PersonalItem[];
  additionalCharges?: AdditionalCharge[];
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

export type HistoryChange = {
  field: string;
  from: string;
  to: string;
};

export type ExpenseHistoryEntry = {
  id: string;
  expenseId: string;
  groupId: string;
  date: string;
  changes: HistoryChange[];
};

export type SplitData = {
  me: string;
  myName?: string;
  groups: Group[];
  expenses: Expense[];
  settlements: Settlement[];
  history?: ExpenseHistoryEntry[];
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
  myName: '',
  groups: [],
  expenses: [],
  settlements: [],
  history: [],
});

const EMPTY: SplitData = {
  me: 'me',
  myName: '',
  groups: [],
  expenses: [],
  settlements: [],
  history: [],
};

function normalizeSplit(rawMode: unknown, rawSplit: unknown) {
  const split = rawSplit && typeof rawSplit === 'object' ? { ...(rawSplit as Record<string, number>) } : {};
  if (rawMode !== 'shares') return split;
  const total = Object.values(split).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  if (!total) return split;
  return Object.fromEntries(
    Object.entries(split).map(([id, value]) => [id, (Math.max(0, Number(value) || 0) / total) * 100]),
  );
}

function normalizeExpense(raw: any): Expense {
  const mode: SplitMode = raw.mode === 'exact' ? 'exact' : raw.mode === 'percentage' || raw.mode === 'shares' ? 'percentage' : 'equal';
  const charges = Array.isArray(raw.additionalCharges) ? raw.additionalCharges : [];
  const chargeTotal = charges.reduce((sum, charge) => sum + Math.max(0, Number(charge.amount) || 0), 0);
  const fallbackBase = Math.max(0, (Number(raw.amount) || 0) - chargeTotal);
  return {
    ...raw,
    amount: Math.max(0, Number(raw.amount) || 0),
    baseAmount: Number.isFinite(Number(raw.baseAmount)) ? Math.max(0, Number(raw.baseAmount)) : fallbackBase,
    payments: raw.payments && typeof raw.payments === 'object' ? raw.payments : {},
    split: normalizeSplit(raw.mode, raw.split),
    splitLabels: raw.splitLabels && typeof raw.splitLabels === 'object' ? raw.splitLabels : {},
    mode,
    personalItems: Array.isArray(raw.personalItems) ? raw.personalItems : [],
    additionalCharges: charges.map((charge) => ({
      ...charge,
      id: charge.id || uid(),
      description: charge.description?.trim() || 'Charge',
      amount: Math.max(0, Number(charge.amount) || 0),
      distribution: charge.distribution === 'proportional' ? 'proportional' : 'equal',
    })),
  };
}

function normalize(data: SplitData): SplitData {
  const groups = Array.isArray(data.groups) ? data.groups : [];
  const storedName = typeof data.myName === 'string' ? data.myName.trim() : '';
  const inferredName = storedName || groups
    .flatMap((group) => group.members)
    .find((member) => member.id === data.me && member.name.trim() && member.name.trim().toLowerCase() !== 'you')
    ?.name.trim() || '';

  return {
    me: data.me || uid(),
    myName: inferredName,
    groups,
    expenses: Array.isArray(data.expenses) ? data.expenses.map((expense) => normalizeExpense(expense)) : [],
    settlements: Array.isArray(data.settlements) ? data.settlements : [],
    history: Array.isArray(data.history) ? data.history : [],
  };
}

function stripLegacyDemo(data: SplitData): SplitData {
  const demoDescriptions = new Set(['Beach shack dinner', 'Airbnb 2 nights', 'Cab from airport']);
  const demoGroupIds = new Set(
    data.groups
      .filter((group) => {
        if (group.name !== 'Goa Trip') return false;
        const names = group.members.map((member) => member.name).sort().join('|');
        if (names !== ['Aditi', 'Rohan', 'You'].sort().join('|')) return false;
        const descriptions = data.expenses.filter((expense) => expense.groupId === group.id).map((expense) => expense.description);
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
    history: (data.history ?? []).filter((entry) => !demoGroupIds.has(entry.groupId)),
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
      cache = stripLegacyDemo(normalize(JSON.parse(legacy) as SplitData));
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
  if (typeof window !== 'undefined') window.localStorage.setItem(KEY, JSON.stringify(cache));
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
    return () => { listeners = listeners.filter((item) => item !== listener); };
  }, []);
  const update = useCallback((fn: (data: SplitData) => SplitData) => write(fn({ ...read() })), []);
  return { data, update, hydrated };
}

export function additionalChargesTotal(expense: Expense) {
  return (expense.additionalCharges ?? []).reduce((sum, charge) => sum + Math.max(0, Number(charge.amount) || 0), 0);
}

export function baseAmountOf(expense: Expense) {
  if (Number.isFinite(Number(expense.baseAmount))) return Math.max(0, Number(expense.baseAmount));
  return Math.max(0, expense.amount - additionalChargesTotal(expense));
}

export function personalTotalOf(expense: Expense) {
  return (expense.personalItems ?? []).reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
}

export function sharedAmountOf(expense: Expense) {
  return Math.max(0, baseAmountOf(expense) - personalTotalOf(expense));
}

export function personalShareOf(expense: Expense, memberId: string) {
  return (expense.personalItems ?? [])
    .filter((item) => item.memberId === memberId)
    .reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
}

export function sharedShareOf(expense: Expense, memberId: string): number {
  const shared = sharedAmountOf(expense);
  if (expense.mode === 'exact') return Math.max(0, Number(expense.split[memberId]) || 0);
  if (expense.mode === 'percentage') return shared * Math.max(0, Number(expense.split[memberId]) || 0) / 100;
  const entries = Object.entries(expense.split).filter(([, value]) => Number(value) > 0);
  const totalWeight = entries.reduce((sum, [, value]) => sum + (Number(value) || 0), 0);
  const weight = Math.max(0, Number(expense.split[memberId]) || 0);
  return totalWeight ? shared * weight / totalWeight : 0;
}

export function baseShareOf(expense: Expense, memberId: string) {
  return sharedShareOf(expense, memberId) + personalShareOf(expense, memberId);
}

export function additionalChargeShareOf(expense: Expense, memberId: string, memberIds?: string[]) {
  const ids = memberIds ?? Object.keys(expense.split);
  const baseShares = Object.fromEntries(ids.map((id) => [id, baseShareOf(expense, id)]));
  const participants = ids.filter((id) => (baseShares[id] ?? 0) > 0.009);
  const denominator = participants.reduce((sum, id) => sum + (baseShares[id] ?? 0), 0);
  return (expense.additionalCharges ?? []).reduce((sum, charge) => {
    const amount = Math.max(0, Number(charge.amount) || 0);
    if (!amount || !participants.includes(memberId)) return sum;
    if (charge.distribution === 'proportional' && denominator > 0) {
      return sum + amount * (baseShares[memberId] ?? 0) / denominator;
    }
    return sum + amount / participants.length;
  }, 0);
}

export function shareOf(expense: Expense, memberId: string, memberIds?: string[]) {
  return baseShareOf(expense, memberId) + additionalChargeShareOf(expense, memberId, memberIds);
}

export function paymentsOf(expense: Expense): Record<string, number> {
  const supplied = expense.payments && typeof expense.payments === 'object'
    ? Object.fromEntries(Object.entries(expense.payments).filter(([, value]) => Number(value) > 0).map(([id, value]) => [id, Number(value)]))
    : {};
  if (Object.keys(supplied).length) return supplied;
  return expense.paidBy ? { [expense.paidBy]: expense.amount } : {};
}

export function groupBalances(group: Group, expenses: Expense[], settlements: Settlement[]): Record<string, number> {
  const balance: Record<string, number> = {};
  const memberIds = group.members.map((member) => member.id);
  group.members.forEach((member) => (balance[member.id] = 0));
  expenses.filter((expense) => expense.groupId === group.id).forEach((expense) => {
    Object.entries(paymentsOf(expense)).forEach(([payerId, amount]) => {
      balance[payerId] = (balance[payerId] ?? 0) + amount;
    });
    group.members.forEach((member) => {
      balance[member.id] = (balance[member.id] ?? 0) - shareOf(expense, member.id, memberIds);
    });
  });
  settlements.filter((settlement) => settlement.groupId === group.id).forEach((settlement) => {
    balance[settlement.from] = (balance[settlement.from] ?? 0) + settlement.amount;
    balance[settlement.to] = (balance[settlement.to] ?? 0) - settlement.amount;
  });
  return balance;
}

export function expenseBalances(expense: Expense, group: Group) {
  const balance: Record<string, number> = {};
  const memberIds = group.members.map((member) => member.id);
  group.members.forEach((member) => (balance[member.id] = 0));
  Object.entries(paymentsOf(expense)).forEach(([payerId, amount]) => {
    balance[payerId] = (balance[payerId] ?? 0) + amount;
  });
  group.members.forEach((member) => {
    balance[member.id] = (balance[member.id] ?? 0) - shareOf(expense, member.id, memberIds);
  });
  return balance;
}

export type Debt = { from: string; to: string; amount: number };

export function simplify(balance: Record<string, number>): Debt[] {
  const debtors = Object.entries(balance).filter(([, value]) => value < -0.01).map(([id, value]) => ({ id, value: -value })).sort((a, b) => b.value - a.value);
  const creditors = Object.entries(balance).filter(([, value]) => value > 0.01).map(([id, value]) => ({ id, value })).sort((a, b) => b.value - a.value);
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
