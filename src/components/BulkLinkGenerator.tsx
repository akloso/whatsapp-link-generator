import { useMemo, useState } from 'react';
import { AlertCircle, Check, ChevronDown, Copy, Download, Files, Loader2, Search, Upload } from 'lucide-react';
import { MAX_PHONE_LENGTH, MIN_PHONE_LENGTH, countryOptions, type CountryOption } from '../data/countryOptions';
import { trackEvent } from '../lib/trackEvent';
import { ToolFaqSection, ToolHowItWorksSection } from './ToolPageSupportSections';
import { EmptyState, pageShell, previewPanel, primaryButton, secondaryButton, textareaClass, toolPanel, ToolPageIntro } from './uiSystem';

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
  const [inputMode, setInputMode] = useState<'manual' | 'csv'>('manual');

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

  const totalRows = generatedRows.length + invalidEntries + duplicateEntries;

  return <section className="bg-gradient-to-b from-white via-green-50/30 to-white py-8 sm:py-12"><div className={pageShell}>
    <ToolPageIntro icon={Files} eyebrow="Private bulk tool" title="Bulk WhatsApp Link Generator" description="Generate multiple WhatsApp chat links from pasted numbers or a CSV file. Everything is processed in your browser." />

    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start">
      <div className={toolPanel}>
        <div role="tablist" aria-label="Bulk input method" className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold text-slate-600">
          {(['manual', 'csv'] as const).map((mode) => <button key={mode} type="button" role="tab" aria-selected={inputMode === mode} onClick={() => setInputMode(mode)} className={`rounded-lg px-3 py-2 transition ${inputMode === mode ? 'bg-white text-emerald-700 shadow-sm' : 'hover:text-slate-900'}`}>{mode === 'manual' ? 'Manual input' : 'CSV upload'}</button>)}
        </div>

        {inputMode === 'manual' ? <div className="space-y-4">
          <div className="space-y-1.5"><label className="block text-sm font-semibold text-slate-900">Country code</label><div className="relative"><button type="button" onClick={() => setIsCountryOpen((p) => !p)} className="flex h-11 w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-3 text-left text-sm text-slate-900 shadow-sm"><span className="truncate">{selectedCountry.country} ({selectedCountry.code})</span><ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${isCountryOpen ? 'rotate-180' : ''}`} /></button>{isCountryOpen ? <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-xl"><div className="relative mb-2"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={countrySearch} onChange={(e) => setCountrySearch(e.target.value)} placeholder="Search country or code" className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm" /></div><div className="max-h-56 overflow-y-auto">{filteredCountries.map((o) => <button key={`${o.country}-${o.code}`} type="button" onClick={() => { setSelectedCountry(o); setIsCountryOpen(false); setCountrySearch(''); }} className="flex w-full justify-between rounded-md px-3 py-2 text-sm text-slate-800 hover:bg-emerald-50"><span>{o.country}</span><span className="text-slate-500">{o.code}</span></button>)}</div></div> : null}</div></div>
          <div className="space-y-1.5"><label className="block text-sm font-semibold text-slate-900">Phone numbers</label><textarea value={rawNumbers} onChange={(e) => setRawNumbers(sanitizeManualInput(e.target.value))} rows={6} placeholder="One number per line, or comma-separated" className={textareaClass} /><p className="text-xs text-slate-500">Use local numbers for the selected country. Invalid and duplicate rows are skipped.</p></div>
          <div className="space-y-1.5"><label className="block text-sm font-semibold text-slate-900">Common pre-filled message</label><textarea value={commonMessage} onChange={(e) => setCommonMessage(e.target.value)} rows={3} placeholder="Optional message for every manual link" className={textareaClass} /></div>
        </div> : <div className="space-y-4">
          <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/35 p-4"><label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"><Upload className="h-4 w-4" />Upload CSV<input type="file" accept=".csv,text/csv" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; setUploadedRows([]); setUploadSummary(null); setCsvFileName(''); setErrorMessage(''); resetGenerated(); setIsParsingCsv(true); try { const parsed = await parseCsvFile(file); setUploadedRows(parsed.rows); setUploadSummary(parsed.summary); setCsvFileName(file.name); } catch { setErrorMessage(EXPECTED_ERROR); } finally { setIsParsingCsv(false); e.currentTarget.value = ''; } }} /></label><button type="button" onClick={() => downloadTextFile('country_code,phone_number,prefilled_message', 'zapora-bulk-sample.csv')} className={`${secondaryButton} ml-2 mt-2 sm:mt-0`}>Download sample CSV</button><p className="mt-3 text-xs leading-5 text-slate-600">Required headers: <code>country_code,phone_number,prefilled_message</code>. The sample CSV contains headers only.</p>{csvFileName ? <p className="mt-2 text-xs font-medium text-emerald-700">Selected file: {csvFileName}</p> : null}</div>
          {isParsingCsv ? <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700"><Loader2 className="h-3.5 w-3.5 animate-spin" />Analyzing CSV…</div> : null}
          {uploadSummary ? <div className="grid grid-cols-2 gap-2 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 text-xs text-slate-700"><p>Total rows: <span className="font-semibold">{uploadSummary.totalRows}</span></p><p>Valid rows: <span className="font-semibold">{uploadSummary.validRows}</span></p><p>Duplicates: <span className="font-semibold">{uploadSummary.duplicateRows}</span></p><p>Invalid: <span className="font-semibold">{uploadSummary.invalidRows}</span></p></div> : null}
        </div>}

        <div className="mt-5 flex flex-wrap items-center gap-3"><button onClick={handleGenerateLinks} className={primaryButton}>Generate bulk links</button>{errorMessage ? <div className="flex items-start gap-2 text-sm font-medium text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4" />{errorMessage}</div> : null}</div>
      </div>

      <aside className={previewPanel}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-bold text-slate-950">Results</h2><p className="text-sm text-slate-500">Valid links stay in this scrollable panel.</p></div>{generatedRows.length ? <button onClick={() => { const head = 'country_code,phone_number,whatsapp_link,prefilled_message'; const rows = generatedRows.map((r) => [esc(r.countryCode), esc(r.phoneNumber), esc(r.whatsappLink), esc(r.message)].join(',')); downloadTextFile([head, ...rows].join('\n'), 'zapora-bulk-whatsapp-links.csv'); }} className={secondaryButton}><Download className="h-4 w-4" />Download CSV</button> : null}</div>
        {generatedRows.length ? <><div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{[['Total', totalRows], ['Valid', generatedRows.length], ['Invalid', invalidEntries], ['Duplicates', duplicateEntries]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-lg font-bold text-slate-950">{value}</p></div>)}</div><div className="max-h-[28rem] overflow-y-auto rounded-xl border border-slate-200 bg-white">{generatedRows.map((row) => <div key={row.whatsappLink} className="flex min-w-0 items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 text-xs"><span className="min-w-0 truncate text-slate-700">{row.whatsappLink}</span><button onClick={async () => { try { await navigator.clipboard.writeText(row.whatsappLink); setCopiedLink(row.whatsappLink); setTimeout(() => setCopiedLink(null), 1500); } catch { setCopiedLink(null); } }} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-semibold hover:bg-emerald-50">{copiedLink === row.whatsappLink ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}Copy</button></div>)}</div></> : <EmptyState icon={Files} title="Generate links to see results" description="Your valid WhatsApp links, row counts, skipped duplicates, and CSV download will appear here without sending bulk data to Zapora." />}
      </aside>
    </div>

    <ToolHowItWorksSection
      heading="How the bulk WhatsApp link generator works"
      intro="Create multiple WhatsApp chat links from manual numbers or a CSV file, then download the final list in one clean CSV."
      steps={[{ title: 'Add your numbers', description: 'Paste multiple phone numbers manually or upload a CSV file with country_code, phone_number, and prefilled_message columns.' }, { title: 'Generate clean links', description: 'Zapora checks the rows, skips invalid entries where possible, and creates WhatsApp chat links with optional pre-filled messages.' }, { title: 'Download and share', description: 'Preview the generated links, copy what you need, or download the final CSV for campaigns, outreach, or internal use.' }]}
    />
    <ToolFaqSection heading="Bulk WhatsApp Link Generator FAQs" items={[{ question: 'Can I generate multiple WhatsApp links at once?', answer: 'Yes. You can paste multiple phone numbers manually or upload a CSV file, then generate WhatsApp links in bulk.' }, { question: 'What CSV format should I use?', answer: 'Use these columns: country_code, phone_number, and prefilled_message. The sample CSV on the page includes the correct headers.' }, { question: 'Does Zapora store my bulk phone numbers?', answer: 'No. Bulk link generation stays client-side. Bulk phone numbers and messages are not sent to analytics or Google Sheets.' }, { question: 'Can I add different messages for different numbers?', answer: 'Yes. Add a prefilled_message value for each row in your CSV to create links with different messages.' }, { question: 'Can I download the generated links?', answer: 'Yes. After generating the links, you can download the final output as a CSV file.' }]} />
  </div></section>;
}
