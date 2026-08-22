from pathlib import Path

ROOT = Path('.')

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')

def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding='utf-8')

def replace_one(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)

# ---------------------------------------------------------------------------
# Durable financial-state safety helpers
# ---------------------------------------------------------------------------
safety = '''import type { SplitData } from './splitStoreV4';
import { buildSharedGroupSnapshot, sharedSnapshotHash } from './splitzapShared';

export type RemoteSnapshotRow<TSnapshot> = {
  snapshot: TSnapshot;
  revision: number;
};

export type ConfirmedSharedState = {
  revision: number;
  fingerprint: string;
};

function cyrb53(value: string, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Compact deterministic fingerprint used only to detect local changes across
 * process restarts. Financial state itself remains in the normal Splitzap
 * store; this avoids duplicating full snapshots in localStorage. */
export function compactSnapshotFingerprint(serializedSnapshot: string) {
  return `${cyrb53(serializedSnapshot, 0x9e3779b9)}:${cyrb53(serializedSnapshot, 0x85ebca6b)}`;
}

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

/**
 * During authenticated bootstrap the server account copy is normally
 * authoritative. The only exception is a same-account shared group that can
 * be proven newer locally than the last confirmed shared snapshot. Preserve
 * only those group-scoped financial records; never promote unrelated or
 * cross-account local data.
 */
export function preserveDirtySharedGroupsOnBootstrap(
  serverAccount: SplitData,
  localAccount: SplitData,
  confirmed: Map<string, ConfirmedSharedState>,
  accountHasUnsyncedLocalChanges: boolean,
) {
  let next = serverAccount;
  const dirtyIds = new Set<string>();

  for (const localGroup of localAccount.groups) {
    const sharedId = localGroup.sharedId;
    if (!sharedId) continue;
    let localSnapshot;
    try { localSnapshot = buildSharedGroupSnapshot(localAccount, localGroup.id); } catch { continue; }

    const record = confirmed.get(sharedId);
    let dirty = record
      ? compactSnapshotFingerprint(sharedSnapshotHash(localSnapshot)) !== record.fingerprint
      : false;

    if (!record && accountHasUnsyncedLocalChanges) {
      const serverGroup = serverAccount.groups.find((group) => group.sharedId === sharedId || group.id === localGroup.id);
      if (!serverGroup) dirty = true;
      else {
        try {
          const serverSnapshot = buildSharedGroupSnapshot(serverAccount, serverGroup.id);
          dirty = sharedSnapshotHash(localSnapshot) !== sharedSnapshotHash(serverSnapshot);
        } catch { dirty = true; }
      }
    }

    if (!dirty) continue;
    dirtyIds.add(sharedId);
    const replacedIds = new Set(
      next.groups
        .filter((group) => group.sharedId === sharedId || group.id === localGroup.id)
        .map((group) => group.id),
    );
    replacedIds.add(localGroup.id);
    next = {
      ...next,
      groups: [localGroup, ...next.groups.filter((group) => group.sharedId !== sharedId && group.id !== localGroup.id)],
      expenses: [
        ...localAccount.expenses.filter((expense) => expense.groupId === localGroup.id),
        ...next.expenses.filter((expense) => !replacedIds.has(expense.groupId)),
      ],
      settlements: [
        ...localAccount.settlements.filter((settlement) => settlement.groupId === localGroup.id),
        ...next.settlements.filter((settlement) => !replacedIds.has(settlement.groupId)),
      ],
      history: [
        ...(localAccount.history ?? []).filter((entry) => entry.groupId === localGroup.id),
        ...(next.history ?? []).filter((entry) => !replacedIds.has(entry.groupId)),
      ],
    };
  }

  return { data: next, dirtyIds };
}
'''
write('src/features/splitzap/splitzapSyncSafety.ts', safety)

