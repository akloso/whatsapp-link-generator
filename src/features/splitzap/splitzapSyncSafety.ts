import type { SplitData } from './splitStoreV4';
import {
  buildSharedGroupSnapshot,
  canonicalJsonHash,
  sharedSnapshotHash,
  type SharedGroupSnapshot,
} from './splitzapShared';

export type RemoteSnapshotRow<TSnapshot> = {
  snapshot: TSnapshot;
  revision: number;
};

export type SharedEntityBaseline = {
  schemaVersion: number;
  group: string;
  expenses: Record<string, string>;
  settlements: Record<string, string>;
  history: Record<string, string>;
};

export type ConfirmedSharedState = {
  revision: number;
  fingerprint: string;
  entities?: SharedEntityBaseline;
};

export type SharedEntityConflict = {
  entityType: 'schema' | 'group' | 'expense' | 'settlement' | 'history';
  entityId?: string;
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

const entityHashes = <T extends { id: string }>(items: T[]) => Object.fromEntries(
  items.map((item) => [item.id, canonicalJsonHash(item)]),
);

export function buildSharedEntityBaseline(snapshot: SharedGroupSnapshot): SharedEntityBaseline {
  return {
    schemaVersion: snapshot.schemaVersion,
    group: canonicalJsonHash(snapshot.group),
    expenses: entityHashes(snapshot.expenses),
    settlements: entityHashes(snapshot.settlements),
    history: entityHashes(snapshot.history),
  };
}

type MergeEntityResult<T> = { value: T | undefined; conflict: boolean };

function mergeEntity<T>(baseHash: string | null, local: T | undefined, remote: T | undefined): MergeEntityResult<T> {
  const localHash = local === undefined ? null : canonicalJsonHash(local);
  const remoteHash = remote === undefined ? null : canonicalJsonHash(remote);
  const localChanged = localHash !== baseHash;
  const remoteChanged = remoteHash !== baseHash;

  if (localChanged && remoteChanged) {
    if (localHash === remoteHash) return { value: local, conflict: false };
    return { value: local, conflict: true };
  }
  if (localChanged) return { value: local, conflict: false };
  return { value: remote, conflict: false };
}

function mergeCollectionOrder<T extends { id: string }>(local: T[], remote: T[], merged: Map<string, T>) {
  const result = local.map((item) => item.id).filter((id) => merged.has(id));
  const seen = new Set(result);
  const remoteIds = remote.map((item) => item.id).filter((id) => merged.has(id));

  for (let index = 0; index < remoteIds.length; index += 1) {
    const id = remoteIds[index]!;
    if (seen.has(id)) continue;

    let inserted = false;
    for (let previous = index - 1; previous >= 0; previous -= 1) {
      const anchor = remoteIds[previous]!;
      const anchorIndex = result.indexOf(anchor);
      if (anchorIndex >= 0) {
        result.splice(anchorIndex + 1, 0, id);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      for (let next = index + 1; next < remoteIds.length; next += 1) {
        const anchor = remoteIds[next]!;
        const anchorIndex = result.indexOf(anchor);
        if (anchorIndex >= 0) {
          result.splice(anchorIndex, 0, id);
          inserted = true;
          break;
        }
      }
    }
    if (!inserted) result.push(id);
    seen.add(id);
  }

  return result.map((id) => merged.get(id)!).filter(Boolean);
}

function mergeCollection<T extends { id: string }>(
  baseHashes: Record<string, string>,
  local: T[],
  remote: T[],
  entityType: SharedEntityConflict['entityType'],
) {
  const localMap = new Map(local.map((item) => [item.id, item]));
  const remoteMap = new Map(remote.map((item) => [item.id, item]));
  const ids = new Set([...Object.keys(baseHashes), ...localMap.keys(), ...remoteMap.keys()]);
  const merged = new Map<string, T>();
  const conflicts: SharedEntityConflict[] = [];

  for (const id of ids) {
    const result = mergeEntity(baseHashes[id] ?? null, localMap.get(id), remoteMap.get(id));
    if (result.conflict) conflicts.push({ entityType, entityId: id });
    if (result.value !== undefined) merged.set(id, result.value);
  }

  return { values: mergeCollectionOrder(local, remote, merged), conflicts };
}

/**
 * Three-way entity merge used only after the server rejects an optimistic
 * shared-group revision. Non-overlapping expense/settlement/history changes
 * are safely combined. If both devices changed the same entity differently,
 * no automatic winner is chosen and the local copy remains untouched.
 */
export function reconcileSharedGroupSnapshots(
  baseline: SharedEntityBaseline,
  local: SharedGroupSnapshot,
  remote: SharedGroupSnapshot,
): { snapshot: SharedGroupSnapshot | null; conflicts: SharedEntityConflict[] } {
  const conflicts: SharedEntityConflict[] = [];

  const localSchemaChanged = local.schemaVersion !== baseline.schemaVersion;
  const remoteSchemaChanged = remote.schemaVersion !== baseline.schemaVersion;
  let schemaVersion = remote.schemaVersion;
  if (localSchemaChanged && remoteSchemaChanged && local.schemaVersion !== remote.schemaVersion) {
    conflicts.push({ entityType: 'schema' });
  } else if (localSchemaChanged) {
    schemaVersion = local.schemaVersion;
  }

  const groupResult = mergeEntity(baseline.group, local.group, remote.group);
  if (groupResult.conflict) conflicts.push({ entityType: 'group', entityId: local.group.id || remote.group.id });

  const expenses = mergeCollection(baseline.expenses, local.expenses, remote.expenses, 'expense');
  const settlements = mergeCollection(baseline.settlements, local.settlements, remote.settlements, 'settlement');
  const history = mergeCollection(baseline.history, local.history, remote.history, 'history');
  conflicts.push(...expenses.conflicts, ...settlements.conflicts, ...history.conflicts);

  if (conflicts.length || !groupResult.value) return { snapshot: null, conflicts };
  return {
    snapshot: {
      schemaVersion,
      group: groupResult.value,
      expenses: expenses.values,
      settlements: settlements.values,
      history: history.values,
    },
    conflicts: [],
  };
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
