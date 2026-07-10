import { useReducer } from 'react';
import type { ColumnMapping, IcrDashboardState, ParsedRow, RawRow, SourceType, ValidationIssue, WorksheetInfo } from '../types';

export const initialIcrDashboardState: IcrDashboardState = {
  status: 'idle',
  sourceName: '',
  sourceType: '',
  worksheets: [],
  selectedWorksheet: '',
  rawRows: [],
  headers: [],
  mapping: {},
  parsedRows: [],
  validationIssues: [],
  processingMessage: '',
  warnings: [],
  error: '',
  isMappingOpen: false,
};

type StartFileReadAction = { type: 'START_FILE_READ'; sourceName: string; sourceType: SourceType };
type FileReadSuccessAction = { type: 'FILE_READ_SUCCESS'; sourceName: string; sourceType: SourceType; message: string };
type WorkbookInspectedAction = { type: 'WORKBOOK_INSPECTED'; worksheets: WorksheetInfo[]; selectedWorksheet: string; rawRows: RawRow[]; headers: string[]; mapping: ColumnMapping; warnings: string[] };
type SelectWorksheetAction = { type: 'SELECT_WORKSHEET'; selectedWorksheet: string; rawRows: RawRow[]; headers: string[]; mapping: ColumnMapping; warnings?: string[] };
type OpenMappingAction = { type: 'OPEN_MAPPING' };
type CloseMappingAction = { type: 'CLOSE_MAPPING' };
type UpdateMappingAction = { type: 'UPDATE_MAPPING'; header: string; key: ColumnMapping[string]['key'] };
type ParseStartAction = { type: 'PARSE_START' };
type ParseSuccessAction = { type: 'PARSE_SUCCESS'; parsedRows: ParsedRow[]; validationIssues: ValidationIssue[]; warnings?: string[] };
type SetErrorAction = { type: 'SET_ERROR'; error: string };
type ClearDataAction = { type: 'CLEAR_DATA' };
type LoadDemoAction = { type: 'LOAD_DEMO'; rawRows: RawRow[]; headers: string[]; mapping: ColumnMapping; parsedRows: ParsedRow[]; validationIssues: ValidationIssue[]; warnings: string[] };

export type IcrDashboardAction =
  | StartFileReadAction
  | FileReadSuccessAction
  | WorkbookInspectedAction
  | SelectWorksheetAction
  | OpenMappingAction
  | CloseMappingAction
  | UpdateMappingAction
  | ParseStartAction
  | ParseSuccessAction
  | SetErrorAction
  | ClearDataAction
  | LoadDemoAction;

export const icrDashboardReducer = (state: IcrDashboardState, action: IcrDashboardAction): IcrDashboardState => {
  switch (action.type) {
    case 'START_FILE_READ':
      return { ...initialIcrDashboardState, status: 'reading-file', sourceName: action.sourceName, sourceType: action.sourceType, processingMessage: 'Reading workbook locally…' };
    case 'FILE_READ_SUCCESS':
      return { ...state, status: 'inspecting-workbook', sourceName: action.sourceName, sourceType: action.sourceType, processingMessage: action.message };
    case 'WORKBOOK_INSPECTED':
      return { ...state, status: 'mapping-columns', worksheets: action.worksheets, selectedWorksheet: action.selectedWorksheet, rawRows: action.rawRows, headers: action.headers, mapping: action.mapping, warnings: action.warnings, parsedRows: [], validationIssues: [], processingMessage: '', isMappingOpen: Object.values(action.mapping).some((entry) => entry.status === 'review') };
    case 'SELECT_WORKSHEET':
      return { ...state, status: 'mapping-columns', selectedWorksheet: action.selectedWorksheet, rawRows: action.rawRows, headers: action.headers, mapping: action.mapping, parsedRows: [], validationIssues: [], warnings: action.warnings ?? state.warnings, isMappingOpen: Object.values(action.mapping).some((entry) => entry.status === 'review') };
    case 'OPEN_MAPPING':
      return { ...state, isMappingOpen: true };
    case 'CLOSE_MAPPING':
      return { ...state, isMappingOpen: false };
    case 'UPDATE_MAPPING': {
      const nextMapping: ColumnMapping = { ...state.mapping, [action.header]: { key: action.key, score: action.key ? 1 : 0, status: action.key ? 'auto' : 'ignore' } };
      return { ...state, mapping: nextMapping };
    }
    case 'PARSE_START':
      return { ...state, status: 'parsing-data', processingMessage: 'Parsing rows in this browser…', error: '' };
    case 'PARSE_SUCCESS':
      return { ...state, status: 'ready', parsedRows: action.parsedRows, validationIssues: action.validationIssues, warnings: action.warnings ?? state.warnings, processingMessage: '', isMappingOpen: false };
    case 'SET_ERROR':
      return { ...state, status: 'error', error: action.error, processingMessage: '', isMappingOpen: false };
    case 'CLEAR_DATA':
      return initialIcrDashboardState;
    case 'LOAD_DEMO':
      return { ...initialIcrDashboardState, status: 'ready', sourceName: 'Northstar Academy (Demo)', sourceType: 'demo', selectedWorksheet: 'Fictional demo data', worksheets: [{ name: 'Fictional demo data', estimatedRows: action.rawRows.length, columnCount: action.headers.length, score: 100, recommendation: 'Recommended', warnings: [] }], rawRows: action.rawRows, headers: action.headers, mapping: action.mapping, parsedRows: action.parsedRows, validationIssues: action.validationIssues, warnings: action.warnings };
    default:
      return state;
  }
};

export const useIcrDashboardReducer = () => useReducer(icrDashboardReducer, initialIcrDashboardState);
