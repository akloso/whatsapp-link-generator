import type { DateRangePreset, RagStatus, ReportFilterOptions, ReportFiltersState } from '../types';
import { presetLabel } from '../logic/filters';

type Props = { filters: ReportFiltersState; options: ReportFilterOptions; resultCount: number; rangeLabel: string; error: string; onChange: (filters: ReportFiltersState) => void };
const presets: DateRangePreset[] = ['all', '30', '90', '180', 'ytd', 'custom'];
const rags: Array<RagStatus | 'all'> = ['all', 'Green', 'Amber', 'Red', 'Unknown'];

export function ReportFilters({ filters, options, resultCount, rangeLabel, error, onChange }: Props) {
  const update = <K extends keyof ReportFiltersState>(key: K, value: ReportFiltersState[K]) => onChange({ ...filters, [key]: value });
  const custom = filters.rangePreset === 'custom';
  return <section className="icr-report-filters" aria-labelledby="icr-filter-title">
    <div className="icr-report-filters__head"><div><h2 id="icr-filter-title">Report filters</h2><p>{rangeLabel}. {resultCount.toLocaleString()} row{resultCount === 1 ? '' : 's'} selected.</p></div>{error ? <p className="icr-filter-error" role="alert">{error}</p> : null}</div>
    <div className="icr-filter-grid">
      <label>Client<select value={filters.clientKey} onChange={(e) => update('clientKey', e.target.value)}><option value="all">All clients</option>{options.clients.map((client) => <option key={client.key} value={client.key}>{client.label}</option>)}</select></label>
      <label>RAG<select value={filters.rag} onChange={(e) => update('rag', e.target.value as ReportFiltersState['rag'])}>{rags.map((rag) => <option key={rag} value={rag}>{rag === 'all' ? 'All RAG statuses' : rag}</option>)}</select></label>
      <label>CS owner<select value={filters.owner} onChange={(e) => update('owner', e.target.value)}><option value="all">All owners</option>{options.owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}</select></label>
      <label>Date preset<select value={filters.rangePreset} onChange={(e) => update('rangePreset', e.target.value as DateRangePreset)}>{presets.map((preset) => <option key={preset} value={preset}>{presetLabel(preset)}</option>)}</select></label>
      <label>From date<input type="date" value={filters.from} disabled={!custom} onChange={(e) => update('from', e.target.value)} /></label>
      <label>To date<input type="date" value={filters.to} disabled={!custom} onChange={(e) => update('to', e.target.value)} /></label>
      <label className="icr-checkbox"><input type="checkbox" checked={filters.latestOnly} onChange={(e) => update('latestOnly', e.target.checked)} /><span>Latest client snapshot</span></label>
    </div>
  </section>;
}
