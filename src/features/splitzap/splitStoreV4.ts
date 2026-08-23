import { useCallback, useEffect, useState } from 'react';

export const SPLITZAP_SCHEMA_VERSION = 2;

export type Member = { id: string; name: string };
export type SplitMode = 'equal' | 'exact' | 'percentage';
export type ChargeDistribution = 'equal' | 'proportional';

export type PersonalItem = {
  id: string;
  memberId: string;
  description: string;
  amount: number;
};

export type SelectiveItem = {
  id: string;
  description: string;
  amount: number;
  memberIds: string[];
  mode: SplitMode;
  split: Record<string, number>;
};

export type AdditionalCharge = {
  id: string;
  description: string;
  amount: number;
  distribution: ChargeDistribution;
};

export type ReceiptItem = {
  id: string;
  description: string;
  amount: number;
  /** Empty/undefined means shared by the whole group; one id means personal; multiple ids mean shared by that subset. */
  memberId?: string;
  memberIds?: string[];
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
  selectiveItems?: SelectiveItem[];
  additionalCharges?: AdditionalCharge[];
  receiptItems?: ReceiptItem[];
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
  /** Level 2 collaboration metadata. These fields are local/account metadata, not bill math. */
  sharedId?: string;
  sharedRole?: 'owner' | 'member';
  myMemberId?: string;
  sharedRevision?: number;
  sharedJoinCode?: string;
  /** Local metadata returned by Level 2. Never used for bill math. */
  sharedStatus?: 'active' | 'archived';
  sharedSchemaVersion?: number;
  archivedAt?: string;
  status?: 'active' | 'archived';
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

export type LocalActivityEvent = {
  id: string;
  groupId: string;
  actorName: string;
  eventType: string;
  entityType: 'expense' | 'payment' | 'member' | 'group';
  entityId?: string;
  date: string;
  data?: Record<string, unknown>;
};

export type SplitData = {
  schemaVersion?: number;
  me: string;
  myName?: string;
  groups: Group[];
  expenses: Expense[];
  settlements: Settlement[];
  history?: ExpenseHistoryEntry[];
  activity?: LocalActivityEvent[];
  preferences?: { defaultCurrency: string; theme: 'system' | 'light' | 'dark'; reducedMotion: boolean };
};

/** A shared group can map this account to a canonical member id that differs from data.me. */
export const memberIdFor = (group: Group, data: Pick<SplitData, 'me'>) => group.myMemberId || data.me;

export type SplitzapBackup = {
  app: 'Splitzap';
  version: 2 | 3;
  exportedAt: string;
  data: SplitData;
};

const KEY = 'splitzap.v2';
const LEGACY_KEY = 'splitzap.v1';
const RECOVERY_KEY = 'splitzap.v2.recovery';

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
  schemaVersion: SPLITZAP_SCHEMA_VERSION,
  me,
  myName: '',
  groups: [],
  expenses: [],
  settlements: [],
  history: [],
  activity: [],
});

const EMPTY: SplitData = {
  schemaVersion: SPLITZAP_SCHEMA_VERSION,
  me: 'me',
  myName: '',
  groups: [],
  expenses: [],
  settlements: [],
  history: [],
  activity: [],
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

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function numberRecord(value: unknown): Record<string, number> {
  return Object.fromEntries(
    Object.entries(recordOf(value))
      .map(([id, amount]) => [id, Math.max(0, Number(amount) || 0)] as const)
      .filter(([, amount]) => amount > 0),
  );
}

function textRecord(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(recordOf(value))
      .filter(([, text]) => typeof text === 'string')
      .map(([id, text]) => [id, String(text)]),
  );
}

