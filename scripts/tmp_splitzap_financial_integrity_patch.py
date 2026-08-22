from pathlib import Path
import re

ROOT = Path('.')


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding='utf-8')


def replace_one(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, found {count}')
    return text.replace(old, new, 1)


# ---------------------------------------------------------------------------
# 1) Pure sync-safety helper + regression tests
# ---------------------------------------------------------------------------
sync_helper = '''export type RemoteSnapshotRow<TSnapshot> = {
  snapshot: TSnapshot;
  revision: number;
};

/**
 * Protect a newer local shared-group snapshot from an older remote refresh.
 * The caller's confirmedHash represents the last snapshot known to be safely
 * accepted by the server. If local state has moved beyond that hash, remote
 * data must not overwrite it; the normal optimistic-revision write will either
 * persist it or surface a conflict.
 */
export function preserveDirtyRemoteRow<
  TSnapshot,
  TRow extends RemoteSnapshotRow<TSnapshot>,
>(
  row: TRow,
  localSnapshot: TSnapshot | null,
  localRevision: number | undefined,
  confirmedHash: string | undefined,
  hashSnapshot: (snapshot: TSnapshot) => string,
): { row: TRow; dirty: boolean } {
  if (!localSnapshot || !confirmedHash) return { row, dirty: false };
  if (hashSnapshot(localSnapshot) === confirmedHash) return { row, dirty: false };
  return {
    row: {
      ...row,
      snapshot: localSnapshot,
      revision: localRevision ?? row.revision,
    },
    dirty: true,
  };
}
'''
write('src/features/splitzap/splitzapSyncSafety.ts', sync_helper)

sync_test = '''import { describe, expect, it } from 'vitest';
import { preserveDirtyRemoteRow } from './splitzapSyncSafety';

type Snapshot = { expenses: string[] };
type Row = { id: string; snapshot: Snapshot; revision: number };
const hash = (snapshot: Snapshot) => JSON.stringify(snapshot);

describe('Splitzap shared-sync safety', () => {
  it('never lets a stale remote snapshot erase a newer unsynced local expense', () => {
    const confirmed: Snapshot = { expenses: ['old-expense'] };
    const local: Snapshot = { expenses: ['new-120-expense', 'old-expense'] };
    const staleRemote: Row = { id: 'shared-1', snapshot: confirmed, revision: 8 };
    const result = preserveDirtyRemoteRow(staleRemote, local, 7, hash(confirmed), hash);
    expect(result.dirty).toBe(true);
    expect(result.row.snapshot).toEqual(local);
    expect(result.row.revision).toBe(7);
  });

  it('accepts remote data when the local snapshot has no unsynced change', () => {
    const confirmed: Snapshot = { expenses: ['e1'] };
    const remote: Row = { id: 'shared-1', snapshot: { expenses: ['e1', 'e2'] }, revision: 9 };
    const result = preserveDirtyRemoteRow(remote, confirmed, 8, hash(confirmed), hash);
    expect(result.dirty).toBe(false);
    expect(result.row).toBe(remote);
  });
});
'''
write('src/features/splitzap/splitzapSyncSafety.test.ts', sync_test)

# ---------------------------------------------------------------------------
# 2) Shared cloud sync hardening + mandatory first-run profile setup
# ---------------------------------------------------------------------------
cloud_path = 'src/features/splitzap/SplitzapCloudApp.tsx'
cloud = read(cloud_path)

cloud = replace_one(
    cloud,
    "} from './splitzapShared';\nimport {\n  archiveSharedGroup,",
    "} from './splitzapShared';\nimport { preserveDirtyRemoteRow } from './splitzapSyncSafety';\nimport {\n  archiveSharedGroup,",
    'CloudApp sync-safety import',
)

cloud = replace_one(
    cloud,
    "function friendlyAuthError(cause: unknown) {",
    '''function protectDirtySharedRows(current: SplitData, rows: SharedGroupRow[], confirmedHashes: Map<string, string>) {
  return rows.map((row) => {
    const localGroup = current.groups.find((group) => group.sharedId === row.id || group.id === row.snapshot.group.id);
    if (!localGroup) return { row, dirty: false };
    try {
      const localSnapshot = buildSharedGroupSnapshot(current, localGroup.id);
      return preserveDirtyRemoteRow(row, localSnapshot, localGroup.sharedRevision, confirmedHashes.get(row.id), sharedSnapshotHash);
    } catch {
      return { row, dirty: false };
    }
  });
}

function friendlyAuthError(cause: unknown) {''',
    'CloudApp dirty-row protector',
)

cloud = replace_one(
    cloud,
    "  const [profile, setProfile] = useState<SplitzapProfile | null>(null);\n  const [accountDataReady, setAccountDataReady] = useState(false);",
    "  const [profile, setProfile] = useState<SplitzapProfile | null>(null);\n  const [profileReady, setProfileReady] = useState(false);\n  const [accountDataReady, setAccountDataReady] = useState(false);",
    'CloudApp profileReady state',
)
cloud = replace_one(
    cloud,
    "  const [productionTick, setProductionTick] = useState(0);\n  const [status, setStatus] = useState<SyncStatus>('local');",
    "  const [productionTick, setProductionTick] = useState(0);\n  const [syncTick, setSyncTick] = useState(0);\n  const [status, setStatus] = useState<SyncStatus>('local');",
    'CloudApp syncTick state',
)
cloud = replace_one(
    cloud,
    "  const sharedHashes = useRef(new Map<string, string>());\n  const syncing = useRef(false);",
    "  const sharedHashes = useRef(new Map<string, string>());\n  const accountSyncing = useRef(false);\n  const sharedSyncing = useRef(false);",
    'CloudApp separate sync locks',
)

# All existing uses of the old generic sync lock belong to account-state sync.
cloud = cloud.replace('syncing.current', 'accountSyncing.current')

cloud = replace_one(
    cloud,
    "      setProfile(null);\n      setSharedActivity([]); setPendingRequests([]); setMemberships([]);",
    "      setProfile(null); setProfileReady(false);\n      setSharedActivity([]); setPendingRequests([]); setMemberships([]);",
    'CloudApp reset profile readiness',
)

old_profile_effect = '''  useEffect(() => {
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
'''
new_profile_effect = '''  useEffect(() => {
    if (!session || !accountDataReady) { setProfileReady(false); return; }
    let active = true;
    setProfileReady(false);
    void getSplitzapProfile().then((next) => {
      if (!active) return;
      const withLocalFallback: SplitzapProfile = { ...next, display_name: next.display_name || latestData.current.myName || '' };
      setProfile(withLocalFallback);
      setProfileReady(true);
      update((current) => ({ ...current, preferences: { defaultCurrency: withLocalFallback.default_currency, theme: withLocalFallback.theme, reducedMotion: withLocalFallback.reduced_motion } }));
    }).catch(() => {
      if (!active) return;
      setProfileReady(true);
      setStatus('error');
      setStatusMessage('Could not load your profile');
    });
    return () => { active = false; };
  }, [accountDataReady, session, update]);
'''
cloud = replace_one(cloud, old_profile_effect, new_profile_effect, 'CloudApp profile loading effect')

cloud = replace_one(
    cloud,
    "  }, [accountDataReady, hydrated, session, status, update]);",
    "  }, [accountDataReady, hydrated, session, update]);",
    'CloudApp initial shared-load dependency',
)

old_subscription_apply = "        sharedHashes.current.set(row.id, sharedSnapshotHash(row.snapshot)); update((current) => mergeSharedRowsIntoLocal(current, [row], false)); setProductionTick((value) => value + 1);"
new_subscription_apply = '''        update((current) => {
          const protectedRow = protectDirtySharedRows(current, [row], sharedHashes.current)[0]!;
          if (!protectedRow.dirty) sharedHashes.current.set(row.id, sharedSnapshotHash(row.snapshot));
          return mergeSharedRowsIntoLocal(current, [protectedRow.row], false);
        });
        setProductionTick((value) => value + 1);'''
cloud = replace_one(cloud, old_subscription_apply, new_subscription_apply, 'CloudApp realtime dirty protection')

old_metadata_merge = '''        rows.forEach((row) => sharedHashes.current.set(row.id, sharedSnapshotHash(row.snapshot)));
        update((current) => mergeSharedRowsIntoLocal(current, rows, true));'''
new_metadata_merge = '''        update((current) => {
          const protectedRows = protectDirtySharedRows(current, rows, sharedHashes.current);
          protectedRows.forEach((entry, index) => {
            if (!entry.dirty) sharedHashes.current.set(rows[index]!.id, sharedSnapshotHash(rows[index]!.snapshot));
          });
          return mergeSharedRowsIntoLocal(current, protectedRows.map((entry) => entry.row), true);
        });'''
cloud = replace_one(cloud, old_metadata_merge, new_metadata_merge, 'CloudApp metadata refresh dirty protection')
cloud = replace_one(
    cloud,
    "  }, [accountDataReady, productionTick, session, status, update]);",
    "  }, [accountDataReady, productionTick, session, update]);",
    'CloudApp metadata dependency',
)

shared_sync_pattern = re.compile(
    r"  useEffect\(\(\) => \{\n    if \(!session \|\| !accountDataReady \|\| sharedInitializedUser\.current !== session\.user\.id \|\| !navigator\.onLine\) return;\n    const changed = .*?\n  \}, \[accountDataReady, data, session, status, update\]\);",
    re.S,
)
shared_sync_replacement = '''  useEffect(() => {
    if (!session || !accountDataReady || sharedInitializedUser.current !== session.user.id || !navigator.onLine || sharedSyncing.current) return;
    const changed = data.groups
      .filter((group) => group.sharedId && (group.status ?? group.sharedStatus ?? 'active') === 'active')
      .map((group) => ({ group, snapshot: buildSharedGroupSnapshot(data, group.id) }))
      .filter(({ group, snapshot }) => sharedSnapshotHash(snapshot) !== sharedHashes.current.get(group.sharedId!));
    if (!changed.length) return;
    const timer = window.setTimeout(() => {
      if (sharedSyncing.current) return;
      sharedSyncing.current = true;
      setStatus('syncing'); setStatusMessage('Syncing shared group…');
      void (async () => {
        try {
          for (const item of changed) {
            const sharedId = item.group.sharedId!;
            const result = await updateSharedGroup(sharedId, item.snapshot, item.group.sharedRevision);
            sharedHashes.current.set(sharedId, sharedSnapshotHash(item.snapshot));
            update((current) => ({ ...current, groups: current.groups.map((group) => group.id === item.group.id ? { ...group, sharedRevision: result.revision } : group) }));
          }
          setStatus('synced'); setStatusMessage('Synced'); setProductionTick((value) => value + 1);
        } catch (cause) {
          setStatus(navigator.onLine ? 'error' : 'offline');
          setStatusMessage(cause instanceof Error ? cause.message : 'Shared group sync failed');
        } finally {
          sharedSyncing.current = false;
          // Catch local mutations that happened while the previous snapshot was in flight.
          setSyncTick((value) => value + 1);
        }
      })();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [accountDataReady, data, session, syncTick, update]);'''
cloud, count = shared_sync_pattern.subn(shared_sync_replacement, cloud, count=1)
if count != 1:
    raise SystemExit(f'CloudApp shared sync effect: expected 1 replacement, found {count}')

# Existing account-state sync must use its own lock after the global rename above.
if 'accountSyncing.current' not in cloud or 'sharedSyncing.current' not in cloud:
    raise SystemExit('CloudApp sync locks were not wired correctly')

# Gate the app on mandatory first-run profile setup after authenticated account data is ready.
app_return_marker = '''  return <>
    <SplitzapAppV4 accountAction={accountAction} collaboration={collaboration} />'''
app_return_replacement = '''  if (!profileReady) {
    return <div className="fixed inset-0 z-[120] grid place-items-center bg-[#fbfaf6] px-6 text-slate-900"><div className="text-center"><div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#256f66] text-2xl font-extrabold text-white shadow-lg">₹</div><Loader2 size={22} className="mx-auto mt-5 animate-spin text-[#256f66]" /><p className="mt-3 text-sm font-bold">Loading your profile…</p></div></div>;
  }
  if (!profile?.display_name?.trim()) {
    return <FirstRunProfileSetup session={session} data={data} update={update} onReady={setProfile} />;
  }

  return <>
    <SplitzapAppV4 accountAction={accountAction} collaboration={collaboration} />'''
cloud = replace_one(cloud, app_return_marker, app_return_replacement, 'CloudApp first-run gate')

first_run_component = '''
function FirstRunProfileSetup({ session, data, update, onReady }: {
  session: SplitzapSession;
  data: SplitData;
  update: (fn: (data: SplitData) => SplitData) => void;
  onReady: (profile: SplitzapProfile) => void;
}) {
  const suggested = typeof session.user.user_metadata?.full_name === 'string' ? session.user.user_metadata.full_name.trim() : '';
  const [name, setName] = useState(suggested);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    const clean = name.trim();
    if (!clean) { setError('Enter the name people in your groups should see.'); return; }
    setBusy(true); setError('');
    try {
      await updateSplitzapProfileName(clean);
      update((current) => {
        const groups = current.groups.map((group) => {
          const memberId = memberIdFor(group, current);
          return { ...group, members: group.members.map((member) => member.id === memberId ? { ...member, name: clean } : member) };
        });
        return { ...current, myName: clean, groups };
      });
      onReady({
        display_name: clean,
        default_currency: data.preferences?.defaultCurrency ?? '₹',
        theme: data.preferences?.theme ?? 'system',
        reduced_motion: data.preferences?.reducedMotion ?? false,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your name.');
    } finally {
      setBusy(false);
    }
  };
  return <div className="fixed inset-0 z-[135] grid place-items-center overflow-y-auto bg-[#fbfaf6] px-5 py-8 text-slate-900"><div className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-xl"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#e7f4ef] text-xl font-extrabold text-[#256f66]">₹</div><h1 className="mt-4 text-center text-xl font-extrabold">Welcome to Splitzap</h1><p className="mt-1 text-center text-xs leading-5 text-slate-500">Start with a clean account. Tell us the name people in your groups should see.</p><label className="mt-5 block text-xs font-bold text-slate-600">What should people call you?</label><input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Your name" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-[#256f66]" /><button type="button" disabled={busy || !name.trim()} onClick={() => void save()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#256f66] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">{busy ? <Loader2 size={16} className="animate-spin" /> : null} Continue</button>{error ? <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-semibold leading-5 text-red-700">{error}</p> : null}<p className="mt-3 text-center text-[10px] leading-4 text-slate-400">You can change this later from My Profile.</p></div></div>;
}

'''
cloud = replace_one(cloud, 'function SharedGroupInviteSheet(', first_run_component + 'function SharedGroupInviteSheet(', 'CloudApp first-run component')
write(cloud_path, cloud)

# ---------------------------------------------------------------------------
# 3) Personal-only settlement actions + profile-owned identity in New Group
# ---------------------------------------------------------------------------
store_path = 'src/features/splitzap/splitStoreV4.ts'
store = read(store_path)
store = replace_one(
    store,
    'export function money(amount: number, currency = \'₹\') {',
    '''export function personalSettlementBuckets(balance: Record<string, number>, memberId: string) {
  const all = simplify(balance);
  return {
    payable: all.filter((debt) => debt.from === memberId),
    receivable: all.filter((debt) => debt.to === memberId),
  };
}

export function money(amount: number, currency = '₹') {''',
    'Store personal settlement buckets',
)
write(store_path, store)

app_path = 'src/features/splitzap/SplitzapAppV4.tsx'
app = read(app_path)
app = replace_one(
    app,
    '  paymentsOf,\n  personalTotalOf,',
    '  paymentsOf,\n  personalSettlementBuckets,\n  personalTotalOf,',
    'App personal settlement import',
)
app = replace_one(app, "  const [creatorName, setCreatorName] = useState(data.myName?.trim() ?? '');\n", '', 'New Group creator-name state')
app = replace_one(app, "  useEffect(() => { if (open && data.myName?.trim() && !creatorName.trim()) setCreatorName(data.myName.trim()); }, [open, data.myName, creatorName]);\n", '', 'New Group creator-name sync')
old_group_create = "  const valid = Boolean(name.trim() && creatorName.trim() && people.some((person) => person.trim()));\n  const create = () => { if (!valid) return; const groupId = uid(); const creator = creatorName.trim(); const unique = [...new Map(people.map((person) => person.trim()).filter(Boolean).map((person) => [person.toLowerCase(), person])).values()]; update((current) => ({ ...current, myName: creator, groups: [{ id: groupId, name: name.trim(), emoji, currency, createdAt: new Date().toISOString(), members: [{ id: current.me, name: creator }, ...unique.map((person) => ({ id: uid(), name: person }))] }, ...current.groups.map((group) => ({ ...group, members: group.members.map((member) => member.id === current.me && (!member.name.trim() || member.name.toLowerCase() === 'you') ? { ...member, name: creator } : member) }))] })); onClose(); setName(''); setEmoji('👥'); setEmojiTouched(false); setIconOpen(false); setPeople(['']); onCreated?.(groupId); };"
new_group_create = "  const creator = data.myName?.trim() ?? '';\n  const valid = Boolean(name.trim() && creator && people.some((person) => person.trim()));\n  const create = () => { if (!valid) return; const groupId = uid(); const unique = [...new Map(people.map((person) => person.trim()).filter(Boolean).map((person) => [person.toLowerCase(), person])).values()]; update((current) => ({ ...current, groups: [{ id: groupId, name: name.trim(), emoji, currency, createdAt: new Date().toISOString(), members: [{ id: current.me, name: current.myName?.trim() || creator }, ...unique.map((person) => ({ id: uid(), name: person }))] }, ...current.groups] })); onClose(); setName(''); setEmoji('👥'); setEmojiTouched(false); setIconOpen(false); setPeople(['']); onCreated?.(groupId); };"
app = replace_one(app, old_group_create, new_group_create, 'New Group profile-owned creator identity')
app = replace_one(app, '    <Field label="Your name"><input value={creatorName} onChange={(event) => setCreatorName(event.target.value)} placeholder="Your name" className={inputClass} /></Field>\n', '', 'New Group remove Your name field')

old_settle_start = '''function SettleSheet({ open, onClose, group, balances, data, update, getMemberUpi }: { open: boolean; onClose: () => void; group: Group; balances: Record<string, number>; data: SplitData; update: (fn: (data: SplitData) => SplitData) => void; getMemberUpi?: (group: Group, memberId: string) => Promise<string | null> }) {
  const debts = simplify(balances);
  const nameOf = (id: string) => displayName(group, data, id);'''
new_settle_start = '''function SettleSheet({ open, onClose, group, balances, data, update, getMemberUpi }: { open: boolean; onClose: () => void; group: Group; balances: Record<string, number>; data: SplitData; update: (fn: (data: SplitData) => SplitData) => void; getMemberUpi?: (group: Group, memberId: string) => Promise<string | null> }) {
  const currentMemberId = memberIdFor(group, data);
  const { payable: debts, receivable } = personalSettlementBuckets(balances, currentMemberId);
  const nameOf = (id: string) => displayName(group, data, id);'''
app = replace_one(app, old_settle_start, new_settle_start, 'Settle personal buckets')
app = replace_one(app, "  const currentMemberId = memberIdFor(group, data);\n  const canUseUpi", "  const canUseUpi", 'Settle duplicate current member id')
app = replace_one(
    app,
    "  const rawDebts = data.expenses.filter((expense) => expense.groupId === group.id).flatMap((expense) => expenseSettlement(expense, group).map((debt) => ({ ...debt, expense })));\n  const recorded = data.settlements.filter((settlement) => settlement.groupId === group.id).sort((a, b) => +new Date(b.date) - +new Date(a.date));",
    "  const rawDebts = data.expenses.filter((expense) => expense.groupId === group.id).flatMap((expense) => expenseSettlement(expense, group).filter((debt) => debt.from === currentMemberId || debt.to === currentMemberId).map((debt) => ({ ...debt, expense })));\n  const recorded = data.settlements.filter((settlement) => settlement.groupId === group.id && (settlement.from === currentMemberId || settlement.to === currentMemberId)).sort((a, b) => +new Date(b.date) - +new Date(a.date));",
    'Settle personal breakdown filters',
)
app = replace_one(app, "    if (!selectedDebt || paymentAmount <= 0) return;", "    if (!selectedDebt || selectedDebt.from !== currentMemberId || paymentAmount <= 0) return;", 'Settle debtor authorization guard')
app = replace_one(app, "{debts.length === 0 ? <div className=\"celebration", "{debts.length === 0 && receivable.length === 0 ? <div className=\"celebration", 'Settle all-settled condition')
app = replace_one(
    app,
    '<div className="mt-3 space-y-2">{debts.map((debt) =>',
    '{!debts.length ? <div className="mt-3 rounded-2xl bg-surface-2 px-3 py-3 text-xs font-semibold text-muted-foreground">You do not owe anything right now.</div> : null}<div className="mt-3 space-y-2">{debts.map((debt) =>',
    'Settle no-payable message',
)
app = replace_one(
    app,
    '</div><button type="button" onClick={() => setBreakdownOpen((value) => !value)} className="press mt-3 flex w-full items-center gap-2 rounded-xl bg-surface-2 px-3 py-3 text-left">',
    '''</div>{receivable.length ? <div className="mt-3 rounded-2xl border border-positive/20 bg-positive/5 p-3"><p className="text-[10px] font-extrabold uppercase tracking-wide text-positive">You are owed</p><div className="mt-2 space-y-2">{receivable.map((debt) => <div key={`owed-${debt.from}-${debt.to}`} className="flex items-center gap-3 rounded-xl bg-surface px-3 py-3"><Avatar name={nameOf(debt.from)} size={30} /><ArrowRight size={14} className="text-muted-foreground" /><Avatar name={nameOf(debt.to)} size={30} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{nameOf(debt.from)} owes you</p><p className="tabular text-sm font-extrabold text-positive">{money(debt.amount, group.currency)}</p></div><span className="rounded-full bg-surface-2 px-2 py-1 text-[9px] font-bold text-muted-foreground">View only</span></div>)}</div></div> : null}<button type="button" onClick={() => setBreakdownOpen((value) => !value)} className="press mt-3 flex w-full items-center gap-2 rounded-xl bg-surface-2 px-3 py-3 text-left">''',
    'Settle receivable view-only section',
)
write(app_path, app)

# ---------------------------------------------------------------------------
# 4) Versioned backend RPCs: clean first-run name + debtor-only payment writes
# ---------------------------------------------------------------------------
prod_path = 'src/features/splitzap/splitzapProduction.ts'
prod = read(prod_path)
prod = replace_one(prod, "splitzapSupabase.rpc('splitzap_get_profile')", "splitzapSupabase.rpc('splitzap_get_profile_v2')", 'Profile v2 RPC')
write(prod_path, prod)

shared_path = 'src/features/splitzap/splitzapShared.ts'
shared = read(shared_path)
shared = replace_one(shared, "splitzapSupabase.rpc('splitzap_update_shared_group', {", "splitzapSupabase.rpc('splitzap_update_shared_group_v2', {", 'Shared update v2 RPC')
write(shared_path, shared)

# ---------------------------------------------------------------------------
# 5) Regression coverage + permanent readiness assertions
# ---------------------------------------------------------------------------
test_path = 'src/features/splitzap/splitStoreV4.test.ts'
test = read(test_path)
test = replace_one(test, '  memberIdFor,\n  shareOf,', '  memberIdFor,\n  personalSettlementBuckets,\n  shareOf,', 'Test import personal buckets')
insert_test_marker = "  it('reduces balances after a partial settlement without changing the expense', () => {"
new_test = '''  it('only exposes settlement actions for the signed-in debtor while keeping receivables view-only', () => {
    const balances = { a: -100, b: 60, c: 40, d: 0 };
    const mine = personalSettlementBuckets(balances, 'a');
    expect(mine.payable).toEqual([
      { from: 'a', to: 'b', amount: 60 },
      { from: 'a', to: 'c', amount: 40 },
    ]);
    expect(mine.receivable).toEqual([]);
    const creditor = personalSettlementBuckets(balances, 'b');
    expect(creditor.payable).toEqual([]);
    expect(creditor.receivable).toEqual([{ from: 'a', to: 'b', amount: 60 }]);
  });

'''
test = replace_one(test, insert_test_marker, new_test + insert_test_marker, 'Personal settlement regression test')
write(test_path, test)

package_path = 'package.json'
package = read(package_path)
package = replace_one(
    package,
    '"test:splitzap": "vitest run src/features/splitzap/splitStoreV4.test.ts"',
    '"test:splitzap": "vitest run src/features/splitzap/splitStoreV4.test.ts src/features/splitzap/splitzapSyncSafety.test.ts"',
    'Package Splitzap regression suite',
)
write(package_path, package)

ready_path = '.github/workflows/splitzap-readiness.yml'
ready = read(ready_path)
ready = replace_one(
    ready,
    '          grep -q "splitzap_update_shared_group" src/features/splitzap/splitzapShared.ts\n',
    '          grep -q "splitzap_update_shared_group_v2" src/features/splitzap/splitzapShared.ts\n          grep -q "splitzap_get_profile_v2" src/features/splitzap/splitzapProduction.ts\n',
    'Readiness v2 backend RPC assertions',
)
ready = replace_one(
    ready,
    '          ! grep -q "function parseReceiptText" src/features/splitzap/SplitzapAppV4.tsx\n',
    '''          ! grep -q "function parseReceiptText" src/features/splitzap/SplitzapAppV4.tsx
          test -f src/features/splitzap/splitzapSyncSafety.ts
          test -f src/features/splitzap/splitzapSyncSafety.test.ts
          grep -q "preserveDirtyRemoteRow" src/features/splitzap/SplitzapCloudApp.tsx
          grep -q "sharedSyncing" src/features/splitzap/SplitzapCloudApp.tsx
          grep -q "setSyncTick" src/features/splitzap/SplitzapCloudApp.tsx
          ! grep -q "\[accountDataReady, data, session, status, update\]" src/features/splitzap/SplitzapCloudApp.tsx
          ! grep -q "\[accountDataReady, productionTick, session, status, update\]" src/features/splitzap/SplitzapCloudApp.tsx
          grep -q "FirstRunProfileSetup" src/features/splitzap/SplitzapCloudApp.tsx
          ! grep -q '<Field label="Your name"' src/features/splitzap/SplitzapAppV4.tsx
          grep -q "personalSettlementBuckets" src/features/splitzap/SplitzapAppV4.tsx
          grep -q "selectedDebt.from !== currentMemberId" src/features/splitzap/SplitzapAppV4.tsx
          grep -q "View only" src/features/splitzap/SplitzapAppV4.tsx
''',
    'Readiness financial integrity assertions',
)
write(ready_path, ready)

print('Splitzap financial-integrity patch applied successfully.')
