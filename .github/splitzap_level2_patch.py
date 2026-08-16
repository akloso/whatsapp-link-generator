from pathlib import Path
import re

ROOT = Path('.')

def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing patch target: {label}')
    return text.replace(old, new, 1)

# --- Store: per-group current-user identity + shared metadata ---
path = ROOT / 'src/features/splitzap/splitStoreV4.ts'
text = path.read_text()
text = replace_once(text, """export type Group = {
  id: string;
  name: string;
  emoji: string;
  currency: string;
  members: Member[];
  createdAt: string;
};""", """export type Group = {
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
};""", 'Group collaboration fields')
text = replace_once(text, """export type SplitData = {
  me: string;
  myName?: string;
  groups: Group[];
  expenses: Expense[];
  settlements: Settlement[];
  history?: ExpenseHistoryEntry[];
};""", """export type SplitData = {
  me: string;
  myName?: string;
  groups: Group[];
  expenses: Expense[];
  settlements: Settlement[];
  history?: ExpenseHistoryEntry[];
};

/** A shared group can map this account to a canonical member id that differs from data.me. */
export const memberIdFor = (group: Group, data: Pick<SplitData, 'me'>) => group.myMemberId || data.me;""", 'memberIdFor')
path.write_text(text)

# --- Main app: collaboration UI, join entry point, per-group me mapping, delete/leave ---
path = ROOT / 'src/features/splitzap/SplitzapAppV4.tsx'
text = path.read_text()
text = replace_once(text, """  money,
  paymentsOf,""", """  money,
  memberIdFor,
  paymentsOf,""", 'memberIdFor import')
text = replace_once(text, """type ParsedReceipt = { merchant: string; detectedTotal: number | null; items: ReceiptItem[]; charges: AdditionalCharge[] };""", """type ParsedReceipt = { merchant: string; detectedTotal: number | null; items: ReceiptItem[]; charges: AdditionalCharge[] };

export type SplitzapCollaboration = {
  signedIn: boolean;
  onInviteGroup: (groupId: string) => void;
  onJoinGroup: () => void;
  onDeleteGroup: (group: Group) => Promise<void>;
};""", 'collaboration type')
text = text.replace("if (id === data.me && data.myName?.trim())", "if (id === memberIdFor(group, data) && data.myName?.trim())")
text = replace_once(text, """export default function SplitzapAppV4({ accountAction }: { accountAction?: ReactNode } = {}) {""", """export default function SplitzapAppV4({ accountAction, collaboration }: { accountAction?: ReactNode; collaboration?: SplitzapCollaboration } = {}) {""", 'app props')
text = replace_once(text, """? <HomeScreen navigate={navigate} onDataBackup={() => setDataToolsOpen(true)} accountAction={accountAction} />""", """? <HomeScreen navigate={navigate} onDataBackup={() => setDataToolsOpen(true)} accountAction={accountAction} collaboration={collaboration} />""", 'home collaboration prop')
text = replace_once(text, """: <GroupScreen groupId={view.groupId} navigate={navigate} />}""", """: <GroupScreen groupId={view.groupId} navigate={navigate} collaboration={collaboration} />}""", 'group collaboration prop')

text = replace_once(text, """function HomeScreen({ navigate, onDataBackup, accountAction }: { navigate: (view: View) => void; onDataBackup: () => void; accountAction?: ReactNode }) {""", """function HomeScreen({ navigate, onDataBackup, accountAction, collaboration }: { navigate: (view: View) => void; onDataBackup: () => void; accountAction?: ReactNode; collaboration?: SplitzapCollaboration }) {""", 'HomeScreen signature')
text = text.replace("mine: balance[data.me] ?? 0", "mine: balance[memberIdFor(group, data)] ?? 0")
text = replace_once(text, """<NewGroupSheet open={groupOpen} onClose={() => setGroupOpen(false)} data={data} update={update} onCreated={(groupId) => navigate({ name: 'group', groupId })} />""", """<NewGroupSheet open={groupOpen} onClose={() => setGroupOpen(false)} data={data} update={update} onCreated={(groupId) => navigate({ name: 'group', groupId })} onJoinGroup={collaboration?.onJoinGroup} />""", 'home new group join')

