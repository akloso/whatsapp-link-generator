import type { AnalyzedRow } from '../types';
import { latestByClient } from '../logic/metrics';

const percent = (value: number | null): string => value === null ? '—' : `${Math.round(value * 100)}%`;
const number = (value: number | null): string => value === null ? '—' : value.toLocaleString('en-IN');

const ragClass = (rag: AnalyzedRow['rag']): string => {
  if (rag === 'Green') return 'bg-emerald-100 text-emerald-800';
  if (rag === 'Amber') return 'bg-amber-100 text-amber-800';
  if (rag === 'Red') return 'bg-red-100 text-red-800';
  return 'bg-slate-100 text-slate-700';
};

type AccountPriorityTableProps = {
  rows: AnalyzedRow[];
};

export function AccountPriorityTable({ rows }: AccountPriorityTableProps) {
  const latest = latestByClient(rows).sort((a, b) => a.health - b.health || (b.unassigned ?? 0) - (a.unassigned ?? 0));

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-950">Account priority register</h2>
        <p className="mt-1 text-sm text-slate-600">Latest available snapshot per filtered account, ordered from highest risk.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-[1100px] w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">RAG</th>
              <th className="px-4 py-3">Health</th>
              <th className="px-4 py-3">Lead use</th>
              <th className="px-4 py-3">Unassigned</th>
              <th className="px-4 py-3">Untouched</th>
              <th className="px-4 py-3">Overdue</th>
              <th className="px-4 py-3">Next move</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {latest.map((row) => (
              <tr key={row._clientKey} className="align-top">
                <td className="px-4 py-4">
                  <div className="font-semibold text-slate-950">{row.clientName}</div>
                  <div className="mt-1 text-xs text-slate-500">{row.owner || 'No owner mapped'}</div>
                </td>
                <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${ragClass(row.rag)}`}>{row.rag}</span></td>
                <td className="px-4 py-4 font-semibold text-slate-950">{row.health}/100</td>
                <td className="px-4 py-4">{percent(row.leadUtil)}</td>
                <td className="px-4 py-4">{number(row.unassigned)} <span className="text-xs text-slate-500">({percent(row.unassignedRate)})</span></td>
                <td className="px-4 py-4">{number(row.untouched)} <span className="text-xs text-slate-500">({percent(row.untouchedRate)})</span></td>
                <td className="px-4 py-4">{number(row.overdue)} <span className="text-xs text-slate-500">({percent(row.overdueRate)})</span></td>
                <td className="max-w-sm px-4 py-4 text-slate-700">{row.recommendation}</td>
              </tr>
            ))}
            {!latest.length ? <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">No accounts match the selected filters.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
