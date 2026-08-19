import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value);
const frag = (name) => read(`scripts/splitzap-fragments/${name}`).trimEnd() + '\n\n';

function replaceOnce(source, from, to, label) {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(from, to);
}

function replaceBetween(source, start, end, replacement, label) {
  const a = source.indexOf(start);
  if (a < 0) throw new Error(`${label}: start marker not found`);
  const b = source.indexOf(end, a + start.length);
  if (b < 0) throw new Error(`${label}: end marker not found`);
  return source.slice(0, a) + replacement + source.slice(b);
}

// ---------------- Store: preferences, safe imports, automatic personal audit ----------------
{
  const path = 'src/features/splitzap/splitStoreV4.ts';
  let s = read(path);
  if (!s.includes('importSplitBackupSafely')) {
    s = replaceOnce(s,
      "  sharedStatus?: 'active' | 'archived';\n  sharedSchemaVersion?: number;\n  archivedAt?: string;\n};",
      "  sharedStatus?: 'active' | 'archived';\n  sharedSchemaVersion?: number;\n  archivedAt?: string;\n  status?: 'active' | 'archived';\n};",
      'generic group status');

    s = replaceOnce(s,
      "  history?: ExpenseHistoryEntry[];\n  activity?: LocalActivityEvent[];\n};",
      "  history?: ExpenseHistoryEntry[];\n  activity?: LocalActivityEvent[];\n  preferences?: { defaultCurrency: string; theme: 'system' | 'light' | 'dark'; reducedMotion: boolean };\n};",
      'preferences type');

    s = replaceOnce(s,
      "    activity: Array.isArray(data.activity) ? data.activity : [],\n  };",
      "    activity: Array.isArray(data.activity) ? data.activity : [],\n    preferences: data.preferences && typeof data.preferences === 'object' ? {\n      defaultCurrency: typeof data.preferences.defaultCurrency === 'string' ? data.preferences.defaultCurrency : '₹',\n      theme: data.preferences.theme === 'light' || data.preferences.theme === 'dark' ? data.preferences.theme : 'system',\n      reducedMotion: Boolean(data.preferences.reducedMotion),\n    } : { defaultCurrency: '₹', theme: 'system', reducedMotion: false },\n  };",
      'normalize preferences');

    const helper = String.raw`
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
`;
    s = replaceOnce(s, "function write(next: SplitData): boolean {\n  cache = normalize(next);", `${helper}\nfunction write(next: SplitData): boolean {\n  const previous = cache ?? read();\n  cache = normalize(deriveLocalActivity(previous, normalize(next)));`, 'derived local audit');

    const safeImport = String.raw`
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
`;
    s = replaceOnce(s, "export function withLocalActivity(data: SplitData, event: Omit<LocalActivityEvent, 'id' | 'date'> & { id?: string; date?: string }): SplitData {", `${safeImport}\nexport function withLocalActivity(data: SplitData, event: Omit<LocalActivityEvent, 'id' | 'date'> & { id?: string; date?: string }): SplitData {`, 'safe import');
    write(path, s);
  }
}

