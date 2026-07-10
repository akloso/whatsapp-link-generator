type Props = { onUpload: () => void; onDemo: () => void; disabled?: boolean };

export function IcrEmptyState({ onUpload, onDemo, disabled }: Props) {
  return (
    <section className="rounded-[28px] border border-dashed border-violet-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-600">Private Phase 1 workspace</p>
          <h2 className="mt-3 text-2xl font-bold text-slate-950">Prepare ICR workbook data for analysis</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Upload an ICR Excel or CSV workbook to detect the relevant worksheet, review column mapping, and prepare the data for analysis.
          </p>
          <p className="mt-3 rounded-2xl bg-violet-50 px-4 py-3 text-sm text-violet-900">
            Your workbook is processed locally in this browser and is not uploaded to Zapora servers.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
          <button className="icr-primary-button" type="button" onClick={onUpload} disabled={disabled}>Upload workbook</button>
          <button className="icr-secondary-button" type="button" onClick={onDemo} disabled={disabled}>View demo</button>
        </div>
      </div>
      <div className="mt-6 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
        <div className="icr-info-pill"><strong>Formats</strong><span>.xlsx, .xls, .csv</span></div>
        <div className="icr-info-pill"><strong>Maximum size</strong><span>15 MB</span></div>
        <div className="icr-info-pill"><strong>Data handling</strong><span>Local browser memory only</span></div>
      </div>
    </section>
  );
}
