import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, Download, Search, Sparkles, AlertCircle } from 'lucide-react';
import { saveSubmissionToSheet } from '../lib/saveSubmissionToSheet';

type CountryOption = {
  code: string;
  country: string;
};

const countryOptions: CountryOption[] = [
  { code: '+1', country: 'United States' },
  { code: '+1', country: 'Canada' },
  { code: '+7', country: 'Russia' },
  { code: '+20', country: 'Egypt' },
  { code: '+27', country: 'South Africa' },
  { code: '+31', country: 'Netherlands' },
  { code: '+32', country: 'Belgium' },
  { code: '+33', country: 'France' },
  { code: '+34', country: 'Spain' },
  { code: '+39', country: 'Italy' },
  { code: '+41', country: 'Switzerland' },
  { code: '+43', country: 'Austria' },
  { code: '+44', country: 'United Kingdom' },
  { code: '+45', country: 'Denmark' },
  { code: '+46', country: 'Sweden' },
  { code: '+47', country: 'Norway' },
  { code: '+48', country: 'Poland' },
  { code: '+49', country: 'Germany' },
  { code: '+52', country: 'Mexico' },
  { code: '+55', country: 'Brazil' },
  { code: '+60', country: 'Malaysia' },
  { code: '+61', country: 'Australia' },
  { code: '+62', country: 'Indonesia' },
  { code: '+63', country: 'Philippines' },
  { code: '+64', country: 'New Zealand' },
  { code: '+65', country: 'Singapore' },
  { code: '+66', country: 'Thailand' },
  { code: '+81', country: 'Japan' },
  { code: '+82', country: 'South Korea' },
  { code: '+84', country: 'Vietnam' },
  { code: '+86', country: 'China' },
  { code: '+90', country: 'Turkey' },
  { code: '+91', country: 'India' },
  { code: '+92', country: 'Pakistan' },
  { code: '+93', country: 'Afghanistan' },
  { code: '+94', country: 'Sri Lanka' },
  { code: '+95', country: 'Myanmar' },
  { code: '+98', country: 'Iran' },
  { code: '+212', country: 'Morocco' },
  { code: '+213', country: 'Algeria' },
  { code: '+216', country: 'Tunisia' },
  { code: '+218', country: 'Libya' },
  { code: '+234', country: 'Nigeria' },
  { code: '+254', country: 'Kenya' },
  { code: '+255', country: 'Tanzania' },
  { code: '+256', country: 'Uganda' },
  { code: '+264', country: 'Namibia' },
  { code: '+351', country: 'Portugal' },
  { code: '+352', country: 'Luxembourg' },
  { code: '+353', country: 'Ireland' },
  { code: '+358', country: 'Finland' },
  { code: '+380', country: 'Ukraine' },
  { code: '+420', country: 'Czech Republic' },
  { code: '+421', country: 'Slovakia' },
  { code: '+880', country: 'Bangladesh' },
  { code: '+960', country: 'Maldives' },
  { code: '+966', country: 'Saudi Arabia' },
  { code: '+971', country: 'United Arab Emirates' },
  { code: '+972', country: 'Israel' },
  { code: '+974', country: 'Qatar' },
  { code: '+977', country: 'Nepal' },
];

const MIN_PHONE_LENGTH = 6;
const MAX_PHONE_LENGTH = 15;

const getPhoneError = (rawValue: string) => {
  if (!rawValue) {
    return 'Enter your WhatsApp number to continue.';
  }

  const digits = rawValue.replace(/\D/g, '');

  if (digits.length < MIN_PHONE_LENGTH) {
    return `Number is too short. Enter at least ${MIN_PHONE_LENGTH} digits.`;
  }

  if (digits.length > MAX_PHONE_LENGTH) {
    return `Number is too long. Enter no more than ${MAX_PHONE_LENGTH} digits.`;
  }

  if (/^(\d)\1+$/.test(digits)) {
    return 'Enter a real phone number (not all repeated digits).';
  }

  return '';
};