function normalizeExpense(rawValue: unknown): Expense {
  const raw = recordOf(rawValue);
  const rawMode = raw.mode;
  const mode: SplitMode = rawMode === 'exact' ? 'exact' : rawMode === 'percentage' || rawMode === 'shares' ? 'percentage' : 'equal';
  const charges = (Array.isArray(raw.additionalCharges) ? raw.additionalCharges : []).map(recordOf);
  const normalizedCharges: AdditionalCharge[] = charges.map((charge) => ({
    id: typeof charge.id === 'string' && charge.id ? charge.id : uid(),
    description: typeof charge.description === 'string' && charge.description.trim() ? charge.description.trim() : 'Charge',
    amount: Math.max(0, Number(charge.amount) || 0),
    distribution: charge.distribution === 'proportional' ? 'proportional' : 'equal',
  }));
  const receiptItems: ReceiptItem[] = (Array.isArray(raw.receiptItems) ? raw.receiptItems : [])
    .map(recordOf)
    .map((item) => ({
      id: typeof item.id === 'string' && item.id ? item.id : uid(),
      description: typeof item.description === 'string' && item.description.trim() ? item.description.trim() : 'Bill item',
      amount: Math.max(0, Number(item.amount) || 0),
      memberId: typeof item.memberId === 'string' && item.memberId ? item.memberId : undefined,
      memberIds: Array.isArray(item.memberIds) ? [...new Set(item.memberIds.filter((id): id is string => typeof id === 'string' && Boolean(id)))] : undefined,
    }))
    .filter((item) => item.amount > 0);
  const chargeTotal = normalizedCharges.reduce((sum, charge) => sum + charge.amount, 0);
  const totalAmount = Math.max(0, Number(raw.amount) || 0);
  const fallbackBase = Math.max(0, totalAmount - chargeTotal);
  const personalItems: PersonalItem[] = (Array.isArray(raw.personalItems) ? raw.personalItems : [])
    .map(recordOf)
    .map((item) => ({
      id: typeof item.id === 'string' && item.id ? item.id : uid(),
      memberId: typeof item.memberId === 'string' ? item.memberId : '',
      description: typeof item.description === 'string' && item.description.trim() ? item.description.trim() : 'Personal item',
      amount: Math.max(0, Number(item.amount) || 0),
    }))
    .filter((item) => item.memberId && item.amount > 0);
  const selectiveItems: SelectiveItem[] = (Array.isArray(raw.selectiveItems) ? raw.selectiveItems : [])
    .map(recordOf)
    .map((item) => {
      const itemMode: SplitMode = item.mode === 'exact' ? 'exact' : item.mode === 'percentage' ? 'percentage' : 'equal';
      const split = numberRecord(item.split);
      const memberIds = (Array.isArray(item.memberIds) ? item.memberIds : Object.keys(split))
        .filter((id): id is string => typeof id === 'string' && Boolean(id));
      return {
        id: typeof item.id === 'string' && item.id ? item.id : uid(),
        description: typeof item.description === 'string' && item.description.trim() ? item.description.trim() : 'Selective item',
        amount: Math.max(0, Number(item.amount) || 0),
        memberIds: [...new Set(memberIds)],
        mode: itemMode,
        split,
      };
    })
    .filter((item) => item.amount > 0 && item.memberIds.length > 0);

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
    groupId: typeof raw.groupId === 'string' ? raw.groupId : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    amount: totalAmount,
    baseAmount: Number.isFinite(Number(raw.baseAmount)) ? Math.max(0, Number(raw.baseAmount)) : fallbackBase,
    paidBy: typeof raw.paidBy === 'string' ? raw.paidBy : '',
    payments: numberRecord(raw.payments),
    split: normalizeSplit(rawMode, raw.split),
    splitLabels: textRecord(raw.splitLabels),
    mode,
    category: typeof raw.category === 'string' ? raw.category : 'general',
    date: typeof raw.date === 'string' ? raw.date : new Date().toISOString(),
    note: typeof raw.note === 'string' ? raw.note : undefined,
    personalItems,
    selectiveItems,
    additionalCharges: normalizedCharges,
    receiptItems,
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
    schemaVersion: SPLITZAP_SCHEMA_VERSION,
    me: data.me || uid(),
    myName: inferredName,
    groups,
    expenses: Array.isArray(data.expenses) ? data.expenses.map((expense) => normalizeExpense(expense)) : [],
    settlements: Array.isArray(data.settlements) ? data.settlements : [],
    history: Array.isArray(data.history) ? data.history : [],
    activity: Array.isArray(data.activity) ? data.activity : [],
    preferences: data.preferences && typeof data.preferences === 'object' ? {
      defaultCurrency: typeof data.preferences.defaultCurrency === 'string' ? data.preferences.defaultCurrency : '₹',
      theme: data.preferences.theme === 'light' || data.preferences.theme === 'dark' ? data.preferences.theme : 'system',
      reducedMotion: Boolean(data.preferences.reducedMotion),
    } : { defaultCurrency: '₹', theme: 'system', reducedMotion: false },
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
    activity: (data.activity ?? []).filter((entry) => !demoGroupIds.has(entry.groupId)),
  };
}

let listeners: Array<() => void> = [];
let storageListeners: Array<() => void> = [];
let cache: SplitData | null = null;
let storageError: string | null = null;

