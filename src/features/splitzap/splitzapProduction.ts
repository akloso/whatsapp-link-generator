import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { splitzapSupabase } from './splitzapCloud';
import type { SharedGroupSnapshot, SharedGroupRow } from './splitzapShared';

export type SplitzapProfile = {
  display_name: string;
  default_currency: string;
  theme: 'system' | 'light' | 'dark';
  reduced_motion: boolean;
};

export type SplitzapPaymentProfile = {
  upi_id: string | null;
  allow_group_upi: boolean;
};

export type SplitzapReceiptIntelligence = {
  merchant: string;
  detectedTotal: number | null;
  items: Array<{ id: string; description: string; amount: number; quantity?: number; confidence?: 'high' | 'low' }>;
  charges: Array<{ id: string; description: string; amount: number; distribution: 'equal' | 'proportional'; confidence?: 'high' | 'low' }>;
  itemsTotal: number;
  chargesTotal: number;
  difference: number | null;
  matched: boolean;
  warnings: string[];
  engine: string;
};

export type SharedMembership = {
  group_id: string;
  user_id: string;
  member_id: string;
  role: 'owner' | 'member';
  joined_at?: string;
};

export type SharedInvite = {
  id: string;
  group_id: string;
  code: string;
  member_id: string | null;
  intended_name: string | null;
  intended_email: string | null;
  created_by: string;
  status: 'active' | 'used' | 'disabled' | 'expired';
  created_at: string;
  updated_at: string;
};

