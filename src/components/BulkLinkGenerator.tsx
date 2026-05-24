import { useMemo, useState } from 'react';
import { AlertCircle, Check, ChevronDown, Copy, Download, Loader2, Search, Upload } from 'lucide-react';
import { MAX_PHONE_LENGTH, MIN_PHONE_LENGTH, countryOptions, type CountryOption } from '../data/countryOptions';
import { trackEvent } from '../lib/trackEvent';

type BulkLinkRow = { phoneNumber: string; countryCode: string; message: string; whatsappLink: string };
type CsvInputRow = { countryCode: string; phoneNumber: string; prefilledMessage: string };
type UploadSummary = { totalRows: number; validRows: number; duplicateRows: number; invalidRows: number };

const EXPECTED_ERROR = 'We could not read this file. Please upload the sample CSV format and try again.';
const sanitizeNumber = (v: string) => v.replace(/[^\d]/g, '');
const sanitizeManualInput = (v: string) => v.replace(/[^\d\n, +()-]/g, '');
const splitRawEntries = (raw: string) => raw.replace(/,/g, '\n').split(/\n+/).map((x) => x.trim()).filter(Boolean);
const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;

function parseCsvLine(line: string) {
  const cells: string[] = []; let current = ''; let inQ = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') { if (inQ && line[i + 1] === '"') { current += '"'; i += 1; } else inQ = !inQ; }
    else if (ch === ',' && !inQ) { cells.push(current.trim()); current = ''; } else current += ch;
  }
  cells.push(current.trim()); return cells;
}

function detectColumns(headers: string[]) {
  const n = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const find = (keys: string[]) => n.findIndex((h) => keys.some((k) => h.includes(k)));
  return { cc: find(['countrycode', 'country', 'dialcode', 'code']), phone: find(['phonenumber', 'phone', 'mobile', 'number']), msg: find(['prefilledmessage', 'message', 'text']) };
}

const downloadTextFile = (content: string, name: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
};