export default function Generator() {
  const [selectedCountry, setSelectedCountry] = useState<CountryOption | null>(null);
  const [countrySearch, setCountrySearch] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [countryError, setCountryError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [showCelebration, setShowCelebration] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);

  const qrImageUrl = useMemo(() => {
    if (!generatedLink) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=480x480&data=${encodeURIComponent(generatedLink)}`;
  }, [generatedLink]);

  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase();

    if (!query) return countryOptions;

    return countryOptions.filter((option) => option.country.toLowerCase().includes(query) || option.code.toLowerCase().includes(query));
  }, [countrySearch]);

  const digitsOnlyPhone = useMemo(() => phoneNumber.replace(/\D/g, ''), [phoneNumber]);
  const phoneValidationError = useMemo(() => getPhoneError(phoneNumber), [phoneNumber]);
  const isFormValid = Boolean(selectedCountry) && !phoneValidationError;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && event.target instanceof Node && !dropdownRef.current.contains(event.target)) {
        setIsCountryOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!isCountryOpen) return;

    setCountrySearch('');

    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }, [isCountryOpen]);

  useEffect(() => {
    if (!phoneTouched) return;
    setPhoneError(phoneValidationError);
  }, [phoneTouched, phoneValidationError]);

  const generateLink = () => {
    if (!selectedCountry) {
      setCountryError('Choose a country code before generating your link.');
      return;
    }

    const phoneIssue = getPhoneError(phoneNumber);

    if (phoneIssue) {
      setPhoneTouched(true);
      setPhoneError(phoneIssue);
      phoneInputRef.current?.focus();
      return;
    }

    const fullNumber = `${selectedCountry.code.replace('+', '')}${digitsOnlyPhone}`;
    const trimmedMessage = message.trim();
    const encodedMessage = encodeURIComponent(trimmedMessage);

    const link = trimmedMessage ? `https://wa.me/${fullNumber}?text=${encodedMessage}` : `https://wa.me/${fullNumber}`;

    setGeneratedLink(link);
    setCopied(false);
    setDownloadStatus('idle');
    setShowCelebration(true);
    window.setTimeout(() => setShowCelebration(false), 1100);

    void saveSubmissionToSheet({
      phone_number: digitsOnlyPhone,
      country_code: selectedCountry.code,
      message: trimmedMessage,
      generated_link: link,
      consent: true,
      created_at: new Date().toISOString(),
    });
  };

  const copyToClipboard = async () => {
    if (!generatedLink) return;

    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const downloadQrCode = async () => {
    if (!generatedLink || !qrImageUrl) return;

    const sanitizedNumber = digitsOnlyPhone || 'number';
    const fileName = `whatsapp-qr-${sanitizedNumber}.png`;

    try {
      const response = await fetch(qrImageUrl);
      if (!response.ok) {
        throw new Error('Unable to fetch QR image');
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
      setDownloadStatus('success');
      window.setTimeout(() => setDownloadStatus('idle'), 2200);
    } catch {
      setDownloadStatus('error');
      window.setTimeout(() => setDownloadStatus('idle'), 2600);
    }
  };

  const selectCountry = (option: CountryOption) => {
    setSelectedCountry(option);
    setCountrySearch('');
    setIsCountryOpen(false);
    setCountryError('');
  };

  const handlePhoneNumberChange = (value: string) => {
    const onlyDigits = value.replace(/\D/g, '').slice(0, MAX_PHONE_LENGTH);
    setPhoneNumber(onlyDigits);
    if (!phoneTouched) return;
    setPhoneError(getPhoneError(onlyDigits));
  };

  return (
    <section id="generator" className="relative overflow-hidden bg-gradient-to-b from-gray-50 via-white to-white py-14 sm:py-16">
      <div className="absolute inset-0 opacity-60">
        <div className="absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-green-100 blur-3xl"></div>
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-emerald-50 blur-3xl"></div>
      </div>

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center sm:mb-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-green-100 bg-white px-4 py-2 text-sm font-medium text-green-700 shadow-sm">
            <Sparkles className="h-4 w-4" />
            Fast, clean, and ready to share
          </div>
          <h2 className="mb-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">Create Your Free Link</h2>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-gray-600 sm:text-lg">
            Choose a country, add your WhatsApp number, and optionally include a message to generate a clean wa.me link.
          </p>
        </div>

        <div className="rounded-[32px] border border-gray-200 bg-white/95 p-5 shadow-[0_20px_70px_-30px_rgba(0,0,0,0.25)] backdrop-blur sm:p-8 lg:p-10">
          <div className="space-y-7">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-3" ref={dropdownRef}>
                <label htmlFor="country-dropdown" className="block text-sm font-semibold tracking-wide text-gray-900">
                  Country / Code <span className="font-medium text-gray-400">(Required)</span>
                </label>

                <div className="relative">
                  <button
                    id="country-dropdown"
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={isCountryOpen}
                    aria-controls="country-listbox"
                    onClick={() => setIsCountryOpen((current) => !current)}
                    className={`flex w-full items-center justify-between rounded-2xl border bg-white px-4 py-3.5 text-left text-gray-900 shadow-sm transition-all hover:border-gray-400 focus-visible:outline-none focus-visible:ring-4 ${
                      countryError ? 'border-rose-300 focus-visible:ring-rose-200' : 'border-gray-300 focus-visible:border-green-500 focus-visible:ring-green-500/20'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{selectedCountry ? selectedCountry.country : 'Select a country'}</div>
                      <div className="text-sm text-gray-500">{selectedCountry ? selectedCountry.code : 'Pick country code'}</div>
                    </div>
                    <ChevronDown className={`h-5 w-5 text-gray-500 transition-transform ${isCountryOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isCountryOpen && (
                    <div className="absolute z-20 mt-3 w-full rounded-2xl border border-gray-200 bg-white p-3 shadow-2xl">
                      <div className="relative mb-3">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          placeholder="Search country or code"
                          aria-label="Search country"
                          className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none transition-all focus-visible:border-green-500 focus-visible:ring-2 focus-visible:ring-green-500/20"
                        />
                      </div>

                      <div id="country-listbox" role="listbox" aria-label="Country options" className="max-h-64 overflow-y-auto rounded-xl border border-gray-100">
                        {filteredCountries.length > 0 ? (
                          filteredCountries.map((option) => {
                            const isSelected = option.code === selectedCountry?.code && option.country === selectedCountry.country;

                            return (
                              <button
                                key={`${option.country}-${option.code}`}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => selectCountry(option)}
                                className={`flex w-full items-center justify-between px-3 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/20 ${
                                  isSelected ? 'bg-green-50 text-green-700' : 'text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                <span className="font-medium">{option.country}</span>
                                <span className="text-gray-500">{option.code}</span>
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-3 py-4 text-sm text-gray-500">No country found for that search.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {countryError ? <p className="flex items-start gap-2 text-sm text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4" />{countryError}</p> : null}
              </div>

              <div className="space-y-3">
                <label htmlFor="phone-number" className="block text-sm font-semibold tracking-wide text-gray-900">
                  Phone Number <span className="font-medium text-gray-400">(Required)</span>
                </label>
                <div
                  className={`flex items-center rounded-2xl border bg-white px-4 shadow-sm transition-all focus-within:ring-2 ${
                    phoneError ? 'border-rose-300 focus-within:border-rose-400 focus-within:ring-rose-100' : 'border-gray-300 hover:border-gray-400 focus-within:border-green-500 focus-within:ring-green-500/20'
                  }`}
                >
                  <span className="pr-3 text-sm font-semibold text-gray-500">{selectedCountry?.code ?? '+'}</span>
                  <input
                    id="phone-number"
                    ref={phoneInputRef}
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    pattern="[0-9]*"
                    aria-invalid={Boolean(phoneError)}
                    aria-describedby="phone-helper"
                    value={phoneNumber}
                    onBlur={() => {
                      setPhoneTouched(true);
                      setPhoneError(getPhoneError(phoneNumber));
                    }}
                    onChange={(e) => handlePhoneNumberChange(e.target.value)}
                    placeholder="9876543210"
                    className="w-full border-none bg-transparent py-3.5 text-gray-900 outline-none"
                  />
                </div>
                <p id="phone-helper" className={`text-sm ${phoneError ? 'flex items-start gap-2 text-rose-700' : 'text-gray-500'}`}>
                  {phoneError ? <AlertCircle className="mt-0.5 h-4 w-4" aria-hidden="true" /> : null}
                  {phoneError || 'Use digits only. Include area code when needed.'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <label htmlFor="prefilled-message" className="block text-sm font-semibold tracking-wide text-gray-900">
                Pre-filled Message <span className="font-medium text-gray-400">(Optional)</span>
              </label>
              <textarea
                id="prefilled-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hi! I would like to know more about your service."
                rows={5}
                className="w-full resize-none rounded-2xl border border-gray-300 px-4 py-3.5 text-gray-900 outline-none transition-all hover:border-gray-400 focus-visible:border-green-500 focus-visible:ring-2 focus-visible:ring-green-500/20"
              />
            </div>

            <button
              onClick={generateLink}
              disabled={!isFormValid}
              aria-disabled={!isFormValid}
              className="w-full rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 text-base font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl hover:from-green-700 hover:to-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-500/30 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 sm:text-lg"
            >
              Generate WhatsApp Link
            </button>

            {generatedLink && (
              <div className="relative space-y-5 border-t border-gray-200 pt-8">
                {showCelebration && (
                  <div className="pointer-events-none absolute inset-x-0 top-1 z-10 flex justify-center" aria-hidden="true">
                    <div className="success-confetti">
                      {[...Array(10)].map((_, index) => (
                        <span key={index} style={{ '--delay': `${index * 45}ms` } as CSSProperties} />
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-3xl border border-green-100 bg-gradient-to-br from-green-50 to-emerald-50 p-5 sm:p-6">
                  <label htmlFor="generated-link" className="mb-3 block text-sm font-semibold tracking-wide text-gray-900">
                    Your Generated Link
                  </label>
                  <div className="flex flex-col gap-3">
                    <input id="generated-link" type="text" value={generatedLink} readOnly className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    onClick={copyToClipboard}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-gray-300 bg-white py-3.5 font-semibold text-gray-900 transition-all hover:border-green-400 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-500/20"
                    aria-label="Copy generated WhatsApp link"
                  >
                    <Copy className="h-5 w-5" />
                    {copied ? 'Link Copied' : 'Copy Link'}
                  </button>

                  <button
                    onClick={downloadQrCode}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-gray-300 bg-white py-3.5 font-semibold text-gray-900 transition-all hover:border-green-400 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-500/20"
                    aria-label="Download QR code"
                  >
                    {downloadStatus === 'success' ? <Check className="h-5 w-5 text-green-600" /> : <Download className="h-5 w-5" />}
                    {downloadStatus === 'success' ? 'QR Downloaded' : 'Download QR'}
                  </button>
                </div>

                <p role="status" aria-live="polite" className="min-h-6 text-center text-sm text-gray-600">
                  {downloadStatus === 'success' && 'QR code downloaded successfully.'}
                  {downloadStatus === 'error' && 'We could not download the QR code. Please try again.'}
                </p>

                <div className="flex flex-col items-center rounded-3xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-6 text-center shadow-lg sm:p-8">
                  <p className="mb-6 text-sm font-medium text-gray-600">Scan this QR code with your phone camera or WhatsApp.</p>
                  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <img src={qrImageUrl} alt="QR code for generated WhatsApp link" className="h-56 w-56 sm:h-60 sm:w-60" />
                  </div>
                </div>

                <p className="text-center text-sm text-gray-600 sm:text-[15px]">Your link and QR are ready to share wherever your audience connects with you.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
