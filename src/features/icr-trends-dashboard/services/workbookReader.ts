import type { RawRow, SourceType, WorksheetInfo } from '../types';
import { chooseBestWorksheet, headersFromRows, MAX_COLUMNS, MAX_ROWS, MAX_WORKSHEETS } from '../logic/worksheetDetection';

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;
export const SUPPORTED_EXTENSIONS = ['xlsx', 'xls', 'csv'] as const;

export type WorkbookHandle = {
  sheetNames: string[];
  readRows: (sheetName: string) => RawRow[];
};

export type WorkbookReadResult = {
  workbook: WorkbookHandle;
  worksheets: WorksheetInfo[];
  selectedWorksheet: string;
  rawRows: RawRow[];
  headers: string[];
  warnings: string[];
  sourceType: SourceType;
};

export const getSourceType = (fileName: string): SourceType => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  return extension === 'xlsx' || extension === 'xls' || extension === 'csv' ? extension : '';
};

export const validateWorkbookFile = (file: File): SourceType => {
  const sourceType = getSourceType(file.name);
  if (!sourceType) throw new Error('Unsupported file type. Upload an .xlsx, .xls, or .csv file.');
  if (file.size > MAX_FILE_SIZE_BYTES) throw new Error('File is too large. Upload a workbook up to 15 MB.');
  if (file.size === 0) throw new Error('The selected file is empty.');
  return sourceType;
};

const sanitizeRows = (rows: RawRow[]): RawRow[] => rows.slice(0, MAX_ROWS).map((row) => {
  const entries = Object.entries(row).slice(0, MAX_COLUMNS);
  return Object.fromEntries(entries);
});

export const readWorkbook = async (file: File): Promise<WorkbookReadResult> => {
  const sourceType = validateWorkbookFile(file);
  let XLSX: typeof import('xlsx');
  try {
    XLSX = await import('xlsx');
  } catch {
    throw new Error('Spreadsheet module could not be loaded. Please refresh and try again.');
  }

  const arrayBuffer = await file.arrayBuffer();
  let workbook: import('xlsx').WorkBook;
  try {
    workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  } catch {
    throw new Error('The workbook could not be read. Check the file and try again.');
  }

  if (!workbook.SheetNames.length) throw new Error('The workbook does not contain any worksheets.');
  const warnings: string[] = [];
  const sheetNames = workbook.SheetNames.slice(0, MAX_WORKSHEETS);
  if (workbook.SheetNames.length > MAX_WORKSHEETS) warnings.push(`Only the first ${MAX_WORKSHEETS} worksheets were inspected.`);

  const handle: WorkbookHandle = {
    sheetNames,
    readRows: (sheetName) => sanitizeRows(XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null, raw: false }).slice(0, MAX_ROWS) as RawRow[]),
  };

  const candidates = sheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const ref = sheet?.['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : null;
    const estimatedRows = ref ? Math.max(0, ref.e.r) : 0;
    const rows = sanitizeRows(XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false }) as RawRow[]);
    return { name, rows, estimatedRows };
  });
  const { best, inspected } = chooseBestWorksheet(candidates);
  if (!best) throw new Error('No readable worksheet was found.');

  const selectedWorksheet = best.name;
  const rawRows = handle.readRows(selectedWorksheet);
  if (!rawRows.length) throw new Error('The selected worksheet has no data rows.');
  if ((candidates.find((candidate) => candidate.name === selectedWorksheet)?.estimatedRows ?? rawRows.length) > MAX_ROWS) warnings.push(`More than ${MAX_ROWS.toLocaleString()} rows were detected. Only the first ${MAX_ROWS.toLocaleString()} rows were parsed.`);
  const headers = headersFromRows(rawRows);
  if (Object.keys(rawRows[0] ?? {}).length > MAX_COLUMNS) warnings.push(`More than ${MAX_COLUMNS} columns were detected. Only the first ${MAX_COLUMNS} columns were parsed.`);

  return { workbook: handle, worksheets: inspected, selectedWorksheet, rawRows, headers, warnings, sourceType };
};

export const loadWorksheetRows = (workbook: WorkbookHandle, worksheetName: string): { rawRows: RawRow[]; headers: string[] } => {
  const rawRows = workbook.readRows(worksheetName);
  if (!rawRows.length) throw new Error('The selected worksheet has no data rows.');
  return { rawRows, headers: headersFromRows(rawRows) };
};
