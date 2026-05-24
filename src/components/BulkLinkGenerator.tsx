import { useMemo, useState } from 'react';
import { AlertCircle, Check, ChevronDown, Copy, Download, Search, Upload } from 'lucide-react';
import { MAX_PHONE_LENGTH, MIN_PHONE_LENGTH, countryOptions, type CountryOption } from '../data/countryOptions';
import { trackEvent } from '../lib/trackEvent';

type BulkLinkRow = {
  phoneNumber: string;
  countryCode: string;
  message: string;
  whatsappLink: string;
};

type CsvInputRow = { countryCode: string; phoneNumber: string; prefilledMessage: string };
const sanitizeNumber = (rawValue: string) => rawValue.replace(/[^\d]/g, '');
const sanitizeManualInput = (rawValue: string) => rawValue.replace(/[^\d\n, +()-]/g, '');

const splitRawEntries = (rawInput: string) => rawInput.replace(/,/g, '\n').split(/\n+/).map((e) => e.trim()).filter(Boolean);
const EXPECTED_ERROR = 'We could not read this file. Please upload the sample CSV format and try again.';

const downloadTextFile = (content: string, name: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
};

function parseCsvLine(line: string) {
  const cells: string[] = []; let cur = ''; let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i += 1; } else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) { cells.push(cur.trim()); cur = ''; } else { cur += ch; }
  }
  cells.push(cur.trim());
  return cells;
}

function detectColumns(headers: string[]) {
  const normalized = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const findIndex = (keys: string[]) => normalized.findIndex((h) => keys.some((k) => h.includes(k)));
  return {
    cc: findIndex(['countrycode', 'country', 'code', 'dialcode']),
    phone: findIndex(['phonenumber', 'phone', 'mobile', 'number', 'whatsappnumber']),
    msg: findIndex(['prefilledmessage', 'message', 'text', 'msg']),
  };
}

