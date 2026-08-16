import { Cloud, CloudOff, Copy, Eye, EyeOff, KeyRound, Link2, Loader2, LogOut, Mail, Share2, ShieldCheck, UserPlus, UserRound, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import SplitzapAppV4 from './SplitzapAppV4';
import { memberIdFor, useSplitData, type Group, type SplitData } from './splitStoreV4';
import {
  fetchSplitzapCloudState,
  getSplitzapSession,
  onSplitzapAuthChange,
  saveSplitzapCloudState,
  sendSplitzapPasswordReset,
  signInSplitzapWithGoogle,
  signInSplitzapWithPassword,
  signOutSplitzap,
  signUpSplitzapWithPassword,
  updateSplitzapPassword,
  type SplitzapSession,
} from './splitzapCloud';
import {
  buildSharedGroupSnapshot,
  createSharedGroup,
  deleteSharedGroup,
  fetchSharedGroup,
  joinSharedGroup,
  leaveSharedGroup,
  loadSharedGroupsForUser,
  mergeSharedRowsIntoLocal,
  previewSharedGroupJoin,
  removeGroupFromLocal,
  sharedSnapshotHash,
  subscribeToSharedGroupChanges,
  updateSharedGroup,
  type JoinPreview,
  type SharedGroupRow,
} from './splitzapShared';

type SyncStatus = 'local' | 'connecting' | 'syncing' | 'synced' | 'offline' | 'error';
type Conflict = { cloud: SplitData; local: SplitData } | null;
type EmailMode = 'signin' | 'signup';

const LAST_SYNC_HASH_KEY = 'splitzap.cloud.lastSyncHash';
const LAST_SYNC_AT_KEY = 'splitzap.cloud.lastSyncAt';
const PENDING_JOIN_KEY = 'splitzap.shared.pendingJoin';

const dataHash = (data: SplitData) => JSON.stringify(data);
const hasMeaningfulData = (data: SplitData) => data.groups.length > 0 || data.expenses.length > 0 || data.settlements.length > 0;

function safeGet(key: string) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function saveSyncMarker(data: SplitData, updatedAt = new Date().toISOString()) {
  try {
    window.localStorage.setItem(LAST_SYNC_HASH_KEY, dataHash(data));
    window.localStorage.setItem(LAST_SYNC_AT_KEY, updatedAt);
  } catch { /* local storage warnings are handled by the main store */ }
}

function friendlyAuthError(cause: unknown) {
  const message = cause instanceof Error ? cause.message : 'Authentication failed.';
  if (/email rate limit|over_email_send_rate_limit/i.test(message)) return "Splitzap's temporary test email limit is reached. Use Google or try the email action later.";
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
  const [migrationOpen, setMigrationOpen] = useState(false);
  const [conflict, setConflict] = useState<Conflict>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [shareGroupId, setShareGroupId] = useState<string | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinRequested, setJoinRequested] = useState(false);
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
    getSplitzapSession()
      .then((next) => { if (active) { setSession(next); setAuthReady(true); } })
      .catch(() => { if (active) { setAuthReady(true); setStatus('error'); setStatusMessage('Could not check cloud account'); } });
    const unsubscribe = onSplitzapAuthChange((next, event) => {
      if (!active) return;
      setSession(next);
      initializedUser.current = null;
      sharedInitializedUser.current = null;
      sharedHashes.current.clear();
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
        setAccountOpen(true);
      }
      if (!next) {
        setStatus('local');
        setStatusMessage('Saved on this device');
      }
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!hydrated || !authReady || !session || initializedUser.current === session.user.id) return;
    let active = true;
    initializedUser.current = session.user.id;
    setStatus('connecting');
    setStatusMessage('Checking cloud copy…');

    void (async () => {
      try {
        const row = await fetchSplitzapCloudState(session.user.id);
        if (!active) return;
        const local = latestData.current;
        const localHash = dataHash(local);
        const lastHash = safeGet(LAST_SYNC_HASH_KEY);

        if (!row) {
          if (hasMeaningfulData(local)) {
            setMigrationOpen(true);
            setStatus('local');
            setStatusMessage('Device data ready to move online');
            return;
          }
          const updatedAt = await saveSplitzapCloudState(session.user.id, local);
          if (!active) return;
          saveSyncMarker(local, updatedAt);
          setLastSyncedAt(updatedAt);
          setStatus('synced');
          setStatusMessage('Synced');
          return;
        }

        const cloudHash = dataHash(row.data);
        if (localHash === cloudHash) {
          saveSyncMarker(row.data, row.updated_at);
          setLastSyncedAt(row.updated_at);
          setStatus('synced');
          setStatusMessage('Synced');
          return;
        }

        if (lastHash && localHash !== lastHash) {
          const updatedAt = await saveSplitzapCloudState(session.user.id, local);
          if (!active) return;
          saveSyncMarker(local, updatedAt);
          setLastSyncedAt(updatedAt);
          setStatus('synced');
          setStatusMessage('Offline changes synced');
          return;
        }

        if (!lastHash && hasMeaningfulData(local) && hasMeaningfulData(row.data)) {
          setConflict({ cloud: row.data, local });
          setStatus('error');
          setStatusMessage('Choose which copy to keep');
          return;
        }

        update(() => row.data);
        saveSyncMarker(row.data, row.updated_at);
        setLastSyncedAt(row.updated_at);
        setStatus('synced');
        setStatusMessage('Cloud data loaded');
      } catch (cause) {
        if (!active) return;
        setStatus(navigator.onLine ? 'error' : 'offline');
        setStatusMessage(navigator.onLine ? (cause instanceof Error ? cause.message : 'Cloud sync failed') : 'Offline · changes stay on this device');
      }
    })();

    return () => { active = false; };
  }, [authReady, hydrated, session, update]);

  useEffect(() => {
    if (!hydrated || !session || initializedUser.current !== session.user.id || migrationOpen || conflict || status !== 'synced' || sharedInitializedUser.current === session.user.id) return;
    let active = true;
    sharedInitializedUser.current = session.user.id;
    void loadSharedGroupsForUser(session.user.id)
      .then((rows) => {
        if (!active) return;
        sharedHashes.current.clear();
        rows.forEach((row) => sharedHashes.current.set(row.id, sharedSnapshotHash(row.snapshot)));
        update((current) => mergeSharedRowsIntoLocal(current, rows, true));
      })
      .catch((cause) => {
        if (!active) return;
        sharedInitializedUser.current = null;
        setStatus('error');
        setStatusMessage(cause instanceof Error ? cause.message : 'Could not load shared groups');
      });
    return () => { active = false; };
  }, [conflict, hydrated, migrationOpen, session, status, update]);

  useEffect(() => {
    if (!session || sharedInitializedUser.current !== session.user.id) return;
    return subscribeToSharedGroupChanges(session.user.id, (payload) => {
      const fresh = payload.new as Record<string, unknown>;
      const old = payload.old as Record<string, unknown>;
      const sharedId = String(fresh?.id ?? old?.id ?? '');
      if (!sharedId) return;
      if (payload.eventType === 'DELETE') {
        sharedHashes.current.delete(sharedId);
        update((current) => {
          const group = current.groups.find((item) => item.sharedId === sharedId);
          return group ? removeGroupFromLocal(current, group.id) : current;
        });
        return;
      }
      void fetchSharedGroup(sharedId, session.user.id).then((row) => {
        if (!row) return;
        sharedHashes.current.set(row.id, sharedSnapshotHash(row.snapshot));
        update((current) => mergeSharedRowsIntoLocal(current, [row], false));
      }).catch(() => undefined);
    });
  }, [session, update]);

  useEffect(() => {
    if (!session || sharedInitializedUser.current !== session.user.id || migrationOpen || conflict || !navigator.onLine) return;
    const changed = data.groups
      .filter((group) => group.sharedId)
      .map((group) => ({ group, snapshot: buildSharedGroupSnapshot(data, group.id) }))
      .filter(({ group, snapshot }) => sharedSnapshotHash(snapshot) !== sharedHashes.current.get(group.sharedId!));
    if (!changed.length) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        setStatus('syncing');
        setStatusMessage('Syncing shared group…');
        try {
          for (const item of changed) {
            const sharedId = item.group.sharedId!;
            const result = await updateSharedGroup(sharedId, item.snapshot);
            sharedHashes.current.set(sharedId, sharedSnapshotHash(item.snapshot));
            update((current) => ({ ...current, groups: current.groups.map((group) => group.id === item.group.id ? { ...group, sharedRevision: result.revision } : group) }));
          }
          setStatus('synced');
          setStatusMessage('Synced');
        } catch (cause) {
          setStatus(navigator.onLine ? 'error' : 'offline');
          setStatusMessage(cause instanceof Error ? cause.message : 'Shared group sync failed');
        }
      })();
    }, 850);
    return () => window.clearTimeout(timer);
  }, [conflict, data, migrationOpen, session, status, update]);

  useEffect(() => {
    if (!authReady) return;
    const urlCode = new URLSearchParams(window.location.search).get('join')?.trim().toUpperCase() || '';
    const pending = urlCode || safeGet(PENDING_JOIN_KEY) || '';
    if (!pending) return;
    setJoinCode(pending);
    try { window.localStorage.setItem(PENDING_JOIN_KEY, pending); } catch { /* best effort */ }
    if (session) {
      setAccountOpen(false);
      setJoinOpen(true);
    } else {
      setAccountOpen(true);
    }
  }, [authReady, session]);

  useEffect(() => {
    if (!session) return;
    if (shareGroupId) setAccountOpen(false);
    if (joinRequested) {
      setAccountOpen(false);
      setJoinOpen(true);
    }
  }, [joinRequested, session, shareGroupId]);

  useEffect(() => {
    if (!hydrated || !session || initializedUser.current !== session.user.id || migrationOpen || conflict || syncing.current) return;
    const currentHash = dataHash(data);
    if (currentHash === safeGet(LAST_SYNC_HASH_KEY)) return;
    if (!navigator.onLine) {
      setStatus('offline');
      setStatusMessage('Offline · changes will sync later');
      return;
    }

    const timer = window.setTimeout(() => {
      syncing.current = true;
      setStatus('syncing');
      setStatusMessage('Syncing…');
      void saveSplitzapCloudState(session.user.id, latestData.current)
        .then((updatedAt) => {
          saveSyncMarker(latestData.current, updatedAt);
          setLastSyncedAt(updatedAt);
          setStatus('synced');
          setStatusMessage('Synced');
        })
        .catch((cause) => {
          setStatus(navigator.onLine ? 'error' : 'offline');
          setStatusMessage(navigator.onLine ? (cause instanceof Error ? cause.message : 'Cloud sync failed') : 'Offline · changes will sync later');
        })
        .finally(() => { syncing.current = false; });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [conflict, data, hydrated, migrationOpen, session]);

  useEffect(() => {
    const onOffline = () => { if (session) { setStatus('offline'); setStatusMessage('Offline · changes will sync later'); } };
    const onOnline = () => {
      if (!session) return;
      const current = latestData.current;
      if (dataHash(current) !== safeGet(LAST_SYNC_HASH_KEY)) {
        setStatus('syncing');
        setStatusMessage('Back online · syncing…');
        void saveSplitzapCloudState(session.user.id, current).then((updatedAt) => {
          saveSyncMarker(current, updatedAt);
          setLastSyncedAt(updatedAt);
          setStatus('synced');
          setStatusMessage('Synced');
        }).catch(() => { setStatus('error'); setStatusMessage('Cloud sync failed'); });
      } else {
        setStatus('synced');
        setStatusMessage('Synced');
      }
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => { window.removeEventListener('offline', onOffline); window.removeEventListener('online', onOnline); };
  }, [session]);

  const migrate = async () => {
    if (!session) return;
    setStatus('syncing');
    setStatusMessage('Saving device data online…');
    try {
      const current = latestData.current;
      const updatedAt = await saveSplitzapCloudState(session.user.id, current);
      saveSyncMarker(current, updatedAt);
      setLastSyncedAt(updatedAt);
      setMigrationOpen(false);
      setStatus('synced');
      setStatusMessage('Synced');
    } catch (cause) {
      setStatus('error');
      setStatusMessage(cause instanceof Error ? cause.message : 'Could not move data online');
    }
  };

  const keepLocalConflict = async () => {
    if (!session || !conflict) return;
    const updatedAt = await saveSplitzapCloudState(session.user.id, conflict.local);
    saveSyncMarker(conflict.local, updatedAt);
    setLastSyncedAt(updatedAt);
    setConflict(null);
    setStatus('synced');
    setStatusMessage('Device copy saved online');
  };

  const keepCloudConflict = () => {
    if (!conflict) return;
    update(() => conflict.cloud);
    saveSyncMarker(conflict.cloud);
    setConflict(null);
    setStatus('synced');
    setStatusMessage('Cloud copy loaded');
  };

  const enableSharing = async (groupId: string) => {
    if (!session) throw new Error('Sign in to share this group.');
    const current = latestData.current;
    const group = current.groups.find((item) => item.id === groupId);
    if (!group) throw new Error('Group not found.');
    if (group.sharedId) return;
    const snapshot = buildSharedGroupSnapshot(current, groupId);
    const row = await createSharedGroup(snapshot, memberIdFor(group, current));
    sharedHashes.current.set(row.id, sharedSnapshotHash(row.snapshot));
    update((value) => mergeSharedRowsIntoLocal(value, [row], false));
  };

  const completeJoin = (row: SharedGroupRow) => {
    sharedHashes.current.set(row.id, sharedSnapshotHash(row.snapshot));
    update((current) => mergeSharedRowsIntoLocal(current, [row], false));
    try { window.localStorage.removeItem(PENDING_JOIN_KEY); } catch { /* best effort */ }
    setJoinOpen(false);
    setJoinRequested(false);
    setJoinCode('');
    const groupId = row.snapshot.group.id;
    window.history.replaceState({}, '', `/splitzap#group=${encodeURIComponent(groupId)}`);
    window.dispatchEvent(new Event('popstate'));
  };

  const removeGroup = async (group: Group) => {
    if (group.sharedId) {
      if (!session) throw new Error('Sign in before changing a shared group.');
      if (group.sharedRole === 'owner') await deleteSharedGroup(group.sharedId);
      else await leaveSharedGroup(group.sharedId);
      sharedHashes.current.delete(group.sharedId);
    }
    update((current) => removeGroupFromLocal(current, group.id));
  };

  const collaboration = {
    signedIn: Boolean(session),
    onInviteGroup: (groupId: string) => {
      setShareGroupId(groupId);
      if (!session) setAccountOpen(true);
    },
    onJoinGroup: () => {
      setJoinRequested(true);
      if (session) setJoinOpen(true);
      else setAccountOpen(true);
    },
    onDeleteGroup: removeGroup,
  };

  const indicatorClass = status === 'synced' ? 'bg-emerald-500' : status === 'syncing' || status === 'connecting' ? 'bg-amber-400' : status === 'error' ? 'bg-red-500' : 'bg-slate-400';
  const accountInitial = (data.myName?.trim()?.[0] || session?.user.email?.[0] || '').toUpperCase();
  const accountAction = (
    <button
      type="button"
      onClick={() => setAccountOpen(true)}
      aria-label={session ? `Account · ${statusMessage}` : 'Sign in to sync'}
      title={session ? statusMessage : 'Sign in to sync'}
      className="press relative grid size-9 place-items-center rounded-full border border-border bg-surface text-primary shadow-sm"
    >
      {status === 'syncing' || status === 'connecting'
        ? <Loader2 size={15} className="animate-spin" />
        : session && accountInitial
          ? <span className="text-xs font-extrabold">{accountInitial}</span>
          : <UserRound size={16} />}
      <span aria-hidden="true" className={`absolute right-0 top-0 size-2.5 rounded-full border-2 border-surface ${indicatorClass}`} />
    </button>
  );

  return (
    <>
      <SplitzapAppV4 accountAction={accountAction} collaboration={collaboration} />
      <SharedGroupInviteSheet
        open={Boolean(shareGroupId && session)}
        group={shareGroupId ? data.groups.find((item) => item.id === shareGroupId) ?? null : null}
        onClose={() => setShareGroupId(null)}
        onEnable={enableSharing}
      />
      <JoinSharedGroupSheet
        open={joinOpen && Boolean(session)}
        initialCode={joinCode}
        onClose={() => { setJoinOpen(false); setJoinRequested(false); }}
        onJoined={completeJoin}
      />
      <AccountSheet
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        session={session}
        status={status}
        statusMessage={statusMessage}
        lastSyncedAt={lastSyncedAt}
        recoveryMode={recoveryMode}
        onRecoveryComplete={() => setRecoveryMode(false)}
      />

      {migrationOpen ? (
        <SimpleModal title="Move this device's Splitzap data online" onClose={() => setMigrationOpen(false)}>
          <p className="text-sm leading-6 text-slate-600">We found {data.groups.length} {data.groups.length === 1 ? 'group' : 'groups'} on this device. Save them to your account so they can follow you to other devices.</p>
          <button type="button" onClick={() => void migrate()} className="mt-4 w-full rounded-xl bg-[#256f66] px-4 py-3 text-sm font-bold text-white">Save device data online</button>
          <button type="button" onClick={() => setMigrationOpen(false)} className="mt-2 w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700">Not now</button>
        </SimpleModal>
      ) : null}

      {conflict ? (
        <SimpleModal title="Two different Splitzap copies found" closable={false}>
          <p className="text-sm leading-6 text-slate-600">This device and your cloud account both contain data. Choose which copy should become your main Splitzap data.</p>
          <div className="mt-4 grid gap-2">
            <button type="button" onClick={() => void keepLocalConflict()} className="rounded-xl bg-[#256f66] px-4 py-3 text-left text-sm font-bold text-white">Keep this device · {conflict.local.groups.length} groups</button>
            <button type="button" onClick={keepCloudConflict} className="rounded-xl bg-slate-100 px-4 py-3 text-left text-sm font-bold text-slate-800">Use cloud copy · {conflict.cloud.groups.length} groups</button>
          </div>
        </SimpleModal>
      ) : null}
    </>
  );
}

function SharedGroupInviteSheet({ open, group, onClose, onEnable }: {
  open: boolean;
  group: Group | null;
  onClose: () => void;
  onEnable: (groupId: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  useEffect(() => { if (open) setFeedback(''); }, [open, group?.id]);
  if (!open || !group) return null;
  const inviteLink = group.sharedJoinCode ? `${window.location.origin}/splitzap?join=${encodeURIComponent(group.sharedJoinCode)}` : '';
  const enable = async () => {
    setBusy(true); setFeedback('');
    try { await onEnable(group.id); setFeedback('Shared group is ready. Send the invite to your friends.'); }
    catch (cause) { setFeedback(cause instanceof Error ? cause.message : 'Could not enable sharing.'); }
    finally { setBusy(false); }
  };
  const copyInvite = async () => {
    if (!inviteLink) return;
    try { await navigator.clipboard.writeText(inviteLink); setFeedback('Invite link copied.'); }
    catch { setFeedback('Could not copy automatically. Select and copy the link below.'); }
  };
  const shareInvite = async () => {
    if (!inviteLink) return;
    const message = `Join ${group.name} on Splitzap: ${inviteLink}`;
    try {
      if (navigator.share) await navigator.share({ title: `Join ${group.name}`, text: message, url: inviteLink });
      else { await navigator.clipboard.writeText(message); setFeedback('Invite copied.'); }
    } catch { /* user may cancel native share */ }
  };
  return <SimpleModal title={group.sharedId ? 'Invite people' : 'Share this group live'} onClose={onClose}>
    {!group.sharedId ? <>
      <div className="rounded-2xl bg-[#eef6f3] p-4"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-xl">{group.emoji}</span><div><p className="text-sm font-extrabold text-slate-900">{group.name}</p><p className="mt-1 text-xs leading-5 text-slate-600">Turn on sharing so signed-in members can join this same group and see updates across devices.</p></div></div></div>
      <button type="button" disabled={busy} onClick={() => void enable()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#256f66] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} Turn on sharing</button>
    </> : <>
      <div className="rounded-2xl bg-[#eef6f3] p-4"><div className="flex items-center gap-2 text-sm font-extrabold text-[#256f66]"><Cloud size={16} /> Live shared group</div><p className="mt-1 text-xs leading-5 text-slate-600">Friends sign in, choose who they are in the group, and then everyone sees the same expenses and payments.</p></div>
      <label className="mt-4 block text-xs font-bold text-slate-600">Invite code</label>
      <div className="mt-1 flex items-center gap-2"><div className="min-w-0 flex-1 rounded-xl bg-slate-100 px-3 py-3 font-mono text-sm font-extrabold tracking-[0.16em] text-slate-800">{group.sharedJoinCode}</div><button type="button" onClick={() => void copyInvite()} aria-label="Copy invite link" className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-[#256f66]"><Copy size={17} /></button></div>
      <div className="mt-3 break-all rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] leading-5 text-slate-500">{inviteLink}</div>
      <button type="button" onClick={() => void shareInvite()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#256f66] px-4 py-3 text-sm font-bold text-white"><Share2 size={16} /> Share invite</button>
    </>}
    {feedback ? <p role="status" className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">{feedback}</p> : null}
  </SimpleModal>;
}

function JoinSharedGroupSheet({ open, initialCode, onClose, onJoined }: {
  open: boolean;
  initialCode: string;
  onClose: () => void;
  onJoined: (row: SharedGroupRow) => void;
}) {
  const [code, setCode] = useState(initialCode);
  const [preview, setPreview] = useState<JoinPreview | null>(null);
  const [choice, setChoice] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = async (value = code) => {
    const clean = value.trim().toUpperCase();
    if (!clean) return;
    setBusy(true); setError(''); setPreview(null); setChoice('');
    try { const result = await previewSharedGroupJoin(clean); setPreview(result); setCode(clean); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not find this shared group.'); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    if (!open) return;
    setCode(initialCode);
    setPreview(null); setChoice(''); setNewName(''); setError('');
    if (initialCode) void load(initialCode);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialCode]);
  if (!open) return null;
  const claimed = new Set(preview?.claimed_member_ids ?? []);
  const available = preview?.members.filter((member) => !claimed.has(member.id)) ?? [];
  const join = async () => {
    if (!preview) return;
    if (!preview.already_joined && !choice) return;
    if (choice === '__new__' && !newName.trim()) return;
    setBusy(true); setError('');
    try {
      const row = await joinSharedGroup(code, preview.already_joined ? undefined : choice === '__new__' ? undefined : choice, choice === '__new__' ? newName : undefined);
      onJoined(row);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not join this group.'); }
    finally { setBusy(false); }
  };
  return <SimpleModal title="Join a shared group" onClose={onClose}>
    {!preview ? <>
      <p className="text-sm leading-6 text-slate-600">Paste the invite code a friend sent you.</p>
      <label className="mt-4 block text-xs font-bold text-slate-600">Invite code</label>
      <div className="mt-1 flex gap-2"><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16))} placeholder="AB12CD34EF" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-3 font-mono text-sm font-bold uppercase tracking-wider outline-none focus:border-[#256f66]" /><button type="button" disabled={busy || !code.trim()} onClick={() => void load()} className="rounded-xl bg-[#256f66] px-4 text-sm font-bold text-white disabled:opacity-40">{busy ? 'Finding…' : 'Find'}</button></div>
    </> : <>
      <div className="rounded-2xl bg-[#eef6f3] p-4"><p className="text-lg font-extrabold text-slate-900">{preview.emoji} {preview.group_name}</p><p className="mt-1 text-xs text-slate-600">{preview.members.length} people in this group</p></div>
      {preview.already_joined ? <p className="mt-4 rounded-xl bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">You already belong to this group.</p> : <>
        <p className="mt-4 text-xs font-bold text-slate-600">Who are you?</p>
        <div className="mt-2 space-y-2">{available.map((member) => <button key={member.id} type="button" onClick={() => setChoice(member.id)} className={`flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 text-left text-sm font-bold ${choice === member.id ? 'border-[#256f66] bg-[#eef6f3] text-[#256f66]' : 'border-slate-200 bg-white text-slate-700'}`}><span className="grid size-7 place-items-center rounded-full bg-slate-100 text-xs">{member.name.trim().charAt(0).toUpperCase() || '?'}</span>{member.name}{choice === member.id ? <span className="ml-auto">✓</span> : null}</button>)}</div>
        <button type="button" onClick={() => setChoice('__new__')} className={`mt-2 flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 text-left text-sm font-bold ${choice === '__new__' ? 'border-[#256f66] bg-[#eef6f3] text-[#256f66]' : 'border-slate-200 bg-white text-slate-700'}`}><UserPlus size={16} /> I'm not listed</button>
        {choice === '__new__' ? <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Your name" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#256f66]" /> : null}
      </>}
      <button type="button" disabled={busy || (!preview.already_joined && (!choice || (choice === '__new__' && !newName.trim())))} onClick={() => void join()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#256f66] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">{busy ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />} {preview.already_joined ? 'Open group' : 'Join group'}</button>
    </>}
    {error ? <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-semibold leading-5 text-red-700">{error}</p> : null}
  </SimpleModal>;
}

function AccountSheet({ open, onClose, session, status, statusMessage, lastSyncedAt, recoveryMode, onRecoveryComplete }: {
  open: boolean;
  onClose: () => void;
  session: SplitzapSession | null;
  status: SyncStatus;
  statusMessage: string;
  lastSyncedAt: string | null;
  recoveryMode: boolean;
  onRecoveryComplete: () => void;
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
      if (event.key === 'Escape' && !recoveryMode) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, open, recoveryMode]);

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
          setFeedback('Account created. Verification email sent. This used 1 email from the shared 2-per-hour test allowance.');
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
      setFeedback('Password reset email sent. This action used 1 email from the shared 2-per-hour test allowance.');
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
      {!recoveryMode ? <button type="button" aria-label="Close account" onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" /> : <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />}
      <section role="dialog" aria-modal="true" aria-label={session ? 'Splitzap account' : 'Sign in to Splitzap'} className="relative max-h-[92dvh] w-full max-w-[520px] overflow-y-auto rounded-t-[28px] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl">
        <div className="mx-auto h-1 w-10 rounded-full bg-slate-200" />
        <div className="flex items-center justify-between gap-3 pb-3 pt-3">
          <div><h2 className="text-lg font-extrabold text-slate-900">{session ? 'Account & sync' : 'Keep your data synced'}</h2><p className="mt-0.5 text-xs text-slate-500">{session ? 'Your Splitzap account and cloud status' : 'Sign in once, use Splitzap across devices'}</p></div>
          {!recoveryMode ? <button type="button" onClick={onClose} aria-label="Close" className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500"><X size={15} /></button> : null}
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
            <p className="mt-3 text-xs leading-5 text-slate-500">Expenses continue saving instantly on this device. When online, Splitzap also keeps the latest copy in your private cloud account.</p>
            <button type="button" onClick={() => void signOutSplitzap().then(onClose)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700"><LogOut size={16} /> Sign out</button>
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

            <button type="button" disabled={busy || !email.trim() || !password || (mode === 'signup' && (password.length < 8 || password !== confirmPassword))} onClick={() => void runEmailAuth()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#256f66] px-4 py-3 text-sm font-bold text-white disabled:opacity-45">{busy ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}{mode === 'signin' ? 'Sign in with email' : 'Create account · sends 1 email'}</button>

            {mode === 'signin' ? <button type="button" onClick={() => setResetOpen((value) => !value)} className="mt-3 w-full text-center text-xs font-bold text-[#256f66]">Forgot password?</button> : null}
            {resetOpen ? <div className="mt-3"><EmailAllowanceNotice action="Password reset" /><button type="button" disabled={busy || !email.trim()} onClick={() => void runPasswordReset()} className="mt-2 w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-bold text-amber-800 disabled:opacity-45">Send reset email · uses 1 email</button></div> : null}
            {feedback ? <p role="status" className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">{feedback}</p> : null}
          </div>
        )}
      </section>
    </div>
  );
}

function EmailAllowanceNotice({ action }: { action: string }) {
  return <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5"><div className="flex items-start gap-2"><Mail size={15} className="mt-0.5 shrink-0 text-amber-700" /><div><p className="text-[11px] font-extrabold text-amber-900">Temporary email limit</p><p className="mt-0.5 text-[11px] leading-4 text-amber-800">{action} sends 1 email. Supabase's current test sender allows only 2 authentication emails per hour across the whole Splitzap project.</p><div className="mt-2 flex gap-2 text-[10px] font-bold text-amber-800"><span className="rounded-full bg-white/70 px-2 py-1">This action: 1 email</span><span className="rounded-full bg-white/70 px-2 py-1">Hourly test allowance: 2</span></div></div></div></div>;
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
