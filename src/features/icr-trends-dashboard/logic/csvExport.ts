import { EXPORT_BOM, exportCell, type ExportCell } from './exportSanitizers';
export interface ExportTable { name:string; headers:string[]; rows: ExportCell[][] }
const quote=(value:ExportCell)=>{ const cell=exportCell(value); const text=String(cell); return /[",\r\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text; };
export function tableToCsv(table: ExportTable, bom=true): string { const lines=[table.headers.map(quote).join(','),...table.rows.map((row)=>row.map(quote).join(','))]; return `${bom?EXPORT_BOM:''}${lines.join('\r\n')}\r\n`; }
