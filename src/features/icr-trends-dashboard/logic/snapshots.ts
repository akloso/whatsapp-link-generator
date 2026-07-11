import type { NormalisedRow } from '../types/icr';
import { dateKey } from './parseDate';
export function latestByClient(rows: readonly NormalisedRow[]): NormalisedRow[] { const m=new Map<string,NormalisedRow>(); rows.forEach((r)=>{const old=m.get(r._clientKey); if(!old || dateKey(r.timestamp)>dateKey(old.timestamp)) m.set(r._clientKey,r);}); return [...m.values()]; }
