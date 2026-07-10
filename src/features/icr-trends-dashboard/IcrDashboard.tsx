import { useEffect, useMemo, useRef, useState } from 'react';
import { DEMO_ROWS } from './constants/demoRows';
import { autoMap, validateMapping } from './logic/columnMapping';
import { filterRows, makeDefaultFilters, makeFilterOptions, rangeForPreset } from './logic/filters';
import { analyzeRows } from './logic/metrics';
import { parseRows } from './logic/rowParser';
import { headersFromRows } from './logic/worksheetDetection';
import { getSourceType, loadWorksheetRows, readWorkbook, type WorkbookHandle } from './services/workbookReader';
import { useIcrDashboardReducer } from './hooks/useIcrDashboardReducer';
import { ColumnMappingModal } from './components/ColumnMappingModal';
import { ExecutiveReport } from './components/ExecutiveReport';
import { IcrEmptyState } from './components/IcrEmptyState';
import { IcrToast } from './components/IcrToast';
import { ParsedDataSummary } from './components/ParsedDataSummary';
import { ProcessingOverlay } from './components/ProcessingOverlay';
import { ReportFilters } from './components/ReportFilters';
import { WorkbookUpload } from './components/WorkbookUpload';
import { WorksheetSelector } from './components/WorksheetSelector';
import type { FieldKey, ReportFiltersState } from './types';

const safeError = (error: unknown): string => error instanceof Error ? error.message : 'Something went wrong while preparing the workbook.';
const busyStatuses = ['reading-file', 'inspecting-workbook', 'parsing-data'];
const EMPTY_FILTERS: ReportFiltersState = { clientKey: 'all', rag: 'all', owner: 'all', rangePreset: 'all', from: '', to: '', latestOnly: false };

