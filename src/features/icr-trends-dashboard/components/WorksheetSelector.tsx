import type { WorksheetInfo } from '../types';

type Props = { worksheets: WorksheetInfo[]; selectedWorksheet: string; onSelect: (name: string) => void; disabled?: boolean };

export function WorksheetSelector({ worksheets, selectedWorksheet, onSelect, disabled }: Props) {
  if (!worksheets.length) return null;
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="worksheet-selector-heading">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 id="worksheet-selector-heading" className="text-lg font-semibold text-slate-950">Worksheet selection</h2>
          <p className="mt-1 text-sm text-slate-600">The best worksheet is selected automatically. You can switch worksheets before parsing.</p>
        </div>
        <label className="flex min-w-0 flex-col gap-2 text-sm font-medium text-slate-700 lg:min-w-80">
          Selected worksheet
          <select className="icr-select" value={selectedWorksheet} onChange={(event) => onSelect(event.target.value)} disabled={disabled || worksheets.length < 2}>
            {worksheets.map((worksheet) => <option key={worksheet.name} value={worksheet.name}>{worksheet.name}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {worksheets.map((worksheet) => (
          <article key={worksheet.name} className={`icr-worksheet-card ${worksheet.name === selectedWorksheet ? 'is-selected' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="break-words text-sm font-semibold text-slate-950">{worksheet.name}</h3>
              <span className="icr-status-badge">{worksheet.recommendation}</span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
              <div><dt>Rows</dt><dd className="font-semibold text-slate-900">~{worksheet.estimatedRows.toLocaleString()}</dd></div>
              <div><dt>Columns</dt><dd className="font-semibold text-slate-900">{worksheet.columnCount}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