export type SharedJoinRequest = {
  id: string;
  group_id: string;
  invite_id: string | null;
  user_id: string;
  requested_member_id: string | null;
  requested_name: string;
  requested_email: string;
  status: 'pending' | 'approved' | 'denied' | 'cancelled';
  requested_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

export type SharedActivityEvent = {
  id: string;
  group_id: string;
  actor_user_id: string | null;
  actor_member_id: string | null;
  actor_name: string | null;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  event_data: Record<string, unknown>;
  revision: number | null;
  occurred_at: string;
};

export type RecentlyDeletedGroup = {
  id: string;
  deleted_at: string;
  purge_after: string | null;
  snapshot: SharedGroupSnapshot;
};

export type InvitePreviewV2 = {
  shared_id: string;
  group_name: string;
  emoji: string;
  invite_id: string;
  member_id: string | null;
  intended_name: string | null;
  intended_email_hint: string | null;
  members: Array<{ id: string; name: string }>;
  claimed_member_ids: string[];
  already_joined: boolean;
  requires_approval: boolean;
  email_match: boolean;
};

export type JoinV2Result = {
  result_status: 'joined' | 'pending';
  request_id: string | null;
  shared_id: string;
  member_id: string | null;
  role: 'owner' | 'member' | null;
  revision: number;
  snapshot: SharedGroupSnapshot | null;
};

const one = <T>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

export async function getSplitzapProfile(): Promise<SplitzapProfile> {
  const { data, error } = await splitzapSupabase.rpc('splitzap_get_profile');
  if (error) throw error;
  const row = one(data) as SplitzapProfile | null;
  if (!row) return { display_name: '', default_currency: '₹', theme: 'system', reduced_motion: false };
  return row;
}

export async function updateSplitzapProfileName(name: string) {
  const { data, error } = await splitzapSupabase.rpc('splitzap_update_profile_name', { p_name: name.trim() });
  if (error) throw error;
  return String(data ?? name.trim());
}

export async function updateSplitzapProfilePreferences(values: Partial<Pick<SplitzapProfile, 'default_currency' | 'theme' | 'reduced_motion'>>) {
  const { error } = await splitzapSupabase.rpc('splitzap_update_profile_preferences', {
    p_default_currency: values.default_currency ?? null,
    p_theme: values.theme ?? null,
    p_reduced_motion: values.reduced_motion ?? null,
  });
  if (error) throw error;
}

export async function getSplitzapPaymentProfile(): Promise<SplitzapPaymentProfile> {
  const { data, error } = await splitzapSupabase.rpc('splitzap_get_payment_profile');
  if (error) throw error;
  const row = one(data) as SplitzapPaymentProfile | null;
  return row ?? { upi_id: null, allow_group_upi: false };
}

export async function updateSplitzapPaymentProfile(upiId: string, allowGroupUpi: boolean) {
  const { error } = await splitzapSupabase.rpc('splitzap_update_payment_profile', {
    p_upi_id: upiId.trim() || null,
    p_allow_group_upi: allowGroupUpi,
  });
  if (error) throw error;
}

export async function getSharedMemberUpi(groupId: string, memberId: string): Promise<string | null> {
  const { data, error } = await splitzapSupabase.rpc('splitzap_get_group_member_upi', { p_group_id: groupId, p_member_id: memberId });
  if (error) throw error;
  const row = one(data) as { upi_id: string | null } | null;
  return row?.upi_id?.trim() || null;
}

export async function parseSplitzapReceiptText(text: string): Promise<SplitzapReceiptIntelligence> {
  const { data, error } = await splitzapSupabase.rpc('splitzap_parse_receipt_text', { p_text: text });
  if (error) throw error;
  const raw = (data && typeof data === 'object' ? data : {}) as Partial<SplitzapReceiptIntelligence>;
  return {
    merchant: typeof raw.merchant === 'string' && raw.merchant.trim() ? raw.merchant.trim() : 'Scanned bill',
    detectedTotal: raw.detectedTotal == null ? null : Number(raw.detectedTotal),
    items: Array.isArray(raw.items) ? raw.items : [],
    charges: Array.isArray(raw.charges) ? raw.charges : [],
    itemsTotal: Number(raw.itemsTotal) || 0,
    chargesTotal: Number(raw.chargesTotal) || 0,
    difference: raw.difference == null ? null : Number(raw.difference),
    matched: Boolean(raw.matched),
    warnings: Array.isArray(raw.warnings) ? raw.warnings.filter((item): item is string => typeof item === 'string') : [],
    engine: typeof raw.engine === 'string' ? raw.engine : 'rules-v1',
  };
}

export async function createSharedInvite(groupId: string, options: { memberId?: string | null; name?: string | null; email?: string | null } = {}) {
  const { data, error } = await splitzapSupabase.rpc('splitzap_create_invite', {
    p_group_id: groupId,
    p_member_id: options.memberId || null,
    p_name: options.name?.trim() || null,
    p_email: options.email?.trim() || null,
  });
  if (error) throw error;
  const row = one(data) as { invite_id: string; code: string; member_id: string | null; intended_name: string | null; intended_email: string | null } | null;
  if (!row) throw new Error('Could not create the invite.');
  return row;
}

export async function disableSharedInvite(inviteId: string) {
  const { error } = await splitzapSupabase.rpc('splitzap_disable_invite', { p_invite_id: inviteId });
  if (error) throw error;
}

export async function listSharedInvites(groupId: string): Promise<SharedInvite[]> {
  const { data, error } = await splitzapSupabase
    .from('splitzap_shared_group_invites')
    .select('id, group_id, code, member_id, intended_name, intended_email, created_by, status, created_at, updated_at')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SharedInvite[];
}

export async function previewSharedInviteV2(code: string): Promise<InvitePreviewV2> {
  const { data, error } = await splitzapSupabase.rpc('splitzap_invite_preview_v2', { p_code: code.trim().toUpperCase() });
  if (error) throw error;
  const row = one(data) as InvitePreviewV2 | null;
  if (!row) throw new Error('This Splitzap invite is invalid or expired.');
  return {
    ...row,
    members: Array.isArray(row.members) ? row.members : [],
    claimed_member_ids: Array.isArray(row.claimed_member_ids) ? row.claimed_member_ids : [],
    already_joined: Boolean(row.already_joined),
    requires_approval: Boolean(row.requires_approval),
    email_match: Boolean(row.email_match),
  };
}

export async function requestSharedJoinV2(code: string, memberId?: string | null, displayName?: string | null): Promise<JoinV2Result> {
  const { data, error } = await splitzapSupabase.rpc('splitzap_join_v2', {
    p_code: code.trim().toUpperCase(),
    p_member_id: memberId || null,
    p_display_name: displayName?.trim() || null,
  });
  if (error) throw error;
  const row = one(data) as JoinV2Result | null;
  if (!row) throw new Error('Could not process this join request.');
  return { ...row, revision: Number(row.revision) || 1 };
}

export async function listPendingJoinRequests(groupIds: string[]): Promise<SharedJoinRequest[]> {
  if (!groupIds.length) return [];
  const { data, error } = await splitzapSupabase
    .from('splitzap_shared_join_requests')
    .select('id, group_id, invite_id, user_id, requested_member_id, requested_name, requested_email, status, requested_at, resolved_at, resolved_by')
    .in('group_id', groupIds)
    .eq('status', 'pending')
    .order('requested_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SharedJoinRequest[];
}

export async function resolveSharedJoinRequest(requestId: string, approve: boolean) {
  const { data, error } = await splitzapSupabase.rpc('splitzap_resolve_join_request', { p_request_id: requestId, p_approve: approve });
  if (error) throw error;
  return one(data) as { result_status: string; shared_id: string; joined_member_id: string | null } | null;
}

export async function listSharedMemberships(groupIds: string[]): Promise<SharedMembership[]> {
  if (!groupIds.length) return [];
  const { data, error } = await splitzapSupabase
    .from('splitzap_shared_group_members')
    .select('group_id, user_id, member_id, role, joined_at')
    .in('group_id', groupIds);
  if (error) throw error;
  return (data ?? []) as SharedMembership[];
}

export async function leaveSharedGroupV2(groupId: string) {
  const { error } = await splitzapSupabase.rpc('splitzap_leave_shared_group_v2', { p_group_id: groupId });
  if (error) throw error;
}

export async function transferSharedGroupOwnership(groupId: string, newOwnerMemberId: string) {
  const { error } = await splitzapSupabase.rpc('splitzap_transfer_ownership', { p_group_id: groupId, p_new_owner_member_id: newOwnerMemberId });
  if (error) throw error;
}

export async function unlinkSharedMember(groupId: string, memberId: string) {
  const { error } = await splitzapSupabase.rpc('splitzap_unlink_member', { p_group_id: groupId, p_member_id: memberId });
  if (error) throw error;
}

export async function renameSharedMember(groupId: string, memberId: string, name: string) {
  const { error } = await splitzapSupabase.rpc('splitzap_rename_member', { p_group_id: groupId, p_member_id: memberId, p_name: name.trim() });
  if (error) throw error;
}

export async function archiveSharedGroup(groupId: string, archive: boolean) {
  const { error } = await splitzapSupabase.rpc('splitzap_archive_shared_group', { p_group_id: groupId, p_archive: archive });
  if (error) throw error;
}

export async function softDeleteSharedGroup(groupId: string) {
  const { error } = await splitzapSupabase.rpc('splitzap_soft_delete_shared_group', { p_group_id: groupId });
  if (error) throw error;
}

export async function restoreSharedGroup(groupId: string) {
  const { data, error } = await splitzapSupabase.rpc('splitzap_restore_shared_group', { p_group_id: groupId });
  if (error) throw error;
  const row = one(data) as { join_code: string } | null;
  return row?.join_code ?? '';
}

export async function listRecentlyDeletedGroups(): Promise<RecentlyDeletedGroup[]> {
  const { data, error } = await splitzapSupabase.rpc('splitzap_recently_deleted_groups');
  if (error) throw error;
  return (data ?? []) as RecentlyDeletedGroup[];
}

export async function loadSharedActivity(groupIds: string[], limit = 500): Promise<SharedActivityEvent[]> {
  if (!groupIds.length) return [];
  const { data, error } = await splitzapSupabase
    .from('splitzap_shared_group_activity')
    .select('id, group_id, actor_user_id, actor_member_id, actor_name, event_type, entity_type, entity_id, event_data, revision, occurred_at')
    .in('group_id', groupIds)
    .order('occurred_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, revision: row.revision == null ? null : Number(row.revision) })) as SharedActivityEvent[];
}

export async function deleteSplitzapAccount() {
  const { error } = await splitzapSupabase.rpc('splitzap_delete_account', { p_confirmation: 'DELETE' });
  if (error) throw error;
}

export function buildInviteLink(code: string) {
  return `${window.location.origin}/splitzap?join=${encodeURIComponent(code.trim().toUpperCase())}`;
}

export function sharedRowFromJoin(result: JoinV2Result, joinCode: string): SharedGroupRow {
  if (result.result_status !== 'joined' || !result.snapshot || !result.member_id || !result.role) throw new Error('The join is still waiting for approval.');
  return {
    id: result.shared_id,
    join_code: joinCode.trim().toUpperCase(),
    snapshot: result.snapshot,
    revision: result.revision,
    updated_at: new Date().toISOString(),
    member_id: result.member_id,
    role: result.role,
    status: 'active',
    schema_version: Number(result.snapshot.schemaVersion) || 1,
  };
}

export function subscribeToProductionChanges(userId: string, callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void) {
  const channel = splitzapSupabase
    .channel(`splitzap-production-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'splitzap_shared_join_requests' }, callback)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'splitzap_shared_group_activity' }, callback)
    .subscribe();
  return () => { void splitzapSupabase.removeChannel(channel); };
}