# Activity self calculations
text = text.replace("shareOf(expense, data.me, group?.members.map((m) => m.id))", "shareOf(expense, group ? memberIdFor(group, data) : data.me, group?.members.map((m) => m.id))")

# Group screen signature + state
text = replace_once(text, """function GroupScreen({ groupId, navigate }: { groupId: string; navigate: (view: View) => void }) {""", """function GroupScreen({ groupId, navigate, collaboration }: { groupId: string; navigate: (view: View) => void; collaboration?: SplitzapCollaboration }) {""", 'GroupScreen signature')
text = replace_once(text, """  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [newMember, setNewMember] = useState('');""", """  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [newMember, setNewMember] = useState('');""", 'delete state')
text = text.replace("const mine = balances[data.me] ?? 0;", "const mine = balances[memberIdFor(group, data)] ?? 0;")
text = text.replace("const paidByMe = paymentsOf(expense)[data.me] ?? 0; const myShare = shareOf(expense, data.me, group.members.map((m) => m.id));", "const myId = memberIdFor(group, data); const paidByMe = paymentsOf(expense)[myId] ?? 0; const myShare = shareOf(expense, myId, group.members.map((m) => m.id));")
text = replace_once(text, """  const settlements = data.settlements.filter((settlement) => settlement.groupId === groupId).sort((a, b) => +new Date(b.date) - +new Date(a.date));

  return <AppShell""", """  const settlements = data.settlements.filter((settlement) => settlement.groupId === groupId).sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const deleteLabel = group.sharedId ? (group.sharedRole === 'owner' ? 'Delete shared group' : 'Leave group') : 'Delete group';
  const deleteCopy = group.sharedId
    ? group.sharedRole === 'owner'
      ? 'This removes the shared group for everyone. This cannot be undone.'
      : 'This removes the shared group from your account only. Everyone else keeps the group.'
    : 'This removes this group and its expenses from your Splitzap. This cannot be undone.';
  const runDeleteGroup = async () => {
    setDeleteBusy(true);
    setDeleteError('');
    try {
      if (collaboration) await collaboration.onDeleteGroup(group);
      else update((current) => ({ ...current, groups: current.groups.filter((item) => item.id !== group.id), expenses: current.expenses.filter((item) => item.groupId !== group.id), settlements: current.settlements.filter((item) => item.groupId !== group.id), history: (current.history ?? []).filter((item) => item.groupId !== group.id) }));
      setDeleteOpen(false);
      navigate({ name: 'home' });
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : 'Could not remove this group.');
    } finally {
      setDeleteBusy(false);
    }
  };

  return <AppShell""", 'delete behavior')

