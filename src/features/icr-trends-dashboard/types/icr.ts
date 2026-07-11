export type CanonicalFieldKey =
  | 'timestamp' | 'email' | 'clientName' | 'clientId' | 'lastMeeting' | 'lastTraining' | 'lastReport' | 'lastQbr'
  | 'trackingStatus' | 'flowStatus' | 'leadPair' | 'unassignedPair' | 'referralLeads' | 'notMappedLeads'
  | 'paidPair' | 'overdue' | 'untouched' | 'widgetPair' | 'userPair' | 'emailPair' | 'smsPair'
  | 'whatsappPair' | 'niaaPair' | 'rawPair' | 'queryPair' | 'applicationGrowth' | 'rag' | 'opportunity'
  | 'actionable' | 'owner' | 'manager' | 'unassignedReason' | 'notDelivered' | 'notUtilised' | 'tickets'
  | 'negativeFeedback' | 'metsBalance' | 'callStatus' | 'emailStatus';
export type FieldValueCategory = 'date' | 'text' | 'number' | 'pair' | 'rag' | 'status';
export type RagStatus = 'Red' | 'Amber' | 'Purple' | 'Green' | 'Unknown';
export type RawRow = Readonly<Record<string, unknown>>;
export interface ParseDiagnostic { code: string; message: string; rawValue?: unknown }
export type ParseResult<T> = { ok: true; value: T; diagnostics: ParseDiagnostic[] } | { ok: false; value: null; diagnostics: ParseDiagnostic[] };
export interface PairValue { a: number | null; b: number | null; count: number; ambiguous: boolean }
export interface DataQualityIssue { type: string; row?: number; client?: string; field?: CanonicalFieldKey | string; rawValue?: unknown; issue: string; resolution: string }
export interface NormalisedRow {
  readonly _row: number; readonly _raw: RawRow; readonly _clientKey: string; readonly _warnings: readonly DataQualityIssue[]; readonly _custom: Readonly<Record<string, number>>;
  readonly timestamp: Date | null; readonly clientName: string; readonly clientId: string; readonly rag: RagStatus; readonly owner: string; readonly manager: string;
  readonly trackingStatus: string; readonly flowStatus: string; readonly opportunity: string; readonly actionable: string;
  readonly leadPair: PairValue | null; readonly unassignedPair: PairValue | null; readonly paidPair: PairValue | null; readonly widgetPair: PairValue | null; readonly userPair: PairValue | null; readonly rawPair: PairValue | null; readonly queryPair: PairValue | null; readonly emailPair: PairValue | null; readonly smsPair: PairValue | null; readonly whatsappPair: PairValue | null; readonly niaaPair: PairValue | null;
  readonly leads: number | null; readonly subscribedLeads: number | null; readonly unassigned: number | null; readonly untouched: number | null; readonly overdue: number | null; readonly activeWidgets: number | null; readonly subscribedWidgets: number | null; readonly activeUsers: number | null; readonly subscribedUsers: number | null; readonly activeRaw: number | null; readonly subscribedRaw: number | null; readonly tickets: number | null;
  readonly emailConsumed: number | null; readonly smsConsumed: number | null; readonly whatsappConsumed: number | null; readonly niaaConsumed: number | null;
  readonly leadUtil: number | null; readonly unassignedRate: number | null; readonly untouchedRate: number | null; readonly overdueRate: number | null; readonly widgetAdoption: number | null; readonly userAdoption: number | null; readonly rawAdoption: number | null; readonly dtcPlaced: boolean | null; readonly health: number; readonly recommendation: string;
}
export interface HealthScoreResult { score: number; category: 'Critical' | 'Watch' | 'Stable' | 'Strong'; appliedRules: readonly string[] }
export interface RecommendationResult { text: string; messages: readonly string[] }
export interface IcrFilters { clientKey?: string; rag?: RagStatus; owner?: string; status?: string; from?: Date; to?: Date; latestOnly?: boolean }
export interface ChartSeries { labels: string[]; values?: number[]; series?: Array<{ label: string; values: number[] }>; summary: string }