export default function BulkLinkGenerator() {
  const indiaOption = countryOptions.find((o) => o.country === 'India') ?? countryOptions[0];
  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(indiaOption);
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [rawNumbers, setRawNumbers] = useState('');
  const [commonMessage, setCommonMessage] = useState('');
  const [uploadedRows, setUploadedRows] = useState<CsvInputRow[]>([]);
  const [uploadSummary, setUploadSummary] = useState<UploadSummary | null>(null);
  const [csvFileName, setCsvFileName] = useState('');
  const [isParsingCsv, setIsParsingCsv] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [generatedRows, setGeneratedRows] = useState<BulkLinkRow[]>([]);
  const [invalidEntries, setInvalidEntries] = useState(0);
  const [duplicateEntries, setDuplicateEntries] = useState(0);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    const sorted = [...countryOptions].sort((a, b) => a.country.localeCompare(b.country));
    const ordered = [indiaOption, ...sorted.filter((x) => x.country !== indiaOption.country)];
    return q ? ordered.filter((x) => x.country.toLowerCase().includes(q) || x.code.includes(q)) : ordered;
  }, [countrySearch, indiaOption]);

  const resetGenerated = () => { setGeneratedRows([]); setInvalidEntries(0); setDuplicateEntries(0); setCopiedLink(null); };

  const parseCsvFile = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) throw new Error(EXPECTED_ERROR);
    const header = parseCsvLine(lines[0]);
    const { cc, phone, msg } = detectColumns(header);

    const rows: CsvInputRow[] = [];
    let invalid = 0;
    let duplicates = 0;
    const seen = new Set<string>();

    for (const line of lines.slice(1)) {
      const cols = parseCsvLine(line);
      const rawPhone = phone >= 0 ? (cols[phone] ?? '') : (cols.find((c) => sanitizeNumber(c).length >= MIN_PHONE_LENGTH) ?? '');
      const rawCode = cc >= 0 ? (cols[cc] ?? '') : selectedCountry.code;
      const rawMsg = msg >= 0 ? (cols[msg] ?? '') : '';
      const digits = sanitizeNumber(rawPhone);

      if (!digits || digits.length < MIN_PHONE_LENGTH || digits.length > MAX_PHONE_LENGTH || /^(\d)\1+$/.test(digits)) { invalid += 1; continue; }
      const cleanCc = rawCode.trim().startsWith('+') ? rawCode.trim() : `+${sanitizeNumber(rawCode) || selectedCountry.code.replace('+', '')}`;
      const key = `${cleanCc}:${digits}`;
      if (seen.has(key)) { duplicates += 1; continue; }
      seen.add(key);
      rows.push({ countryCode: cleanCc, phoneNumber: digits, prefilledMessage: rawMsg.trim() });
    }

    if (!rows.length) throw new Error(EXPECTED_ERROR);
    return { rows, summary: { totalRows: lines.length - 1, validRows: rows.length, duplicateRows: duplicates, invalidRows: invalid } };
  };

  const handleGenerateLinks = () => {
    const baseRows = uploadedRows.length
      ? uploadedRows.map((r) => ({ cc: r.countryCode, phone: r.phoneNumber, msg: r.prefilledMessage }))
      : splitRawEntries(rawNumbers).map((phone) => ({ cc: selectedCountry.code, phone, msg: commonMessage.trim() }));

    if (!baseRows.length) { setErrorMessage('Paste at least one phone number to generate bulk links.'); resetGenerated(); return; }

    const seen = new Set<string>();
    let invalid = 0;
    let duplicate = 0;
    const rows: BulkLinkRow[] = [];

    for (const item of baseRows) {
      const digits = sanitizeNumber(item.phone);
      if (!digits || digits.length < MIN_PHONE_LENGTH || digits.length > MAX_PHONE_LENGTH || /^(\d)\1+$/.test(digits)) { invalid += 1; continue; }
      const cleanCc = (item.cc || selectedCountry.code).replace(/[^\d+]/g, '').replace(/^([^+])/, '+$1');
      const key = `${cleanCc}:${digits}`;
      if (seen.has(key)) { duplicate += 1; continue; }
      seen.add(key);
      const full = `${cleanCc.replace('+', '')}${digits}`;
      const message = item.msg.trim();
      rows.push({ phoneNumber: digits, countryCode: cleanCc, message, whatsappLink: message ? `https://wa.me/${full}?text=${encodeURIComponent(message)}` : `https://wa.me/${full}` });
    }

    if (!rows.length) { setErrorMessage('No valid phone numbers found. Check your input and try again.'); setGeneratedRows([]); setInvalidEntries(invalid); setDuplicateEntries(duplicate); return; }
    setErrorMessage(''); setGeneratedRows(rows); setInvalidEntries(invalid); setDuplicateEntries(duplicate); setCopiedLink(null);
    trackEvent('bulk_generate_links', { source: 'bulk_generator', generated_count: rows.length, has_message: rows.some((r) => Boolean(r.message)) });
  };

  return <section className="bg-white py-12 sm:py-14 lg:py-16"><div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"><div className="mb-6 text-center sm:mb-8"><h2 className="text-2xl font-bold tracking-tight text-gray-950 sm:text-4xl">Bulk WhatsApp Link Generator</h2></div>
    <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-lg shadow-green-100/50 sm:p-7"><div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6"><div className="space-y-4"><label className="block text-sm font-semibold text-gray-800">Country code</label><div className="relative"><button type="button" onClick={() => setIsCountryOpen((p) => !p)} className="flex w-full items-center justify-between rounded-xl border border-gray-300 px-4 py-3 text-left text-sm text-gray-900"><span>{selectedCountry.country} ({selectedCountry.code})</span><ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isCountryOpen ? 'rotate-180' : ''}`} /></button>{isCountryOpen ? <div className="absolute z-20 mt-2 w-full rounded-xl border border-gray-200 bg-white p-3 shadow-xl"><div className="relative mb-2"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={countrySearch} onChange={(e) => setCountrySearch(e.target.value)} placeholder="Search country or code" className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm" /></div><div className="max-h-56 overflow-y-auto">{filteredCountries.map((o) => <button key={`${o.country}-${o.code}`} type="button" onClick={() => { setSelectedCountry(o); setIsCountryOpen(false); setCountrySearch(''); }} className="flex w-full justify-between rounded-md px-3 py-2 text-sm text-gray-800 hover:bg-green-50"><span>{o.country}</span><span className="text-gray-500">{o.code}</span></button>)}</div></div> : null}</div>
      <label className="block text-sm font-semibold text-gray-800">Phone numbers</label><textarea value={rawNumbers} onChange={(e) => setRawNumbers(sanitizeManualInput(e.target.value))} rows={8} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900" />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"><Upload className="h-4 w-4" />Upload CSV<input type="file" accept=".csv,text/csv" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; setUploadedRows([]); setUploadSummary(null); setCsvFileName(''); setErrorMessage(''); resetGenerated(); setIsParsingCsv(true); try { const parsed = await parseCsvFile(file); setUploadedRows(parsed.rows); setUploadSummary(parsed.summary); setCsvFileName(file.name); } catch { setErrorMessage(EXPECTED_ERROR); } finally { setIsParsingCsv(false); e.currentTarget.value = ''; } }} /></label>
        <button type="button" onClick={() => downloadTextFile('country_code,phone_number,prefilled_message', 'zapora-bulk-sample.csv')} className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Download Sample CSV</button>
      </div>
      {isParsingCsv ? <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700"><Loader2 className="h-3.5 w-3.5 animate-spin" />Analyzing CSV…</div> : null}
      {uploadSummary ? <div className="grid grid-cols-2 gap-2 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 text-xs text-slate-700"><p>Total rows: <span className="font-semibold">{uploadSummary.totalRows}</span></p><p>Valid numbers: <span className="font-semibold">{uploadSummary.validRows}</span></p><p>Duplicate numbers: <span className="font-semibold">{uploadSummary.duplicateRows}</span></p><p>Invalid/skipped: <span className="font-semibold">{uploadSummary.invalidRows}</span></p></div> : null}
    </div><div className="space-y-4"><label className="block text-sm font-semibold text-gray-800">Common pre-filled message (manual mode)</label><textarea value={commonMessage} onChange={(e) => setCommonMessage(e.target.value)} rows={4} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900" /><button onClick={handleGenerateLinks} className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-3 text-sm font-semibold text-white">Generate Bulk Links</button>{errorMessage ? <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4" />{errorMessage}</div> : null}{csvFileName ? <p className="text-xs text-gray-500">Using uploaded file: <span className="font-medium">{csvFileName}</span></p> : null}</div></div>

    {generatedRows.length ? <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-gray-800">Generated: {generatedRows.length} · Duplicates skipped: {duplicateEntries} · Invalid/skipped: {invalidEntries}</p><button onClick={() => { const head = 'country_code,phone_number,whatsapp_link,prefilled_message'; const rows = generatedRows.map((r) => [esc(r.countryCode), esc(r.phoneNumber), esc(r.whatsappLink), esc(r.message)].join(',')); downloadTextFile([head, ...rows].join('\n'), 'zapora-bulk-whatsapp-links.csv'); }} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700"><Download className="h-3.5 w-3.5" />Download CSV</button></div><div className="max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white">{generatedRows.map((row) => <div key={row.whatsappLink} className="flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 text-xs"><span className="truncate text-gray-700">{row.whatsappLink}</span><button onClick={async () => { try { await navigator.clipboard.writeText(row.whatsappLink); setCopiedLink(row.whatsappLink); setTimeout(() => setCopiedLink(null), 1500); } catch { setCopiedLink(null); } }} className="inline-flex items-center gap-1 rounded-md border px-2 py-1">{copiedLink === row.whatsappLink ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}Copy</button></div>)}</div></div> : null}
  </div></div></section>;
}
