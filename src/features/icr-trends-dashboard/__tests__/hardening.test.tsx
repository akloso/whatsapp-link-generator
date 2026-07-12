import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AccountPriorityTable } from '../components/AccountPriorityTable';
import { ExportActions } from '../components/ExportActions';
import { buildChartConfig, finiteChartPoints } from '../logic/chartOptions';
import { buildClientSummaries, filterClientSummaries, chooseSelectedClientKey } from '../logic/clientIntelligence';
import { buildHealthTrendChartModel } from '../logic/chartSelectors';
import { firstTableCsv } from '../logic/exportModels';
import { workbookModelToBlob } from '../logic/workbookExport';
import { downloadBlob } from '../services/downloadFile';
import { exportCell } from '../logic/exportSanitizers';
import { normalRow } from './fixtures';
import type { IcrChartModel } from '../types/charts';
import type { WorkbookModel } from '../logic/exportModels';

const workbookModel: WorkbookModel = { sheets: [{ name: 'Dangerous/Sheet*Name?That Is Definitely Too Long', headers: ['Name', 'Score'], rows: [[' =SUM(A1:A2)', -4]] }, { name: 'Dangerous/Sheet*Name?That Is Definitely Too Long', headers: ['Name'], rows: [['@IMPORT']] }] };

describe('ICR dashboard hardening guards', () => {
  it('filters non-finite chart values before Chart.js config creation', () => {
    const model: IcrChartModel = { kind: 'health', title: 'Finite only', description: 'defensive guard', type: 'bar', points: [], labels: ['Valid', 'Bad', 'Also valid'], values: [4, Number.NaN, 0], summary: 'summary', emptyReason: null };
    expect(finiteChartPoints(model.labels, model.values)).toEqual({ labels: ['Valid', 'Also valid'], values: [4, 0] });
    const config = buildChartConfig(model, true);
    expect(config.data.labels).toEqual(['Valid', 'Also valid']);
    expect(config.data.datasets[0].data).toEqual([4, 0]);
    expect(config.options?.animation).toBe(false);
  });

  it('exposes sort direction and disabled export semantics in static markup', () => {
    const rows = [{ clientKey: 'acme', clientName: 'Acme', owner: 'Owner', timestamp: new Date('2026-01-01T00:00:00Z'), health: 0, category: 'Critical' as const, rag: 'Red' as const, recommendation: 'Act', actionable: true, opportunity: '', priorityRank: 1, tickets: 0, status: 'Open', row: normalRow }];
    const table = renderToStaticMarkup(<AccountPriorityTable rows={rows} sort={{ key: 'health', direction: 'desc' }} onSort={() => undefined} />);
    expect(table).toContain('aria-sort="descending"');
    expect(table).toContain('0 · Critical');
    expect(table).toContain('Tickets: 0');
    const exports = renderToStaticMarkup(<ExportActions label="Hardening" disabled filenameBase="hardening" csv={() => ''} workbook={() => ({ sheets: [] })} />);
    expect(exports.match(/disabled=""/g)?.length).toBe(3);
    expect(exports).toContain('aria-live="polite"');
  });

  it('keeps selected-client export scoped after filtering and preserves one-snapshot empty trends', () => {
    const rows = Array.from({ length: 1000 }, (_, index) => ({ ...normalRow, _clientKey: `client-${index % 250}`, clientName: `Client ${index % 250}`, clientId: `ID-${index % 250}`, owner: index % 2 ? 'Owner B' : 'Owner A', timestamp: new Date(Date.UTC(2026, index % 12, (index % 20) + 1)), health: index % 101, tickets: index === 0 ? 0 : normalRow.tickets, _row: index + 2 }));
    const clients = buildClientSummaries(rows);
    expect(clients).toHaveLength(250);
    const filtered = filterClientSummaries(clients, { search: ' ID-7 ', owner: '', rag: undefined, status: '' });
    expect(filtered.every((client) => client.clientId.includes('ID-7'))).toBe(true);
    const selectedKey = chooseSelectedClientKey(filtered, 'missing-client');
    expect(selectedKey).toBe(filtered[0]?.clientKey ?? null);
    const selected = clients.find((client) => client.clientKey === selectedKey);
    expect(selected).toBeTruthy();
    if (!selected) throw new Error('expected selected client');
    const csvTable = firstTableCsv({ sheets: [{ name: 'Client History', headers: ['Client ID'], rows: selected.rows.map((row) => [row.clientId]) }] }, 'Client History');
    expect(csvTable.rows.every(([clientId]) => clientId === selected.clientId)).toBe(true);
    const oneSnapshotTrend = buildHealthTrendChartModel([{ ...normalRow, timestamp: new Date('2026-01-01T00:00:00Z'), health: 0 }]);
    expect(oneSnapshotTrend.emptyReason).toContain('At least two dated rows');
  });

  it('cleans up object URLs when a browser download click throws', () => {
    const remove = vi.fn();
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:hardening'), revokeObjectURL });
    vi.stubGlobal('document', { createElement: vi.fn(() => ({ style: {}, click: () => { throw new Error('blocked click'); }, remove })), body: { appendChild: vi.fn() } });
    expect(() => downloadBlob(new Blob(['x']), 'blocked.csv')).toThrow('blocked click');
    expect(remove).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:hardening');
    vi.unstubAllGlobals();
  });

  it('builds parseable safe XLSX workbooks with sanitized duplicate sheet names', async () => {
    const blob = await workbookModelToBlob(workbookModel, () => import('xlsx'));
    const buffer = await blob.arrayBuffer();
    const XLSX = await import('xlsx');
    const parsed = XLSX.read(buffer, { type: 'array' });
    expect(parsed.SheetNames).toEqual(['Dangerous Sheet Name That Is De', 'Dangerous Sheet Name That Is  2']);
    expect(parsed.Sheets[parsed.SheetNames[0]]?.A2?.v).toBe("' =SUM(A1:A2)");
    expect(parsed.Sheets[parsed.SheetNames[0]]?.B2?.v).toBe(-4);
    expect(exportCell('  @IMPORT')).toBe("'  @IMPORT");
  });
});