function setStorageError(message: string | null) {
  storageError = message;
  storageListeners.forEach((listener) => listener());
}

export function useSplitStorageStatus() {
  const [error, setError] = useState<string | null>(storageError);
  useEffect(() => {
    const listener = () => setError(storageError);
    storageListeners.push(listener);
    return () => { storageListeners = storageListeners.filter((item) => item !== listener); };
  }, []);
  return { storageError: error, clearStorageError: () => setStorageError(null) };
}

function parsedData(raw: string): SplitData {
  return normalize(JSON.parse(raw) as SplitData);
}

function read(): SplitData {
  if (cache) return cache;
  if (typeof window === 'undefined') return EMPTY;

  let current: string | null = null;
  try {
    current = window.localStorage.getItem(KEY);
  } catch {
    setStorageError('Browser storage is unavailable. Changes can work for this session but may not survive a refresh.');
    cache = emptyData();
    return cache;
  }

  if (current) {
    try {
      cache = parsedData(current);
      return cache;
    } catch {
      try {
        const recovery = window.localStorage.getItem(RECOVERY_KEY);
        if (recovery) {
          cache = parsedData(recovery);
          try { window.localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* keep recovered data in memory */ }
          setStorageError('Splitzap recovered your data from its local safety copy. Export a backup before continuing.');
          return cache;
        }
      } catch { /* recovery unavailable */ }
      setStorageError('Stored Splitzap data could not be read. Restore a backup before adding new expenses.');
      cache = emptyData();
      return cache;
    }
  }

  try {
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      cache = stripLegacyDemo(parsedData(legacy));
      try { window.localStorage.setItem(KEY, JSON.stringify(cache)); } catch {
        setStorageError('Your old Splitzap data was loaded, but the upgraded copy could not be saved. Export a backup now.');
      }
      return cache;
    }
  } catch {
    setStorageError('Browser storage is unavailable. Changes can work for this session but may not survive a refresh.');
  }

  cache = emptyData();
  return cache;
}


function currentActorName(data: SplitData, group?: Group) {
  const clean = data.myName?.trim();
  if (clean) return clean;
  if (group) {
    const member = group.members.find((item) => item.id === memberIdFor(group, data));
    if (member?.name?.trim()) return member.name.trim();
  }
  return 'You';
}

function deriveLocalActivity(previous: SplitData, next: SplitData): SplitData {
  if ((next.activity?.length ?? 0) !== (previous.activity?.length ?? 0)) return next;
  const events: LocalActivityEvent[] = [];
  const now = new Date().toISOString();
  const previousGroups = new Map(previous.groups.map((group) => [group.id, group]));
  const nextGroups = new Map(next.groups.map((group) => [group.id, group]));
  const add = (groupId: string, actorName: string, eventType: string, entityType: LocalActivityEvent['entityType'], entityId?: string, data?: Record<string, unknown>) => events.push({ id: uid(), groupId, actorName, eventType, entityType, entityId, date: now, data });

  next.groups.forEach((group) => {
    if (group.sharedId) return;
    const before = previousGroups.get(group.id);
    const actor = currentActorName(previous, before ?? group);
    if (!before) { add(group.id, currentActorName(next, group), 'group_created', 'group', group.id, { name: group.name }); return; }
    if (before.name !== group.name) add(group.id, actor, 'group_renamed', 'group', group.id, { from: before.name, to: group.name });
    if (before.currency !== group.currency) add(group.id, actor, 'group_currency_changed', 'group', group.id, { from: before.currency, to: group.currency });
    if ((before.status ?? 'active') !== (group.status ?? 'active')) add(group.id, actor, group.status === 'archived' ? 'group_archived' : 'group_unarchived', 'group', group.id, { status: group.status ?? 'active' });
    group.members.forEach((member) => {
      const oldMember = before.members.find((item) => item.id === member.id);
      if (!oldMember) add(group.id, actor, 'member_added', 'member', member.id, { member });
      else if (oldMember.name !== member.name) add(group.id, actor, 'member_renamed', 'member', member.id, { from: oldMember.name, to: member.name });
    });
    before.members.forEach((member) => { if (!group.members.some((item) => item.id === member.id)) add(group.id, actor, 'member_removed', 'member', member.id, { member }); });
  });
  previous.groups.forEach((group) => { if (!group.sharedId && !nextGroups.has(group.id)) add(group.id, currentActorName(previous, group), 'group_deleted', 'group', group.id, { name: group.name }); });

  const oldExpenses = new Map(previous.expenses.map((expense) => [expense.id, expense]));
  const newExpenses = new Map(next.expenses.map((expense) => [expense.id, expense]));
  next.expenses.forEach((expense) => {
    const group = nextGroups.get(expense.groupId);
    if (group?.sharedId) return;
    const before = oldExpenses.get(expense.id);
    const actor = currentActorName(previous, previousGroups.get(expense.groupId) ?? group);
    if (!before) add(expense.groupId, actor, 'expense_added', 'expense', expense.id, { after: expense });
    else if (JSON.stringify(before) !== JSON.stringify(expense)) add(expense.groupId, actor, 'expense_updated', 'expense', expense.id, { before, after: expense });
  });
  previous.expenses.forEach((expense) => { const group = previousGroups.get(expense.groupId); if (!group?.sharedId && !newExpenses.has(expense.id)) add(expense.groupId, currentActorName(previous, group), 'expense_deleted', 'expense', expense.id, { before: expense }); });

  const oldPayments = new Map(previous.settlements.map((payment) => [payment.id, payment]));
  const newPayments = new Map(next.settlements.map((payment) => [payment.id, payment]));
  next.settlements.forEach((payment) => { const group = nextGroups.get(payment.groupId); if (group?.sharedId) return; const before = oldPayments.get(payment.id); const actor = currentActorName(previous, previousGroups.get(payment.groupId) ?? group); if (!before) add(payment.groupId, actor, 'payment_recorded', 'payment', payment.id, { after: payment }); else if (JSON.stringify(before) !== JSON.stringify(payment)) add(payment.groupId, actor, 'payment_updated', 'payment', payment.id, { before, after: payment }); });
  previous.settlements.forEach((payment) => { const group = previousGroups.get(payment.groupId); if (!group?.sharedId && !newPayments.has(payment.id)) add(payment.groupId, currentActorName(previous, group), 'payment_removed', 'payment', payment.id, { before: payment }); });

  return events.length ? { ...next, activity: [...events, ...(next.activity ?? [])].slice(0, 2000) } : next;
}