export default function BulkLinkGenerator() {
  const indiaOption = countryOptions.find((option) => option.country === 'India') ?? countryOptions[0];
  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(indiaOption);
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [rawNumbers, setRawNumbers] = useState('');
  const [commonMessage, setCommonMessage] = useState('');
  const [uploadedRows, setUploadedRows] = useState<CsvInputRow[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [generatedRows, setGeneratedRows] = useState<BulkLinkRow[]>([]);
  const [invalidEntries, setInvalidEntries] = useState(0);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase();
    const sorted = [...countryOptions].sort((a, b) => a.country.localeCompare(b.country));
    const ordered = [indiaOption, ...sorted.filter((o) => o.country !== indiaOption.country)];
    return query ? ordered.filter((o) => o.country.toLowerCase().includes(query) || o.code.includes(query)) : ordered;
  }, [countrySearch, indiaOption]);

  const parseCsvFile = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) throw new Error(EXPECTED_ERROR);
    const header = parseCsvLine(lines[0]);
    const { cc, phone, msg } = detectColumns(header);
    const rows: CsvInputRow[] = [];

    for (const line of lines.slice(1)) {
      const cols = parseCsvLine(line);
      const fallbackPhone = cols.find((c) => sanitizeNumber(c).length >= MIN_PHONE_LENGTH) ?? '';
      const fallbackCc = cols.find((c) => /^\+?\d{1,4}$/.test(c.trim())) ?? selectedCountry.code;
      const rawPhone = phone >= 0 ? cols[phone] ?? '' : fallbackPhone;
      const rawCode = cc >= 0 ? cols[cc] ?? '' : fallbackCc;
      const message = msg >= 0 ? (cols[msg] ?? '') : '';
      const phoneNumber = sanitizeNumber(rawPhone);
      if (!phoneNumber) continue;
      const countryCode = rawCode.trim().startsWith('+') ? rawCode.trim() : `+${sanitizeNumber(rawCode) || selectedCountry.code.replace('+', '')}`;
      rows.push({ countryCode, phoneNumber, prefilledMessage: message.trim() });
    }
    if (!rows.length) throw new Error(EXPECTED_ERROR);
    return rows;
  };

  const handleGenerateLinks = () => {
    const sourceRows = uploadedRows.length
      ? uploadedRows.map((r) => `${r.countryCode}|${r.phoneNumber}|${r.prefilledMessage}`)
      : splitRawEntries(rawNumbers).map((num) => `${selectedCountry.code}|${num}|${commonMessage.trim()}`);

    if (!sourceRows.length) {
      setErrorMessage('Paste at least one phone number to generate bulk links.');
      setGeneratedRows([]);
      setInvalidEntries(0);
      return;
    }

    const { validRows, invalidCount } = sourceRows.reduce((acc, raw) => {
      const [countryCodeRaw, phoneRaw, messageRaw] = raw.split('|');
      const digits = sanitizeNumber(phoneRaw);
      const isInvalidLength = digits.length < MIN_PHONE_LENGTH || digits.length > MAX_PHONE_LENGTH;
      const repeatedDigits = /^(\d)\1+$/.test(digits);
      if (!digits || isInvalidLength || repeatedDigits) { acc.invalidCount += 1; return acc; }
      const cleanCc = (countryCodeRaw || selectedCountry.code).replace(/[^\d+]/g, '').replace(/^([^+])/, '+$1');
      const fullNumber = `${cleanCc.replace('+', '')}${digits}`;
      const safeMessage = (messageRaw ?? '').trim();
      const whatsappLink = safeMessage ? `https://wa.me/${fullNumber}?text=${encodeURIComponent(safeMessage)}` : `https://wa.me/${fullNumber}`;
      acc.validRows.push({ phoneNumber: digits, countryCode: cleanCc, message: safeMessage, whatsappLink });
      return acc;
    }, { validRows: [] as BulkLinkRow[], invalidCount: 0 });

    if (!validRows.length) {
      setGeneratedRows([]); setInvalidEntries(invalidCount); setErrorMessage('No valid phone numbers found. Check your input and try again.'); return;
    }
    setGeneratedRows(validRows); setInvalidEntries(invalidCount); setErrorMessage(''); setCopiedLink(null);
    trackEvent('bulk_generate_links', { source: 'bulk_generator', generated_count: validRows.length, has_message: validRows.some((r) => Boolean(r.message)) });
  };

  const copyLink = async (link: string) => { try { await navigator.clipboard.writeText(link); setCopiedLink(link); setTimeout(() => setCopiedLink(null), 1800); } catch { setCopiedLink(null); } };

  return <section id="bulk-generator" className="bg-white py-12 sm:py-14 lg:py-16">{/* shortened for brevity in patch */}
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="mb-6 text-center sm:mb-8"><h2 className="text-2xl font-bold tracking-tight text-gray-950 sm:text-4xl">Bulk WhatsApp Link Generator</h2></div>
      <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-lg shadow-green-100/50 sm:p-7">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
          <div className="space-y-4"><label className="block text-sm font-semibold text-gray-800">Country code</label><div className="relative"><button type="button" onClick={() => setIsCountryOpen((p) => !p)} className="flex w-full items-center justify-between rounded-xl border border-gray-300 px-4 py-3 text-left text-sm text-gray-900"><span>{selectedCountry.country} ({selectedCountry.code})</span><ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isCountryOpen ? 'rotate-180' : ''}`} /></button>{isCountryOpen ? <div className="absolute z-20 mt-2 w-full rounded-xl border border-gray-200 bg-white p-3 shadow-xl"><div className="relative mb-2"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={countrySearch} onChange={(e) => setCountrySearch(e.target.value)} placeholder="Search country or code" className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm" /></div><div className="max-h-56 overflow-y-auto">{filteredCountries.map((option) => <button key={`${option.country}-${option.code}`} type="button" onClick={() => { setSelectedCountry(option); setIsCountryOpen(false); setCountrySearch(''); }} className="flex w-full justify-between rounded-md px-3 py-2 text-sm text-gray-800 hover:bg-green-50"><span>{option.country}</span><span className="text-gray-500">{option.code}</span></button>)}</div></div> : null}</div>
            <label className="block text-sm font-semibold text-gray-800">Phone numbers</label>
            <textarea value={rawNumbers} onChange={(e) => setRawNumbers(sanitizeManualInput(e.target.value))} rows={8} placeholder={'9876543210\n9876543211'} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900" />
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-emerald-700"><Upload className="h-4 w-4" />Upload CSV<input type="file" accept=".csv,text/csv" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { const parsed = await parseCsvFile(file); setUploadedRows(parsed); setCsvFileName(file.name); setErrorMessage(''); } catch { setUploadedRows([]); setCsvFileName(''); setErrorMessage(EXPECTED_ERROR); } finally { e.currentTarget.value = ''; } }} /></label>
            <button type="button" onClick={() => downloadTextFile('country_code,phone_number,prefilled_message\n+91,9876543210,Hi! I would like to know more.\n+91,9876543211,Hello, please share details.\n+1,4155550101,Hi from Zapora bulk generator.', 'zapora-bulk-sample.csv')} className="text-xs font-semibold text-emerald-700 underline">Download sample CSV</button>
            {csvFileName ? <p className="text-xs text-gray-600">Using uploaded file: <span className="font-medium">{csvFileName}</span> ({uploadedRows.length} rows)</p> : null}
          </div>
          <div className="space-y-4"><label className="block text-sm font-semibold text-gray-800">Common pre-filled message (manual mode)</label><textarea value={commonMessage} onChange={(e) => setCommonMessage(e.target.value)} rows={4} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900" /><button onClick={handleGenerateLinks} className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-3 text-sm font-semibold text-white">Generate Bulk Links</button>{errorMessage ? <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4" />{errorMessage}</div> : null}</div>
        </div>
        {generatedRows.length ? <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-gray-800">Generated: {generatedRows.length} · Skipped: {invalidEntries}</p><button onClick={() => { const esc = (v: string) => `"${v.replace(/"/g, '""')}"`; const head = 'country_code,phone_number,whatsapp_link,prefilled_message'; const rows = generatedRows.map((r) => [esc(r.countryCode), esc(r.phoneNumber), esc(r.whatsappLink), esc(r.message)].join(',')); downloadTextFile([head, ...rows].join('\n'), 'zapora-bulk-whatsapp-links.csv'); }} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700"><Download className="h-3.5 w-3.5" />Download CSV</button></div><div className="max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white">{generatedRows.map((row) => <div key={row.whatsappLink} className="flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 text-xs"><span className="truncate text-gray-700">{row.whatsappLink}</span><button onClick={() => copyLink(row.whatsappLink)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1">{copiedLink === row.whatsappLink ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}Copy</button></div>)}</div></div> : null}
      </div>
    </div>
  </section>;
}
