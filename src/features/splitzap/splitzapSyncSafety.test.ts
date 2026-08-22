import { describe, expect, it } from 'vitest';
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