function write(next: SplitData): boolean {
  const previous = cache ?? read();
  cache = normalize(deriveLocalActivity(previous, normalize(next)));
  let saved = true;
  if (typeof window !== 'undefined') {
    try {
      const previous = window.localStorage.getItem(KEY);
      if (previous) {
        try { window.localStorage.setItem(RECOVERY_KEY, previous); } catch { /* recovery copy is best-effort */ }
      }
      window.localStorage.setItem(KEY, JSON.stringify(cache));
      setStorageError(null);
    } catch {
      saved = false;
      setStorageError('Splitzap could not save this change to your device. Storage may be full or blocked. Export a backup before closing the app.');
    }
  }
  listeners.forEach((listener) => listener());
  return saved;
}

function validateBackupCandidate(value: unknown): value is SplitData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SplitData>;
  if (typeof candidate.me !== 'string' || !Array.isArray(candidate.groups) || !Array.isArray(candidate.expenses) || !Array.isArray(candidate.settlements)) return false;
  return candidate.groups.every((group) => Boolean(group)
    && typeof group.id === 'string'
    && typeof group.name === 'string'
    && typeof group.emoji === 'string'
    && typeof group.currency === 'string'
    && Array.isArray(group.members)
    && group.members.every((member) => Boolean(member) && typeof member.id === 'string' && typeof member.name === 'string'));
}

export function createSplitBackup(): string {
  const payload: SplitzapBackup = {
    app: 'Splitzap',
    version: 3,
    exportedAt: new Date().toISOString(),
    data: read(),
  };
  return JSON.stringify(payload, null, 2);
}

export function restoreSplitBackup(raw: string): SplitData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('This is not a valid Splitzap backup file.');
  }
  const envelope = parsed && typeof parsed === 'object' ? parsed as Partial<SplitzapBackup> : null;
  const candidate = envelope?.app === 'Splitzap' && envelope.data ? envelope.data : parsed;
  if (!validateBackupCandidate(candidate)) throw new Error('This backup does not contain valid Splitzap data.');
  const next = normalize(candidate);
  if (!write(next)) throw new Error('The backup was read, but your browser could not save the restored data.');
  return next;
}


