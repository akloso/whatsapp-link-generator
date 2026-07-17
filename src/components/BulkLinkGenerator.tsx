import { useMemo, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, ChevronDown, Copy, Download, FileSpreadsheet, FileText, Link2, Loader2, Search, Upload, UsersRound } from 'lucide-react';
import { MAX_PHONE_LENGTH, MIN_PHONE_LENGTH, countryOptions, type CountryOption } from '../data/countryOptions';
import { trackEvent } from '../lib/trackEvent';
import { ToolFaqSection, ToolHowItWorksSection } from './ToolPageSupportSections';
import { Button, FieldLabel, Surface, Textarea } from './ui';

type BulkLinkRow = { phoneNumber: string; countryCode: string; message: string; whatsappLink: string };
type CsvInputRow = { countryCode: string; phoneNumber: string; prefilledMessage: string };
type UploadSummary = { totalRows: number; validRows: number; duplicateRows: number; invalidRows: number; invalidDetails: string[] };
type InputMethod = 'manual' | 'csv';

const EXPECTED_ERROR = 'We could not read this file. Please upload the sample CSV format and try again.';
const SAMPLE_CSV = 'country_code,phone_number,prefilled_message';
const sanitizeNumber = (value: string) => value.replace(/[^\d]/g, '');
const sanitizeManualInput = (value: string) => value.replace(/[^\d\n, +()-]/g, '');
const splitRawEntries = (raw: string) => raw.replace(/,/g, '\n').split(/\n+/).map((entry) => entry.trim()).filter(Boolean);
const esc = (value: string) => `"${value.replace(/"/g, '""')}"`;

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }

  cells.push(current.trim());
  return cells;
}

function detectColumns(headers: string[]) {
  const normalized = headers.map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const find = (keys: string[]) => normalized.findIndex((header) => keys.some((key) => header.includes(key)));
  return { cc: find(['countrycode', 'country', 'dialcode', 'code']), phone: find(['phonenumber', 'phone', 'mobile', 'number']), msg: find(['prefilledmessage', 'message', 'text']) };
}