// ---------------- Core V4 UI ----------------
{
  const path = 'src/features/splitzap/SplitzapAppV4.tsx';
  let s = read(path);
  if (!s.includes('type SplitzapAuditEvent')) {
    s = replaceOnce(s, "  AlertTriangle,\n", "  AlertTriangle,\n  Archive,\n  CalendarDays,\n", 'icons part 1');
    s = replaceOnce(s, "  ChevronRight,\n", "  ChevronDown,\n  ChevronRight,\n", 'icons part 2');
    s = replaceOnce(s, "  ImagePlus,\n", "  Filter,\n  ImagePlus,\n", 'icons part 3');
    s = replaceOnce(s, "  Scale,\n", "  Scale,\n  Search,\n", 'icons part 4');
    s = replaceOnce(s, "  useSplitStorageStatus,\n", "  useSplitStorageStatus,\n  withLocalActivity,\n", 'store helper import');

    const oldCollaboration = String.raw`export type SplitzapCollaboration = {
  signedIn: boolean;
  onInviteGroup: (groupId: string) => void;
  onJoinGroup: () => void;
  onDeleteGroup: (group: Group) => Promise<void>;
};`;
    const newCollaboration = String.raw`export type SplitzapAuditEvent = { id: string; group_id: string; actor_user_id: string | null; actor_member_id: string | null; actor_name: string | null; event_type: string; entity_type: string; entity_id: string | null; event_data: Record<string, unknown>; revision: number | null; occurred_at: string };
export type SplitzapJoinRequestView = { id: string; group_id: string; requested_member_id: string | null; requested_name: string; requested_email: string; status: string; requested_at: string };
export type SplitzapMembershipView = { group_id: string; user_id: string; member_id: string; role: 'owner' | 'member'; joined_at?: string };
export type SplitzapCollaboration = {
  signedIn: boolean;
  activity?: SplitzapAuditEvent[];
  pendingRequests?: SplitzapJoinRequestView[];
  memberships?: SplitzapMembershipView[];
  onInviteGroup: (groupId: string, memberId?: string) => void;
  onManageMembers?: (groupId: string) => void;
  onJoinGroup: () => void;
  onDeleteGroup: (group: Group, mode: 'self' | 'everyone', transferMemberId?: string) => Promise<void>;
  onArchiveGroup?: (group: Group, archive: boolean) => Promise<void>;
  onResolveJoinRequest?: (requestId: string, approve: boolean) => Promise<void>;
};`;
    s = replaceOnce(s, oldCollaboration, newCollaboration, 'collaboration contract');
    s = replaceOnce(s, "? <ActivityScreen navigate={navigate} />", "? <ActivityScreen navigate={navigate} collaboration={collaboration} />", 'activity collaboration');

    s = replaceBetween(s, 'function HomeScreen(', 'function GroupScreen(', frag('v4-home.tsxfrag') + frag('v4-activity.tsxfrag'), 'home and activity');
    s = replaceBetween(s, 'function GroupScreen(', 'function BalancesTab(', frag('v4-group.tsxfrag'), 'group screen');
    s = replaceBetween(s, 'function BalancesTab(', 'const INSIGHT_COLORS', frag('v4-balances.tsxfrag'), 'balances');
    s = replaceBetween(s, 'function ExpenseResultSheet(', 'function HistoryDialog(', frag('v4-expense-result.tsxfrag'), 'expense result');
    s = replaceBetween(s, 'function SettleSheet(', 'function buildExpenseShareMessage(', frag('v4-settle.tsxfrag'), 'settlement');

    const confetti = String.raw`function ExpenseConfetti({ strong = false }: { strong?: boolean }) {
  return <span className={`expense-confetti ${strong ? 'is-strong' : ''}`} aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</span>;
}

const expenseDateInputValue = (value?: string) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const expenseDateToIso = (value: string) => {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

`;
    s = replaceOnce(s, 'function AnimatedMoney(', confetti + 'function AnimatedMoney(', 'confetti helpers');

    s = replaceOnce(s, "  if (JSON.stringify(before.splitLabels ?? {}) !== JSON.stringify(after.splitLabels ?? {})) add('Labels', 'Previous labels', 'Updated labels');\n", "  if (JSON.stringify(before.splitLabels ?? {}) !== JSON.stringify(after.splitLabels ?? {})) add('Labels', 'Previous labels', 'Updated labels');\n  if (expenseDateInputValue(before.date) !== expenseDateInputValue(after.date)) add('Date', expenseDateInputValue(before.date), expenseDateInputValue(after.date));\n", 'date history');

    s = replaceOnce(s, "  const [categoryTouched, setCategoryTouched] = useState(Boolean(editing));\n", "  const [categoryTouched, setCategoryTouched] = useState(Boolean(editing));\n  const [categoryOpen, setCategoryOpen] = useState(false);\n  const [expenseDate, setExpenseDate] = useState(expenseDateInputValue(editing?.date));\n  const [moreOpen, setMoreOpen] = useState(Boolean(editing && (editing.personalItems?.length || editing.selectiveItems?.length || editing.additionalCharges?.length || Object.keys(editing.payments ?? {}).length > 1)));\n", 'expense date state');

    s = replaceOnce(s, "      date: editing?.date ?? new Date().toISOString(), personalItems, selectiveItems, additionalCharges:", "      date: expenseDateToIso(expenseDate), personalItems, selectiveItems, additionalCharges:", 'expense date payload');

    s = replaceOnce(s,
      "      return { ...current, expenses: editing ? current.expenses.map((expense) => expense.id === editing.id ? payload : expense) : [payload, ...current.expenses], history: entry ? [entry, ...(current.history ?? [])] : current.history ?? [] };",
      "      const next = { ...current, expenses: editing ? current.expenses.map((expense) => expense.id === editing.id ? payload : expense) : [payload, ...current.expenses], history: entry ? [entry, ...(current.history ?? [])] : current.history ?? [] };\n      return group.sharedId ? next : withLocalActivity(next, { groupId: group.id, actorName: current.myName?.trim() || displayName(group, current, memberIdFor(group, current)), eventType: editing ? 'expense_updated' : 'expense_added', entityType: 'expense', entityId: payload.id, data: editing ? { before: editing, after: payload } : { after: payload } });",
      'expense local audit');

    s = replaceOnce(s, "    setSavedExpense(payload);\n", "    if (!editing) { try { navigator.vibrate?.(15); } catch { /* optional */ } }\n    setSavedExpense(payload);\n", 'expense haptic');
    s = replaceOnce(s, "<div className=\"success-state py-3 text-center\"><div className=\"success-check", "<div className=\"success-state relative py-3 text-center\">{!editing ? <ExpenseConfetti /> : null}<div className=\"success-check", 'expense confetti');

    const leadingStart = '<div className="mb-4 grid grid-cols-[minmax(0,1.7fr)_minmax(110px,.8fr)] gap-2">';
    const leadingEnd = '<Field label={`Split shared amount · ${money(sharedTotal, group?.currency)}`}>`'.slice(0, -1);
    s = replaceBetween(s, leadingStart, leadingEnd, frag('v4-expense-fields.tsxfrag'), 'compact expense fields');

    const optionsStart = '<div className="mb-3 grid grid-cols-3 gap-1.5">';
    const optionsEnd = '{chargeTotal > 0 ? <p className="pb-2';
    const optionsEndIndex = s.indexOf(optionsEnd, s.indexOf(optionsStart));
    if (optionsEndIndex < 0) throw new Error('expense options end marker not found');
    const optionsStartIndex = s.indexOf(optionsStart);
    s = s.slice(0, optionsStartIndex) + frag('v4-expense-options.tsxfrag') + s.slice(optionsEndIndex);

    s = replaceOnce(s, "  const [currency, setCurrency] = useState('₹');", "  const [currency, setCurrency] = useState(data.preferences?.defaultCurrency ?? '₹');", 'new group default currency');

    write(path, s);
  }
}

