import type { SplitData } from './splitStoreV4';
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
