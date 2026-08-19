import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value);
const replaceOnce = (source, from, to, label) => {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(from, to);
};

// Phase 1: durable schema metadata + shared lifecycle metadata. Idempotent marker.
{
  const path = 'src/features/splitzap/splitStoreV4.ts';
  let s = read(path);
  if (!s.includes('SPLITZAP_SCHEMA_VERSION = 2')) {
    s = replaceOnce(s,
      "export type Member = { id: string; name: string };\n",
      "export const SPLITZAP_SCHEMA_VERSION = 2;\n\nexport type Member = { id: string; name: string };\n",
      'schema constant');

    s = replaceOnce(s,
      "export type ExpenseHistoryEntry = {\n  id: string;\n  expenseId: string;\n  groupId: string;\n  date: string;\n  changes: HistoryChange[];\n};\n\nexport type SplitData = {\n  me: string;\n  myName?: string;\n  groups: Group[];\n  expenses: Expense[];\n  settlements: Settlement[];\n  history?: ExpenseHistoryEntry[];\n};",
      "export type ExpenseHistoryEntry = {\n  id: string;\n  expenseId: string;\n  groupId: string;\n  date: string;\n  changes: HistoryChange[];\n};\n\nexport type LocalActivityEvent = {\n  id: string;\n  groupId: string;\n  actorName: string;\n  eventType: string;\n  entityType: 'expense' | 'payment' | 'member' | 'group';\n  entityId?: string;\n  date: string;\n  data?: Record<string, unknown>;\n};\n\nexport type SplitData = {\n  schemaVersion?: number;\n  me: string;\n  myName?: string;\n  groups: Group[];\n  expenses: Expense[];\n  settlements: Settlement[];\n  history?: ExpenseHistoryEntry[];\n  activity?: LocalActivityEvent[];\n};",
      'activity types');

    s = replaceOnce(s,
      "  sharedJoinCode?: string;\n};",
      "  sharedJoinCode?: string;\n  /** Local metadata returned by Level 2. Never used for bill math. */\n  sharedStatus?: 'active' | 'archived';\n  sharedSchemaVersion?: number;\n  archivedAt?: string;\n};",
      'group metadata');

    s = replaceOnce(s,
      "export type SplitzapBackup = {\n  app: 'Splitzap';\n  version: 2;\n  exportedAt: string;\n  data: SplitData;\n};",
      "export type SplitzapBackup = {\n  app: 'Splitzap';\n  version: 2 | 3;\n  exportedAt: string;\n  data: SplitData;\n};",
      'backup version type');

    s = replaceOnce(s,
      "const emptyData = (me = uid()): SplitData => ({\n  me,\n  myName: '',\n  groups: [],\n  expenses: [],\n  settlements: [],\n  history: [],\n});",
      "const emptyData = (me = uid()): SplitData => ({\n  schemaVersion: SPLITZAP_SCHEMA_VERSION,\n  me,\n  myName: '',\n  groups: [],\n  expenses: [],\n  settlements: [],\n  history: [],\n  activity: [],\n});",
      'empty data');

    s = replaceOnce(s,
      "const EMPTY: SplitData = {\n  me: 'me',\n  myName: '',\n  groups: [],\n  expenses: [],\n  settlements: [],\n  history: [],\n};",
      "const EMPTY: SplitData = {\n  schemaVersion: SPLITZAP_SCHEMA_VERSION,\n  me: 'me',\n  myName: '',\n  groups: [],\n  expenses: [],\n  settlements: [],\n  history: [],\n  activity: [],\n};",
      'empty constant');

    s = replaceOnce(s,
      "  return {\n    me: data.me || uid(),\n    myName: inferredName,\n    groups,\n    expenses: Array.isArray(data.expenses) ? data.expenses.map((expense) => normalizeExpense(expense)) : [],\n    settlements: Array.isArray(data.settlements) ? data.settlements : [],\n    history: Array.isArray(data.history) ? data.history : [],\n  };",
      "  return {\n    schemaVersion: SPLITZAP_SCHEMA_VERSION,\n    me: data.me || uid(),\n    myName: inferredName,\n    groups,\n    expenses: Array.isArray(data.expenses) ? data.expenses.map((expense) => normalizeExpense(expense)) : [],\n    settlements: Array.isArray(data.settlements) ? data.settlements : [],\n    history: Array.isArray(data.history) ? data.history : [],\n    activity: Array.isArray(data.activity) ? data.activity : [],\n  };",
      'normalize data');

    s = replaceOnce(s,
      "    history: (data.history ?? []).filter((entry) => !demoGroupIds.has(entry.groupId)),\n  };",
      "    history: (data.history ?? []).filter((entry) => !demoGroupIds.has(entry.groupId)),\n    activity: (data.activity ?? []).filter((entry) => !demoGroupIds.has(entry.groupId)),\n  };",
      'legacy activity');

    s = replaceOnce(s,
      "    version: 2,",
      "    version: 3,",
      'backup version');

    s = replaceOnce(s,
      "export function useSplitData() {",
      "export function withLocalActivity(data: SplitData, event: Omit<LocalActivityEvent, 'id' | 'date'> & { id?: string; date?: string }): SplitData {\n  const next: LocalActivityEvent = { ...event, id: event.id ?? uid(), date: event.date ?? new Date().toISOString() };\n  return { ...data, activity: [next, ...(data.activity ?? [])].slice(0, 2000) };\n}\n\nexport function useSplitData() {",
      'local activity helper');

    write(path, s);
  }
}

