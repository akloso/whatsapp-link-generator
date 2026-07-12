export type ExportCell = string | number | boolean | null | undefined | Date;
export const EXPORT_BOM='\ufeff';
const dangerous=/^\s*[=+\-@]/;
export function safeText(value:string): string { return dangerous.test(value)?`'${value}`:value; }
export function exportCell(value:ExportCell): string|number|boolean { if(value===null||value===undefined) return ''; if(value instanceof Date) return value.toISOString().slice(0,10); if(typeof value==='string') return safeText(value); return value; }
export function safeFilename(input:string, fallback='zapora-icr-report', max=96): string { const withoutControls=[...input].filter((ch)=>{const c=ch.charCodeAt(0); return c>=32&&c!==127;}).join(''); const cleaned=withoutControls.replace(/[\\/]+/g,' ').replace(/\s+/g,' ').trim().replace(/[. ]+$/g,'').slice(0,max).trim(); return cleaned || fallback; }
export function safeWorksheetName(input:string, used=new Set<string>()): string { const base=(input.replace(/[\\/?*[\]:]+/g,' ').replace(/\s+/g,' ').trim()||'Sheet').slice(0,31); let name=base; let i=2; while(used.has(name)){ const suffix=` ${i}`; name=base.slice(0,31-suffix.length)+suffix; i+=1; } used.add(name); return name; }
export function todayStamp(now=new Date()): string { return now.toISOString().slice(0,10); }
