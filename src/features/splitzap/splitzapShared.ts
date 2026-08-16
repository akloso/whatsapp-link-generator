import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import {
  type Expense,
  type ExpenseHistoryEntry,
  type Group,
  type Settlement,
  type SplitData,
} from './splitStoreV4';
import { splitzapSupabase } from './splitzapCloud';

export type SharedRole = 'owner' | 'member';

export type SharedGroupSnapshot = {
  group: Group;
  expenses: Expense[];
  settlements: Settlement[];
  history: ExpenseHistoryEntry[];
};

export type SharedGroupRow = {
  id: string;
  join_code: string;
  snapshot: SharedGroupSnapshot;
  revision: number;
  updated_at: string;
  member_id: string;
  role: SharedRole;
};

export type JoinPreview = {
  shared_id: string;
  group_name: string;
  emoji: string;
  members: Array<{ id: string; name: string }>;
  claimed_member_ids: string[];
  already_joined: boolean;
};

const cleanGroupForSnapshot = (group: Group): Group => {
  const {
    sharedId: _sharedId,
    sharedRole: _sharedRole,
    myMemberId: _myMemberId,
    sharedRevision: _sharedRevision,
    sharedJoinCode: _sharedJoinCode,
    ...clean
  } = group;
  return clean;
};

export function buildSharedGroupSnapshot(data: SplitData, groupId: string): SharedGroupSnapshot {
  const group = data.groups.find((item) => item.id === groupId);
  if (!group) throw new Error('Group not found.');
  return {
    group: cleanGroupForSnapshot(group),
    expenses: data.expenses.filter((expense) => expense.groupId === groupId),
    settlements: data.settlements.filter((settlement) => settlement.groupId === groupId),
    history: (data.history ?? []).filter((entry) => entry.groupId === groupId),
  };
}

export function sharedSnapshotHash(snapshot: SharedGroupSnapshot) {
  return JSON.stringify(snapshot);
}

function applySharedRow(current: SplitData, row: SharedGroupRow): SplitData {
  const snapshot = row.snapshot;
  const canonicalGroup = snapshot.group;
  const group: Group = {
    ...canonicalGroup,
    sharedId: row.id,
    sharedRole: row.role,
    myMemberId: row.member_id,
    sharedRevision: row.revision,
    sharedJoinCode: row.join_code,
  };
  const existingIds = new Set(
    current.groups
      .filter((item) => item.sharedId === row.id || item.id === canonicalGroup.id)
      .map((item) => item.id),
  );
  existingIds.add(canonicalGroup.id);
  const myName = current.myName?.trim()
    || canonicalGroup.members.find((member) => member.id === row.member_id)?.name?.trim()
    || '';
  return {
    ...current,
    myName,
    groups: [group, ...current.groups.filter((item) => item.sharedId !== row.id && item.id !== canonicalGroup.id)],
    expenses: [...snapshot.expenses, ...current.expenses.filter((item) => !existingIds.has(item.groupId))],
    settlements: [...snapshot.settlements, ...current.settlements.filter((item) => !existingIds.has(item.groupId))],
    history: [...snapshot.history, ...(current.history ?? []).filter((item) => !existingIds.has(item.groupId))],
  };
}

export function mergeSharedRowsIntoLocal(current: SplitData, rows: SharedGroupRow[], pruneMissing = false): SplitData {
  let next = current;
  rows.forEach((row) => { next = applySharedRow(next, row); });
  if (!pruneMissing) return next;
  const activeSharedIds = new Set(rows.map((row) => row.id));
  const removedGroupIds = new Set(
    next.groups
      .filter((group) => group.sharedId && !activeSharedIds.has(group.sharedId))
      .map((group) => group.id),
  );
  if (!removedGroupIds.size) return next;
  return {
    ...next,
    groups: next.groups.filter((group) => !removedGroupIds.has(group.id)),
    expenses: next.expenses.filter((expense) => !removedGroupIds.has(expense.groupId)),
    settlements: next.settlements.filter((settlement) => !removedGroupIds.has(settlement.groupId)),
    history: (next.history ?? []).filter((entry) => !removedGroupIds.has(entry.groupId)),
  };
}

export function removeGroupFromLocal(current: SplitData, groupId: string): SplitData {
  return {
    ...current,
    groups: current.groups.filter((group) => group.id !== groupId),
    expenses: current.expenses.filter((expense) => expense.groupId !== groupId),
    settlements: current.settlements.filter((settlement) => settlement.groupId !== groupId),
    history: (current.history ?? []).filter((entry) => entry.groupId !== groupId),
  };
}