// ---------------- Cloud shell, verified invites, profile and member management ----------------
{
  const path = 'src/features/splitzap/SplitzapCloudApp.tsx';
  let s = read(path);
  if (!s.includes('ProfileScreen({ open')) {
    const imports = String.raw`import { ChevronRight, Cloud, CloudOff, Copy, Download, Eye, EyeOff, KeyRound, Link2, Loader2, LogOut, Mail, Share2, ShieldCheck, Upload, UserPlus, UserRound, X } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import SplitzapAppV4 from './SplitzapAppV4';
import { createSplitBackup, importSplitBackupSafely, memberIdFor, useSplitData, type Group, type SplitData } from './splitStoreV4';
import {
  fetchSplitzapCloudState, getSplitzapSession, onSplitzapAuthChange, saveSplitzapCloudState, sendSplitzapPasswordReset, signInSplitzapWithGoogle, signInSplitzapWithPassword, signOutSplitzap, signUpSplitzapWithPassword, updateSplitzapPassword, type SplitzapSession,
} from './splitzapCloud';
import {
  buildSharedGroupSnapshot, createSharedGroup, fetchSharedGroup, loadSharedGroupsForUser, mergeSharedRowsIntoLocal, removeGroupFromLocal, sharedSnapshotHash, subscribeToSharedGroupChanges, updateSharedGroup, type SharedGroupRow,
} from './splitzapShared';
import {
  archiveSharedGroup, buildInviteLink, createSharedInvite, deleteSplitzapAccount, disableSharedInvite, getSplitzapProfile, leaveSharedGroupV2, listPendingJoinRequests, listRecentlyDeletedGroups, listSharedActivity, listSharedInvites, listSharedMemberships, previewSharedInviteV2, renameSharedMember, requestSharedJoinV2, resolveSharedJoinRequest, restoreSharedGroup, sharedRowFromJoin, softDeleteSharedGroup, subscribeToProductionChanges, transferSharedGroupOwnership, unlinkSharedMember, updateSplitzapProfileName, updateSplitzapProfilePreferences,
  type InvitePreviewV2, type RecentlyDeletedGroup, type SharedActivityEvent, type SharedInvite, type SharedJoinRequest, type SharedMembership, type SplitzapProfile,
} from './splitzapProduction';

`;
    s = replaceBetween(s, 'import { Cloud,', "type SyncStatus", imports, 'cloud imports');
    s = replaceBetween(s, 'export default function SplitzapCloudApp()', 'function SharedGroupInviteSheet(', frag('cloud-app.tsxfrag'), 'cloud app');
    s = replaceBetween(s, 'function SharedGroupInviteSheet(', 'function JoinSharedGroupSheet(', frag('cloud-invite.tsxfrag'), 'invite component');
    s = replaceBetween(s, 'function JoinSharedGroupSheet(', 'function AccountSheet(', frag('cloud-join.tsxfrag') + frag('cloud-profile-manage.tsxfrag').replaceAll('React.ReactNode', 'ReactNode'), 'join/profile/manage');
    write(path, s);
  }
}