{
  const path = 'src/features/splitzap/splitzapShared.ts';
  let s = read(path);
  if (!s.includes("schemaVersion: 2,")) {
    s = replaceOnce(s,
      "export type SharedGroupSnapshot = {\n  group: Group;",
      "export type SharedGroupSnapshot = {\n  schemaVersion: number;\n  group: Group;",
      'shared snapshot version');

    s = replaceOnce(s,
      "  role: SharedRole;\n};",
      "  role: SharedRole;\n  status: 'active' | 'archived' | 'deleted';\n  schema_version: number;\n  archived_at?: string | null;\n  deleted_at?: string | null;\n};",
      'shared row metadata');

    s = replaceOnce(s,
      "    sharedJoinCode: _sharedJoinCode,\n    ...clean",
      "    sharedJoinCode: _sharedJoinCode,\n    sharedStatus: _sharedStatus,\n    sharedSchemaVersion: _sharedSchemaVersion,\n    archivedAt: _archivedAt,\n    ...clean",
      'clean shared metadata');

    s = replaceOnce(s,
      "  return {\n    group: cleanGroupForSnapshot(group),",
      "  return {\n    schemaVersion: 2,\n    group: cleanGroupForSnapshot(group),",
      'snapshot build version');

    s = replaceOnce(s,
      "function applySharedRow(current: SplitData, row: SharedGroupRow): SplitData {\n  const snapshot = row.snapshot;",
      "function applySharedRow(current: SplitData, row: SharedGroupRow): SplitData {\n  const snapshot = row.snapshot;\n  if (row.status === 'deleted') {\n    const local = current.groups.find((item) => item.sharedId === row.id || item.id === snapshot.group.id);\n    return local ? removeGroupFromLocal(current, local.id) : current;\n  }",
      'deleted merge guard');

    s = replaceOnce(s,
      "    sharedJoinCode: row.join_code,\n  };",
      "    sharedJoinCode: row.join_code,\n    sharedStatus: row.status === 'archived' ? 'archived' : 'active',\n    sharedSchemaVersion: row.schema_version || snapshot.schemaVersion || 1,\n    archivedAt: row.status === 'archived' ? row.archived_at ?? undefined : undefined,\n  };",
      'apply row metadata');

    s = replaceOnce(s,
      "    history: (current.history ?? []).filter((entry) => entry.groupId !== groupId),\n  };",
      "    history: (current.history ?? []).filter((entry) => entry.groupId !== groupId),\n    activity: (current.activity ?? []).filter((entry) => entry.groupId !== groupId),\n  };",
      'remove local activity');

    s = replaceOnce(s,
      "    role: row.role as SharedRole,\n    updated_at: new Date().toISOString(),",
      "    role: row.role as SharedRole,\n    status: 'active',\n    schema_version: Number((row.snapshot as SharedGroupSnapshot).schemaVersion) || 1,\n    updated_at: new Date().toISOString(),",
      'create row metadata');

    s = replaceOnce(s,
      ".select('id, join_code, snapshot, revision, updated_at')\n    .in('id', ids);",
      ".select('id, join_code, snapshot, revision, updated_at, status, schema_version, archived_at, deleted_at')\n    .in('id', ids)\n    .neq('status', 'deleted');",
      'load status select');

    s = replaceOnce(s,
      "      role: membership.role as SharedRole,\n    };",
      "      role: membership.role as SharedRole,\n      status: (group.status ?? 'active') as SharedGroupRow['status'],\n      schema_version: Number(group.schema_version) || Number((group.snapshot as SharedGroupSnapshot).schemaVersion) || 1,\n      archived_at: group.archived_at,\n      deleted_at: group.deleted_at,\n    };",
      'load row metadata');

    s = replaceOnce(s,
      ".select('id, join_code, snapshot, revision, updated_at')\n    .eq('id', sharedId)",
      ".select('id, join_code, snapshot, revision, updated_at, status, schema_version, archived_at, deleted_at')\n    .eq('id', sharedId)",
      'fetch status select');

    s = replaceOnce(s,
      "    role: membership.role as SharedRole,\n  };\n}\n\nexport async function previewSharedGroupJoin",
      "    role: membership.role as SharedRole,\n    status: (data.status ?? 'active') as SharedGroupRow['status'],\n    schema_version: Number(data.schema_version) || Number((data.snapshot as SharedGroupSnapshot).schemaVersion) || 1,\n    archived_at: data.archived_at,\n    deleted_at: data.deleted_at,\n  };\n}\n\nexport async function previewSharedGroupJoin",
      'fetch row metadata');

    s = replaceOnce(s,
      "    role: row.role as SharedRole,\n  };\n}\n\nexport async function updateSharedGroup",
      "    role: row.role as SharedRole,\n    status: 'active',\n    schema_version: Number((row.snapshot as SharedGroupSnapshot).schemaVersion) || 1,\n  };\n}\n\nexport async function updateSharedGroup",
      'join legacy metadata');

    write(path, s);
  }
}

console.log('Splitzap production phase 1 patch applied.');