old_menu = """<div className=\"absolute right-0 top-11 z-40 w-44 rounded-2xl border border-border bg-surface p-1.5 shadow-xl\"><button type=\"button\" onClick={() => { setGroupMenuOpen(false); setDuplicateOpen(true); }} className=\"press flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-foreground hover:bg-surface-2\"><Copy size={14} className=\"text-primary\" /> Duplicate group</button></div>"""
new_menu = """<div className=\"absolute right-0 top-11 z-40 w-52 rounded-2xl border border-border bg-surface p-1.5 shadow-xl\">{collaboration ? <button type=\"button\" onClick={() => { setGroupMenuOpen(false); collaboration.onInviteGroup(group.id); }} className=\"press flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-foreground hover:bg-surface-2\"><UserPlus size={14} className=\"text-primary\" /> {group.sharedId ? 'Invite people' : 'Share group live'}</button> : null}<button type=\"button\" onClick={() => { setGroupMenuOpen(false); setDuplicateOpen(true); }} className=\"press flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-foreground hover:bg-surface-2\"><Copy size={14} className=\"text-primary\" /> Duplicate group</button><div className=\"my-1 h-px bg-border\" /><button type=\"button\" onClick={() => { setGroupMenuOpen(false); setDeleteError(''); setDeleteOpen(true); }} className=\"press flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-negative hover:bg-negative/5\"><Trash2 size={14} /> {deleteLabel}</button></div>"""
text = replace_once(text, old_menu, new_menu, 'group menu')
text = replace_once(text, """<DuplicateGroupDialog open={duplicateOpen} onClose={() => setDuplicateOpen(false)} group={group} data={data} update={update} onCreated={(newId) => navigate({ name: 'group', groupId: newId })} /></AppShell>""", """<DuplicateGroupDialog open={duplicateOpen} onClose={() => setDuplicateOpen(false)} group={group} data={data} update={update} onCreated={(newId) => navigate({ name: 'group', groupId: newId })} /><CompactDialog open={deleteOpen} onClose={() => { if (!deleteBusy) setDeleteOpen(false); }} title={deleteLabel} footer={<div className=\"grid grid-cols-2 gap-2\"><button type=\"button\" disabled={deleteBusy} onClick={() => setDeleteOpen(false)} className=\"press rounded-xl bg-surface-2 px-3 py-3 text-sm font-bold text-foreground\">Cancel</button><button type=\"button\" disabled={deleteBusy} onClick={() => void runDeleteGroup()} className=\"press rounded-xl bg-negative px-3 py-3 text-sm font-bold text-white disabled:opacity-50\">{deleteBusy ? 'Working…' : deleteLabel}</button></div>}><p className=\"text-sm leading-6 text-muted-foreground\">{deleteCopy}</p>{deleteError ? <p role=\"alert\" className=\"mt-3 rounded-xl bg-negative/5 px-3 py-2 text-xs font-semibold text-negative\">{deleteError}</p> : null}</CompactDialog></AppShell>""", 'delete confirmation')

# New group join entry point + shared-aware presets
text = replace_once(text, """function NewGroupSheet({ open, onClose, data, update, onCreated }: { open: boolean; onClose: () => void; data: SplitData; update: (fn: (data: SplitData) => SplitData) => void; onCreated?: (groupId: string) => void }) {""", """function NewGroupSheet({ open, onClose, data, update, onCreated, onJoinGroup }: { open: boolean; onClose: () => void; data: SplitData; update: (fn: (data: SplitData) => SplitData) => void; onCreated?: (groupId: string) => void; onJoinGroup?: () => void }) {""", 'NewGroup signature')
text = text.replace("if (member.id === data.me) return;", "if (member.id === memberIdFor(group, data)) return;")
text = replace_once(text, """  return <SheetModal open={open} onClose={onClose} title=\"New group\" footer={<PrimaryButton onClick={create} disabled={!valid}>Create group</PrimaryButton>}>
    <Field label=\"Group name\">""", """  return <SheetModal open={open} onClose={onClose} title=\"New group\" footer={<PrimaryButton onClick={create} disabled={!valid}>Create group</PrimaryButton>}>
    {onJoinGroup ? <button type=\"button\" onClick={() => { onClose(); onJoinGroup(); }} className=\"press mb-4 flex min-h-12 w-full items-center gap-3 rounded-xl border border-primary/15 bg-secondary px-3 text-left\"><span className=\"grid size-9 place-items-center rounded-xl bg-surface text-primary\"><UserPlus size={17} /></span><span className=\"min-w-0 flex-1\"><b className=\"block text-sm\">Join a shared group</b><span className=\"text-[11px] text-muted-foreground\">Use an invite link or code from a friend</span></span><ChevronRight size={15} className=\"text-primary\" /></button> : null}
    <Field label=\"Group name\">""", 'join group entry')

# Show any remaining data.me references for audit; allowed ones are account-global or personal group creation.
path.write_text(text)
print('Remaining SplitzapAppV4 data.me lines:')
for i, line in enumerate(text.splitlines(), 1):
    if 'data.me' in line:
        print(i, line.strip()[:240])

