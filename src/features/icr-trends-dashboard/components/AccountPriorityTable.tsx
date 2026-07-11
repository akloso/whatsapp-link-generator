import type { AnalyzedRow } from '../types';
import { sortPriorityRows } from '../logic/metrics';

const fmtPct = (value: number | null) => value === null ? '—' : `${Math.round(value * 100)}%`;
const fmtNum = (value: number | null) => value === null ? '—' : value.toLocaleString();
const implementationStatus = (row: AnalyzedRow) => {
  if (row.dtcPlaced === true && row.widgetPlaced === true) return 'Implemented';
  if ((row.dtcPlaced === true && row.widgetPlaced === false) || (row.dtcPlaced === false && row.widgetPlaced === true)) return 'Partially implemented';
  if (row.dtcPlaced === false && row.widgetPlaced === false) return 'Not implemented';
  return 'Status unclear';
};

export function AccountPriorityTable({ rows }: { rows: AnalyzedRow[] }) {
  const priorityRows = sortPriorityRows(rows);
  if (!priorityRows.length) return <div className="icr-no-result">No accounts match the selected filters.</div>;
  return <section className="icr-priority" aria-labelledby="icr-priority-title">
    <h2 id="icr-priority-title">Account Priority Register</h2>
    <div className="icr-table-scroll"><table><thead><tr><th>Client</th><th>RAG</th><th>Health</th><th>Lead utilisation</th><th>Unassigned</th><th>Untouched</th><th>Overdue</th><th>Implementation status</th><th>Recommended next move</th></tr></thead><tbody>{priorityRows.map((row) => <tr key={`${row._clientKey}-${row._row}`}><td><strong>{row.clientName || 'Unnamed client'}</strong><span>{row.clientId}</span></td><td><span className={`icr-rag icr-rag--${row.rag.toLowerCase()}`}>{row.rag}</span></td><td>{row.health}/100</td><td>{fmtPct(row.leadUtil)}</td><td>{fmtNum(row.unassigned)}</td><td>{fmtNum(row.untouched)}</td><td>{fmtNum(row.overdue)}</td><td>{implementationStatus(row)}</td><td>{row.recommendation}</td></tr>)}</tbody></table></div>
  </section>;
}
