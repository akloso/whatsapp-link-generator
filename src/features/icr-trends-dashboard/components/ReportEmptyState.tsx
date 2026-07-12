import type { ReportEmptyReason } from '../types/report';
const COPY: Record<ReportEmptyReason,{title:string;body:string;action:string}>={
  'no-workbook':{title:'Choose a workbook to begin',body:'Upload a local ICR workbook to build the private reporting layer in this browser.',action:'Use the workbook picker above.'},
  processing:{title:'Workbook processing is in progress',body:'Reporting will appear after worksheet selection, mapping, and parsing are complete.',action:'Continue the current workbook step.'},
  'zero-valid-rows':{title:'No valid report rows were parsed',body:'The selected worksheet did not produce account rows with the required client and RAG fields.',action:'Review mappings or choose another worksheet.'},
  'filtered-empty':{title:'No accounts match these filters',body:'The workbook remains loaded, but the current report filters exclude every row.',action:'Clear filters or broaden the date range.'},
  'no-latest-snapshots':{title:'Latest snapshots are unavailable',body:'Rows exist, but the report could not derive a client-level latest snapshot set.',action:'Review date and client fields, or turn off latest-only filtering.'},
  'logic-error':{title:'Report could not be calculated',body:'The parsed workbook is still in memory, but report derivation failed.',action:'Reset and parse the workbook again.'}
};
export function ReportEmptyState({reason,onClearFilters}:{reason:ReportEmptyReason;onClearFilters?:()=>void}){ const c=COPY[reason]; return <div className="icr-dashboard__empty-state" role={reason==='logic-error'?'alert':'status'}><h2 id="icr-dashboard-workspace-title">{c.title}</h2><p>{c.body}</p><p><strong>Next action:</strong> {c.action}</p>{reason==='filtered-empty'&&onClearFilters?<button type="button" className="icr-dashboard__secondary-button" onClick={onClearFilters}>Clear filters</button>:null}</div>; }