export async function createSharedGroup(snapshot: SharedGroupSnapshot, memberId: string): Promise<SharedGroupRow> {
  const { data, error } = await splitzapSupabase.rpc('splitzap_create_shared_group', {
    p_snapshot: snapshot,
    p_member_id: memberId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Could not create the shared group.');
  return {
    id: row.shared_id,
    join_code: row.join_code,
    revision: Number(row.revision) || 1,
    snapshot: row.snapshot as SharedGroupSnapshot,
    member_id: row.member_id,
    role: row.role as SharedRole,
    updated_at: new Date().toISOString(),
  };
}

export async function loadSharedGroupsForUser(userId: string): Promise<SharedGroupRow[]> {
  const { data: memberships, error: membershipError } = await splitzapSupabase
    .from('splitzap_shared_group_members')
    .select('group_id, member_id, role')
    .eq('user_id', userId);
  if (membershipError) throw membershipError;
  if (!memberships?.length) return [];
  const ids = memberships.map((item) => item.group_id);
  const { data: groups, error } = await splitzapSupabase
    .from('splitzap_shared_groups')
    .select('id, join_code, snapshot, revision, updated_at')
    .in('id', ids);
  if (error) throw error;
  const membershipByGroup = new Map(memberships.map((item) => [item.group_id, item]));
  return (groups ?? []).map((group) => {
    const membership = membershipByGroup.get(group.id)!;
    return {
      id: group.id,
      join_code: group.join_code,
      snapshot: group.snapshot as SharedGroupSnapshot,
      revision: Number(group.revision) || 1,
      updated_at: group.updated_at,
      member_id: membership.member_id,
      role: membership.role as SharedRole,
    };
  });
}

export async function fetchSharedGroup(sharedId: string, userId: string): Promise<SharedGroupRow | null> {
  const { data: membership, error: membershipError } = await splitzapSupabase
    .from('splitzap_shared_group_members')
    .select('member_id, role')
    .eq('group_id', sharedId)
    .eq('user_id', userId)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) return null;
  const { data, error } = await splitzapSupabase
    .from('splitzap_shared_groups')
    .select('id, join_code, snapshot, revision, updated_at')
    .eq('id', sharedId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    join_code: data.join_code,
    snapshot: data.snapshot as SharedGroupSnapshot,
    revision: Number(data.revision) || 1,
    updated_at: data.updated_at,
    member_id: membership.member_id,
    role: membership.role as SharedRole,
  };
}

export async function previewSharedGroupJoin(code: string): Promise<JoinPreview> {
  const { data, error } = await splitzapSupabase.rpc('splitzap_join_preview', { p_code: code.trim().toUpperCase() });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('This Splitzap invite is invalid or expired.');
  return {
    shared_id: row.shared_id,
    group_name: row.group_name,
    emoji: row.emoji,
    members: Array.isArray(row.members) ? row.members : [],
    claimed_member_ids: Array.isArray(row.claimed_member_ids) ? row.claimed_member_ids : [],
    already_joined: Boolean(row.already_joined),
  };
}

export async function joinSharedGroup(code: string, memberId?: string, displayName?: string): Promise<SharedGroupRow> {
  const { data, error } = await splitzapSupabase.rpc('splitzap_join_shared_group', {
    p_code: code.trim().toUpperCase(),
    p_member_id: memberId || null,
    p_display_name: displayName?.trim() || null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Could not join this shared group.');
  const { data: group, error: groupError } = await splitzapSupabase
    .from('splitzap_shared_groups')
    .select('join_code, updated_at')
    .eq('id', row.shared_id)
    .single();
  if (groupError) throw groupError;
  return {
    id: row.shared_id,
    join_code: group.join_code,
    snapshot: row.snapshot as SharedGroupSnapshot,
    revision: Number(row.revision) || 1,
    updated_at: group.updated_at,
    member_id: row.member_id,
    role: row.role as SharedRole,
  };
}

export async function updateSharedGroup(sharedId: string, snapshot: SharedGroupSnapshot, expectedRevision?: number) {
  const { data, error } = await splitzapSupabase.rpc('splitzap_update_shared_group', {
    p_group_id: sharedId,
    p_snapshot: snapshot,
    p_expected_revision: expectedRevision ?? null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Shared group sync failed.');
  return { revision: Number(row.revision), updatedAt: row.updated_at as string };
}

export async function leaveSharedGroup(sharedId: string) {
  const { error } = await splitzapSupabase.rpc('splitzap_leave_shared_group', { p_group_id: sharedId });
  if (error) throw error;
}

export async function deleteSharedGroup(sharedId: string) {
  const { error } = await splitzapSupabase.rpc('splitzap_delete_shared_group', { p_group_id: sharedId });
  if (error) throw error;
}

export function subscribeToSharedGroupChanges(userId: string, callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void) {
  const channel = splitzapSupabase
    .channel(`splitzap-shared-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'splitzap_shared_groups' }, callback)
    .subscribe();
  return () => { void splitzapSupabase.removeChannel(channel); };
}