safety_test = '''import { describe, expect, it } from 'vitest';
import { buildSharedGroupSnapshot, sharedSnapshotHash } from './splitzapShared';
import type { Expense, Group, SplitData } from './splitStoreV4';
import { compactSnapshotFingerprint, preserveDirtyRemoteRow, preserveDirtySharedGroupsOnBootstrap } from './splitzapSyncSafety';

type Snapshot = { expenses: string[] };
type Row = { id: string; snapshot: Snapshot; revision: number };
const hash = (snapshot: Snapshot) => JSON.stringify(snapshot);

const group: Group = {
  id: 'g1', name: 'Trip', emoji: '✈️', currency: '₹', createdAt: '2026-08-22T00:00:00.000Z',
  sharedId: 'shared-1', sharedRevision: 7, sharedRole: 'member', myMemberId: 'me',
  members: [{ id: 'me', name: 'Akash' }, { id: 'friend', name: 'Rahul' }],
};
const oldExpense: Expense = {
  id: 'old-expense', groupId: 'g1', description: 'Old', amount: 100, paidBy: 'friend',
  split: { me: 1, friend: 1 }, mode: 'equal', category: 'general', date: '2026-08-22T00:00:00.000Z',
};
const newExpense: Expense = {
  id: 'new-120-expense', groupId: 'g1', description: '₹120 expense', amount: 120, paidBy: 'friend',
  split: { me: 1, friend: 1 }, mode: 'equal', category: 'general', date: '2026-08-22T01:00:00.000Z',
};
const data = (expenses: Expense[]): SplitData => ({
  schemaVersion: 2, me: 'me', myName: 'Akash', groups: [group], expenses, settlements: [], history: [], activity: [],
  preferences: { defaultCurrency: '₹', theme: 'system', reducedMotion: false },
});

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

  it('preserves an unsynced shared expense across an app restart before cloud sync finishes', () => {
    const serverAccount = data([oldExpense]);
    const localAccount = data([newExpense, oldExpense]);
    const confirmedSnapshot = buildSharedGroupSnapshot(serverAccount, group.id);
    const confirmed = new Map([['shared-1', {
      revision: 7,
      fingerprint: compactSnapshotFingerprint(sharedSnapshotHash(confirmedSnapshot)),
    }]]);
    const result = preserveDirtySharedGroupsOnBootstrap(serverAccount, localAccount, confirmed, false);
    expect(result.dirtyIds.has('shared-1')).toBe(true);
    expect(result.data.expenses.map((expense) => expense.id)).toEqual(['new-120-expense', 'old-expense']);
  });

  it('does not promote unrelated local data when the shared snapshot is already confirmed', () => {
    const serverAccount = data([oldExpense]);
    const localAccount = { ...data([oldExpense]), myName: 'Wrong local name' };
    const confirmedSnapshot = buildSharedGroupSnapshot(serverAccount, group.id);
    const confirmed = new Map([['shared-1', {
      revision: 7,
      fingerprint: compactSnapshotFingerprint(sharedSnapshotHash(confirmedSnapshot)),
    }]]);
    const result = preserveDirtySharedGroupsOnBootstrap(serverAccount, localAccount, confirmed, false);
    expect(result.dirtyIds.size).toBe(0);
    expect(result.data.myName).toBe('Akash');
  });
});
'''
write('src/features/splitzap/splitzapSyncSafety.test.ts', safety_test)

