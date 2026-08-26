import type { SharedGroupSnapshot } from './splitzapShared';

export type SharedEntityBaseline = {
  schemaVersion: number;
  group: string;
  expenses: Record<string, string>;
  settlements: Record<string, string>;
  history: Record<string, string>;
};

export type SharedEntityConflict = {
  entityType: 'schema' | 'group' | 'expense' | 'settlement' | 'history';
  entityId?: string;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonicalize(record[key])]));
  }
  return value;
}

export function entityCanonicalHash(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

const entityHashes = <T extends { id: string }>(items: T[]) => Object.fromEntries(
  items.map((item) => [item.id, entityCanonicalHash(item)]),
);

export function buildSharedEntityBaseline(snapshot: SharedGroupSnapshot): SharedEntityBaseline {
  return {
    schemaVersion: snapshot.schemaVersion,
    group: entityCanonicalHash(snapshot.group),
    expenses: entityHashes(snapshot.expenses),
    settlements: entityHashes(snapshot.settlements),
    history: entityHashes(snapshot.history),
  };
}

type MergeEntityResult<T> = { value: T | undefined; conflict: boolean };

function mergeEntity<T>(baseHash: string | null, local: T | undefined, remote: T | undefined): MergeEntityResult<T> {
  const localHash = local === undefined ? null : entityCanonicalHash(local);
  const remoteHash = remote === undefined ? null : entityCanonicalHash(remote);
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
      const anchorIndex = result.indexOf(remoteIds[previous]!);
      if (anchorIndex >= 0) {
        result.splice(anchorIndex + 1, 0, id);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      for (let next = index + 1; next < remoteIds.length; next += 1) {
        const anchorIndex = result.indexOf(remoteIds[next]!);
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
 * Three-way entity merge used only after an optimistic shared-group revision
 * is stale. Non-overlapping changes are combined. If both devices changed the
 * same permanent entity differently, Splitzap refuses to pick a silent winner.
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
