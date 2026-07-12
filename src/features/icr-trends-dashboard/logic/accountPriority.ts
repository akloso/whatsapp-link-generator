import { healthCategory } from './healthScore';
import { isActionableRecommendation } from './reportSelectors';
import type { NormalisedRow } from '../types/icr';
import type { AccountPriorityRow, ReportSortState } from '../types/report';
const categoryRank={Critical:0,Watch:1,Stable:2,Strong:3};
const ragRank={Red:0,Amber:1,Purple:2,Unknown:3,Green:4};
export function toPriorityRow(row: NormalisedRow): AccountPriorityRow { const category=healthCategory(row.health); const actionable=isActionableRecommendation(row.recommendation); return {row,clientKey:row._clientKey,clientName:row.clientName,owner:row.owner,timestamp:row.timestamp,health:row.health,category,rag:row.rag,recommendation:row.recommendation,actionable,opportunity:row.opportunity,tickets:row.tickets,status:row.trackingStatus || row.flowStatus,priorityRank:categoryRank[category]*1000+(actionable?0:200)+ragRank[row.rag]*20+(100-row.health)}; }
const cmpString=(a:string,b:string)=>a.localeCompare(b,undefined,{sensitivity:'base'});
const cmpDate=(a:Date|null,b:Date|null)=>(a?.getTime()??0)-(b?.getTime()??0);
export function sortPriorityRows(rows: readonly AccountPriorityRow[], sort: ReportSortState={key:'priority',direction:'asc'}): AccountPriorityRow[] { const dir=sort.direction==='asc'?1:-1; return [...rows].sort((a,b)=>{ let c=0; if(sort.key==='priority') c=a.priorityRank-b.priorityRank; else if(sort.key==='clientName') c=cmpString(a.clientName,b.clientName); else if(sort.key==='owner') c=cmpString(a.owner,b.owner); else if(sort.key==='timestamp') c=cmpDate(a.timestamp,b.timestamp); else if(sort.key==='health') c=a.health-b.health; else if(sort.key==='rag') c=ragRank[a.rag]-ragRank[b.rag]; else if(sort.key==='recommendation') c=cmpString(a.recommendation,b.recommendation); else if(sort.key==='tickets') c=(a.tickets??-1)-(b.tickets??-1); else if(sort.key==='status') c=cmpString(a.status,b.status); return c*dir || a.priorityRank-b.priorityRank || cmpString(a.clientName,b.clientName) || a.row._row-b.row._row; }); }
export function buildAccountPriorityRows(rows: readonly NormalisedRow[], sort?: ReportSortState): AccountPriorityRow[] { return sortPriorityRows(rows.map(toPriorityRow),sort); }