export function IcrDashboard() {
  const [state, dispatch] = useIcrDashboardReducer();
  const [toast, setToast] = useState('');
  const [filters, setFilters] = useState<ReportFiltersState>(EMPTY_FILTERS);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workbookRef = useRef<WorkbookHandle | null>(null);

  const isBusy = busyStatuses.includes(state.status);
  const mappingReviewNeeded = useMemo(() => Object.values(state.mapping).some((entry) => entry.status === 'review'), [state.mapping]);
  const analyzedRows = useMemo(() => analyzeRows(state.parsedRows), [state.parsedRows]);
  const filterOptions = useMemo(() => makeFilterOptions(analyzedRows), [analyzedRows]);
  const filteredRows = useMemo(() => filterRows(analyzedRows, filters), [analyzedRows, filters]);

  useEffect(() => {
    setFilters(analyzedRows.length ? makeDefaultFilters(analyzedRows) : EMPTY_FILTERS);
  }, [analyzedRows]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3600);
  };

  const parseCurrentRows = (mapping = state.mapping) => {
    const validation = validateMapping(mapping);
    const blocking = validation.filter((message) => !message.startsWith('Timestamp'));
    if (blocking.length) {
      dispatch({ type: 'SET_ERROR', error: blocking[0] });
      return;
    }
    try {
      dispatch({ type: 'PARSE_START' });
      const parsed = parseRows(state.rawRows, mapping);
      dispatch({ type: 'PARSE_SUCCESS', parsedRows: parsed.result, validationIssues: parsed.issues, warnings: validation.filter((message) => message.startsWith('Timestamp')) });
      notify('Workbook parsed locally. Executive report generated.');
    } catch {
      dispatch({ type: 'SET_ERROR', error: 'Rows could not be parsed. Review the mapping and try again.' });
    }
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    const sourceType = getSourceType(file.name);
    dispatch({ type: 'START_FILE_READ', sourceName: file.name, sourceType });
    try {
      dispatch({ type: 'FILE_READ_SUCCESS', sourceName: file.name, sourceType, message: 'Inspecting worksheets locally…' });
      const result = await readWorkbook(file);
      workbookRef.current = result.workbook;
      const mapping = autoMap(result.headers);
      dispatch({ type: 'WORKBOOK_INSPECTED', worksheets: result.worksheets, selectedWorksheet: result.selectedWorksheet, rawRows: result.rawRows, headers: result.headers, mapping, warnings: result.warnings });
      notify('Workbook inspected. Review mapping, then parse the selected worksheet.');
    } catch (error) {
      workbookRef.current = null;
      dispatch({ type: 'SET_ERROR', error: safeError(error) });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleWorksheetSelect = (worksheetName: string) => {
    if (!workbookRef.current) return;
    try {
      const { rawRows, headers } = loadWorksheetRows(workbookRef.current, worksheetName);
      const mapping = autoMap(headers);
      dispatch({ type: 'SELECT_WORKSHEET', selectedWorksheet: worksheetName, rawRows, headers, mapping });
      notify('Worksheet switched. Review mapping before parsing.');
    } catch {
      dispatch({ type: 'SET_ERROR', error: 'The selected worksheet could not be loaded.' });
    }
  };

  const loadDemo = () => {
    workbookRef.current = null;
    const rawRows = [...DEMO_ROWS];
    const headers = headersFromRows(rawRows);
    const mapping = autoMap(headers);
    const parsed = parseRows(rawRows, mapping);
    dispatch({ type: 'LOAD_DEMO', rawRows, headers, mapping, parsedRows: parsed.result, validationIssues: parsed.issues, warnings: ['Fictional and synthetic demo data. No workbook library was loaded.'] });
    notify('Loaded fictional demo data and generated the Executive Report.');
  };

  const clearData = () => {
    workbookRef.current = null;
    setFilters(EMPTY_FILTERS);
    dispatch({ type: 'CLEAR_DATA' });
    if (fileInputRef.current) fileInputRef.current.value = '';
    notify('ICR workbook data cleared from memory.');
  };

  const handlePresetChange = (preset: ReportFiltersState['rangePreset']) => {
    if (preset === 'custom') {
      setFilters((current) => ({ ...current, rangePreset: preset }));
      return;
    }
    const range = rangeForPreset(preset, analyzedRows);
    setFilters((current) => ({ ...current, rangePreset: preset, ...range }));
  };

  return (
    <main className="icr-dashboard bg-slate-50" aria-busy={isBusy}>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-3xl border border-violet-100 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-600">Internal noindex workspace</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">ICR Trends Dashboard</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
            Upload an ICR Excel or CSV workbook to detect the relevant worksheet, review column mapping, and generate an executive portfolio report.
          </p>
          <p className="mt-4 inline-flex rounded-full bg-violet-50 px-4 py-2 text-sm font-medium text-violet-900">
            Your workbook is processed locally in this browser and is not uploaded to Zapora servers.
          </p>
        </div>

        <div className="space-y-5">
          <WorkbookUpload state={state} inputRef={fileInputRef} onFileChange={handleFile} onUploadClick={() => fileInputRef.current?.click()} onDemo={loadDemo} onClear={clearData} />

          {state.status === 'idle' ? <IcrEmptyState onUpload={() => fileInputRef.current?.click()} onDemo={loadDemo} disabled={isBusy} /> : null}

          {state.error ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">
              <strong>Workbook could not be prepared.</strong> {state.error}
            </div>
          ) : null}

          {state.warnings.length && state.status !== 'ready' ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
              <strong>Warnings:</strong>
              <ul className="mt-2 list-disc pl-5">{state.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </div>
          ) : null}

          {state.worksheets.length ? <WorksheetSelector worksheets={state.worksheets} selectedWorksheet={state.selectedWorksheet} onSelect={handleWorksheetSelect} disabled={isBusy} /> : null}

          {state.headers.length && state.status !== 'ready' ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Column mapping ready</h2>
                  <p className="mt-1 text-sm text-slate-600">{Object.values(state.mapping).filter((entry) => entry.key).length} canonical fields mapped from {state.headers.length} detected columns. {mappingReviewNeeded ? 'Some mappings need review.' : 'Automatic mapping looks ready.'}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button className="icr-secondary-button" type="button" onClick={() => dispatch({ type: 'OPEN_MAPPING' })}>Review mapping</button>
                  <button className="icr-primary-button" type="button" onClick={() => parseCurrentRows()}>Generate report</button>
                </div>
              </div>
            </section>
          ) : null}

          <ParsedDataSummary state={state} onReviewMapping={() => dispatch({ type: 'OPEN_MAPPING' })} onClear={clearData} />

          {state.status === 'ready' ? (
            <>
              <ReportFilters filters={filters} options={filterOptions} onChange={setFilters} onPresetChange={handlePresetChange} />
              <ExecutiveReport rows={filteredRows} sourceName={state.sourceName} />
            </>
          ) : null}
        </div>
      </section>

      <ColumnMappingModal
        isOpen={state.isMappingOpen}
        headers={state.headers}
        rawRows={state.rawRows}
        mapping={state.mapping}
        onClose={() => dispatch({ type: 'CLOSE_MAPPING' })}
        onChange={(header, key: FieldKey | '') => dispatch({ type: 'UPDATE_MAPPING', header, key })}
        onParse={() => parseCurrentRows()}
      />
      <ProcessingOverlay active={isBusy} message={state.processingMessage} />
      <IcrToast message={toast} />
    </main>
  );
}
