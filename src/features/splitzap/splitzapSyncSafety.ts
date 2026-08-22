export type RemoteSnapshotRow<TSnapshot> = {
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
