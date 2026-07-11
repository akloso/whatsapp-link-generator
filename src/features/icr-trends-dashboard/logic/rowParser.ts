import { FIELD_BY_KEY, FIELD_DEFS } from '../constants/fieldDefinitions';
import type { ColumnMapping, FieldKey, ParsedRow, RawRow, ValidationIssue } from '../types';
import { parseDate } from './dateParsing';
import { parseNum, parsePair, ratio } from './numberParsing';
import { canonicalClient, isMissing, normalizeRag, safe } from './normalize';

const getByField = (row: RawRow, mapping: ColumnMapping, key: FieldKey): unknown => {
  const header = Object.entries(mapping).find(([, entry]) => entry.key === key)?.[0];
  return header ? row[header] : undefined;
};

const placementStatus = (value: string): boolean | null => {
  const normalized = value.toLowerCase();
  if (!normalized) return null;
  if (/(not|missing|pending|correction|required|issue|absent|no\s)/.test(normalized)) return false;
  if (/(placed|configured|present|active|validated|healthy|done|complete|implemented)/.test(normalized)) return true;
  return null;
};

export const detectCustomNumericHeaders = (rows: RawRow[], mapping: ColumnMapping): string[] => {
  const mappedHeaders = new Set(Object.keys(mapping).filter((header) => mapping[header]?.key));
  const headers = [...new Set(rows.slice(0, 50).flatMap((row) => Object.keys(row)))];
  return headers.filter((header) => {
    if (mappedHeaders.has(header)) return false;
    const samples = rows.slice(0, 20).map((row) => row[header]).filter((value) => !isMissing(value));
    return samples.length > 0 && samples.some((value) => parseNum(value) !== null);
  });
};

export const addIssue = (
  issues: ValidationIssue[],
  row: number,
  field: FieldKey | 'workbook',
  message: string,
  severity: ValidationIssue['severity'] = 'warning',
): ValidationIssue => {
  const issue = { row, field, message, severity };
  issues.push(issue);
  return issue;
};

