import type { ReportFilterOptions, ReportFiltersState } from '../types';

type ReportFiltersProps = {
  filters: ReportFiltersState;
  options: ReportFilterOptions;
  onChange: (next: ReportFiltersState) => void;
  onPresetChange: (preset: ReportFiltersState['rangePreset']) => void;
};

export function ReportFilters({ filters, options, onChange, onPresetChange }: ReportFiltersProps) {
  const set = <K extends keyof ReportFiltersState>(key: K, value: ReportFiltersState[K]) => onChange({ ...filters, [key]: value });

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Report filters">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Report filters</h2>
          <p className="mt-1 text-sm text-slate-600">Filters update the report in memory without reparsing the workbook.</p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={filters.latestOnly}
            onChange={(event) => set('latestOnly', event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
          />
          Latest client snapshot
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-medium text-slate-700">
          Client
          <select className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" value={filters.clientKey} onChange={(event) => set('clientKey', event.target.value)}>
            <option value="all">All clients</option>
            {options.clients.map((client) => <option key={client.key} value={client.key}>{client.label}</option>)}
          </select>
        </label>

        <label className="text-sm font-medium text-slate-700">
          RAG
          <select className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" value={filters.rag} onChange={(event) => set('rag', event.target.value as ReportFiltersState['rag'])}>
            <option value="all">All RAG statuses</option>
            {options.rags.map((rag) => <option key={rag} value={rag}>{rag}</option>)}
          </select>
        </label>

        <label className="text-sm font-medium text-slate-700">
          CS owner
          <select className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" value={filters.owner} onChange={(event) => set('owner', event.target.value)}>
            <option value="all">All owners</option>
            {options.owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
          </select>
        </label>

        <label className="text-sm font-medium text-slate-700">
          Date range
          <select className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" value={filters.rangePreset} onChange={(event) => onPresetChange(event.target.value as ReportFiltersState['rangePreset'])}>
            <option value="all">All available dates</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="180">Last 180 days</option>
            <option value="ytd">Year to date</option>
            <option value="custom">Custom</option>
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          From
          <input type="date" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" value={filters.from} onChange={(event) => onChange({ ...filters, from: event.target.value, rangePreset: 'custom' })} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          To
          <input type="date" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" value={filters.to} onChange={(event) => onChange({ ...filters, to: event.target.value, rangePreset: 'custom' })} />
        </label>
      </div>
    </section>
  );
}