const downloadTextFile = (content: string, name: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export default function BulkLinkGenerator() {
  const indiaOption = countryOptions.find((option) => option.country === 'India') ?? countryOptions[0];
  const [inputMethod, setInputMethod] = useState<InputMethod>('manual');
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
  const [invalidDetails, setInvalidDetails] = useState<string[]>([]);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState('');

  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase();
    const sorted = [...countryOptions].sort((left, right) => left.country.localeCompare(right.country));
    const ordered = [indiaOption, ...sorted.filter((option) => option.country !== indiaOption.country)];
    return query ? ordered.filter((option) => option.country.toLowerCase().includes(query) || option.code.includes(query)) : ordered;
  }, [countrySearch, indiaOption]);

  const manualEntryCount = splitRawEntries(rawNumbers).length;
  const resetGenerated = () => {
    setGeneratedRows([]);
    setInvalidEntries(0);
    setDuplicateEntries(0);
    setInvalidDetails([]);
    setCopiedLink(null);
    setDownloadStatus('');
  };

  const parseCsvFile = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) throw new Error(EXPECTED_ERROR);
    const { cc, phone, msg } = detectColumns(parseCsvLine(lines[0]));
    const rows: CsvInputRow[] = [];
    let invalid = 0;
    let duplicates = 0;
    const details: string[] = [];
    const seen = new Set<string>();

    for (const [index, line] of lines.slice(1).entries()) {
      const rowNumber = index + 2;
      const cells = parseCsvLine(line);
      const rawPhone = phone >= 0 ? (cells[phone] ?? '') : (cells.find((cell) => sanitizeNumber(cell).length >= MIN_PHONE_LENGTH) ?? '');
      const rawCode = cc >= 0 ? (cells[cc] ?? '') : selectedCountry.code;
      const rawMessage = msg >= 0 ? (cells[msg] ?? '') : '';
      const digits = sanitizeNumber(rawPhone);

      if (!digits || digits.length < MIN_PHONE_LENGTH || digits.length > MAX_PHONE_LENGTH || /^(\d)\1+$/.test(digits)) {
        invalid += 1;
        if (details.length < 8) details.push(`Row ${rowNumber}: phone number is missing, too short, too long, or repeated digits.`);
        continue;
      }
      const countryCode = rawCode.trim().startsWith('+') ? rawCode.trim() : `+${sanitizeNumber(rawCode) || selectedCountry.code.replace('+', '')}`;
      const key = `${countryCode}:${digits}`;
      if (seen.has(key)) {
        duplicates += 1;
        if (details.length < 8) details.push(`Row ${rowNumber}: duplicate phone number skipped.`);
        continue;
      }
      seen.add(key);
      rows.push({ countryCode, phoneNumber: digits, prefilledMessage: rawMessage.trim() });
    }
    if (!rows.length) throw new Error(EXPECTED_ERROR);
    return { rows, summary: { totalRows: lines.length - 1, validRows: rows.length, duplicateRows: duplicates, invalidRows: invalid, invalidDetails: details } };
  };

  const handleGenerateLinks = () => {
    const csvReady = inputMethod === 'csv' && uploadedRows.length > 0;
    const baseRows = csvReady
      ? uploadedRows.map((row, index) => ({ cc: row.countryCode, phone: row.phoneNumber, msg: row.prefilledMessage, rowNumber: index + 2 }))
      : splitRawEntries(rawNumbers).map((phone, index) => ({ cc: selectedCountry.code, phone, msg: commonMessage.trim(), rowNumber: index + 1 }));

    if (!baseRows.length) {
      setErrorMessage(inputMethod === 'csv' ? 'Upload a CSV with at least one valid row before generating.' : 'Paste at least one phone number to generate bulk links.');
      resetGenerated();
      return;
    }

    const seen = new Set<string>();
    let invalid = csvReady ? uploadSummary?.invalidRows ?? 0 : 0;
    let duplicates = csvReady ? uploadSummary?.duplicateRows ?? 0 : 0;
    const details = csvReady ? [...(uploadSummary?.invalidDetails ?? [])] : [];
    const rows: BulkLinkRow[] = [];

    for (const item of baseRows) {
      const digits = sanitizeNumber(item.phone);
      if (!digits || digits.length < MIN_PHONE_LENGTH || digits.length > MAX_PHONE_LENGTH || /^(\d)\1+$/.test(digits)) {
        invalid += 1;
        if (details.length < 8) details.push(`${inputMethod === 'csv' ? `Row ${item.rowNumber}` : `Entry ${item.rowNumber}`}: phone number is missing, too short, too long, or repeated digits.`);
        continue;
      }
      const countryCode = (item.cc || selectedCountry.code).replace(/[^\d+]/g, '').replace(/^([^+])/, '+$1');
      const key = `${countryCode}:${digits}`;
      if (seen.has(key)) {
        duplicates += 1;
        if (details.length < 8) details.push(`${inputMethod === 'csv' ? `Row ${item.rowNumber}` : `Entry ${item.rowNumber}`}: duplicate phone number skipped.`);
        continue;
      }
      seen.add(key);
      const fullNumber = `${countryCode.replace('+', '')}${digits}`;
      const message = item.msg.trim();
      rows.push({ phoneNumber: digits, countryCode, message, whatsappLink: message ? `https://wa.me/${fullNumber}?text=${encodeURIComponent(message)}` : `https://wa.me/${fullNumber}` });
    }

    if (!rows.length) {
      setErrorMessage('No valid phone numbers found. Check your input and try again.');
      setGeneratedRows([]);
      setInvalidEntries(invalid);
      setDuplicateEntries(duplicates);
      setInvalidDetails(details);
      return;
    }
    setErrorMessage('');
    setGeneratedRows(rows);
    setInvalidEntries(invalid);
    setDuplicateEntries(duplicates);
    setInvalidDetails(details);
    setCopiedLink(null);
    setDownloadStatus('');
    trackEvent('bulk_generate_links', { source: 'bulk_generator', generated_count: rows.length, has_message: rows.some((row) => Boolean(row.message)) });
  };

  const downloadGeneratedCsv = () => {
    const header = 'country_code,phone_number,whatsapp_link,prefilled_message';
    const rows = generatedRows.map((row) => [esc(row.countryCode), esc(row.phoneNumber), esc(row.whatsappLink), esc(row.message)].join(','));
    downloadTextFile([header, ...rows].join('\n'), 'zapora-bulk-whatsapp-links.csv');
    setDownloadStatus('Generated CSV downloaded.');
    window.setTimeout(() => setDownloadStatus(''), 2200);
  };

  const summaryStats = [
    { label: 'Total rows', value: inputMethod === 'csv' ? uploadSummary?.totalRows ?? uploadedRows.length : manualEntryCount, tone: 'neutral' },
    { label: 'Valid', value: generatedRows.length || uploadSummary?.validRows || 0, tone: 'success' },
    { label: 'Invalid', value: invalidEntries || uploadSummary?.invalidRows || 0, tone: 'error' },
    { label: 'Duplicates', value: duplicateEntries || uploadSummary?.duplicateRows || 0, tone: 'warning' },
    { label: 'Generated', value: generatedRows.length, tone: 'generated' },
  ];

  return (
    <section className="bg-[linear-gradient(180deg,#f0fdf7_0%,#ffffff_24rem)] py-6 sm:py-8 lg:py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="relative mb-5 overflow-hidden rounded-3xl border border-emerald-100 bg-white px-5 py-6 shadow-[0_20px_50px_-38px_rgba(6,78,59,0.5)] sm:mb-6 sm:px-7 sm:py-7">
          <div className="absolute -right-16 -top-20 h-44 w-44 rounded-full bg-cyan-100/60 blur-3xl" aria-hidden="true" />
          <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800"><FileText className="h-3.5 w-3.5" /> Bulk workflow</div>
              <h1 className="max-w-2xl text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">Generate WhatsApp links for a full list.</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 sm:text-base">Add numbers manually or upload a CSV. Zapora validates every row in your browser, then gives you clean links to copy or download.</p>
              <ul className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-gray-700" aria-label="Bulk generator benefits">
                {['Local validation', 'CSV ready', 'No login', 'Download output'].map((label) => <li key={label} className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1.5">{label}</li>)}
              </ul>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl border border-cyan-100 bg-cyan-50/60 p-3 text-center" aria-label="CSV to WhatsApp links workflow">
              <div className="rounded-xl bg-white p-2.5 shadow-sm"><FileSpreadsheet className="mx-auto h-5 w-5 text-cyan-700" /><span className="mt-1 block text-[11px] font-semibold text-gray-700">Numbers</span></div>
              <div className="text-lg font-bold text-emerald-600" aria-hidden="true">→</div>
              <div className="rounded-xl bg-white p-2.5 shadow-sm"><Link2 className="mx-auto h-5 w-5 text-emerald-700" /><span className="mt-1 block text-[11px] font-semibold text-gray-700">Clean links</span></div>
            </div>
          </div>
        </header>

        <Surface className="overflow-hidden p-0">
          <div className="grid lg:grid-cols-[minmax(0,.94fr)_minmax(340px,1.06fr)]">
            <div className="min-w-0 border-b border-gray-200 p-4 sm:p-5 lg:border-b-0 lg:border-r lg:p-6">
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">1. Choose your source</p>
                <h2 className="mt-1 text-lg font-bold text-gray-950">Add contacts</h2>
              </div>
              <div role="tablist" aria-label="Bulk input method" className="grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1.5">
                {(['manual', 'csv'] as const).map((method) => {
                  const active = inputMethod === method;
                  const Icon = method === 'manual' ? UsersRound : FileSpreadsheet;
                  return <button key={method} id={`${method}-tab`} type="button" role="tab" aria-selected={active} aria-controls={`${method}-panel`} onClick={() => { setInputMethod(method); setErrorMessage(''); }} className={`min-h-[68px] rounded-xl px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20 ${active ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-600 hover:bg-white/70 hover:text-gray-950'}`}><span className={`mb-1 flex h-6 w-6 items-center justify-center rounded-lg ${active ? method === 'manual' ? 'bg-emerald-100 text-emerald-700' : 'bg-cyan-100 text-cyan-700' : 'bg-gray-200 text-gray-600'}`}><Icon className="h-3.5 w-3.5" /></span><span className="block text-sm font-bold">{method === 'manual' ? 'Manual input' : 'Upload CSV'}</span><span className="mt-0.5 block text-xs font-medium leading-4">{method === 'manual' ? 'Paste numbers quickly' : 'Use a message per row'}</span></button>;
                })}
              </div>

              <div className="mt-5">
                {inputMethod === 'manual' ? <div id="manual-panel" role="tabpanel" aria-labelledby="manual-tab" className="space-y-4 zapora-result-enter">
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="bulk-country">Country code</FieldLabel>
                    <div className="relative">
                      <button id="bulk-country" type="button" onClick={() => setIsCountryOpen((open) => !open)} className="flex min-h-11 w-full items-center justify-between rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-left text-sm text-gray-900 transition hover:border-gray-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/15" aria-haspopup="listbox" aria-expanded={isCountryOpen}><span className="truncate">{selectedCountry.country} ({selectedCountry.code})</span><ChevronDown className={`h-4 w-4 flex-none text-gray-500 transition-transform ${isCountryOpen ? 'rotate-180' : ''}`} /></button>
                      {isCountryOpen ? <div className="absolute left-0 right-0 z-20 mt-2 max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-200 bg-white p-2 shadow-xl"><div className="relative mb-2"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={countrySearch} onChange={(event) => setCountrySearch(event.target.value)} placeholder="Search country or code" aria-label="Search countries and calling codes" className="min-h-10 w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus-visible:border-emerald-500 focus-visible:ring-4 focus-visible:ring-emerald-500/15" autoFocus /></div><div role="listbox" aria-label="Country code options" className="max-h-56 overflow-y-auto rounded-xl border border-gray-100">{filteredCountries.map((option) => <button key={`${option.country}-${option.code}`} type="button" role="option" aria-selected={option.code === selectedCountry.code && option.country === selectedCountry.country} onClick={() => { setSelectedCountry(option); setIsCountryOpen(false); setCountrySearch(''); }} className="flex w-full justify-between gap-3 px-3 py-2.5 text-left text-sm text-gray-800 transition hover:bg-emerald-50 focus-visible:bg-emerald-50"><span className="min-w-0 truncate">{option.country}</span><span className="flex-none text-gray-500">{option.code}</span></button>)}</div></div> : null}
                    </div>
                  </div>
                  <div className="space-y-1.5"><div className="flex items-end justify-between gap-3"><FieldLabel htmlFor="bulk-numbers">Phone numbers</FieldLabel><span className="text-xs font-semibold text-emerald-700" aria-live="polite">{manualEntryCount} detected</span></div><Textarea id="bulk-numbers" value={rawNumbers} onChange={(event) => { setRawNumbers(sanitizeManualInput(event.target.value)); resetGenerated(); }} rows={6} placeholder={'9876543210\n98765 43210\n+91 98765 43210'} aria-describedby="bulk-numbers-help" className="min-h-[140px]" /><p id="bulk-numbers-help" className="text-sm text-gray-500">One number per line or comma-separated. Spaces, +, hyphens, and parentheses are supported.</p></div>
                  <div className="space-y-1.5"><FieldLabel htmlFor="bulk-message" optional>Common pre-filled message</FieldLabel><Textarea id="bulk-message" value={commonMessage} onChange={(event) => setCommonMessage(event.target.value)} rows={3} placeholder="Optional message added to every manual link" className="min-h-[88px]" /></div>
                </div> : <div id="csv-panel" role="tabpanel" aria-labelledby="csv-tab" className="space-y-3 zapora-result-enter">
                  <label className="group block cursor-pointer rounded-2xl border border-dashed border-cyan-300 bg-cyan-50/50 px-4 py-5 transition hover:border-cyan-500 hover:bg-cyan-50 focus-within:border-cyan-500 focus-within:bg-cyan-50 focus-within:ring-4 focus-within:ring-cyan-500/15"><span className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-cyan-700 shadow-sm"><Upload className="h-5 w-5" /></span><span className="min-w-0"><span className="block text-sm font-bold text-gray-900">Upload your CSV</span><span className="mt-1 block text-sm leading-5 text-gray-600">Use country_code, phone_number, and prefilled_message columns.</span></span></span><span className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-cyan-700 px-3 py-2 text-sm font-semibold text-white transition group-hover:bg-cyan-800"><Upload className="h-4 w-4" /> {isParsingCsv ? 'Analyzing CSV...' : 'Choose CSV'}</span>{csvFileName ? <span className="mt-3 flex items-center gap-2 rounded-xl border border-cyan-100 bg-white px-3 py-2 text-xs font-semibold text-gray-700"><FileText className="h-4 w-4 shrink-0 text-cyan-700" /><span className="truncate">{csvFileName}</span></span> : null}<input type="file" accept=".csv,text/csv" className="sr-only" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') { setCsvFileName(file.name); setErrorMessage('Please upload a CSV file. Download the sample if you need the header format.'); event.currentTarget.value = ''; return; } setUploadedRows([]); setUploadSummary(null); setCsvFileName(file.name); setErrorMessage(''); resetGenerated(); setIsParsingCsv(true); try { const parsed = await parseCsvFile(file); setUploadedRows(parsed.rows); setUploadSummary(parsed.summary); setInvalidDetails(parsed.summary.invalidDetails); } catch { setErrorMessage(EXPECTED_ERROR); } finally { setIsParsingCsv(false); event.currentTarget.value = ''; } }} /></label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center"><Button type="button" variant="secondary" onClick={() => downloadTextFile(SAMPLE_CSV, 'zapora-bulk-sample.csv')} icon={<Download className="h-4 w-4" />} className="w-full sm:w-auto">Download sample CSV</Button>{isParsingCsv ? <p role="status" aria-live="polite" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-900"><Loader2 className="h-4 w-4 animate-spin" /> Checking rows locally</p> : null}</div>
                  {uploadSummary ? <div role="status" aria-live="polite" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900"><span className="font-bold">Ready to generate.</span> {uploadSummary.validRows} valid row{uploadSummary.validRows === 1 ? '' : 's'} found locally.</div> : null}
                </div>}
              </div>
              <Button onClick={handleGenerateLinks} variant="primary" className="mt-5 w-full text-base" disabled={isParsingCsv} icon={<Link2 className="h-4 w-4" />}>Generate bulk links</Button>
              {errorMessage ? <div role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 flex-none" />{errorMessage}</div> : null}
            </div>

            <div className="min-w-0 bg-slate-50/70 p-4 sm:p-5 lg:p-6">
              <div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">2. Validate and export</p><h2 className="mt-1 text-lg font-bold text-gray-950">Output workspace</h2></div>{generatedRows.length ? <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1.5 text-xs font-bold text-emerald-800"><CheckCircle2 className="h-3.5 w-3.5" /> Ready</span> : null}</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-2 xl:grid-cols-5">{summaryStats.map((stat) => <StatCard key={stat.label} label={stat.label} value={stat.value} tone={stat.tone} />)}</div>
              {invalidDetails.length ? <div className="mt-4 max-h-36 overflow-y-auto rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p className="mb-1 flex items-center gap-1.5 font-bold"><AlertCircle className="h-4 w-4 text-amber-700" /> Skipped rows</p><ul className="space-y-1.5 pl-5 marker:text-amber-600">{invalidDetails.map((detail) => <li key={detail}>{detail}</li>)}</ul></div> : null}
              <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white"><div className="flex flex-col gap-3 border-b border-gray-200 bg-white px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-bold text-gray-950">Generated links</h3><p className="mt-0.5 text-sm text-gray-600">{generatedRows.length ? `${generatedRows.length} link${generatedRows.length === 1 ? '' : 's'} ready to use.` : 'Generate links to preview your output here.'}</p></div><Button onClick={downloadGeneratedCsv} disabled={!generatedRows.length} variant={generatedRows.length ? 'primary' : 'secondary'} icon={<Download className="h-4 w-4" />} className="w-full shrink-0 sm:w-auto">Download CSV</Button></div>{downloadStatus ? <p role="status" aria-live="polite" className="border-b border-emerald-100 bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-800">{downloadStatus}</p> : null}
                {generatedRows.length ? <div className="max-h-[28rem] overflow-y-auto"><div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-gray-200 bg-gray-50 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-gray-500"><span>Recipient and link</span><span>Action</span></div>{generatedRows.map((row, index) => <div key={`${row.whatsappLink}-${index}`} className="zapora-result-enter grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-gray-100 px-3.5 py-3 text-xs transition hover:bg-emerald-50/40 last:border-b-0" style={{ animationDelay: `${Math.min(index * 28, 280)}ms` }}><div className="min-w-0"><p className="font-bold text-gray-800">{row.countryCode} {row.phoneNumber}</p><p className="mt-0.5 truncate font-mono text-gray-600">{row.whatsappLink}</p>{row.message ? <p className="mt-0.5 truncate text-gray-500">Message: {row.message}</p> : null}</div><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(row.whatsappLink); setCopiedLink(row.whatsappLink); window.setTimeout(() => setCopiedLink(null), 1500); } catch { setCopiedLink(null); } }} className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20 ${copiedLink === row.whatsappLink ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-gray-200 text-gray-700 hover:border-emerald-200 hover:bg-emerald-50'}`} aria-label={`Copy generated WhatsApp link for ${row.countryCode} ${row.phoneNumber}`}>{copiedLink === row.whatsappLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copiedLink === row.whatsappLink ? 'Copied' : 'Copy'}</button></div>)}</div> : <div className="px-5 py-10 text-center"><span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100 text-gray-500"><Link2 className="h-5 w-5" /></span><p className="mt-3 text-sm font-bold text-gray-800">Your links will appear here</p><p className="mx-auto mt-1 max-w-xs text-sm leading-5 text-gray-500">Add contacts on the left, then generate to review, copy, or download the final CSV.</p></div>}</div>
            </div>
          </div>
        </Surface>

        <ToolHowItWorksSection heading="How the bulk WhatsApp link generator works" intro="Create multiple WhatsApp chat links from manual numbers or a CSV file, then download the final list in one clean CSV." steps={[{ title: 'Add your numbers', description: 'Paste multiple phone numbers manually or upload a CSV file with country_code, phone_number, and prefilled_message columns.' }, { title: 'Generate clean links', description: 'Zapora checks the rows, skips invalid entries where possible, and creates WhatsApp chat links with optional pre-filled messages.' }, { title: 'Download and share', description: 'Preview the generated links, copy what you need, or download the final CSV for campaigns, outreach, or internal use.' }]} />
        <ToolFaqSection heading="Bulk WhatsApp Link Generator FAQs" items={[{ question: 'Can I generate multiple WhatsApp links at once?', answer: 'Yes. Users can paste multiple phone numbers manually or upload a CSV file, then generate WhatsApp links in bulk.' }, { question: 'What CSV format should I use?', answer: 'Use country_code, phone_number, and prefilled_message columns. The sample CSV should contain the correct headers.' }, { question: 'Does Zapora store my bulk phone numbers?', answer: 'No. Bulk link generation remains client-side. Bulk numbers and messages are not sent to analytics or Google Sheets.' }, { question: 'Can I add different messages for different numbers?', answer: 'Yes. Each CSV row can include its own prefilled_message.' }, { question: 'Can I download the generated links?', answer: 'Yes. The generated output can be downloaded as a CSV file.' }]} />
      </div>
    </section>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  const toneClass = tone === 'success' ? 'text-emerald-700' : tone === 'error' ? 'text-rose-700' : tone === 'warning' ? 'text-amber-700' : tone === 'generated' ? 'text-cyan-700' : 'text-gray-800';
  const borderClass = tone === 'success' ? 'border-emerald-100' : tone === 'error' ? 'border-rose-100' : tone === 'warning' ? 'border-amber-100' : tone === 'generated' ? 'border-cyan-100' : 'border-gray-200';
  return <div className={`min-w-0 rounded-xl border bg-white p-3 shadow-[0_8px_18px_-16px_rgba(15,23,42,.5)] ${borderClass}`}><p className="truncate text-xs font-semibold text-gray-500">{label}</p><p className={`mt-1 text-xl font-bold tabular-nums ${toneClass}`}>{value}</p></div>;
}
