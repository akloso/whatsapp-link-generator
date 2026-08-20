import { ChevronRight, Cloud, CloudOff, Copy, Download, Eye, EyeOff, KeyRound, Link2, Loader2, LogOut, Mail, Share2, ShieldCheck, Upload, UserPlus, X } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import SplitzapAppV4, { clearSplitzapExpenseDraft, useSplitzapInstall } from './SplitzapAppV4';
import { SPLITZAP_SCHEMA_VERSION, createSplitBackup, importSplitBackupSafely, memberIdFor, useSplitData, type Group, type SplitData } from './splitStoreV4';
import {
  fetchSplitzapCloudState, getSplitzapSession, onSplitzapAuthChange, saveSplitzapCloudState, sendSplitzapPasswordReset, signInSplitzapWithGoogle, signInSplitzapWithPassword, signOutSplitzap, signUpSplitzapWithPassword, updateSplitzapPassword, type SplitzapSession,
} from './splitzapCloud';
import {
  buildSharedGroupSnapshot, createSharedGroup, fetchSharedGroup, loadSharedGroupsForUser, mergeSharedRowsIntoLocal, removeGroupFromLocal, sharedSnapshotHash, subscribeToSharedGroupChanges, updateSharedGroup, type SharedGroupRow,
} from './splitzapShared';
import {
  archiveSharedGroup, buildInviteLink, createSharedInvite, deleteSplitzapAccount, disableSharedInvite, getSplitzapProfile, leaveSharedGroupV2, listPendingJoinRequests, listRecentlyDeletedGroups, loadSharedActivity, listSharedInvites, listSharedMemberships, previewSharedInviteV2, renameSharedMember, requestSharedJoinV2, resolveSharedJoinRequest, restoreSharedGroup, sharedRowFromJoin, softDeleteSharedGroup, subscribeToProductionChanges, transferSharedGroupOwnership, unlinkSharedMember, updateSplitzapProfileName, updateSplitzapProfilePreferences,
  type InvitePreviewV2, type RecentlyDeletedGroup, type SharedActivityEvent, type SharedInvite, type SharedJoinRequest, type SharedMembership, type SplitzapProfile,
} from './splitzapProduction';

type SyncStatus = 'local' | 'connecting' | 'syncing' | 'synced' | 'offline' | 'error';
type EmailMode = 'signin' | 'signup';

const LAST_SYNC_HASH_KEY = 'splitzap.cloud.lastSyncHash';
const LAST_SYNC_AT_KEY = 'splitzap.cloud.lastSyncAt';
const LAST_USER_KEY = 'splitzap.cloud.lastUserId';
const PENDING_JOIN_KEY = 'splitzap.shared.pendingJoin';

const dataHash = (data: SplitData) => JSON.stringify(data);

function safeGet(key: string) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function clearPendingJoinIntent() {
  try { window.localStorage.removeItem(PENDING_JOIN_KEY); } catch { /* best effort */ }
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('join')) return;
    url.searchParams.delete('join');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  } catch { /* best effort */ }
}

function saveSyncMarker(data: SplitData, updatedAt = new Date().toISOString()) {
  try {
    window.localStorage.setItem(LAST_SYNC_HASH_KEY, dataHash(data));
    window.localStorage.setItem(LAST_SYNC_AT_KEY, updatedAt);
  } catch { /* local storage warnings are handled by the main store */ }
}

function friendlyAuthError(cause: unknown) {
  const message = cause instanceof Error ? cause.message : 'Authentication failed.';
  if (/email rate limit|over_email_send_rate_limit/i.test(message)) return 'Too many emails have been sent recently. Please try again later or use Google sign-in.';
  if (/invalid login credentials/i.test(message)) return 'Email or password is incorrect.';
  if (/email not confirmed/i.test(message)) return 'Confirm your email first, then sign in with your password.';
  if (/provider.*not enabled|unsupported provider/i.test(message)) return 'Google sign-in is not connected yet.';
  if (/password should be at least/i.test(message)) return 'Use a password with at least 8 characters.';
  return message;
}

