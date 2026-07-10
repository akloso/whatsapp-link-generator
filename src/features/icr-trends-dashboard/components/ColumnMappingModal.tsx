import { useEffect } from 'react';
import { FIELD_BY_KEY, FIELD_DEFS } from '../constants/fieldDefinitions';
import { duplicateMappingTargets, requiredMappingsReady, validateMapping } from '../logic/columnMapping';
import { truncateCell } from '../logic/normalize';
import type { ColumnMapping, FieldKey, RawRow } from '../types';

type Props = {
  isOpen: boolean;
  headers: string[];
  rawRows: RawRow[];
  mapping: ColumnMapping;
  onClose: () => void;
  onChange: (header: string, key: FieldKey | '') => void;
  onParse: () => void;
};

const sampleFor = (rows: RawRow[], header: string) => truncateCell(rows.slice(0, 20).map((row) => row[header]).find((value) => truncateCell(value)), 1000) || 'No sample value';

export function ColumnMappingModal({ isOpen, headers, rawRows, mapping, onClose, onChange, onParse }: Props) {
  const duplicates = duplicateMappingTargets(mapping);
  const validation = validateMapping(mapping);
  const blockingErrors = validation.filter((message) => !message.startsWith('Timestamp'));
  const canParse = requiredMappingsReady(mapping) && duplicates.length === 0;

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="icr-modal-backdrop" role="presentation">
      <section className="icr-mapping-modal" role="dialog" aria-modal="true" aria-labelledby="icr-mapping-title">
        <header className="icr-modal-header">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">Column mapping</p>
            <h2 id="icr-mapping-title" className="mt-1 text-xl font-bold text-slate-950">Review mapped columns</h2>
            <p className="mt-1 text-sm text-slate-600">Required fields are Client name and RAG status. Timestamp is recommended for date-ready reporting.</p>
          </div>
          <button className="icr-ghost-button" type="button" onClick={onClose}>Close</button>
        </header>

        {validation.length ? (
          <div className="mx-4 mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:mx-6" aria-live="polite">
            <ul className="list-disc space-y-1 pl-5">
              {validation.map((message) => <li key={message}>{message}</li>)}
            </ul>
          </div>
        ) : null}

        <div className="icr-mapping-list">
          {headers.map((header) => {
            const entry = mapping[header] ?? { key: '', score: 0, status: 'ignore' as const };
            const duplicate = entry.key && duplicates.includes(entry.key);
            return (
              <div className="icr-mapping-row" key={header}>
                <div className="min-w-0">
                  <div className="break-words text-sm font-semibold text-slate-900">{header}</div>
                  <div className="mt-1 break-words text-xs text-slate-500">Sample: {sampleFor(rawRows, header)}</div>
                </div>
                <label className="min-w-0 text-sm font-medium text-slate-700">
                  ICR meaning
                  <select className="icr-select mt-1" value={entry.key} onChange={(event) => onChange(header, event.target.value as FieldKey | '')}>
                    <option value="">Ignore / keep as raw</option>
                    {FIELD_DEFS.map((field) => (
                      <option key={field.key} value={field.key}>{field.label}{field.required ? ' *' : ''}</option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-col items-start gap-2">
                  <span className={`icr-status-badge ${entry.status === 'review' ? 'is-review' : ''}`}>{entry.status === 'auto' ? 'Matched' : entry.status === 'review' ? 'Review' : 'Ignored'}</span>
                  {duplicate && entry.key ? <span className="text-xs font-medium text-red-700">Duplicate {FIELD_BY_KEY[entry.key].label}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
        <footer className="icr-modal-footer">
          <button className="icr-secondary-button" type="button" onClick={onClose}>Continue reviewing later</button>
          <button className="icr-primary-button" type="button" onClick={onParse} disabled={!canParse || blockingErrors.length > 0}>Parse data</button>
        </footer>
      </section>
    </div>
  );
}
