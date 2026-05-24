import { useMemo, useState } from 'react';
import { AlertCircle, Check, ChevronDown, Copy, Download, Search } from 'lucide-react';
import { MAX_PHONE_LENGTH, MIN_PHONE_LENGTH, countryOptions, type CountryOption } from '../data/countryOptions';
import { trackEvent } from '../lib/trackEvent';

type BulkLinkRow = {
  phoneNumber: string;
  countryCode: string;
  message: string;
  whatsappLink: string;
};

const sanitizeNumber = (rawValue: string) => rawValue.replace(/[^\d]/g, '');

const splitRawEntries = (rawInput: string) => rawInput
  .replace(/,/g, '\n')
  .split(/\n+/)
  .flatMap((line) => line.trim().split(/\s+/))
  .map((entry) => entry.trim())
  .filter(Boolean);

export default function BulkLinkGenerator() {
  const indiaOption = countryOptions.find((option) => option.country === 'India') ?? countryOptions[0];
  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(indiaOption);
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [rawNumbers, setRawNumbers] = useState('');
  const [commonMessage, setCommonMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [generatedRows, setGeneratedRows] = useState<BulkLinkRow[]>([]);
  const [invalidEntries, setInvalidEntries] = useState(0);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase();
    const sortedCountries = [...countryOptions].sort((a, b) => a.country.localeCompare(b.country));
    const orderedCountries = indiaOption
      ? [indiaOption, ...sortedCountries.filter((option) => option.country !== indiaOption.country)]
      : sortedCountries;

    if (!query) return orderedCountries;

    return orderedCountries.filter((option) => option.country.toLowerCase().includes(query) || option.code.includes(query));
  }, [countrySearch, indiaOption]);

  const handleGenerateLinks = () => {
    const entries = splitRawEntries(rawNumbers);

    if (!entries.length) {
      setErrorMessage('Paste at least one phone number to generate bulk links.');
      setGeneratedRows([]);
      setInvalidEntries(0);
      return;
    }

    const trimmedMessage = commonMessage.trim();
    const encodedMessage = encodeURIComponent(trimmedMessage);

    const { validRows, invalidCount } = entries.reduce(
      (acc, entry) => {
        const digits = sanitizeNumber(entry);
        const isInvalidLength = digits.length < MIN_PHONE_LENGTH || digits.length > MAX_PHONE_LENGTH;
        const repeatedDigits = /^(\d)\1+$/.test(digits);

        if (!digits || isInvalidLength || repeatedDigits) {
          acc.invalidCount += 1;
          return acc;
        }

        const fullNumber = `${selectedCountry.code.replace('+', '')}${digits}`;
        const whatsappLink = trimmedMessage
          ? `https://wa.me/${fullNumber}?text=${encodedMessage}`
          : `https://wa.me/${fullNumber}`;

        acc.validRows.push({
          phoneNumber: digits,
          countryCode: selectedCountry.code,
          message: trimmedMessage,
          whatsappLink,
        });

        return acc;
      },
      { validRows: [] as BulkLinkRow[], invalidCount: 0 },
    );

    if (!validRows.length) {
      setGeneratedRows([]);
      setInvalidEntries(invalidCount);
      setErrorMessage('No valid phone numbers found. Check your input and try again.');
      return;
    }

    setGeneratedRows(validRows);
    setInvalidEntries(invalidCount);
    setErrorMessage('');
    setCopiedLink(null);

    trackEvent('bulk_generate_links', {
      source: 'homepage_bulk_generator',
      generated_count: validRows.length,
      has_message: Boolean(trimmedMessage),
    });
  };

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(link);
      window.setTimeout(() => setCopiedLink(null), 1800);
    } catch {
      setCopiedLink(null);
    }
  };

  const downloadCsv = () => {
    if (!generatedRows.length) return;

    const csvEscape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const csvHeader = 'phone_number,country_code,whatsapp_link,message';
    const csvRows = generatedRows.map((row) => [
      csvEscape(row.phoneNumber),
      csvEscape(row.countryCode),
      csvEscape(row.whatsappLink),
      csvEscape(row.message),
    ].join(','));

    const csvBlob = new Blob([[csvHeader, ...csvRows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(csvBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'zapora-bulk-whatsapp-links.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <section id="bulk-generator" className="bg-white py-12 sm:py-14 lg:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 text-center sm:mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-gray-950 sm:text-4xl">Bulk WhatsApp Link Generator</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-gray-600 sm:text-base">Paste multiple numbers and generate ready-to-share WhatsApp links in seconds.</p>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-lg shadow-green-100/50 sm:p-7">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-800">Country code</label>
              <div className="relative">
                <button type="button" onClick={() => setIsCountryOpen((prev) => !prev)} className="flex w-full items-center justify-between rounded-xl border border-gray-300 px-4 py-3 text-left text-sm text-gray-900">
                  <span>{selectedCountry.country} ({selectedCountry.code})</span>
                  <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isCountryOpen ? 'rotate-180' : ''}`} />
                </button>
                {isCountryOpen ? (
                  <div className="absolute z-20 mt-2 w-full rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
                    <div className="relative mb-2">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input value={countrySearch} onChange={(e) => setCountrySearch(e.target.value)} placeholder="Search country or code" className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm" />
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      {filteredCountries.map((option) => (
                        <button key={`${option.country}-${option.code}`} type="button" onClick={() => { setSelectedCountry(option); setIsCountryOpen(false); setCountrySearch(''); }} className="flex w-full justify-between rounded-md px-3 py-2 text-sm text-gray-800 hover:bg-green-50">
                          <span>{option.country}</span>
                          <span className="text-gray-500">{option.code}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <label className="block text-sm font-semibold text-gray-800">Phone numbers</label>
              <textarea
                value={rawNumbers}
                onChange={(e) => setRawNumbers(e.target.value)}
                rows={8}
                placeholder={'9876543210\n9876543211\n9876543212'}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900"
              />
              <p className="text-xs text-gray-500">Supports one-per-line, comma-separated, or clean space-separated numbers.</p>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-800">Common pre-filled message (optional)</label>
              <textarea
                value={commonMessage}
                onChange={(e) => setCommonMessage(e.target.value)}
                rows={5}
                placeholder="Hi! Sharing this WhatsApp link for quick contact."
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900"
              />

              <button onClick={handleGenerateLinks} className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:from-green-700 hover:to-emerald-700">
                Generate Bulk Links
              </button>

              {errorMessage ? (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4" />
                  <span>{errorMessage}</span>
                </div>
              ) : null}

              {(generatedRows.length > 0 || invalidEntries > 0) ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  <p><span className="font-semibold text-gray-900">Generated:</span> {generatedRows.length} valid link(s)</p>
                  <p><span className="font-semibold text-gray-900">Skipped:</span> {invalidEntries} invalid/empty entry(ies)</p>
                </div>
              ) : null}
            </div>
          </div>

          {generatedRows.length > 0 ? (
            <div className="mt-6 rounded-2xl border border-gray-200">
              <div className="flex items-center justify-between border-b border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900">Generated links</h3>
                <button onClick={downloadCsv} className="inline-flex items-center gap-2 rounded-lg border border-green-300 bg-white px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-50">
                  <Download className="h-4 w-4" />
                  Download CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Phone number</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">WhatsApp link</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Copy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {generatedRows.map((row) => (
                      <tr key={row.whatsappLink}>
                        <td className="px-4 py-3 font-medium text-gray-900">{row.phoneNumber}</td>
                        <td className="px-4 py-3"><a href={row.whatsappLink} target="_blank" rel="noreferrer" className="text-green-700 underline-offset-2 hover:underline">{row.whatsappLink}</a></td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => copyLink(row.whatsappLink)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100">
                            {copiedLink === row.whatsappLink ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />} {copiedLink === row.whatsappLink ? 'Copied' : 'Copy'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