export default function SplitzapCloudApp() {
  const { data, update, hydrated } = useSplitData();
  const [session, setSession] = useState<SplitzapSession | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState<SplitzapProfile | null>(null);
  const [accountDataReady, setAccountDataReady] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [shareGroupId, setShareGroupId] = useState<string | null>(null);
  const [inviteMemberId, setInviteMemberId] = useState<string | null>(null);
  const [manageGroupId, setManageGroupId] = useState<string | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [, setJoinRequested] = useState(false);
  const [sharedActivity, setSharedActivity] = useState<SharedActivityEvent[]>([]);
  const [pendingRequests, setPendingRequests] = useState<SharedJoinRequest[]>([]);
  const [memberships, setMemberships] = useState<SharedMembership[]>([]);
  const [productionTick, setProductionTick] = useState(0);
  const [status, setStatus] = useState<SyncStatus>('local');
  const [statusMessage, setStatusMessage] = useState('Saved on this device');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => typeof window === 'undefined' ? null : safeGet(LAST_SYNC_AT_KEY));
  const initializedUser = useRef<string | null>(null);
  const sharedInitializedUser = useRef<string | null>(null);
  const sharedHashes = useRef(new Map<string, string>());
  const syncing = useRef(false);
  const latestData = useRef(data);
  latestData.current = data;

  useEffect(() => {
    let active = true;
    getSplitzapSession().then((next) => { if (active) { setSession(next); setAuthReady(true); } }).catch(() => { if (active) { setAuthReady(true); setStatus('error'); setStatusMessage('Could not check cloud account'); } });
    const unsubscribe = onSplitzapAuthChange((next, event) => {
      if (!active) return;
      setSession(next);
      if (next && initializedUser.current === next.user.id && event !== 'PASSWORD_RECOVERY') {
        // Token refresh / same-account auth events must never remount the app or destroy an open draft.
        return;
      }
      setAccountDataReady(false);
      initializedUser.current = null;
      sharedInitializedUser.current = null;
      sharedHashes.current.clear();
      setProfile(null);
      setSharedActivity([]); setPendingRequests([]); setMemberships([]);
      if (event === 'PASSWORD_RECOVERY') { setRecoveryMode(true); setAccountOpen(true); }
      if (!next) { setStatus('local'); setStatusMessage('Signed out'); setProfileOpen(false); setAccountOpen(false); }
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session || !accountDataReady) return;
    let active = true;
    void getSplitzapProfile().then((next) => {
      if (!active) return;
      const withLocalFallback: SplitzapProfile = { ...next, display_name: next.display_name || latestData.current.myName || '' };
      setProfile(withLocalFallback);
      update((current) => ({ ...current, preferences: { defaultCurrency: withLocalFallback.default_currency, theme: withLocalFallback.theme, reducedMotion: withLocalFallback.reduced_motion } }));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [accountDataReady, session, update]);

  useEffect(() => {
    const theme = profile?.theme ?? data.preferences?.theme ?? 'system';
    const reduced = profile?.reduced_motion ?? data.preferences?.reducedMotion ?? false;
    document.documentElement.dataset.splitzapTheme = theme;
    document.documentElement.dataset.splitzapReducedMotion = reduced ? 'true' : 'false';
    return () => { delete document.documentElement.dataset.splitzapTheme; delete document.documentElement.dataset.splitzapReducedMotion; };
  }, [data.preferences?.reducedMotion, data.preferences?.theme, profile?.reduced_motion, profile?.theme]);

  useEffect(() => {
    if (!hydrated || !authReady || !session || initializedUser.current === session.user.id) return;
    let active = true;
    setAccountDataReady(false);
    setStatus('connecting');
    setStatusMessage('Loading your Splitzap…');
    void (async () => {
      try {
        const row = await fetchSplitzapCloudState(session.user.id);
        if (!active) return;
        if (row) {
          update(() => row.data);
          saveSyncMarker(row.data, row.updated_at);
          setLastSyncedAt(row.updated_at);
        } else {
          const fresh: SplitData = {
            schemaVersion: SPLITZAP_SCHEMA_VERSION,
            me: session.user.id,
            myName: '',
            groups: [],
            expenses: [],
            settlements: [],
            history: [],
            activity: [],
            preferences: { defaultCurrency: '₹', theme: 'system', reducedMotion: false },
          };
          const updatedAt = await saveSplitzapCloudState(session.user.id, fresh);
          if (!active) return;
          update(() => fresh);
          saveSyncMarker(fresh, updatedAt);
          setLastSyncedAt(updatedAt);
        }
        try { window.localStorage.setItem(LAST_USER_KEY, session.user.id); } catch { /* best effort */ }
        initializedUser.current = session.user.id;
        setStatus('synced');
        setStatusMessage('Synced');
        setAccountDataReady(true);
      } catch (cause) {
        if (!active) return;
        const sameCachedUser = !navigator.onLine && safeGet(LAST_USER_KEY) === session.user.id;
        if (sameCachedUser) {
          initializedUser.current = session.user.id;
          setStatus('offline');
          setStatusMessage('Offline · changes saved on this device');
          setAccountDataReady(true);
          return;
        }
        initializedUser.current = null;
        setAccountDataReady(false);
        setStatus(navigator.onLine ? 'error' : 'offline');
        setStatusMessage(navigator.onLine ? (cause instanceof Error ? cause.message : 'Could not load your Splitzap') : 'Internet connection required to load your Splitzap');
      }
    })();
    return () => { active = false; };
  }, [authReady, hydrated, session, update]);

  useEffect(() => {
    if (!hydrated || !session || !accountDataReady || initializedUser.current !== session.user.id || sharedInitializedUser.current === session.user.id || !navigator.onLine) return;
    let active = true;
    sharedInitializedUser.current = session.user.id;
    void loadSharedGroupsForUser(session.user.id).then((rows) => {
      if (!active) return;
      sharedHashes.current.clear(); rows.forEach((row) => sharedHashes.current.set(row.id, sharedSnapshotHash(row.snapshot)));
      update((current) => mergeSharedRowsIntoLocal(current, rows, true));
      setProductionTick((value) => value + 1);
    }).catch((cause) => { if (!active) return; sharedInitializedUser.current = null; setStatus('error'); setStatusMessage(cause instanceof Error ? cause.message : 'Could not load shared groups'); });
    return () => { active = false; };
  }, [accountDataReady, hydrated, session, status, update]);

  useEffect(() => {
    if (!session || sharedInitializedUser.current !== session.user.id) return;
    return subscribeToSharedGroupChanges(session.user.id, (payload) => {
      const fresh = payload.new as Record<string, unknown>; const old = payload.old as Record<string, unknown>;
      const sharedId = String(fresh?.id ?? old?.id ?? '');
      if (!sharedId) return;
      if (payload.eventType === 'DELETE' || fresh?.status === 'deleted') {
        sharedHashes.current.delete(sharedId);
        update((current) => { const group = current.groups.find((item) => item.sharedId === sharedId); return group ? removeGroupFromLocal(current, group.id) : current; });
        setProductionTick((value) => value + 1);
        return;
      }
      void fetchSharedGroup(sharedId, session.user.id).then((row) => {
        if (!row || row.status === 'deleted') { sharedHashes.current.delete(sharedId); update((current) => { const group = current.groups.find((item) => item.sharedId === sharedId); return group ? removeGroupFromLocal(current, group.id) : current; }); return; }
        sharedHashes.current.set(row.id, sharedSnapshotHash(row.snapshot)); update((current) => mergeSharedRowsIntoLocal(current, [row], false)); setProductionTick((value) => value + 1);
      }).catch(() => undefined);
    });
  }, [session, update]);

  useEffect(() => {
    if (!session) return;
    return subscribeToProductionChanges(session.user.id, () => setProductionTick((value) => value + 1));
  }, [session]);

  useEffect(() => {
    if (!session || !accountDataReady || initializedUser.current !== session.user.id) return;
    let active = true;
    void (async () => {
      try {
        const rows = await loadSharedGroupsForUser(session.user.id);
        if (!active) return;
        rows.forEach((row) => sharedHashes.current.set(row.id, sharedSnapshotHash(row.snapshot)));
        update((current) => mergeSharedRowsIntoLocal(current, rows, true));
        const ids = rows.map((row) => row.id);
        const [activity, requests, memberRows] = await Promise.all([loadSharedActivity(ids), listPendingJoinRequests(ids), listSharedMemberships(ids)]);
        if (!active) return;
        setSharedActivity(activity); setPendingRequests(requests); setMemberships(memberRows);
      } catch { /* core sync status handles material failures; collaboration metadata retries on next event */ }
    })();
    return () => { active = false; };
  }, [accountDataReady, productionTick, session, status, update]);

  useEffect(() => {
    if (!session || !accountDataReady || sharedInitializedUser.current !== session.user.id || !navigator.onLine) return;
    const changed = data.groups.filter((group) => group.sharedId && (group.status ?? group.sharedStatus ?? 'active') === 'active').map((group) => ({ group, snapshot: buildSharedGroupSnapshot(data, group.id) })).filter(({ group, snapshot }) => sharedSnapshotHash(snapshot) !== sharedHashes.current.get(group.sharedId!));
    if (!changed.length) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        setStatus('syncing'); setStatusMessage('Syncing shared group…');
        try {
          for (const item of changed) {
            const sharedId = item.group.sharedId!;
            const result = await updateSharedGroup(sharedId, item.snapshot, item.group.sharedRevision);
            sharedHashes.current.set(sharedId, sharedSnapshotHash(item.snapshot));
            update((current) => ({ ...current, groups: current.groups.map((group) => group.id === item.group.id ? { ...group, sharedRevision: result.revision } : group) }));
          }
          setStatus('synced'); setStatusMessage('Synced'); setProductionTick((value) => value + 1);
        } catch (cause) { setStatus(navigator.onLine ? 'error' : 'offline'); setStatusMessage(cause instanceof Error ? cause.message : 'Shared group sync failed'); }
      })();
    }, 850);
    return () => window.clearTimeout(timer);
  }, [accountDataReady, data, session, status, update]);

  useEffect(() => {
    if (!authReady) return;
    const urlCode = new URLSearchParams(window.location.search).get('join')?.trim().toUpperCase() || '';
    const pending = urlCode || safeGet(PENDING_JOIN_KEY) || '';
    if (!pending) return;
    if (!session) {
      setJoinCode(pending);
      try { window.localStorage.setItem(PENDING_JOIN_KEY, pending); } catch { /* best effort */ }
      setAccountOpen(true);
      return;
    }
    let active = true;
    void previewSharedInviteV2(pending).then((preview) => {
      if (!active) return;
      if (preview.already_joined) {
        clearPendingJoinIntent();
        setJoinOpen(false);
        setJoinCode('');
        const existing = latestData.current.groups.find((group) => group.sharedId === preview.shared_id);
        if (existing) {
          window.history.replaceState({}, '', `/splitzap#group=${encodeURIComponent(existing.id)}`);
          window.dispatchEvent(new Event('popstate'));
        }
        return;
      }
      setJoinCode(pending);
      try { window.localStorage.setItem(PENDING_JOIN_KEY, pending); } catch { /* best effort */ }
      setAccountOpen(false);
      setProfileOpen(false);
      setJoinOpen(true);
    }).catch(() => {
      if (!active) return;
      if (!urlCode) { clearPendingJoinIntent(); return; }
      setJoinCode(pending);
      setAccountOpen(false);
      setProfileOpen(false);
      setJoinOpen(true);
    });
    return () => { active = false; };
  }, [authReady, session]);

  useEffect(() => {
    if (!hydrated || !session || !accountDataReady || initializedUser.current !== session.user.id || syncing.current) return;
    const currentHash = dataHash(data);
    if (currentHash === safeGet(LAST_SYNC_HASH_KEY)) return;
    if (!navigator.onLine) { setStatus('offline'); setStatusMessage('Offline · changes saved on this device'); return; }
    const timer = window.setTimeout(() => {
      syncing.current = true; setStatus('syncing'); setStatusMessage('Syncing…');
      void saveSplitzapCloudState(session.user.id, latestData.current).then((updatedAt) => { saveSyncMarker(latestData.current, updatedAt); setLastSyncedAt(updatedAt); setStatus('synced'); setStatusMessage('Synced'); }).catch((cause) => { setStatus(navigator.onLine ? 'error' : 'offline'); setStatusMessage(navigator.onLine ? (cause instanceof Error ? cause.message : 'Sync problem') : 'Offline · changes saved on this device'); }).finally(() => { syncing.current = false; });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [accountDataReady, data, hydrated, session]);

  useEffect(() => {
    if (!session || !accountDataReady) return;
    const onOffline = () => { setStatus('offline'); setStatusMessage('Offline · changes saved on this device'); };
    const onOnline = () => {
      const current = latestData.current;
      if (dataHash(current) !== safeGet(LAST_SYNC_HASH_KEY)) {
        setStatus('syncing');
        setStatusMessage('Syncing…');
        void saveSplitzapCloudState(session.user.id, current)
          .then((updatedAt) => { saveSyncMarker(current, updatedAt); setLastSyncedAt(updatedAt); setStatus('synced'); setStatusMessage('Synced'); })
          .catch(() => { setStatus('error'); setStatusMessage('Sync problem · tap your profile to retry'); });
      } else {
        setStatus('synced');
        setStatusMessage('Synced');
      }
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => { window.removeEventListener('offline', onOffline); window.removeEventListener('online', onOnline); };
  }, [accountDataReady, session]);


  const enableSharing = async (groupId: string) => {
    if (!session) throw new Error('Sign in to share this group.');
    const current = latestData.current; const group = current.groups.find((item) => item.id === groupId);
    if (!group) throw new Error('Group not found.'); if (group.sharedId) return;
    const row = await createSharedGroup(buildSharedGroupSnapshot(current, groupId), memberIdFor(group, current));
    sharedHashes.current.set(row.id, sharedSnapshotHash(row.snapshot)); update((value) => mergeSharedRowsIntoLocal(value, [row], false)); setProductionTick((value) => value + 1);
  };

  const completeJoin = (row: SharedGroupRow) => {
    sharedHashes.current.set(row.id, sharedSnapshotHash(row.snapshot)); update((current) => mergeSharedRowsIntoLocal(current, [row], false));
    clearPendingJoinIntent();
    setJoinOpen(false); setJoinRequested(false); setJoinCode(''); setProductionTick((value) => value + 1);
    window.history.replaceState({}, '', `/splitzap#group=${encodeURIComponent(row.snapshot.group.id)}`); window.dispatchEvent(new Event('popstate'));
  };

  const removeGroup = async (group: Group, mode: 'self' | 'everyone', transferMemberId?: string) => {
    if (group.sharedId) {
      if (!session) throw new Error('Sign in before changing a shared group.');
      if (mode === 'everyone') {
        if (group.sharedRole !== 'owner') throw new Error('Only the owner can delete this group for everyone.');
        await softDeleteSharedGroup(group.sharedId);
      } else {
        if (group.sharedRole === 'owner') {
          if (!transferMemberId) throw new Error('Choose a new owner before leaving.');
          await transferSharedGroupOwnership(group.sharedId, transferMemberId);
        }
        await leaveSharedGroupV2(group.sharedId);
      }
      sharedHashes.current.delete(group.sharedId); setProductionTick((value) => value + 1);
    }
    update((current) => removeGroupFromLocal(current, group.id));
  };

  const archiveGroup = async (group: Group, archive: boolean) => {
    if (group.sharedId) { await archiveSharedGroup(group.sharedId, archive); setProductionTick((value) => value + 1); }
    update((current) => ({ ...current, groups: current.groups.map((item) => item.id === group.id ? { ...item, status: archive ? 'archived' : 'active', sharedStatus: archive ? 'archived' : 'active', archivedAt: archive ? new Date().toISOString() : undefined } : item) }));
  };

  const resolveJoin = async (id: string, approve: boolean) => { await resolveSharedJoinRequest(id, approve); setProductionTick((value) => value + 1); };
  const refreshProfile = async () => { if (!session) return; try { setProfile(await getSplitzapProfile()); } catch { /* retry when reopened */ } };

  const collaboration = {
    signedIn: Boolean(session), activity: sharedActivity, pendingRequests, memberships,
    onInviteGroup: (groupId: string, memberId?: string) => { setInviteMemberId(memberId ?? null); setShareGroupId(groupId); if (!session) setAccountOpen(true); },
    onManageMembers: (groupId: string) => { if (!session) setAccountOpen(true); else setManageGroupId(groupId); },
    onJoinGroup: () => { setJoinRequested(true); if (session) setJoinOpen(true); else setAccountOpen(true); },
    onDeleteGroup: removeGroup,
    onArchiveGroup: archiveGroup,
    onResolveJoinRequest: resolveJoin,
  };

  const indicatorClass = status === 'error' ? 'bg-red-500' : 'bg-amber-400';
  const accountInitial = (profile?.display_name?.trim()?.[0] || data.myName?.trim()?.[0] || session?.user.email?.[0] || '').toUpperCase();
  const accountAction = <button type="button" onClick={() => setProfileOpen(true)} aria-label="My Profile" title={status === 'error' || status === 'offline' ? statusMessage : 'My Profile'} className="press relative grid size-9 place-items-center rounded-full border border-border bg-surface text-primary shadow-sm"><span className="text-xs font-extrabold">{accountInitial || '?'}</span>{status === 'error' || status === 'offline' ? <span aria-hidden="true" className={`absolute right-0 top-0 size-2.5 rounded-full border-2 border-surface ${indicatorClass}`} /> : null}</button>;
  const managedGroup = manageGroupId ? data.groups.find((item) => item.id === manageGroupId) ?? null : null;

  if (!authReady) {
    return <div className="fixed inset-0 z-[120] grid place-items-center bg-[#fbfaf6] px-6 text-slate-900"><div className="text-center"><div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#256f66] text-2xl font-extrabold text-white shadow-lg">₹</div><Loader2 size={22} className="mx-auto mt-5 animate-spin text-[#256f66]" /><p className="mt-3 text-sm font-bold">Opening Splitzap…</p></div></div>;
  }
  if (!session) {
    return <AccountSheet open locked onClose={() => undefined} session={null} status={status} statusMessage={statusMessage} lastSyncedAt={lastSyncedAt} recoveryMode={false} onRecoveryComplete={() => undefined} />;
  }
  if (!accountDataReady) {
    return <div className="fixed inset-0 z-[120] grid place-items-center bg-[#fbfaf6] px-6 text-slate-900"><div className="w-full max-w-sm text-center"><div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#256f66] text-2xl font-extrabold text-white shadow-lg">₹</div>{status === 'connecting' ? <Loader2 size={22} className="mx-auto mt-5 animate-spin text-[#256f66]" /> : null}<p className="mt-4 text-sm font-extrabold">{status === 'connecting' ? 'Loading your Splitzap…' : statusMessage}</p>{status !== 'connecting' ? <><button type="button" onClick={() => window.location.reload()} className="mt-4 w-full rounded-xl bg-[#256f66] px-4 py-3 text-sm font-bold text-white">Try again</button><button type="button" onClick={() => void signOutSplitzap()} className="mt-2 w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700">Sign out</button></> : null}</div></div>;
  }

  return <>
    <SplitzapAppV4 accountAction={accountAction} collaboration={collaboration} />
    <SharedGroupInviteSheet open={Boolean(shareGroupId && session)} group={shareGroupId ? data.groups.find((item) => item.id === shareGroupId) ?? null : null} memberships={memberships} presetMemberId={inviteMemberId} onClose={() => { setShareGroupId(null); setInviteMemberId(null); }} onEnable={enableSharing} onChanged={() => setProductionTick((value) => value + 1)} />
    <JoinSharedGroupSheet open={joinOpen && Boolean(session)} initialCode={joinCode} onClose={() => { setJoinOpen(false); setJoinRequested(false); }} onJoined={completeJoin} onPending={() => setProductionTick((value) => value + 1)} />
    {session ? <ProfileScreen open={profileOpen} onClose={() => setProfileOpen(false)} session={session} data={data} update={update} status={status} statusMessage={statusMessage} lastSyncedAt={lastSyncedAt} profile={profile} onProfileChanged={setProfile} onOpenSecurity={() => { setProfileOpen(false); setAccountOpen(true); }} onRestored={() => { setProductionTick((value) => value + 1); void refreshProfile(); }} /> : null}
    <ManageMembersSheet open={Boolean(manageGroupId && session)} group={managedGroup} memberships={memberships} requests={pendingRequests} onClose={() => setManageGroupId(null)} onInvite={(memberId) => { if (!managedGroup) return; setManageGroupId(null); setInviteMemberId(memberId || null); setShareGroupId(managedGroup.id); }} onResolve={resolveJoin} onRename={async (memberId, name) => { if (!managedGroup?.sharedId) return; await renameSharedMember(managedGroup.sharedId, memberId, name); setProductionTick((value) => value + 1); }} onUnlink={async (memberId) => { if (!managedGroup?.sharedId) return; await unlinkSharedMember(managedGroup.sharedId, memberId); setProductionTick((value) => value + 1); }} onTransfer={async (memberId) => { if (!managedGroup?.sharedId) return; await transferSharedGroupOwnership(managedGroup.sharedId, memberId); setProductionTick((value) => value + 1); }} />
    <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} session={session} status={status} statusMessage={statusMessage} lastSyncedAt={lastSyncedAt} recoveryMode={recoveryMode} onRecoveryComplete={() => setRecoveryMode(false)} />
  </>;
}

function SharedGroupInviteSheet({ open, group, memberships, presetMemberId, onClose, onEnable, onChanged }: {
  open: boolean;
  group: Group | null;
  memberships: SharedMembership[];
  presetMemberId?: string | null;
  onClose: () => void;
  onEnable: (groupId: string) => Promise<void>;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [memberId, setMemberId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [createdCode, setCreatedCode] = useState('');
  const [invites, setInvites] = useState<SharedInvite[]>([]);
  const joinedIds = new Set(memberships.filter((item) => item.group_id === group?.sharedId).map((item) => item.member_id));
  const unjoined = group?.members.filter((member) => !joinedIds.has(member.id)) ?? [];
  const generalLink = group?.sharedJoinCode ? buildInviteLink(group.sharedJoinCode) : '';
  const createdLink = createdCode ? buildInviteLink(createdCode) : '';

  const refreshInvites = async () => {
    if (!group?.sharedId) { setInvites([]); return; }
    try { setInvites(await listSharedInvites(group.sharedId)); } catch { setInvites([]); }
  };

  useEffect(() => {
    if (!open || !group) return;
    const requested = presetMemberId && group.members.some((member) => member.id === presetMemberId) ? presetMemberId : '';
    const requestedMember = group.members.find((member) => member.id === requested);
    setMemberId(requested);
    setName(requestedMember?.name ?? '');
    setEmail('');
    setCreatedCode('');
    setFeedback('');
    void refreshInvites();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, group?.id, group?.sharedId, presetMemberId]);

  if (!open || !group) return null;

  const enable = async () => {
    setBusy(true); setFeedback('');
    try { await onEnable(group.id); setFeedback('Sharing is now live. You can create a targeted invite.'); onChanged(); }
    catch (cause) { setFeedback(cause instanceof Error ? cause.message : 'Could not enable sharing.'); }
    finally { setBusy(false); }
  };

  const chooseMember = (id: string) => {
    setMemberId(id);
    const member = group.members.find((item) => item.id === id);
    setName(member?.name ?? '');
    setCreatedCode('');
  };

  const createInvite = async () => {
    if (!group.sharedId) return;
    if (!memberId && !name.trim()) { setFeedback('Enter a name, or choose an existing member.'); return; }
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) { setFeedback('Enter a valid email address or leave email blank.'); return; }
    setBusy(true); setFeedback('');
    try {
      const result = await createSharedInvite(group.sharedId, { memberId: memberId || null, name: name.trim() || null, email: email.trim() || null });
      setCreatedCode(result.code);
      setFeedback(email.trim() ? 'Invite ready. The recipient must sign in with this exact email.' : 'Invite ready. A joined group member must approve the recipient after they request access.');
      await refreshInvites();
      onChanged();
    } catch (cause) { setFeedback(cause instanceof Error ? cause.message : 'Could not create invite.'); }
    finally { setBusy(false); }
  };

  const share = async (link: string, inviteName?: string) => {
    const message = `Join ${group.name} on Splitzap${inviteName ? ` as ${inviteName}` : ''}: ${link}`;
    try {
      if (navigator.share) await navigator.share({ title: `Join ${group.name}`, text: message, url: link });
      else { await navigator.clipboard.writeText(message); setFeedback('Invite copied.'); }
    } catch { /* Native share cancellation is not an error. */ }
  };

  const copy = async (link: string) => {
    try { await navigator.clipboard.writeText(link); setFeedback('Invite link copied.'); }
    catch { setFeedback('Could not copy automatically.'); }
  };

  const disable = async (id: string) => {
    setBusy(true);
    try { await disableSharedInvite(id); await refreshInvites(); onChanged(); setFeedback('Invite disabled.'); }
    catch (cause) { setFeedback(cause instanceof Error ? cause.message : 'Could not disable invite.'); }
    finally { setBusy(false); }
  };

  return <SimpleModal title={group.sharedId ? 'Invite people' : 'Share this group live'} onClose={onClose}>
    {!group.sharedId ? <><div className="rounded-2xl bg-[#eef6f3] p-4"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-xl">{group.emoji}</span><div><p className="text-sm font-extrabold text-slate-900">{group.name}</p><p className="mt-1 text-xs leading-5 text-slate-600">Turn on live sharing first. Existing expenses and balances stay exactly as they are.</p></div></div></div><button type="button" disabled={busy} onClick={() => void enable()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#256f66] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} Turn on sharing</button></> : <>
      <div className="rounded-2xl bg-[#eef6f3] p-3"><p className="text-xs font-extrabold text-[#256f66]">Targeted invite</p><p className="mt-1 text-[11px] leading-5 text-slate-600">Use a member-specific invite when possible. Email is optional; without it, the join request needs approval from any already joined member.</p></div>
      {unjoined.length ? <><label className="mt-4 block text-xs font-bold text-slate-600">Existing member</label><select value={memberId} onChange={(event) => chooseMember(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-[#256f66]"><option value="">New person / not listed yet</option>{unjoined.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></> : null}
      <label className="mt-3 block text-xs font-bold text-slate-600">Name</label><input value={name} disabled={Boolean(memberId)} onChange={(event) => setName(event.target.value)} placeholder="Rahul" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none disabled:bg-slate-50 disabled:text-slate-500 focus:border-[#256f66]" />
      <label className="mt-3 block text-xs font-bold text-slate-600">Email <span className="font-medium text-slate-400">(optional)</span></label><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="rahul@example.com" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-[#256f66]" />
      <p className="mt-1.5 text-[10px] leading-4 text-slate-500">{email.trim() ? 'Only this signed-in email can accept the invite.' : 'No email: the recipient signs in, claims their identity, then waits for a group member to approve.'}</p>
      <button type="button" disabled={busy || (!memberId && !name.trim())} onClick={() => void createInvite()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#256f66] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">{busy ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />} Create invite link</button>
      {createdLink ? <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3"><p className="break-all text-[10px] leading-4 text-emerald-900">{createdLink}</p><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => void copy(createdLink)} className="rounded-xl bg-white py-2.5 text-xs font-bold text-[#256f66]"><Copy size={14} className="mr-1 inline" /> Copy</button><button type="button" onClick={() => void share(createdLink, name.trim())} className="rounded-xl bg-[#256f66] py-2.5 text-xs font-bold text-white"><Share2 size={14} className="mr-1 inline" /> Share</button></div></div> : null}
      <div className="my-4 flex items-center gap-2"><div className="h-px flex-1 bg-slate-200" /><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">or</span><div className="h-px flex-1 bg-slate-200" /></div>
      <div className="rounded-2xl border border-slate-200 p-3"><p className="text-xs font-extrabold text-slate-800">General group invite</p><p className="mt-1 text-[10px] leading-4 text-slate-500">Useful for dropping one link into a WhatsApp group. Every new identity claim requires approval.</p><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => void copy(generalLink)} className="rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-[#256f66]">Copy link</button><button type="button" onClick={() => void share(generalLink)} className="rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-[#256f66]">Share</button></div></div>
      {invites.filter((invite) => invite.status === 'active' && invite.code !== group.sharedJoinCode).length ? <div className="mt-4"><p className="mb-2 text-xs font-extrabold text-slate-700">Active targeted invites</p><div className="space-y-2">{invites.filter((invite) => invite.status === 'active' && invite.code !== group.sharedJoinCode).map((invite) => <div key={invite.id} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3"><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-800">{invite.intended_name || 'Invite'}</p><p className="truncate text-[10px] text-slate-500">{invite.intended_email || 'Approval required'}</p></div><button type="button" disabled={busy} onClick={() => void disable(invite.id)} className="rounded-lg px-2 py-1.5 text-[10px] font-bold text-red-600">Disable</button></div>)}</div></div> : null}
    </>}
    {feedback ? <p role="status" className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">{feedback}</p> : null}
  </SimpleModal>;
}

function JoinSharedGroupSheet({ open, initialCode, onClose, onJoined, onPending }: {
  open: boolean;
  initialCode: string;
  onClose: () => void;
  onJoined: (row: SharedGroupRow) => void;
  onPending: () => void;
}) {
  const [code, setCode] = useState(initialCode);
  const [preview, setPreview] = useState<InvitePreviewV2 | null>(null);
  const [choice, setChoice] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const load = async (value = code) => {
    const clean = value.trim().toUpperCase();
    if (!clean) return;
    setBusy(true); setError(''); setPreview(null); setChoice(''); setPending(false);
    try {
      const result = await previewSharedInviteV2(clean);
      setPreview(result);
      setCode(clean);
      if (result.member_id) setChoice(result.member_id);
      else if (result.intended_name) { setChoice('__new__'); setNewName(result.intended_name); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not find this shared group.'); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!open) return;
    setCode(initialCode);
    setPreview(null); setChoice(''); setNewName(''); setError(''); setPending(false);
    if (initialCode) void load(initialCode);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialCode]);

  if (!open) return null;
  const claimed = new Set(preview?.claimed_member_ids ?? []);
  const available = preview?.members.filter((member) => !claimed.has(member.id)) ?? [];
  const fixedIdentity = Boolean(preview?.member_id || preview?.intended_name);
  const identityName = preview?.member_id ? preview.members.find((member) => member.id === preview.member_id)?.name : preview?.intended_name;

  const join = async () => {
    if (!preview) return;
    if (!preview.email_match) return;
    const memberId = preview.member_id ?? (choice && choice !== '__new__' ? choice : null);
    const displayName = preview.intended_name ?? (choice === '__new__' ? newName.trim() : null);
    if (!preview.already_joined && !memberId && !displayName) return;
    setBusy(true); setError('');
    try {
      const result = await requestSharedJoinV2(code, memberId, displayName);
      if (result.result_status === 'pending') {
        clearPendingJoinIntent();
        setPending(true);
        onPending();
        return;
      }
      onJoined(sharedRowFromJoin(result, code));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not join this group.'); }
    finally { setBusy(false); }
  };

  return <SimpleModal title="Join a shared group" onClose={onClose}>
    {pending ? <div className="py-4 text-center"><div className="mx-auto grid size-14 place-items-center rounded-full bg-amber-50 text-2xl">⏳</div><h3 className="mt-3 text-base font-extrabold text-slate-900">Request sent</h3><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-600">Any already joined group member can review your name and signed-in email, then approve or deny the request.</p><button type="button" onClick={onClose} className="mt-4 rounded-xl bg-[#256f66] px-5 py-3 text-sm font-bold text-white">Done</button></div> : !preview ? <><p className="text-sm leading-6 text-slate-600">Open an invite link or paste the invite code here.</p><label className="mt-4 block text-xs font-bold text-slate-600">Invite code</label><div className="mt-1 flex gap-2"><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16))} placeholder="AB12CD34EF56" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-3 font-mono text-sm font-bold uppercase tracking-wider outline-none focus:border-[#256f66]" /><button type="button" disabled={busy || !code.trim()} onClick={() => void load()} className="rounded-xl bg-[#256f66] px-4 text-sm font-bold text-white disabled:opacity-40">{busy ? 'Finding…' : 'Find'}</button></div></> : <>
      <div className="rounded-2xl bg-[#eef6f3] p-4"><p className="text-lg font-extrabold text-slate-900">{preview.emoji} {preview.group_name}</p><p className="mt-1 text-xs text-slate-600">{preview.members.length} people · secure account-based sharing</p></div>
      {preview.already_joined ? <p className="mt-4 rounded-xl bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">You already belong to this group.</p> : !preview.email_match ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4"><p className="text-sm font-extrabold text-red-800">Wrong signed-in email</p><p className="mt-1 text-xs leading-5 text-red-700">This invitation was created for {preview.intended_email_hint || 'another email address'}. Sign out and use the invited email. Group members cannot override this check.</p></div> : fixedIdentity ? <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Joining as</p><p className="mt-1 text-lg font-extrabold text-slate-900">{identityName}</p><p className="mt-1 text-[11px] text-slate-500">{preview.requires_approval ? 'Your signed-in email and this identity will be sent to the group for approval.' : `Verified for ${preview.intended_email_hint || 'your invited email'}.`}</p></div> : <><p className="mt-4 text-xs font-bold text-slate-600">Who are you?</p><div className="mt-2 space-y-2">{available.map((member) => <button key={member.id} type="button" onClick={() => setChoice(member.id)} className={`flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 text-left text-sm font-bold ${choice === member.id ? 'border-[#256f66] bg-[#eef6f3] text-[#256f66]' : 'border-slate-200 bg-white text-slate-700'}`}><span className="grid size-7 place-items-center rounded-full bg-slate-100 text-xs">{member.name.trim().charAt(0).toUpperCase() || '?'}</span>{member.name}{choice === member.id ? <span className="ml-auto">✓</span> : null}</button>)}</div><button type="button" onClick={() => setChoice('__new__')} className={`mt-2 flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 text-left text-sm font-bold ${choice === '__new__' ? 'border-[#256f66] bg-[#eef6f3] text-[#256f66]' : 'border-slate-200 bg-white text-slate-700'}`}><UserPlus size={16} /> I'm not listed</button>{choice === '__new__' ? <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Your name" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#256f66]" /> : null}<div className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-[11px] leading-5 text-amber-800">Your signed-in email and selected name will be shown to the group. Any joined member can approve or deny.</div></>}
      <button type="button" disabled={busy || !preview.email_match || (!preview.already_joined && !fixedIdentity && (!choice || (choice === '__new__' && !newName.trim())))} onClick={() => void join()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#256f66] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">{busy ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />} {preview.already_joined ? 'Open group' : preview.requires_approval ? 'Request to join' : 'Join group'}</button>
    </>}
    {error ? <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-semibold leading-5 text-red-700">{error}</p> : null}
  </SimpleModal>;
}

function ProfileScreen({ open, onClose, session, data, update, status, statusMessage, lastSyncedAt, profile, onProfileChanged, onOpenSecurity, onRestored }: {
  open: boolean;
  onClose: () => void;
  session: SplitzapSession;
  data: SplitData;
  update: (fn: (data: SplitData) => SplitData) => void;
  status: SyncStatus;
  statusMessage: string;
  lastSyncedAt: string | null;
  profile: SplitzapProfile | null;
  onProfileChanged: (profile: SplitzapProfile) => void;
  onOpenSecurity: () => void;
  onRestored: () => void;
}) {
  const [name, setName] = useState(profile?.display_name || data.myName || '');
  const [currency, setCurrency] = useState(profile?.default_currency || data.preferences?.defaultCurrency || '₹');
  const [theme, setTheme] = useState<SplitzapProfile['theme']>(profile?.theme || data.preferences?.theme || 'system');
  const [reducedMotion, setReducedMotion] = useState(profile?.reduced_motion ?? data.preferences?.reducedMotion ?? false);
  const [deleted, setDeleted] = useState<RecentlyDeletedGroup[]>([]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const installState = useSplitzapInstall();

  const refreshDeleted = async () => {
    try { setDeleted(await listRecentlyDeletedGroups()); } catch { setDeleted([]); }
  };

  useEffect(() => {
    if (!open) return;
    setName(profile?.display_name || data.myName || '');
    setCurrency(profile?.default_currency || data.preferences?.defaultCurrency || '₹');
    setTheme(profile?.theme || data.preferences?.theme || 'system');
    setReducedMotion(profile?.reduced_motion ?? data.preferences?.reducedMotion ?? false);
    setFeedback('');
    void refreshDeleted();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profile?.display_name, profile?.default_currency, profile?.theme, profile?.reduced_motion]);

  if (!open) return null;

  const saveName = async () => {
    const clean = name.trim();
    if (!clean) { setFeedback('Enter your name.'); return; }
    setBusy(true); setFeedback('');
    try {
      await updateSplitzapProfileName(clean);
      update((current) => {
        const groups = current.groups.map((group) => {
          const id = memberIdFor(group, current);
          return { ...group, members: group.members.map((member) => member.id === id ? { ...member, name: clean } : member) };
        });
        return { ...current, myName: clean, groups };
      });
      const next = { display_name: clean, default_currency: currency, theme, reduced_motion: reducedMotion };
      onProfileChanged(next);
      setFeedback('Name updated everywhere. Existing audit entries keep their original event-time name.');
    } catch (cause) { setFeedback(cause instanceof Error ? cause.message : 'Could not update your name.'); }
    finally { setBusy(false); }
  };

  const savePreferences = async () => {
    setBusy(true); setFeedback('');
    try {
      await updateSplitzapProfilePreferences({ default_currency: currency, theme, reduced_motion: reducedMotion });
      update((current) => ({ ...current, preferences: { defaultCurrency: currency, theme, reducedMotion } }));
      onProfileChanged({ display_name: profile?.display_name || name.trim(), default_currency: currency, theme, reduced_motion: reducedMotion });
      setFeedback('Preferences saved.');
    } catch (cause) { setFeedback(cause instanceof Error ? cause.message : 'Could not save preferences.'); }
    finally { setBusy(false); }
  };

  const downloadExport = () => {
    try {
      const blob = new Blob([createSplitBackup()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `splitzap-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setFeedback('Splitzap data exported.');
    } catch { setFeedback('Could not export data on this device.'); }
  };

  const importFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true); setFeedback('');
    try {
      const result = importSplitBackupSafely(await file.text());
      setFeedback(`Imported ${result.importedGroups} personal ${result.importedGroups === 1 ? 'group' : 'groups'}.${result.skippedSharedGroups ? ` ${result.skippedSharedGroups} shared ${result.skippedSharedGroups === 1 ? 'group was' : 'groups were'} skipped to protect the live cloud copy.` : ''}`);
      onRestored();
    } catch (cause) { setFeedback(cause instanceof Error ? cause.message : 'Could not import this Splitzap file.'); }
    finally { setBusy(false); }
  };

  const restoreDeleted = async (id: string) => {
    setBusy(true); setFeedback('');
    try { await restoreSharedGroup(id); await refreshDeleted(); onRestored(); setFeedback('Group restored. Old invite links remain invalid; a new general invite was created.'); }
    catch (cause) { setFeedback(cause instanceof Error ? cause.message : 'Could not restore this group.'); }
    finally { setBusy(false); }
  };

  const removeAccount = async () => {
    if (deleteConfirm !== 'DELETE') return;
    setBusy(true); setFeedback('');
    try {
      await deleteSplitzapAccount();
      clearSplitzapExpenseDraft(session.user.id);
      try { await signOutSplitzap(); } catch { /* account may already be removed */ }
      window.localStorage.removeItem('splitzap.cloud.lastSyncHash');
      window.localStorage.removeItem('splitzap.cloud.lastSyncAt');
      window.localStorage.removeItem('splitzap.cloud.lastUserId');
      window.location.replace('/splitzap');
    } catch (cause) { setFeedback(cause instanceof Error ? cause.message : 'Could not delete your account.'); setBusy(false); }
  };

  const providers = session.user.identities?.map((identity) => identity.provider) ?? [];
  const initial = (name.trim()?.[0] || session.user.email?.[0] || '?').toUpperCase();

  return <div className="fixed inset-0 z-[140] overflow-y-auto bg-[#fbfaf6] text-slate-900"><div className="mx-auto min-h-[100dvh] w-full max-w-[520px] bg-[#fbfaf6] pb-[max(2rem,env(safe-area-inset-bottom))]"><header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200/80 bg-[#fbfaf6]/95 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur"><button type="button" onClick={onClose} aria-label="Back" className="grid size-10 place-items-center rounded-full bg-white shadow-sm"><X size={18} /></button><div className="min-w-0 flex-1"><h2 className="text-lg font-extrabold">My Profile</h2><p className="truncate text-[11px] text-slate-500">Account, preferences and your data</p></div></header><main className="space-y-4 p-4"><section className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-sm"><span className="grid size-14 place-items-center rounded-2xl bg-[#e7f4ef] text-xl font-extrabold text-[#256f66]">{initial}</span><div className="min-w-0 flex-1"><p className="truncate text-base font-extrabold">{name.trim() || 'Splitzap user'}</p><p className="truncate text-xs text-slate-500">{session.user.email}</p></div>{status === 'offline' || status === 'error' ? <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${status === 'offline' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{status === 'offline' ? 'Offline' : 'Sync issue'}</span> : null}</section>
      <ProfileSection title="Personal information"><label className="block text-xs font-bold text-slate-600">Name</label><div className="mt-1 flex gap-2"><input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-[#256f66]" /><button type="button" disabled={busy || !name.trim()} onClick={() => void saveName()} className="rounded-xl bg-[#256f66] px-4 text-xs font-bold text-white disabled:opacity-40">Save</button></div><label className="mt-3 block text-xs font-bold text-slate-600">Email</label><div className="mt-1 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600">{session.user.email}</div></ProfileSection>
      <ProfileSection title="Account & Security"><ProfileRow label="Google" value={providers.includes('google') ? 'Connected' : 'Not connected'} /><ProfileRow label="Email sign-in" value={session.user.email ? 'Available' : 'Unavailable'} /><button type="button" onClick={onOpenSecurity} className="mt-2 w-full rounded-xl bg-slate-50 px-3 py-3 text-left text-xs font-bold text-[#256f66]">Password & sign-in settings</button></ProfileSection>
      <ProfileSection title="Preferences"><div className="grid grid-cols-2 gap-2"><div><label className="block text-[11px] font-bold text-slate-600">Default currency</label><select value={currency} onChange={(event) => setCurrency(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">{['₹','$','€','£','¥'].map((item) => <option key={item}>{item}</option>)}</select></div><div><label className="block text-[11px] font-bold text-slate-600">Theme</label><select value={theme} onChange={(event) => setTheme(event.target.value as SplitzapProfile['theme'])} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></div></div><label className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3 text-xs font-bold">Reduced animations<input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} className="size-5" /></label><button type="button" disabled={busy} onClick={() => void savePreferences()} className="mt-3 w-full rounded-xl bg-[#e7f4ef] py-3 text-xs font-bold text-[#256f66]">Save preferences</button></ProfileSection>
      <ProfileSection title="Data & Privacy">{status === 'offline' || status === 'error' ? <div className={`rounded-xl px-3 py-3 ${status === 'offline' ? 'bg-amber-50' : 'bg-red-50'}`}><p className={`text-xs font-bold ${status === 'offline' ? 'text-amber-800' : 'text-red-800'}`}>{status === 'offline' ? 'Offline' : 'Sync problem'}</p><p className={`mt-0.5 text-[10px] ${status === 'offline' ? 'text-amber-700' : 'text-red-700'}`}>{statusMessage}{lastSyncedAt ? ` · Last synced ${new Date(lastSyncedAt).toLocaleString()}` : ''}</p></div> : null}<div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={downloadExport} className="rounded-xl bg-slate-50 px-3 py-3 text-left"><Download size={16} className="text-[#256f66]" /><b className="mt-2 block text-xs">Export data</b></button><label className="cursor-pointer rounded-xl bg-slate-50 px-3 py-3 text-left"><Upload size={16} className="text-[#256f66]" /><b className="mt-2 block text-xs">Import data</b><input type="file" accept="application/json,.json" className="hidden" onChange={(event) => { void importFile(event.target.files?.[0] ?? null); event.currentTarget.value = ''; }} /></label></div><p className="mt-2 text-[10px] leading-4 text-slate-500">Import never overwrites a live shared group. Shared cloud copies are protected and skipped.</p><button type="button" onClick={() => setDeleteAccountOpen(true)} className="mt-3 w-full rounded-xl bg-red-50 py-3 text-xs font-bold text-red-700">Delete account</button></ProfileSection>
      <ProfileSection title="Recently Deleted"><p className="mb-2 text-[10px] leading-4 text-slate-500">Shared groups deleted for everyone can be restored for 30 days.</p>{deleted.length ? <div className="space-y-2">{deleted.map((item) => { const group = item.snapshot.group; const days = item.purge_after ? Math.max(0, Math.ceil((+new Date(item.purge_after) - Date.now()) / 86400000)) : 30; return <div key={item.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><span className="text-xl">{group.emoji}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{group.name}</p><p className="text-[10px] text-slate-500">{days} days left to restore</p></div><button type="button" disabled={busy} onClick={() => void restoreDeleted(item.id)} className="rounded-lg bg-white px-3 py-2 text-[10px] font-bold text-[#256f66]">Restore</button></div>; })}</div> : <p className="rounded-xl bg-slate-50 px-3 py-3 text-xs text-slate-500">Nothing recently deleted.</p>}</ProfileSection>
      <ProfileSection title="Help & About">{!installState.installed ? <button type="button" onClick={() => { void installState.install().then((result) => { if (result.outcome === 'manual') setFeedback(installState.ios ? 'To install Splitzap on iPhone, open the browser Share menu and choose Add to Home Screen.' : 'Open your browser menu and choose Install app or Add to Home screen.'); else if (result.outcome === 'accepted') setFeedback('Splitzap installation started.'); }); }} className="mb-2 flex w-full items-center gap-3 rounded-xl bg-[#eef6f3] px-3 py-3 text-left text-xs font-bold text-[#256f66]"><Download size={15} /> Install Splitzap</button> : null}<details className="rounded-xl bg-slate-50 px-3 py-3"><summary className="cursor-pointer list-none text-xs font-bold">Help & feedback <ChevronRight size={14} className="float-right" /></summary><p className="mt-2 text-[11px] leading-5 text-slate-600">For help with groups, expenses, payments, invites or anything that does not look right, email <a className="font-bold text-[#256f66]" href="mailto:hizapora@gmail.com?subject=Splitzap%20Help">hizapora@gmail.com</a>.</p></details><details className="mt-2 rounded-xl bg-slate-50 px-3 py-3"><summary className="cursor-pointer list-none text-xs font-bold">Privacy <ChevronRight size={14} className="float-right" /></summary><p className="mt-2 text-[11px] leading-5 text-slate-600">Splitzap uses your account information to provide the service and keep your expense data available across your devices. Information inside a shared group can be seen by people in that group. We do not sell your personal information. You can export your data or delete your account from My Profile. For privacy questions, email hizapora@gmail.com.</p></details></ProfileSection>
      {feedback ? <p role="status" className="rounded-xl bg-[#eef6f3] px-3 py-3 text-xs leading-5 text-slate-700">{feedback}</p> : null}
      <button type="button" onClick={() => { clearSplitzapExpenseDraft(session.user.id); void signOutSplitzap(); }} className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-700">Sign out</button>
    </main></div>{deleteAccountOpen ? <div className="fixed inset-0 z-[160] flex items-end justify-center bg-black/40 p-3"><div className="w-full max-w-[500px] rounded-3xl bg-white p-5"><h3 className="text-base font-extrabold">Delete Splitzap account?</h3><p className="mt-2 text-xs leading-5 text-slate-600">This removes your account data. If you own a shared group with other joined members, Splitzap will block deletion until you transfer ownership or remove those members.</p><label className="mt-4 block text-xs font-bold text-slate-600">Type DELETE</label><input value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" /><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => { setDeleteAccountOpen(false); setDeleteConfirm(''); }} className="rounded-xl bg-slate-100 py-3 text-xs font-bold">Cancel</button><button type="button" disabled={busy || deleteConfirm !== 'DELETE'} onClick={() => void removeAccount()} className="rounded-xl bg-red-600 py-3 text-xs font-bold text-white disabled:opacity-40">Delete account</button></div></div></div> : null}</div>;
}

function ProfileSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-3xl bg-white p-4 shadow-sm"><h3 className="mb-3 text-sm font-extrabold">{title}</h3>{children}</section>;
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between border-b border-slate-100 py-2.5 last:border-b-0"><span className="text-xs font-semibold text-slate-600">{label}</span><span className="text-xs font-bold text-slate-800">{value}</span></div>;
}

function ManageMembersSheet({ open, group, memberships, requests, onClose, onInvite, onResolve, onRename, onUnlink, onTransfer }: {
  open: boolean;
  group: Group | null;
  memberships: SharedMembership[];
  requests: SharedJoinRequest[];
  onClose: () => void;
  onInvite: (memberId: string) => void;
  onResolve: (requestId: string, approve: boolean) => Promise<void>;
  onRename: (memberId: string, name: string) => Promise<void>;
  onUnlink: (memberId: string) => Promise<void>;
  onTransfer: (memberId: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState('');
  const [editingMember, setEditingMember] = useState('');
  const [editingName, setEditingName] = useState('');
  if (!open || !group?.sharedId) return null;
  const groupMemberships = memberships.filter((item) => item.group_id === group.sharedId);
  const membershipByMember = new Map(groupMemberships.map((item) => [item.member_id, item]));
  const groupRequests = requests.filter((item) => item.group_id === group.sharedId);
  const myMemberId = group.myMemberId;
  const ownerMemberId = groupMemberships.find((item) => item.role === 'owner')?.member_id;
  const isOwner = group.sharedRole === 'owner';

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setFeedback('');
    try { await fn(); }
    catch (cause) { setFeedback(cause instanceof Error ? cause.message : 'Could not complete that action.'); }
    finally { setBusy(''); }
  };

  return <SimpleModal title="Manage members" onClose={onClose}>
    {groupRequests.length ? <div className="mb-4"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-extrabold text-slate-700">Pending requests</p><span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">{groupRequests.length}</span></div><div className="space-y-2">{groupRequests.map((request) => <div key={request.id} className="rounded-2xl border border-amber-100 bg-amber-50/60 p-3"><p className="text-sm font-extrabold text-slate-900">{request.requested_name}</p><p className="mt-0.5 break-all text-[11px] text-slate-600">{request.requested_email}</p>{request.requested_member_id ? <p className="mt-1 text-[10px] text-slate-500">Claims existing member: {group.members.find((member) => member.id === request.requested_member_id)?.name || 'Unknown'}</p> : <p className="mt-1 text-[10px] text-slate-500">New member identity</p>}<div className="mt-2 grid grid-cols-2 gap-2"><button type="button" disabled={Boolean(busy)} onClick={() => void run(`deny-${request.id}`, () => onResolve(request.id, false))} className="rounded-xl bg-white py-2.5 text-xs font-bold text-red-600">Deny</button><button type="button" disabled={Boolean(busy)} onClick={() => void run(`approve-${request.id}`, () => onResolve(request.id, true))} className="rounded-xl bg-[#256f66] py-2.5 text-xs font-bold text-white">Approve</button></div></div>)}</div></div> : null}
    <div className="space-y-2">{group.members.map((member) => { const membership = membershipByMember.get(member.id); const joined = Boolean(membership); const isSelf = member.id === myMemberId; const isMemberOwner = member.id === ownerMemberId; return <div key={member.id} className="rounded-2xl border border-slate-200 bg-white p-3"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-slate-100 text-xs font-extrabold">{member.name.trim().charAt(0).toUpperCase() || '?'}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold">{member.name}{isSelf ? ' (You)' : ''}</p><p className="text-[10px] text-slate-500">{isMemberOwner ? 'Owner' : joined ? 'Joined' : 'Not joined'}</p></div>{!joined ? <button type="button" onClick={() => onInvite(member.id)} className="rounded-lg bg-[#eef6f3] px-3 py-2 text-[10px] font-bold text-[#256f66]">Invite</button> : null}</div>{isOwner && !isSelf ? <div className="mt-2 flex flex-wrap gap-1.5">{editingMember === member.id ? <div className="flex w-full gap-2"><input value={editingName} onChange={(event) => setEditingName(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs" /><button type="button" disabled={!editingName.trim() || Boolean(busy)} onClick={() => void run(`rename-${member.id}`, async () => { await onRename(member.id, editingName.trim()); setEditingMember(''); })} className="rounded-lg bg-[#256f66] px-3 text-[10px] font-bold text-white">Save</button></div> : <button type="button" onClick={() => { setEditingMember(member.id); setEditingName(member.name); }} className="rounded-lg bg-slate-50 px-2.5 py-2 text-[10px] font-bold text-slate-600">Rename</button>}{joined && !isMemberOwner ? <button type="button" disabled={Boolean(busy)} onClick={() => window.confirm(`Remove ${member.name} from ${group.name}? They will lose access, but their historical expenses and balances will remain intact.`) && void run(`unlink-${member.id}`, () => onUnlink(member.id))} className="rounded-lg bg-slate-50 px-2.5 py-2 text-[10px] font-bold text-slate-600">Remove from group</button> : null}{joined && !isMemberOwner ? <button type="button" disabled={Boolean(busy)} onClick={() => window.confirm(`Transfer ownership of ${group.name} to ${member.name}?`) && void run(`owner-${member.id}`, () => onTransfer(member.id))} className="rounded-lg bg-slate-50 px-2.5 py-2 text-[10px] font-bold text-slate-600">Make owner</button> : null}</div> : null}</div>; })}</div>
    <button type="button" onClick={() => onInvite('')} className="mt-3 w-full rounded-xl border border-dashed border-slate-300 py-3 text-xs font-bold text-[#256f66]">+ Invite a new person</button>
    {feedback ? <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">{feedback}</p> : null}
  </SimpleModal>;
}

function AccountSheet({ open, onClose, session, status, statusMessage, lastSyncedAt, recoveryMode, onRecoveryComplete, locked = false }: {
  open: boolean;
  onClose: () => void;
  session: SplitzapSession | null;
  status: SyncStatus;
  statusMessage: string;
  lastSyncedAt: string | null;
  recoveryMode: boolean;
  onRecoveryComplete: () => void;
  locked?: boolean;
}) {
  const [mode, setMode] = useState<EmailMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [passwordEditorOpen, setPasswordEditorOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !recoveryMode && !locked) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [locked, onClose, open, recoveryMode]);

  useEffect(() => {
    if (recoveryMode) {
      setPasswordEditorOpen(true);
      setFeedback('Set a new password to finish account recovery.');
    }
  }, [recoveryMode]);

  if (!open) return null;

  const runGoogle = async () => {
    setBusy(true);
    setFeedback('');
    try {
      await signInSplitzapWithGoogle();
    } catch (cause) {
      setBusy(false);
      setFeedback(friendlyAuthError(cause));
    }
  };

  const runEmailAuth = async () => {
    if (!email.trim() || !password) return;
    if (mode === 'signup' && password.length < 8) {
      setFeedback('Use at least 8 characters for your password.');
      return;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setFeedback('Passwords do not match.');
      return;
    }
    setBusy(true);
    setFeedback('');
    try {
      if (mode === 'signin') {
        await signInSplitzapWithPassword(email, password);
        setFeedback('Signed in. Loading your Splitzap data…');
      } else {
        const result = await signUpSplitzapWithPassword(email, password);
        if (result.user?.identities?.length === 0) {
          setFeedback('An account may already exist for this email. Try Sign in instead.');
        } else if (!result.session) {
          setFeedback('Account created. Verification email sent. If you do not receive it, wait a little and try again later.');
        } else {
          setFeedback('Account created. Loading your Splitzap data…');
        }
      }
    } catch (cause) {
      setFeedback(friendlyAuthError(cause));
    } finally {
      setBusy(false);
    }
  };

  const runPasswordReset = async () => {
    if (!email.trim()) {
      setFeedback('Enter your email first.');
      return;
    }
    setBusy(true);
    setFeedback('');
    try {
      await sendSplitzapPasswordReset(email);
      setFeedback('Password reset email sent. If you do not receive it, wait a little and try again later.');
      setResetOpen(false);
    } catch (cause) {
      setFeedback(friendlyAuthError(cause));
    } finally {
      setBusy(false);
    }
  };

  const runPasswordUpdate = async () => {
    if (newPassword.length < 8) {
      setFeedback('Use at least 8 characters for your password.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setFeedback('Passwords do not match.');
      return;
    }
    setBusy(true);
    setFeedback('');
    try {
      await updateSplitzapPassword(newPassword);
      setFeedback(recoveryMode ? 'Password reset complete. You can use email + password next time.' : 'Password saved. Email + password sign-in is now available for this account.');
      setPasswordEditorOpen(false);
      setNewPassword('');
      setConfirmNewPassword('');
      if (recoveryMode) onRecoveryComplete();
    } catch (cause) {
      setFeedback(friendlyAuthError(cause));
    } finally {
      setBusy(false);
    }
  };

  const statusIcon = status === 'offline' ? <CloudOff size={16} /> : status === 'syncing' || status === 'connecting' ? <Loader2 size={16} className="animate-spin" /> : <Cloud size={16} />;
  const providers = session?.user.identities?.map((identity) => identity.provider) ?? [];

  return (
    <div className="fixed inset-0 z-[125] flex items-end justify-center" role="presentation">
      {locked ? <div className="absolute inset-0 bg-[#fbfaf6]" /> : !recoveryMode ? <button type="button" aria-label="Close account" onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" /> : <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />}
      <section role="dialog" aria-modal="true" aria-label={session ? 'Splitzap account' : 'Sign in to Splitzap'} className={locked ? 'relative min-h-[100dvh] w-full max-w-[520px] overflow-y-auto bg-[#fbfaf6] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]' : 'relative max-h-[92dvh] w-full max-w-[520px] overflow-y-auto rounded-t-[28px] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl'}>
        {!locked ? <div className="mx-auto h-1 w-10 rounded-full bg-slate-200" /> : <div className="mx-auto mt-5 grid size-16 place-items-center rounded-2xl bg-[#256f66] text-2xl font-extrabold text-white shadow-lg">₹</div>}
        <div className="flex items-center justify-between gap-3 pb-3 pt-3">
          <div><h2 className="text-lg font-extrabold text-slate-900">{session ? 'Account & sync' : 'Sign in to Splitzap'}</h2><p className="mt-0.5 text-xs text-slate-500">{session ? 'Your Splitzap account and sync status' : 'Your groups and expenses stay with your account'}</p></div>
          {!recoveryMode && !locked ? <button type="button" onClick={onClose} aria-label="Close" className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500"><X size={15} /></button> : null}
        </div>

        {session ? (
          <div>
            <div className="rounded-2xl bg-[#eef6f3] p-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-extrabold text-slate-900">{session.user.email}</p><div className="mt-2 flex flex-wrap gap-1.5">{providers.length ? providers.map((provider) => <span key={provider} className="rounded-full bg-white px-2 py-1 text-[10px] font-bold capitalize text-slate-600">{provider}</span>) : <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-slate-600">email</span>}</div></div><ShieldCheck size={20} className="shrink-0 text-[#256f66]" /></div>
              <div className="mt-3 flex items-center gap-2 text-xs font-bold text-[#256f66]">{statusIcon}<span>{statusMessage}</span></div>
              {lastSyncedAt ? <p className="mt-1 text-[11px] text-slate-500">Last cloud sync: {new Date(lastSyncedAt).toLocaleString()}</p> : null}
            </div>

            <button type="button" onClick={() => setPasswordEditorOpen((value) => !value)} className="mt-3 flex min-h-12 w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 text-left">
              <span className="grid size-9 place-items-center rounded-xl bg-slate-100 text-[#256f66]"><KeyRound size={17} /></span>
              <span className="min-w-0 flex-1"><b className="block text-sm">Set / change password</b><span className="text-[11px] text-slate-500">Enable email + password sign-in for this same account</span></span>
            </button>

            {passwordEditorOpen ? (
              <div className="mt-3 rounded-2xl border border-slate-200 p-3">
                {recoveryMode ? <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-semibold leading-4 text-amber-800">Password recovery is active. Set your new password below.</p> : null}
                <PasswordInput label="New password" value={newPassword} onChange={setNewPassword} show={showPassword} onToggle={() => setShowPassword((value) => !value)} />
                <PasswordInput label="Confirm password" value={confirmNewPassword} onChange={setConfirmNewPassword} show={showPassword} />
                <button type="button" disabled={busy || newPassword.length < 8 || newPassword !== confirmNewPassword} onClick={() => void runPasswordUpdate()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#256f66] px-4 py-3 text-sm font-bold text-white disabled:opacity-45">{busy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />} Save password</button>
              </div>
            ) : null}

            {feedback ? <p role="status" className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">{feedback}</p> : null}
            <p className="mt-3 text-xs leading-5 text-slate-500">When you are online, Splitzap keeps your latest changes synced to your account. If your connection drops while you are signed in, you can keep working and changes will sync when you reconnect.</p>
            <button type="button" onClick={() => { if (session) clearSplitzapExpenseDraft(session.user.id); void signOutSplitzap().then(onClose); }} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700"><LogOut size={16} /> Sign out</button>
          </div>
        ) : (
          <div>
            <button type="button" disabled={busy} onClick={() => void runGoogle()} className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 shadow-sm disabled:opacity-50">
              <GoogleMark /> Continue with Google
            </button>
            <div className="my-4 flex items-center gap-3"><span className="h-px flex-1 bg-slate-200" /><span className="text-[11px] font-semibold text-slate-400">or use email</span><span className="h-px flex-1 bg-slate-200" /></div>

            <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
              <button type="button" onClick={() => { setMode('signin'); setFeedback(''); setResetOpen(false); }} className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === 'signin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Sign in</button>
              <button type="button" onClick={() => { setMode('signup'); setFeedback(''); setResetOpen(false); }} className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Create account</button>
            </div>

            <label className="mt-4 block text-xs font-bold text-slate-600">Email</label>
            <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-[#256f66] focus:ring-2 focus:ring-[#256f66]/10" />
            <PasswordInput label="Password" value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword((value) => !value)} />
            {mode === 'signup' ? <PasswordInput label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} show={showPassword} /> : null}

            {mode === 'signup' ? <EmailAllowanceNotice action="Creating an account" /> : null}

            <button type="button" disabled={busy || !email.trim() || !password || (mode === 'signup' && (password.length < 8 || password !== confirmPassword))} onClick={() => void runEmailAuth()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#256f66] px-4 py-3 text-sm font-bold text-white disabled:opacity-45">{busy ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}{mode === 'signin' ? 'Sign in with email' : 'Create account'}</button>

            {mode === 'signin' ? <button type="button" onClick={() => setResetOpen((value) => !value)} className="mt-3 w-full text-center text-xs font-bold text-[#256f66]">Forgot password?</button> : null}
            {resetOpen ? <div className="mt-3"><EmailAllowanceNotice action="Password reset" /><button type="button" disabled={busy || !email.trim()} onClick={() => void runPasswordReset()} className="mt-2 w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-bold text-amber-800 disabled:opacity-45">Send reset email</button></div> : null}
            {feedback ? <p role="status" className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">{feedback}</p> : null}
          </div>
        )}
      </section>
    </div>
  );
}

function EmailAllowanceNotice({ action }: { action: string }) {
  return <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5"><div className="flex items-start gap-2"><Mail size={15} className="mt-0.5 shrink-0 text-amber-700" /><div><p className="text-[11px] font-extrabold text-amber-900">Temporary email limit</p><p className="mt-0.5 text-[11px] leading-4 text-amber-800">{action} sends an email. Authentication emails are temporarily limited, so if the limit is reached please try again later or use Google sign-in.</p></div></div></div>;
}

function PasswordInput({ label, value, onChange, show, onToggle }: { label: string; value: string; onChange: (value: string) => void; show: boolean; onToggle?: () => void }) {
  return <div className="mt-3"><label className="block text-xs font-bold text-slate-600">{label}</label><div className="relative mt-1"><input type={show ? 'text' : 'password'} autoComplete={label.toLowerCase().includes('new') || label.toLowerCase().includes('confirm') ? 'new-password' : 'current-password'} value={value} onChange={(event) => onChange(event.target.value)} placeholder="At least 8 characters" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 pr-11 text-sm outline-none focus:border-[#256f66] focus:ring-2 focus:ring-[#256f66]/10" />{onToggle ? <button type="button" onClick={onToggle} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-1 top-1 grid size-10 place-items-center rounded-lg text-slate-500">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button> : null}</div></div>;
}

function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px]"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.93A6.02 6.02 0 0 1 6.07 12c0-.67.12-1.32.32-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.55l3.35-2.62Z"/><path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"/></svg>;
}

function SimpleModal({ title, onClose, children, closable = true }: { title: string; onClose?: () => void; children: React.ReactNode; closable?: boolean }) {
  return (
    <div className="fixed inset-0 z-[130] grid place-items-center bg-black/40 px-5 backdrop-blur-[2px]" role="presentation">
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-[400px] rounded-3xl bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-base font-extrabold text-slate-900">{title}</h2>{closable && onClose ? <button type="button" onClick={onClose} aria-label="Close" className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500"><X size={15} /></button> : null}</div>
        {children}
      </div>
    </div>
  );
}