cloud_path = 'src/features/splitzap/SplitzapCloudApp.tsx'
cloud = read(cloud_path)
cloud = replace_one(
    cloud,
    "import { preserveDirtyRemoteRow } from './splitzapSyncSafety';",
    "import { compactSnapshotFingerprint, preserveDirtyRemoteRow, preserveDirtySharedGroupsOnBootstrap, type ConfirmedSharedState } from './splitzapSyncSafety';",
    'sync safety imports',
)
cloud = replace_one(
    cloud,
    "const PENDING_JOIN_KEY = 'splitzap.shared.pendingJoin';\n\nconst dataHash",
    "const PENDING_JOIN_KEY = 'splitzap.shared.pendingJoin';\nconst SHARED_CONFIRMED_PREFIX = 'splitzap.shared.confirmed.';\n\nconst dataHash",
    'confirmed storage prefix',
)
cloud = replace_one(
    cloud,
    "function clearPendingJoinIntent() {",
    '''function loadConfirmedSharedState(userId: string) {
  const map = new Map<string, ConfirmedSharedState>();
  if (!userId) return map;
  try {
    const raw = window.localStorage.getItem(`${SHARED_CONFIRMED_PREFIX}${userId}`);
    if (!raw) return map;
    const parsed = JSON.parse(raw) as Record<string, ConfirmedSharedState>;
    Object.entries(parsed).forEach(([sharedId, record]) => {
      if (record && Number.isFinite(Number(record.revision)) && typeof record.fingerprint === 'string') {
        map.set(sharedId, { revision: Number(record.revision), fingerprint: record.fingerprint });
      }
    });
  } catch { /* best effort */ }
  return map;
}

function persistConfirmedSharedState(userId: string, map: Map<string, ConfirmedSharedState>) {
  if (!userId) return;
  try { window.localStorage.setItem(`${SHARED_CONFIRMED_PREFIX}${userId}`, JSON.stringify(Object.fromEntries(map))); } catch { /* best effort */ }
}

function rememberConfirmedSharedState(userId: string, map: Map<string, ConfirmedSharedState>, row: Pick<SharedGroupRow, 'id' | 'revision' | 'snapshot'>) {
  map.set(row.id, {
    revision: row.revision,
    fingerprint: compactSnapshotFingerprint(sharedSnapshotHash(row.snapshot)),
  });
  persistConfirmedSharedState(userId, map);
}

function forgetConfirmedSharedState(userId: string, map: Map<string, ConfirmedSharedState>, sharedId: string) {
  map.delete(sharedId);
  persistConfirmedSharedState(userId, map);
}

function clearPendingJoinIntent() {''',
    'confirmed storage helpers',
)
cloud = replace_one(
    cloud,
    "  const sharedHashes = useRef(new Map<string, string>());\n  const accountSyncing",
    "  const sharedHashes = useRef(new Map<string, string>());\n  const confirmedSharedState = useRef(new Map<string, ConfirmedSharedState>());\n  const restartDirtySharedIds = useRef(new Set<string>());\n  const accountSyncing",
    'confirmed refs',
)
cloud = replace_one(
    cloud,
    "      sharedHashes.current.clear();\n      setProfile(null); setProfileReady(false);",
    "      sharedHashes.current.clear();\n      confirmedSharedState.current.clear();\n      restartDirtySharedIds.current.clear();\n      setProfile(null); setProfileReady(false);",
    'auth reset confirmed refs',
)
old_bootstrap = '''      try {
        const row = await fetchSplitzapCloudState(session.user.id);
        if (!active) return;
        if (row) {
          update(() => row.data);
          saveSyncMarker(row.data, row.updated_at);
          setLastSyncedAt(row.updated_at);
        } else {'''
new_bootstrap = '''      try {
        const localBeforeCloud = latestData.current;
        const sameLocalUser = safeGet(LAST_USER_KEY) === session.user.id;
        const accountHasUnsyncedLocalChanges = sameLocalUser && dataHash(localBeforeCloud) !== safeGet(LAST_SYNC_HASH_KEY);
        confirmedSharedState.current = loadConfirmedSharedState(session.user.id);
        restartDirtySharedIds.current.clear();
        const row = await fetchSplitzapCloudState(session.user.id);
        if (!active) return;
        if (row) {
          const protectedBootstrap = sameLocalUser
            ? preserveDirtySharedGroupsOnBootstrap(row.data, localBeforeCloud, confirmedSharedState.current, accountHasUnsyncedLocalChanges)
            : { data: row.data, dirtyIds: new Set<string>() };
          restartDirtySharedIds.current = protectedBootstrap.dirtyIds;
          update(() => protectedBootstrap.data);
          // The sync marker must represent the actual server account copy, not
          // locally preserved dirty financial state, so account sync still runs.
          saveSyncMarker(row.data, row.updated_at);
          setLastSyncedAt(row.updated_at);
        } else {'''
cloud = replace_one(cloud, old_bootstrap, new_bootstrap, 'same-account bootstrap protection')

old_initial = '''    void loadSharedGroupsForUser(session.user.id).then((rows) => {
      if (!active) return;
      sharedHashes.current.clear(); rows.forEach((row) => sharedHashes.current.set(row.id, sharedSnapshotHash(row.snapshot)));
      update((current) => mergeSharedRowsIntoLocal(current, rows, true));
      setProductionTick((value) => value + 1);
    }).catch'''
new_initial = '''    void loadSharedGroupsForUser(session.user.id).then((rows) => {
      if (!active) return;
      const current = latestData.current;
      sharedHashes.current.clear();
      const protectedRows = rows.map((row) => {
        const remoteHash = sharedSnapshotHash(row.snapshot);
        sharedHashes.current.set(row.id, remoteHash);
        const localGroup = current.groups.find((group) => group.sharedId === row.id || group.id === row.snapshot.group.id);
        if (!localGroup) {
          rememberConfirmedSharedState(session.user.id, confirmedSharedState.current, row);
          return row;
        }
        let localSnapshot;
        try { localSnapshot = buildSharedGroupSnapshot(current, localGroup.id); } catch {
          rememberConfirmedSharedState(session.user.id, confirmedSharedState.current, row);
          return row;
        }
        const localHash = sharedSnapshotHash(localSnapshot);
        const noBaselineButSameRevisionChanged = !confirmedSharedState.current.has(row.id)
          && localGroup.sharedRevision === row.revision
          && localHash !== remoteHash;
        const shouldProtect = restartDirtySharedIds.current.has(row.id) || noBaselineButSameRevisionChanged;
        if (!shouldProtect || localHash === remoteHash) {
          restartDirtySharedIds.current.delete(row.id);
          rememberConfirmedSharedState(session.user.id, confirmedSharedState.current, row);
          return row;
        }
        return { ...row, snapshot: localSnapshot, revision: localGroup.sharedRevision ?? row.revision };
      });
      update((value) => mergeSharedRowsIntoLocal(value, protectedRows, true));
      setProductionTick((value) => value + 1);
    }).catch'''
