import type { CanonicalFieldKey, DataQualityIssue, NormalisedRow, RawRow } from './icr';
import type { HeaderMapping, MappingCandidate } from './mapping';
import type { WorksheetScore } from './workbook';

export const WORKBOOK_SIZE_LIMIT_BYTES = 15 * 1024 * 1024;
export const SUPPORTED_WORKBOOK_EXTENSIONS = ['.xlsx', '.xls', '.xlsm'] as const;
export type SupportedWorkbookExtension = typeof SUPPORTED_WORKBOOK_EXTENSIONS[number];

export type WorkbookValidationErrorCode = 'missing-file' | 'missing-name' | 'unsupported-extension' | 'empty-file' | 'file-too-large' | 'invalid-size';
export interface WorkbookValidationError { code: WorkbookValidationErrorCode; message: string; }
export interface WorkbookFileMetadata { name: string; size: number; extension: SupportedWorkbookExtension; lastModified?: number; }
export type WorkbookValidationResult = { ok: true; file: WorkbookFileMetadata } | { ok: false; error: WorkbookValidationError };

export type WorkbookReadErrorCode = 'empty-workbook' | 'no-visible-worksheets' | 'empty-worksheet' | 'malformed-workbook' | 'unsupported-workbook' | 'read-failure';
export interface WorkbookReadError { code: WorkbookReadErrorCode; message: string; cause?: unknown; }
export interface WorkbookSheetData { name: string; index: number; hidden: boolean; rows: unknown[][]; rowCount: number; nonEmptyRowCount: number; }
export interface BrowserWorkbook { metadata: WorkbookFileMetadata; sheetNames: string[]; sheets: WorkbookSheetData[]; warnings: DataQualityIssue[]; }

export interface SourceHeader { columnIndex: number; label: string; normalisedLabel: string; examples: string[]; candidate?: MappingCandidate; }
export interface WorksheetCandidate { name: string; index: number; rowCount: number; nonEmptyRowCount: number; headerRowIndex: number | null; headers: SourceHeader[]; score: WorksheetScore; valid: boolean; rows: unknown[][]; }
export type ColumnMappingState = Partial<Record<CanonicalFieldKey, string>>;
export interface ParseProgress { processedRows: number; totalRows: number; skippedRows: number; }
export interface ParseResultSummary { rows: NormalisedRow[]; issues: DataQualityIssue[]; skippedRows: number; mappedColumnCount: number; mapping: HeaderMapping; sourceRows: RawRow[]; }
