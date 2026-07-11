import { matchHeaders } from '../logic/headerMatching';
import { normaliseRow } from '../logic/normaliseRow';
export const headers=['Client Name','RAG analysis (Based on CS understanding)','Timestamp','CS SPOC','Total No. of Leads / Subscribed','No. of Leads & Applications Unassigned','No. of Untouched Leads','Overdue follow-ups till date','Tracking Code Placement','No. of Widgets Active/ subscribed','No of User Active/Subscribed','Zendesk Tickets'];
export const mapping=matchHeaders(headers);
export const rawRow=Object.freeze({'Client Name':'Acme College','RAG analysis (Based on CS understanding)':'Red','Timestamp':'2024-02-29','CS SPOC':'Owner A','Total No. of Leads / Subscribed':'100/200','No. of Leads & Applications Unassigned':'30/2','No. of Untouched Leads':'40','Overdue follow-ups till date':'15','Tracking Code Placement':'DTC not placed','No. of Widgets Active/ subscribed':'1/3','No of User Active/Subscribed':'2/8','Zendesk Tickets':'8'});
export const normalRow=normaliseRow(rawRow,mapping,2).row!;
