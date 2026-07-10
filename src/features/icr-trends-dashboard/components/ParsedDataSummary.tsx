import { avg } from '../logic/numberParsing';
import type { IcrDashboardState } from '../types';

type Props = { state: IcrDashboardState; onReviewMapping: () => void; onClear: () => void };

const formatPercent = (value: number | null) => value === null ? '—' : `${Math.round(value)}%`;

export function ParsedDataSummary({ state, onReviewMapping, onClear }: Props) {
  if (!state.parsedRows.length) return null;
  const mappedCount = Object.values(state.mapping).filter((entry) => entry.key).length;
  const ignoredCount = state.headers.length - mappedCount;
  const clients = new Set(state.parsedRows.map((row) => row._clientKey).filter(Boolean));
  const datedRows = state.parsedRows.filter((row) => row.timestamp).length;
  const parserConfidence = avg(state.parsedRows.map((row) => row.dataConfidence));
  const readyForReports = state.validationIssues.filter((issue) => issue.severity === 'error').length === 0 && clients.size > 0;
  const cards = [
    ['Workbook ready', readyForReports ? 'Yes' : 'Review needed'],
    ['Selected worksheet', state.selectedWorksheet || '—'],
    ['Rows parsed', state.parsedRows.length.toLocaleString()],
    ['Columns detected', state.headers.length.toLocaleString()],
    ['Canonical fields mapped', mappedCount.toLocaleString()],
    ['Ignored/raw columns', ignoredCount.toLocaleString()],
    ['Clients detected', clients.size.toLocaleString()],
    ['Dated rows', datedRows.toLocaleString()],
    ['Validation warnings', state.validationIssues.length.toLocaleString()],
    ['Parser confidence average', formatPercent(parserConfidence)],
  ];
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="parsed-summary-heading">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-600">Phase 1 readiness</p>
          <h2 id="parsed-summary-heading" className="mt-2 text-2xl font-bold text-slate-950">Workbook ready for report generation</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">The workbook has been parsed in browser memory. Executive reports, charts, exports, and client intelligence are intentionally deferred to the next implementation phase.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button className="icr-secondary-button" type="button" onClick={onReviewMapping}>Review mapping</button>
          <button className="icr-ghost-button" type="button" onClick={onClear}>Clear data</button>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map(([label, value]) => (
          <div className="icr-summary-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      {state.warnings.length || state.validationIssues.length ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {state.warnings.length ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <h3 className="font-semibold">Parsing warnings</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">{state.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </div>
          ) : null}
          {state.validationIssues.length ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <h3 className="font-semibold text-slate-950">Validation summary</h3>
              <p className="mt-2">{state.validationIssues.length.toLocaleString()} row-level warning{state.validationIssues.length === 1 ? '' : 's'} detected. Detailed issue review belongs to the Data Quality phase.</p>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900">
        Report generation will be added in the next implementation phase.
      </div>
    </section>
  );
}