// ---------------- Color system, themes, confetti ----------------
{
  const path = 'src/features/splitzap/splitzap.css';
  let s = read(path);
  if (!s.includes('Splitzap production UX refresh')) {
    s += frag('production.cssfrag');
    write(path, s);
  }
}

// ---------------- Readiness assertions evolve with the product ----------------
{
  const path = '.github/workflows/splitzap-readiness.yml';
  let s = read(path);
  if (!s.includes('splitzap_create_invite')) {
    s = replaceOnce(s,
      "          grep -q \"Delete shared group\" src/features/splitzap/SplitzapAppV4.tsx\n",
      "          grep -q \"onDeleteGroup\" src/features/splitzap/SplitzapAppV4.tsx\n          grep -q \"Simplified settlement\" src/features/splitzap/SplitzapAppV4.tsx\n          grep -q \"type=\\\"date\\\"\" src/features/splitzap/SplitzapAppV4.tsx\n          grep -q \"splitzap_create_invite\" src/features/splitzap/splitzapProduction.ts\n          grep -q \"splitzap_resolve_join_request\" src/features/splitzap/splitzapProduction.ts\n          grep -q \"ProfileScreen\" src/features/splitzap/SplitzapCloudApp.tsx\n",
      'readiness assertions');
    write(path, s);
  }
}

console.log('Splitzap production UI and lifecycle patch applied.');
