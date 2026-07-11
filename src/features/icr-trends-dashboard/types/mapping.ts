import type { CanonicalFieldKey } from './icr';
export type ConfidenceLevel = 'auto' | 'review' | 'ignore' | 'ambiguous' | 'duplicate';
export interface MappingCandidate { sourceHeader: string; key: CanonicalFieldKey | ''; score: number; status: ConfidenceLevel; alternatives?: Array<{ key: CanonicalFieldKey; score: number }> }
export type HeaderMapping = Readonly<Record<string, MappingCandidate>>;
