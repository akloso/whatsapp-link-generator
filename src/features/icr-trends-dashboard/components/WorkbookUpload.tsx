import { MAX_FILE_SIZE_BYTES, SUPPORTED_EXTENSIONS } from '../services/workbookReader';
import type { IcrDashboardState } from '../types';

type Props = { state: IcrDashboardState; inputRef: React.RefObject<HTMLInputElement>; onFileChange: (file: File | null) => void; onUploadClick: () => void; onDemo: () => void; onClear: () => void };

export function WorkbookUpload({ state, inputRef, onFileChange, onUploadClick, onDemo, onClear }: Props) {
  const isBusy = ['reading-file', 'inspecting-workbook', 'parsing-data'].includes(state.status);
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Workbook upload controls">
      <input
        ref={inputRef}
        id="icr-workbook-input"
        className="sr-only"
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
      />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <label htmlFor="icr-workbook-input" className="text-sm font-semibold text-slate-900">ICR workbook</label>
          <p className="mt-1 text-sm text-slate-600">
            Supported formats: {SUPPORTED_EXTENSIONS.map((extension) => `.${extension}`).join(', ')} · Max {(MAX_FILE_SIZE_BYTES / 1024 / 1024).toFixed(0)} MB · local processing only.
          </p>
          {state.sourceName ? (
            <p className="mt-2 text-sm text-slate-700"><strong>Current file:</strong> {state.sourceName} <span className="text-slate-500">({state.sourceType || 'demo'})</span></p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button className="icr-primary-button" type="button" onClick={onUploadClick} disabled={isBusy}>Upload workbook</button>
          <button className="icr-secondary-button" type="button" onClick={onDemo} disabled={isBusy}>View demo</button>
          <button className="icr-ghost-button" type="button" onClick={onClear} disabled={isBusy && state.status !== 'error'}>Clear data</button>
        </div>
      </div>
    </section>
  );
}
