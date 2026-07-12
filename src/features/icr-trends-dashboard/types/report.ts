import type { HealthScoreResult, IcrFilters, NormalisedRow, RagStatus } from './icr';

export type ReportEmptyReason = 'no-workbook' | 'processing' | 'zero-valid-rows' | 'filtered-empty' | 'no-latest-snapshots' | 'logic-error';
export type ReportSortKey = 'priority' | 'clientName' | 'owner' | 'timestamp' | 'health' | 'rag' | 'recommendation' | 'tickets' | 'status';
export interface ReportSortState { key: ReportSortKey; direction: 'asc' | 'desc' }
export interface ReportFilterState extends IcrFilters { recommendation?: 'actionable' | 'informational'; search?: string }
export interface ReportFilterOptions { clients: Array<{value:string;label:string}>; rags: RagStatus[]; owners: string[]; statuses: string[]; recommendations: Array<{value:'actionable'|'informational';label:string}> }
export interface PortfolioSummary { accountCount: number; snapshotCount: number; averageHealth: number | null; accountsNeedingAction: number; unresolvedRecommendationCount: number; ownerCoverage: { covered: number; total: number; percent: number | null }; dataQualityIssueCount: number }
export type HealthDistribution = Record<HealthScoreResult['category'], number>;
export interface RecommendationSummary { total: number; actionable: number; informational: number; themes: Array<{label:string;count:number}> }
export interface AccountPriorityRow { row: NormalisedRow; clientKey: string; clientName: string; owner: string; timestamp: Date | null; health: number; category: HealthScoreResult['category']; rag: RagStatus; recommendation: string; actionable: boolean; opportunity: string; tickets: number | null; status: string; priorityRank: number }
export interface ReportViewState { filters: ReportFilterState; sort: ReportSortState; filteredRows: NormalisedRow[]; latestRows: NormalisedRow[]; priorityRows: AccountPriorityRow[]; summary: PortfolioSummary; healthDistribution: HealthDistribution; recommendationSummary: RecommendationSummary; emptyReason: ReportEmptyReason | null; activeFilterCount: number }
