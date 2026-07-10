export type FieldType = 'date' | 'text' | 'status' | 'pair' | 'number' | 'rag';

export type FieldKey =
  | 'timestamp' | 'email' | 'clientName' | 'clientId' | 'lastMeeting' | 'lastTraining' | 'lastReport' | 'lastQbr'
  | 'trackingStatus' | 'flowStatus' | 'leadPair' | 'unassignedPair' | 'referralLeads' | 'notMappedLeads'
  | 'paidPair' | 'overdue' | 'untouched' | 'widgetPair' | 'userPair' | 'emailPair' | 'smsPair'
  | 'whatsappPair' | 'niaaPair' | 'rawPair' | 'queryPair' | 'applicationGrowth' | 'rag' | 'opportunity'
  | 'actionable' | 'owner' | 'manager' | 'unassignedReason' | 'notDelivered' | 'notUtilised' | 'tickets'
  | 'negativeFeedback' | 'metsBalance' | 'callStatus' | 'emailStatus';

export type FieldDefinition = Readonly<{
  key: FieldKey;
  label: string;
  type: FieldType;
  required?: boolean;
  aliases: readonly string[];
}>;

export type RawRow = Record<string, unknown>;

export type MappingStatus = 'auto' | 'review' | 'ignore';

export type MappingEntry = {
  key: FieldKey | '';
  score: number;
  status: MappingStatus;
};

export type ColumnMapping = Record<string, MappingEntry>;

export type ParsedPair = {
  a: number | null;
  b: number | null;
  count: number;
  ambiguous: boolean;
};

export type RagStatus = 'Green' | 'Amber' | 'Red' | 'Unknown';

export type ValidationSeverity = 'warning' | 'error';

export type ValidationIssue = {
  row: number;
  field: FieldKey | 'workbook';
  message: string;
  severity: ValidationSeverity;
};

export type ParsedRow = {
  _row: number;
  _raw: RawRow;
  _custom: Record<string, number>;
  _warnings: ValidationIssue[];
  _clientKey: string;
  dataConfidence: number;
  timestamp: Date | null;
  clientName: string;
  clientId: string;
  rag: RagStatus;
  owner: string;
  manager: string;
  leads: number | null;
  subscribedLeads: number | null;
  unassigned: number | null;
  unassignedApps: number | null;
  referralLeads: number | null;
  notMappedLeads: number | null;
  paidApplications: number | null;
  applicationCapping: number | null;
  overdue: number | null;
  untouched: number | null;
  activeWidgets: number | null;
  subscribedWidgets: number | null;
  activeUsers: number | null;
  subscribedUsers: number | null;
  emailConsumed: number | null;
  emailLeft: number | null;
  smsConsumed: number | null;
  smsLeft: number | null;
  whatsappConsumed: number | null;
  whatsappLeft: number | null;
  niaaConsumed: number | null;
  niaaLeft: number | null;
  activeRaw: number | null;
  subscribedRaw: number | null;
  openQueries: number | null;
  unassignedQueries: number | null;
  leadUtil: number | null;
  unassignedRate: number | null;
  untouchedRate: number | null;
  overdueRate: number | null;
  widgetAdoption: number | null;
  userAdoption: number | null;
  rawAdoption: number | null;
};

export type WorksheetInfo = {
  name: string;
  estimatedRows: number;
  columnCount: number;
  score: number;
  recommendation: 'Recommended' | 'Viable' | 'Low confidence';
  warnings: string[];
};

export type SourceType = 'demo' | 'xlsx' | 'xls' | 'csv' | '';

export type IcrWorkflowStatus =
  | 'idle'
  | 'reading-file'
  | 'inspecting-workbook'
  | 'selecting-sheet'
  | 'mapping-columns'
  | 'parsing-data'
  | 'ready'
  | 'error';

export type IcrDashboardState = {
  status: IcrWorkflowStatus;
  sourceName: string;
  sourceType: SourceType;
  worksheets: WorksheetInfo[];
  selectedWorksheet: string;
  rawRows: RawRow[];
  headers: string[];
  mapping: ColumnMapping;
  parsedRows: ParsedRow[];
  validationIssues: ValidationIssue[];
  processingMessage: string;
  warnings: string[];
  error: string;
  isMappingOpen: boolean;
};