export function importSplitBackupSafely(raw: string): { importedGroups: number; skippedSharedGroups: number } {
  const parsed = JSON.parse(raw) as unknown;
  const record = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  const candidate = record.app === 'Splitzap' && record.data ? record.data : parsed;
  if (!validateBackupCandidate(candidate)) throw new Error('This file is not a valid Splitzap export.');
  const imported = normalize(candidate as SplitData);
  const current = read();
  let importedGroups = 0;
  let skippedSharedGroups = 0;
  let groups = [...current.groups];
  let expenses = [...current.expenses];
  let settlements = [...current.settlements];
  let history = [...(current.history ?? [])];
  let activity = [...(current.activity ?? [])];

  for (const sourceGroup of imported.groups) {
    if (sourceGroup.sharedId) { skippedSharedGroups += 1; continue; }
    const groupId = groups.some((item) => item.id === sourceGroup.id) ? uid() : sourceGroup.id;
    const group = { ...sourceGroup, id: groupId, sharedId: undefined, sharedJoinCode: undefined, sharedRevision: undefined, sharedRole: undefined, myMemberId: sourceGroup.myMemberId && sourceGroup.myMemberId !== imported.me ? sourceGroup.myMemberId : undefined, status: sourceGroup.status ?? 'active' };
    const expenseIdMap = new Map<string, string>();
    const clonedExpenses = imported.expenses.filter((item) => item.groupId === sourceGroup.id).map((item) => { const id = expenses.some((existing) => existing.id === item.id) || groupId !== sourceGroup.id ? uid() : item.id; expenseIdMap.set(item.id, id); return { ...item, id, groupId }; });
    const clonedPayments = imported.settlements.filter((item) => item.groupId === sourceGroup.id).map((item) => ({ ...item, id: settlements.some((existing) => existing.id === item.id) || groupId !== sourceGroup.id ? uid() : item.id, groupId }));
    const clonedHistory = (imported.history ?? []).filter((item) => item.groupId === sourceGroup.id).map((item) => ({ ...item, id: uid(), groupId, expenseId: expenseIdMap.get(item.expenseId) ?? item.expenseId }));
    const clonedActivity = (imported.activity ?? []).filter((item) => item.groupId === sourceGroup.id).map((item) => ({ ...item, id: uid(), groupId, entityId: item.entityType === 'expense' && item.entityId ? expenseIdMap.get(item.entityId) ?? item.entityId : item.entityId }));
    groups = [group, ...groups]; expenses = [...clonedExpenses, ...expenses]; settlements = [...clonedPayments, ...settlements]; history = [...clonedHistory, ...history]; activity = [...clonedActivity, ...activity]; importedGroups += 1;
  }

  write({ ...current, groups, expenses, settlements, history, activity });
  return { importedGroups, skippedSharedGroups };
}

export function withLocalActivity(data: SplitData, event: Omit<LocalActivityEvent, 'id' | 'date'> & { id?: string; date?: string }): SplitData {
  const next: LocalActivityEvent = { ...event, id: event.id ?? uid(), date: event.date ?? new Date().toISOString() };
  return { ...data, activity: [next, ...(data.activity ?? [])].slice(0, 2000) };
}

export function useSplitData() {
  const [hydrated, setHydrated] = useState(false);
  const [data, setData] = useState<SplitData>(EMPTY);
  useEffect(() => {
    const initial = read();
    try {
      if (!window.localStorage.getItem(KEY) && !storageError) write(initial);
    } catch { /* read() already exposes the storage problem */ }
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

export function selectiveItemsTotal(expense: Expense) {
  return (expense.selectiveItems ?? []).reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
}

export function selectiveItemShare(item: SelectiveItem, memberId: string) {
  if (!item.memberIds.includes(memberId) || !item.memberIds.length) return 0;
  const amount = Math.max(0, Number(item.amount) || 0);
  if (item.mode === 'exact') return Math.max(0, Number(item.split[memberId]) || 0);
  if (item.mode === 'percentage') return amount * Math.max(0, Number(item.split[memberId]) || 0) / 100;
  return amount / item.memberIds.length;
}

export function selectiveShareOf(expense: Expense, memberId: string) {
  return (expense.selectiveItems ?? []).reduce((sum, item) => sum + selectiveItemShare(item, memberId), 0);
}

export function sharedAmountOf(expense: Expense) {
  return Math.max(0, baseAmountOf(expense) - personalTotalOf(expense) - selectiveItemsTotal(expense));
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
  return sharedShareOf(expense, memberId) + personalShareOf(expense, memberId) + selectiveShareOf(expense, memberId);
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

export function personalSettlementBuckets(balance: Record<string, number>, memberId: string) {
  const all = simplify(balance);
  return {
    payable: all.filter((debt) => debt.from === memberId),
    receivable: all.filter((debt) => debt.to === memberId),
  };
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