export const parseRows = (rows: RawRow[], mapping: ColumnMapping): { result: ParsedRow[]; issues: ValidationIssue[] } => {
  const issues: ValidationIssue[] = [];
  const customHeaders = detectCustomNumericHeaders(rows, mapping);
  const result = rows.map((row, index) => {
    const rowNumber = index + 2;
    const rowWarnings: ValidationIssue[] = [];
    const warn = (field: FieldKey | 'workbook', message: string) => rowWarnings.push(addIssue(issues, rowNumber, field, message));

    const timestamp = parseDate(getByField(row, mapping, 'timestamp'));
    const clientName = safe(getByField(row, mapping, 'clientName'));
    const clientId = safe(getByField(row, mapping, 'clientId'));
    const rag = normalizeRag(getByField(row, mapping, 'rag'));
    const trackingStatus = safe(getByField(row, mapping, 'trackingStatus'));
    const flowStatus = safe(getByField(row, mapping, 'flowStatus'));

    if (!clientName) warn('clientName', 'Client name is missing.');
    if (rag === 'Unknown') warn('rag', 'RAG status is missing or not recognised.');
    if (!timestamp) warn('timestamp', 'Review timestamp is missing or invalid.');

    const leadPair = parsePair(getByField(row, mapping, 'leadPair'));
    const unassignedPair = parsePair(getByField(row, mapping, 'unassignedPair'));
    const paidPair = parsePair(getByField(row, mapping, 'paidPair'));
    const widgetPair = parsePair(getByField(row, mapping, 'widgetPair'));
    const userPair = parsePair(getByField(row, mapping, 'userPair'));
    const emailPair = parsePair(getByField(row, mapping, 'emailPair'));
    const smsPair = parsePair(getByField(row, mapping, 'smsPair'));
    const whatsappPair = parsePair(getByField(row, mapping, 'whatsappPair'));
    const niaaPair = parsePair(getByField(row, mapping, 'niaaPair'));
    const rawPair = parsePair(getByField(row, mapping, 'rawPair'));
    const queryPair = parsePair(getByField(row, mapping, 'queryPair'));

    ([['leadPair', leadPair], ['unassignedPair', unassignedPair], ['paidPair', paidPair], ['widgetPair', widgetPair], ['userPair', userPair], ['emailPair', emailPair], ['smsPair', smsPair], ['whatsappPair', whatsappPair], ['niaaPair', niaaPair], ['rawPair', rawPair], ['queryPair', queryPair]] as Array<[FieldKey, typeof leadPair]>).forEach(([key, pair]) => {
      if (pair.ambiguous) warn(key, `${FIELD_BY_KEY[key].label} contains more than two numeric values.`);
    });

    const custom: Record<string, number> = {};
    customHeaders.forEach((header) => {
      const parsed = parseNum(row[header]);
      if (parsed !== null) custom[header] = parsed;
    });

    const populatedMappedValues = FIELD_DEFS.filter((field) => Object.values(mapping).some((entry) => entry.key === field.key))
      .filter((field) => !isMissing(getByField(row, mapping, field.key))).length;
    const mappedFieldCount = FIELD_DEFS.filter((field) => Object.values(mapping).some((entry) => entry.key === field.key)).length;
    const dataConfidence = mappedFieldCount ? Math.max(0, Math.round((populatedMappedValues / mappedFieldCount) * 100) - rowWarnings.length * 5) : 0;

    const parsed: ParsedRow = {
      _row: rowNumber,
      _raw: row,
      _custom: custom,
      _warnings: rowWarnings,
      _clientKey: canonicalClient(clientName, clientId),
      dataConfidence,
      timestamp,
      clientName,
      clientId,
      rag,
      owner: safe(getByField(row, mapping, 'owner')),
      manager: safe(getByField(row, mapping, 'manager')),
      trackingStatus,
      flowStatus,
      tickets: parseNum(getByField(row, mapping, 'tickets')),
      opportunity: safe(getByField(row, mapping, 'opportunity')),
      actionable: safe(getByField(row, mapping, 'actionable')),
      dtcPlaced: placementStatus(trackingStatus),
      widgetPlaced: placementStatus(flowStatus),
      leads: leadPair.a,
      subscribedLeads: leadPair.b,
      unassigned: unassignedPair.a,
      unassignedApps: unassignedPair.b,
      referralLeads: parseNum(getByField(row, mapping, 'referralLeads')),
      notMappedLeads: parseNum(getByField(row, mapping, 'notMappedLeads')),
      paidApplications: paidPair.a,
      applicationCapping: paidPair.b,
      overdue: parseNum(getByField(row, mapping, 'overdue')),
      untouched: parseNum(getByField(row, mapping, 'untouched')),
      activeWidgets: widgetPair.a,
      subscribedWidgets: widgetPair.b,
      activeUsers: userPair.a,
      subscribedUsers: userPair.b,
      emailConsumed: emailPair.a,
      emailLeft: emailPair.b,
      smsConsumed: smsPair.a,
      smsLeft: smsPair.b,
      whatsappConsumed: whatsappPair.a,
      whatsappLeft: whatsappPair.b,
      niaaConsumed: niaaPair.a,
      niaaLeft: niaaPair.b,
      activeRaw: rawPair.a,
      subscribedRaw: rawPair.b,
      openQueries: queryPair.a,
      unassignedQueries: queryPair.b,
      leadUtil: ratio(leadPair.a, leadPair.b),
      unassignedRate: ratio(unassignedPair.a, leadPair.a),
      untouchedRate: ratio(parseNum(getByField(row, mapping, 'untouched')), leadPair.a),
      overdueRate: ratio(parseNum(getByField(row, mapping, 'overdue')), leadPair.a),
      widgetAdoption: ratio(widgetPair.a, widgetPair.b),
      userAdoption: ratio(userPair.a, userPair.b),
      rawAdoption: ratio(rawPair.a, rawPair.b),
    };
    return parsed;
  });

  return { result, issues };
};