cloud = replace_one(cloud, old_initial, new_initial, 'initial shared bootstrap protection')

cloud = replace_one(
    cloud,
    "        sharedHashes.current.delete(sharedId);\n        update((current)",
    "        sharedHashes.current.delete(sharedId);\n        forgetConfirmedSharedState(session.user.id, confirmedSharedState.current, sharedId);\n        update((current)",
    'realtime delete persisted baseline',
)
cloud = replace_one(
    cloud,
    "        if (!row || row.status === 'deleted') { sharedHashes.current.delete(sharedId); update((current)",
    "        if (!row || row.status === 'deleted') { sharedHashes.current.delete(sharedId); forgetConfirmedSharedState(session.user.id, confirmedSharedState.current, sharedId); update((current)",
    'fetch delete persisted baseline',
)
cloud = replace_one(
    cloud,
    "          if (!protectedRow.dirty) sharedHashes.current.set(row.id, sharedSnapshotHash(row.snapshot));\n          return mergeSharedRowsIntoLocal",
    "          if (!protectedRow.dirty) { sharedHashes.current.set(row.id, sharedSnapshotHash(row.snapshot)); rememberConfirmedSharedState(session.user.id, confirmedSharedState.current, row); }\n          return mergeSharedRowsIntoLocal",
    'realtime clean baseline remember',
)
cloud = replace_one(
    cloud,
    "            if (!entry.dirty) sharedHashes.current.set(rows[index]!.id, sharedSnapshotHash(rows[index]!.snapshot));",
    "            if (!entry.dirty) { sharedHashes.current.set(rows[index]!.id, sharedSnapshotHash(rows[index]!.snapshot)); rememberConfirmedSharedState(session.user.id, confirmedSharedState.current, rows[index]!); }",
    'metadata clean baseline remember',
)
cloud = replace_one(
    cloud,
    "            sharedHashes.current.set(sharedId, sharedSnapshotHash(item.snapshot));\n            update((current)",
    "            sharedHashes.current.set(sharedId, sharedSnapshotHash(item.snapshot));\n            restartDirtySharedIds.current.delete(sharedId);\n            rememberConfirmedSharedState(session.user.id, confirmedSharedState.current, { id: sharedId, revision: result.revision, snapshot: item.snapshot });\n            update((current)",
    'write success baseline remember',
)
cloud = replace_one(
    cloud,
    "    sharedHashes.current.set(row.id, sharedSnapshotHash(row.snapshot)); update((value) => mergeSharedRowsIntoLocal(value, [row], false)); setProductionTick",
    "    sharedHashes.current.set(row.id, sharedSnapshotHash(row.snapshot)); rememberConfirmedSharedState(session.user.id, confirmedSharedState.current, row); update((value) => mergeSharedRowsIntoLocal(value, [row], false)); setProductionTick",
    'enable sharing baseline remember',
)
cloud = replace_one(
    cloud,
    "    sharedHashes.current.set(row.id, sharedSnapshotHash(row.snapshot)); update((current) => mergeSharedRowsIntoLocal(current, [row], false));\n    clearPendingJoinIntent();",
    "    sharedHashes.current.set(row.id, sharedSnapshotHash(row.snapshot)); rememberConfirmedSharedState(session!.user.id, confirmedSharedState.current, row); update((current) => mergeSharedRowsIntoLocal(current, [row], false));\n    clearPendingJoinIntent();",
    'join baseline remember',
)
cloud = replace_one(
    cloud,
    "      sharedHashes.current.delete(group.sharedId); setProductionTick",
    "      sharedHashes.current.delete(group.sharedId); forgetConfirmedSharedState(session.user.id, confirmedSharedState.current, group.sharedId); setProductionTick",
    'remove group baseline forget',
)
write(cloud_path, cloud)

print('Durable Splitzap financial sync patch applied.')
