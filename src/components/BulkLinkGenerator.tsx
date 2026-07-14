import { useMemo, useState } from 'react';
import { AlertCircle, Check, ChevronDown, Copy, Download, FileText, Loader2, Search, Upload } from 'lucide-react';
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
const sanitizeNumber = (v: string) => v.replace(/[^\d]/g, '');
const sanitizeManualInput = (v: string) => v.replace(/[^\d\n, +()-]/g, '');
const splitRawEntries = (raw: string) => raw.replace(/,/g, '\n').split(/\n+/).map((x) => x.trim()).filter(Boolean);
const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let inQ = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQ = !inQ;
      }
    } else if (ch === ',' && !inQ) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  cells.push(current.trim());
  return cells;
}

function detectColumns(headers: string[]) {
  const n = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const find = (keys: string[]) => n.findIndex((h) => keys.some((k) => h.includes(k)));
  return { cc: find(['countrycode', 'country', 'dialcode', 'code']), phone: find(['phonenumber', 'phone', 'mobile', 'number']), msg: find(['prefilledmessage', 'message', 'text']) };
}

const downloadTextFile = (content: string, name: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export default function BulkLinkGenerator() {
  const indiaOption = countryOptions.find((o) => o.country === 'India') ?? countryOptions[0];
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
    const q = countrySearch.trim().toLowerCase();
    const sorted = [...countryOptions].sort((a, b) => a.country.localeCompare(b.country));
    const ordered = [indiaOption, ...sorted.filter((x) => x.country !== indiaOption.country)];
    return q ? ordered.filter((x) => x.country.toLowerCase().includes(q) || x.code.includes(q)) : ordered;
  }, [countrySearch, indiaOption]);

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
    const header = parseCsvLine(lines[0]);
    const { cc, phone, msg } = detectColumns(header);

    const rows: CsvInputRow[] = [];
    let invalid = 0;
    let duplicates = 0;
    const details: string[] = [];
    const seen = new Set<string>();

    for (const [index, line] of lines.slice(1).entries()) {
      const rowNumber = index + 2;
      const cols = parseCsvLine(line);
      const rawPhone = phone >= 0 ? (cols[phone] ?? '') : (cols.find((c) => sanitizeNumber(c).length >= MIN_PHONE_LENGTH) ?? '');
      const rawCode = cc >= 0 ? (cols[cc] ?? '') : selectedCountry.code;
      const rawMsg = msg >= 0 ? (cols[msg] ?? '') : '';
      const digits = sanitizeNumber(rawPhone);

      if (!digits || digits.length < MIN_PHONE_LENGTH || digits.length > MAX_PHONE_LENGTH || /^(\d)\1+$/.test(digits)) {
        invalid += 1;
        if (details.length < 8) details.push(`Row ${rowNumber}: phone number is missing, too short, too long, or repeated digits.`);
        continue;
      }
      const cleanCc = rawCode.trim().startsWith('+') ? rawCode.trim() : `+${sanitizeNumber(rawCode) || selectedCountry.code.replace('+', '')}`;
      const key = `${cleanCc}:${digits}`;
      if (seen.has(key)) {
        duplicates += 1;
        if (details.length < 8) details.push(`Row ${rowNumber}: duplicate phone number skipped.`);
        continue;
      }
      seen.add(key);
      rows.push({ countryCode: cleanCc, phoneNumber: digits, prefilledMessage: rawMsg.trim() });
    }

    if (!rows.length) throw new Error(EXPECTED_ERROR);
    return { rows, summary: { totalRows: lines.length - 1, validRows: rows.length, duplicateRows: duplicates, invalidRows: invalid, invalidDetails: details } };
  };

  const handleGenerateLinks = () => {
    const baseRows = inputMethod === 'csv' && uploadedRows.length
      ? uploadedRows.map((r, index) => ({ cc: r.countryCode, phone: r.phoneNumber, msg: r.prefilledMessage, rowNumber: index + 2 }))
      : splitRawEntries(rawNumbers).map((phone, index) => ({ cc: selectedCountry.code, phone, msg: commonMessage.trim(), rowNumber: index + 1 }));

    if (!baseRows.length) {
      setErrorMessage(inputMethod === 'csv' ? 'Upload a CSV with at least one valid row before generating.' : 'Paste at least one phone number to generate bulk links.');
      resetGenerated();
      return;
    }

    const seen = new Set<string>();
    let invalid = 0;
    let duplicate = 0;
    const details: string[] = [];
    const rows: BulkLinkRow[] = [];

    for (const item of baseRows) {
      const digits = sanitizeNumber(item.phone);
      if (!digits || digits.length < MIN_PHONE_LENGTH || digits.length > MAX_PHONE_LENGTH || /^(\d)\1+$/.test(digits)) {
        invalid += 1;
        if (details.length < 8) details.push(`${inputMethod === 'csv' ? `Row ${item.rowNumber}` : `Entry ${item.rowNumber}`}: phone number is missing, too short, too long, or repeated digits.`);
        continue;
      }
      const cleanCc = (item.cc || selectedCountry.code).replace(/[^\d+]/g, '').replace(/^([^+])/, '+$1');
      const key = `${cleanCc}:${digits}`;
      if (seen.has(key)) {
        duplicate += 1;
        if (details.length < 8) details.push(`${inputMethod === 'csv' ? `Row ${item.rowNumber}` : `Entry ${item.rowNumber}`}: duplicate phone number skipped.`);
        continue;
      }
      seen.add(key);
      const full = `${cleanCc.replace('+', '')}${digits}`;
      const message = item.msg.trim();
      rows.push({ phoneNumber: digits, countryCode: cleanCc, message, whatsappLink: message ? `https://wa.me/${full}?text=${encodeURIComponent(message)}` : `https://wa.me/${full}` });
    }

    if (!rows.length) {
      setErrorMessage('No valid phone numbers found. Check your input and try again.');
      setGeneratedRows([]);
      setInvalidEntries(invalid);
      setDuplicateEntries(duplicate);
      setInvalidDetails(details);
      return;
    }
    setErrorMessage('');
    setGeneratedRows(rows);
    setInvalidEntries(invalid);
    setDuplicateEntries(duplicate);
    setInvalidDetails(details);
    setCopiedLink(null);
    setDownloadStatus('');
    trackEvent('bulk_generate_links', { source: 'bulk_generator', generated_count: rows.length, has_message: rows.some((r) => Boolean(r.message)) });
  };

  const downloadGeneratedCsv = () => {
    const head = 'country_code,phone_number,whatsapp_link,prefilled_message';
    const rows = generatedRows.map((r) => [esc(r.countryCode), esc(r.phoneNumber), esc(r.whatsappLink), esc(r.message)].join(','));
    downloadTextFile([head, ...rows].join('\n'), 'zapora-bulk-whatsapp-links.csv');
    setDownloadStatus('Generated CSV downloaded.');
    window.setTimeout(() => setDownloadStatus(''), 2200);
  };

  const summaryStats = [
    { label: 'Total rows', value: inputMethod === 'csv' ? uploadSummary?.totalRows ?? uploadedRows.length : splitRawEntries(rawNumbers).length, tone: 'neutral' },
    { label: 'Valid', value: generatedRows.length || uploadSummary?.validRows || 0, tone: 'success' },
    { label: 'Invalid', value: invalidEntries || uploadSummary?.invalidRows || 0, tone: 'error' },
    { label: 'Duplicates', value: duplicateEntries || uploadSummary?.duplicateRows || 0, tone: 'warning' },
    { label: 'Generated', value: generatedRows.length, tone: 'success' },
  ];

  return (
    <section className="bg-white py-6 sm:py-8 lg:py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-5 max-w-3xl sm:mb-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800">
            <FileText className="h-3.5 w-3.5" /> Bulk workflow
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">Bulk WhatsApp Link Generator</h1>
          <p className="mt-2 text-sm leading-6 text-gray-600 sm:text-base">
            Paste many numbers or upload a CSV, validate rows locally, generate clean WhatsApp links, and download the final CSV.
          </p>
        </div>

        <Surface className="p-4 sm:p-5 lg:p-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(320px,1fr)] lg:gap-6">
            <div className="min-w-0 space-y-4">
              <div role="tablist" aria-label="Bulk input method" className="grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1">
                {(['manual', 'csv'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    role="tab"
                    aria-selected={inputMethod === method}
                    onClick={() => { setInputMethod(method); setErrorMessage(''); }}
                    className={`min-h-10 rounded-xl px-3 py-2 text-sm font-semibold transition ${inputMethod === method ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-600 hover:text-gray-950'}`}
                  >
                    {method === 'manual' ? 'Manual input' : 'CSV upload'}
                  </button>
                ))}
              </div>

              {inputMethod === 'manual' ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="bulk-country">Country code</FieldLabel>
                    <div className="relative">
                      <button
                        id="bulk-country"
                        type="button"
                        onClick={() => setIsCountryOpen((p) => !p)}
                        className="flex min-h-11 w-full items-center justify-between rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-left text-sm text-gray-900 transition hover:border-gray-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-500/15"
                        aria-haspopup="listbox"
                        aria-expanded={isCountryOpen}
                      >
                        <span className="truncate">{selectedCountry.country} ({selectedCountry.code})</span>
                        <ChevronDown className={`h-4 w-4 flex-none text-gray-500 transition-transform ${isCountryOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isCountryOpen ? (
                        <div className="absolute left-0 right-0 z-20 mt-2 max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
                          <div className="relative mb-2">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input value={countrySearch} onChange={(e) => setCountrySearch(e.target.value)} placeholder="Search country or code" className="min-h-10 w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus-visible:border-green-500 focus-visible:ring-4 focus-visible:ring-green-500/15" />
                          </div>
                          <div role="listbox" className="max-h-56 overflow-y-auto rounded-xl border border-gray-100">
                            {filteredCountries.map((o) => (
                              <button key={`${o.country}-${o.code}`} type="button" role="option" aria-selected={o.code === selectedCountry.code && o.country === selectedCountry.country} onClick={() => { setSelectedCountry(o); setIsCountryOpen(false); setCountrySearch(''); }} className="flex w-full justify-between gap-3 px-3 py-2.5 text-left text-sm text-gray-800 transition hover:bg-green-50">
                                <span className="min-w-0 truncate">{o.country}</span><span className="flex-none text-gray-500">{o.code}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="bulk-numbers">Phone numbers</FieldLabel>
                    <Textarea
                      id="bulk-numbers"
                      value={rawNumbers}
                      onChange={(e) => { setRawNumbers(sanitizeManualInput(e.target.value)); resetGenerated(); }}
                      rows={6}
                      placeholder="9876543210\n98765 43210\n+91 98765 43210"
                      className="min-h-[140px]"
                    />
                    <p className="text-sm text-gray-500">One number per line or comma-separated. Digits, spaces, +, hyphens, and parentheses are supported.</p>
                  </div>

                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="bulk-message" optional>Common pre-filled message</FieldLabel>
                    <Textarea id="bulk-message" value={commonMessage} onChange={(e) => setCommonMessage(e.target.value)} rows={3} placeholder="Optional message added to every manual link" className="min-h-[88px]" />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4 transition hover:bg-gray-100">
                    <span className="block text-sm font-semibold text-gray-900">Upload CSV file</span>
                    <span className="mt-1 block text-sm text-gray-600">Accepted format: country_code, phone_number, prefilled_message</span>
                    <span className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700">
                      <Upload className="h-4 w-4" /> {isParsingCsv ? 'Analyzing CSV…' : 'Choose CSV'}
                    </span>
                    {csvFileName ? <span className="mt-2 block truncate text-xs font-medium text-gray-700">Selected: {csvFileName}</span> : null}
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="sr-only"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
                          setCsvFileName(file.name);
                          setErrorMessage('Please upload a CSV file. Download the sample if you need the header format.');
                          e.currentTarget.value = '';
                          return;
                        }
                        setUploadedRows([]);
                        setUploadSummary(null);
                        setCsvFileName(file.name);
                        setErrorMessage('');
                        resetGenerated();
                        setIsParsingCsv(true);
                        try {
                          const parsed = await parseCsvFile(file);
                          setUploadedRows(parsed.rows);
                          setUploadSummary(parsed.summary);
                          setInvalidDetails(parsed.summary.invalidDetails);
                        } catch {
                          setErrorMessage(EXPECTED_ERROR);
                        } finally {
                          setIsParsingCsv(false);
                          e.currentTarget.value = '';
                        }
                      }}
                    />
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button type="button" variant="secondary" onClick={() => downloadTextFile(SAMPLE_CSV, 'zapora-bulk-sample.csv')} icon={<Download className="h-4 w-4" />} className="w-full sm:w-auto">
                      Download sample CSV
                    </Button>
                    {isParsingCsv ? <div className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-green-50 px-3 py-2 text-sm font-medium text-green-800"><Loader2 className="h-4 w-4 animate-spin" /> Analyzing locally</div> : null}
                  </div>
                  {uploadSummary ? <p className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">CSV parsed successfully. {uploadSummary.validRows} valid rows are ready.</p> : null}
                </div>
              )}

              <Button onClick={handleGenerateLinks} variant="primary" className="w-full text-base" disabled={isParsingCsv}>
                Generate Bulk Links
              </Button>
              {errorMessage ? <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 flex-none" />{errorMessage}</div> : null}
            </div>

            <div className="min-w-0 space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-2 xl:grid-cols-5">
                {summaryStats.map((stat) => <StatCard key={stat.label} label={stat.label} value={stat.value} tone={stat.tone} />)}
              </div>

              {invalidDetails.length ? (
                <div className="max-h-32 overflow-y-auto rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="mb-1 font-semibold">Rows skipped</p>
                  <ul className="space-y-1">
                    {invalidDetails.map((detail) => <li key={detail}>{detail}</li>)}
                  </ul>
                </div>
              ) : null}

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 sm:p-4">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-950">Generated results</h2>
                    <p className="text-sm text-gray-600">{generatedRows.length ? `${generatedRows.length} links generated. ${duplicateEntries} duplicates and ${invalidEntries} invalid rows skipped.` : 'Generate links to preview and download the final CSV.'}</p>
                  </div>
                  <Button onClick={downloadGeneratedCsv} disabled={!generatedRows.length} variant="secondary" icon={<Download className="h-4 w-4" />} className="w-full sm:w-auto">
                    Download CSV
                  </Button>
                </div>
                {downloadStatus ? <p role="status" aria-live="polite" className="mb-2 text-sm font-medium text-green-700">{downloadStatus}</p> : null}

                {generatedRows.length ? (
                  <div className="max-h-96 overflow-y-auto rounded-xl border border-gray-200 bg-white">
                    <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-gray-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <span>Link</span><span>Action</span>
                    </div>
                    {generatedRows.map((row, index) => (
                      <div key={`${row.whatsappLink}-${index}`} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-gray-100 px-3 py-2 text-xs last:border-b-0">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800">{row.countryCode} {row.phoneNumber}</p>
                          <p className="truncate font-mono text-gray-600">{row.whatsappLink}</p>
                          {row.message ? <p className="truncate text-gray-500">Message: {row.message}</p> : null}
                        </div>
                        <button onClick={async () => { try { await navigator.clipboard.writeText(row.whatsappLink); setCopiedLink(row.whatsappLink); setTimeout(() => setCopiedLink(null), 1500); } catch { setCopiedLink(null); } }} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 font-semibold text-gray-700 transition hover:bg-gray-50" aria-label="Copy generated WhatsApp link">
                          {copiedLink === row.whatsappLink ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />} Copy
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
                    Add numbers or upload a CSV, then generate links to see results here.
                  </div>
                )}
              </div>
            </div>
          </div>
        </Surface>

        <ToolHowItWorksSection
          heading="How the bulk WhatsApp link generator works"
          intro="Create multiple WhatsApp chat links from manual numbers or a CSV file, then download the final list in one clean CSV."
          steps={[
            { title: 'Add your numbers', description: 'Paste multiple phone numbers manually or upload a CSV file with country_code, phone_number, and prefilled_message columns.' },
            { title: 'Generate clean links', description: 'Zapora checks the rows, skips invalid entries where possible, and creates WhatsApp chat links with optional pre-filled messages.' },
            { title: 'Download and share', description: 'Preview the generated links, copy what you need, or download the final CSV for campaigns, outreach, or internal use.' },
          ]}
        />

        <ToolFaqSection
          heading="Bulk WhatsApp Link Generator FAQs"
          items={[
            { question: 'Can I generate multiple WhatsApp links at once?', answer: 'Yes. Users can paste multiple phone numbers manually or upload a CSV file, then generate WhatsApp links in bulk.' },
            { question: 'What CSV format should I use?', answer: 'Use country_code, phone_number, and prefilled_message columns. The sample CSV should contain the correct headers.' },
            { question: 'Does Zapora store my bulk phone numbers?', answer: 'No. Bulk link generation should remain client-side. Do not send bulk numbers or messages to analytics or Google Sheets.' },
            { question: 'Can I add different messages for different numbers?', answer: 'Yes. Each CSV row can include its own prefilled_message.' },
            { question: 'Can I download the generated links?', answer: 'Yes. The generated output can be downloaded as a CSV file.' },
          ]}
        />
      </div>
    </section>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  const toneClass = tone === 'success' ? 'text-green-700' : tone === 'error' ? 'text-red-700' : tone === 'warning' ? 'text-amber-700' : 'text-gray-800';
  return (
    <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-3">
      <p className="truncate text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}