# --- Cloud wrapper: shared group orchestration + dialogs ---
path = ROOT / 'src/features/splitzap/SplitzapCloudApp.tsx'
text = path.read_text()
text = replace_once(text, """import { Cloud, CloudOff, Eye, EyeOff, KeyRound, Loader2, LogOut, Mail, ShieldCheck, UserRound, X } from 'lucide-react';""", """import { Cloud, CloudOff, Copy, Eye, EyeOff, KeyRound, Link2, Loader2, LogOut, Mail, Share2, ShieldCheck, UserPlus, UserRound, X } from 'lucide-react';""", 'cloud icons')
text = replace_once(text, """import { useSplitData, type SplitData } from './splitStoreV4';""", """import { memberIdFor, useSplitData, type Group, type SplitData } from './splitStoreV4';""", 'cloud store imports')
text = replace_once(text, """  type SplitzapSession,
} from './splitzapCloud';""", """  type SplitzapSession,
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
} from './splitzapShared';""", 'shared imports')
text = replace_once(text, """const LAST_SYNC_AT_KEY = 'splitzap.cloud.lastSyncAt';""", """const LAST_SYNC_AT_KEY = 'splitzap.cloud.lastSyncAt';
const PENDING_JOIN_KEY = 'splitzap.shared.pendingJoin';""", 'pending join constant')

text = replace_once(text, """  const [recoveryMode, setRecoveryMode] = useState(false);
  const [status, setStatus] = useState<SyncStatus>('local');""", """  const [recoveryMode, setRecoveryMode] = useState(false);
  const [shareGroupId, setShareGroupId] = useState<string | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinRequested, setJoinRequested] = useState(false);
  const [status, setStatus] = useState<SyncStatus>('local');""", 'shared UI state')
text = replace_once(text, """  const initializedUser = useRef<string | null>(null);
  const syncing = useRef(false);""", """  const initializedUser = useRef<string | null>(null);
  const sharedInitializedUser = useRef<string | null>(null);
  const sharedHashes = useRef(new Map<string, string>());
  const syncing = useRef(false);""", 'shared refs')
text = replace_once(text, """      initializedUser.current = null;
      if (event === 'PASSWORD_RECOVERY')""", """      initializedUser.current = null;
      sharedInitializedUser.current = null;
      sharedHashes.current.clear();
      if (event === 'PASSWORD_RECOVERY')""", 'auth reset shared')

# Insert shared group lifecycle before the existing automatic Level 1 save effect.
needle = """  useEffect(() => {
    if (!hydrated || !session || initializedUser.current !== session.user.id || migrationOpen || conflict || syncing.current) return;"""
shared_effects = """  useEffect(() => {
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

"""
text = replace_once(text, needle, shared_effects + needle, 'shared effects')

# Collaboration handlers before indicatorClass.
text = replace_once(text, """  const indicatorClass = status === 'synced' ? 'bg-emerald-500' : status === 'syncing' || status === 'connecting' ? 'bg-amber-400' : status === 'error' ? 'bg-red-500' : 'bg-slate-400';""", """  const enableSharing = async (groupId: string) => {
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

  const indicatorClass = status === 'synced' ? 'bg-emerald-500' : status === 'syncing' || status === 'connecting' ? 'bg-amber-400' : status === 'error' ? 'bg-red-500' : 'bg-slate-400';""", 'collaboration handlers')

text = replace_once(text, """      <SplitzapAppV4 accountAction={accountAction} />""", """      <SplitzapAppV4 accountAction={accountAction} collaboration={collaboration} />
      <SharedGroupInviteSheet
        open={Boolean(shareGroupId && session)}
        group={shareGroupId ? data.groups.find((item) => item.id === shareGroupId) ?? null : null}
        data={data}
        onClose={() => setShareGroupId(null)}
        onEnable={enableSharing}
      />
      <JoinSharedGroupSheet
        open={joinOpen && Boolean(session)}
        initialCode={joinCode}
        onClose={() => { setJoinOpen(false); setJoinRequested(false); }}
        onJoined={completeJoin}
      />""", 'render shared dialogs')

# Add Level 2 dialogs before AccountSheet.
marker = """function AccountSheet({ open, onClose, session, status, statusMessage, lastSyncedAt, recoveryMode, onRecoveryComplete }: {"""
components = r'''function SharedGroupInviteSheet({ open, group, data, onClose, onEnable }: {
  open: boolean;
  group: Group | null;
  data: SplitData;
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

'''
text = replace_once(text, marker, components + marker, 'shared dialog components')
path.write_text(text)
