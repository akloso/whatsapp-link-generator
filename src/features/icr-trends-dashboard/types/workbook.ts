import type { HeaderMapping } from './mapping';
export interface WorksheetMetadata { name: string; headers: readonly unknown[]; rowCount: number; nonEmptyRowCount?: number; index?: number }
export interface WorksheetScore { name: string; score: number; valid: boolean; mappedCount: number; mapping: HeaderMapping; reasons: readonly string[]; index: number }
