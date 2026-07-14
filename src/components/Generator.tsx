import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, ChevronDown, Copy, Download, ExternalLink, Link2, QrCode, Search, Sparkles } from 'lucide-react';
import QRCode from 'qrcode';
import { trackEvent } from '../lib/trackEvent';
import { logToGoogleSheets } from '../lib/sheetsLogger';
import { countryOptions, type CountryOption } from '../data/countryOptions';
import { SuccessConfetti } from './SuccessConfetti';
import { Button, FieldLabel, Surface, Textarea } from './ui';

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

type GeneratorProps = {
  onCustomizeQrCode?: (generatedLink: string) => void;
};

export default function Generator({ onCustomizeQrCode }: GeneratorProps) {
  const indiaOption = countryOptions.find((option) => option.country === 'India') ?? countryOptions[0];

  const [selectedCountry, setSelectedCountry] = useState<CountryOption | null>(indiaOption);
  const [countrySearch, setCountrySearch] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [countryError, setCountryError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [qrForegroundColor, setQrForegroundColor] = useState('#000000');

  const qrColorPresets = [
    { id: 'black', type: 'solid', value: '#000000' },
    { id: 'aurora-purple', type: 'blend', value: '#7f72e3', swatch: 'linear-gradient(135deg, #7b61ff, #b16cea, #5ce1e6)' },
    { id: 'sunset-candy', type: 'blend', value: '#de7ea2', swatch: 'linear-gradient(90deg, #ff6ec7, #ffb86c)' },
    { id: 'ocean-cyan', type: 'blend', value: '#1e8ae6', swatch: 'linear-gradient(135deg, #00c6ff, #0072ff)' },
    { id: 'lime-energy', type: 'blend', value: '#3fbb7f', swatch: 'linear-gradient(135deg, #bfff00, #00d9a6)' },
    { id: 'royal-dark-mode', type: 'blend', value: '#3a3d7d', swatch: 'linear-gradient(135deg, #141e30, #243b55, #6a11cb)' },
  ] as const;

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);

  const [qrImageUrl, setQrImageUrl] = useState('');

  useEffect(() => {
    if (!generatedLink) {
      setQrImageUrl('');
      return;
    }

    QRCode.toDataURL(generatedLink, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 480,
      color: {
        dark: qrForegroundColor,
        light: '#ffffff',
      },
    })
      .then((url) => setQrImageUrl(url))
      .catch(() => setQrImageUrl(''));
  }, [generatedLink, qrForegroundColor]);

  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase();
    const sortedCountries = [...countryOptions].sort((a, b) => a.country.localeCompare(b.country));
    const nonIndiaCountries = sortedCountries.filter((option) => option.country !== 'India');
    const orderedCountries = indiaOption ? [indiaOption, ...nonIndiaCountries] : nonIndiaCountries;

    if (!query) return orderedCountries;

    return orderedCountries.filter((option) => option.country.toLowerCase().includes(query) || option.code.toLowerCase().includes(query));
  }, [countrySearch, indiaOption]);

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
    window.setTimeout(() => setShowCelebration(false), 1300);
    trackEvent('generate_link', {
      source: 'homepage_generator',
      has_message: Boolean(trimmedMessage),
      country_code: selectedCountry.code,
    });
    if (trimmedMessage) {
      trackEvent('message_added', {
        source: 'homepage_generator',
        has_message: true,
        country_code: selectedCountry.code,
      });
    }
    logToGoogleSheets({
      phone_number: digitsOnlyPhone,
      country_code: selectedCountry.code,
      message: trimmedMessage,
      generated_link: link,
      user_action_consent: true,
      created_at: new Date().toISOString(),
    });
  };

  const copyToClipboard = async () => {
    if (!generatedLink) return;

    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      trackEvent('copy_link', {
        source: 'homepage_generator',
        has_message: generatedLink.includes('?text='),
      });
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
      trackEvent('download_qr', {
        source: 'homepage_generator',
        export_format: 'png',
      });
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

  const openWhatsApp = () => {
    if (!generatedLink) return;
    window.open(generatedLink, '_blank', 'noopener,noreferrer');
    trackEvent('open_whatsapp', {
      source: 'homepage_generator',
      has_message: generatedLink.includes('?text='),
    });
  };

  return (
    <section id="generator" className="zapora-page-bg py-6 sm:py-8 lg:py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-4 max-w-3xl sm:mb-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800">
            <Sparkles className="h-3.5 w-3.5" /> Free WhatsApp link generator
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">Create your chat link</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600 sm:text-base">
            Pick a country code, enter your WhatsApp number, and add an optional message. Your link and QR code appear here after you generate.
          </p>
        </div>

        <Surface className="relative overflow-visible bg-white/95 p-4 sm:p-5 lg:p-6">
          <SuccessConfetti active={showCelebration} />
          <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(320px,1fr)] lg:gap-6">
            <div className="min-w-0 space-y-4">
              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)]">
                <div className="min-w-0 space-y-1.5" ref={dropdownRef}>
                  <FieldLabel htmlFor="country-dropdown">Country / Code</FieldLabel>
                  <div className="relative min-w-0">
                    <button
                      id="country-dropdown"
                      type="button"
                      aria-haspopup="listbox"
                      aria-expanded={isCountryOpen}
                      aria-controls="country-listbox"
                      onClick={() => setIsCountryOpen((current) => !current)}
                      className={`flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border bg-white px-3.5 py-2 text-left text-gray-900 transition duration-150 hover:border-gray-400 focus-visible:outline-none focus-visible:ring-4 ${
                        countryError ? 'border-rose-300 focus-visible:ring-rose-200' : 'border-gray-300 focus-visible:border-green-500 focus-visible:ring-green-500/15'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{selectedCountry ? selectedCountry.country : 'Select a country'}</span>
                        <span className="block text-xs text-gray-500">{selectedCountry ? selectedCountry.code : 'Pick country code'}</span>
                      </span>
                      <ChevronDown className={`h-4 w-4 flex-none text-gray-500 transition-transform ${isCountryOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isCountryOpen ? (
                      <div className="absolute left-0 right-0 z-20 mt-2 max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
                        <div className="relative mb-2">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                          <input
                            ref={searchInputRef}
                            type="text"
                            value={countrySearch}
                            onChange={(e) => setCountrySearch(e.target.value)}
                            placeholder="Search country or code"
                            aria-label="Search country"
                            className="min-h-10 w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm text-gray-900 outline-none transition focus-visible:border-green-500 focus-visible:ring-4 focus-visible:ring-green-500/15"
                          />
                        </div>
                        <div id="country-listbox" role="listbox" aria-label="Country options" className="max-h-60 overflow-y-auto rounded-xl border border-gray-100">
                          {filteredCountries.length > 0 ? filteredCountries.map((option) => {
                            const isSelected = option.code === selectedCountry?.code && option.country === selectedCountry.country;
                            return (
                              <button
                                key={`${option.country}-${option.code}`}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => selectCountry(option)}
                                className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/20 ${isSelected ? 'bg-green-50 text-green-800' : 'text-gray-700 hover:bg-gray-50'}`}
                              >
                                <span className="min-w-0 truncate font-medium">{option.country}</span>
                                <span className="flex-none text-gray-500">{option.code}</span>
                              </button>
                            );
                          }) : <div className="px-3 py-4 text-sm text-gray-500">No country found for that search.</div>}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  {countryError ? <p className="flex items-start gap-2 text-sm text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4" />{countryError}</p> : null}
                </div>

                <div className="min-w-0 space-y-1.5">
                  <FieldLabel htmlFor="phone-number">Phone Number</FieldLabel>
                  <div className={`flex min-h-11 items-center rounded-xl border bg-white px-3.5 transition duration-150 focus-within:ring-4 ${phoneError ? 'border-rose-300 focus-within:border-rose-400 focus-within:ring-rose-100' : 'border-gray-300 hover:border-gray-400 focus-within:border-green-500 focus-within:ring-green-500/15'}`}>
                    <span className="border-r border-gray-200 pr-2 text-sm font-semibold text-gray-500">{selectedCountry?.code ?? '+'}</span>
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
                      onBlur={() => { setPhoneTouched(true); setPhoneError(getPhoneError(phoneNumber)); }}
                      onChange={(e) => handlePhoneNumberChange(e.target.value)}
                      placeholder="9876543210"
                      className="min-w-0 flex-1 border-none bg-transparent px-2 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400"
                    />
                  </div>
                  <p id="phone-helper" className={`text-sm leading-5 ${phoneError ? 'flex items-start gap-2 text-rose-700' : 'text-gray-500'}`}>
                    {phoneError ? <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" /> : null}
                    {phoneError || 'Digits only. Include area code if needed.'}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <FieldLabel htmlFor="prefilled-message" optional>Pre-filled Message</FieldLabel>
                <Textarea id="prefilled-message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Hi! I would like to know more about your service." rows={3} />
                <p className="text-sm text-gray-500">This message is encoded into the link only after you generate.</p>
              </div>

              <Button onClick={generateLink} disabled={!isFormValid} aria-disabled={!isFormValid} variant="primary" className="w-full text-base" icon={<Link2 className="h-4 w-4" />}>
                Generate WhatsApp Link
              </Button>
            </div>

            <div className="min-w-0 rounded-2xl border border-teal-100 bg-teal-50/60 p-3 sm:p-4">
              {!generatedLink ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center">
                  <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-700"><QrCode className="h-5 w-5" /></div>
                  <h3 className="text-base font-semibold text-gray-950">Result preview</h3>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-gray-600">Your generated URL, copy/open actions, and QR download controls will appear here.</p>
                </div>
              ) : (
                <div className="animate-[zapora-result-reveal_180ms_ease-out] space-y-3">
                  <div className="rounded-xl border border-green-200 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label htmlFor="generated-link" className="text-sm font-semibold text-gray-900">Generated link</label>
                      <span aria-live="polite" className={`text-xs font-semibold ${copied ? 'text-green-700' : 'text-gray-500'}`}>{copied ? 'Copied' : 'Ready'}</span>
                    </div>
                    <input id="generated-link" type="text" value={generatedLink} readOnly className="w-full min-w-0 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-xs leading-5 text-gray-700 outline-none" />
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <Button onClick={copyToClipboard} variant={copied ? 'success' : 'secondary'} aria-label="Copy generated WhatsApp link" icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} className="w-full">{copied ? 'Copied' : 'Copy'}</Button>
                    <Button onClick={openWhatsApp} variant="primary" aria-label="Open generated WhatsApp link" icon={<ExternalLink className="h-4 w-4" />} className="w-full">Open</Button>
                    <Button onClick={downloadQrCode} variant="secondary" aria-label="Download QR code" icon={downloadStatus === 'success' ? <Check className="h-4 w-4 text-green-600" /> : <Download className="h-4 w-4" />} className="w-full">{downloadStatus === 'success' ? 'Saved' : 'QR PNG'}</Button>
                  </div>

                  <p role="status" aria-live="polite" className={`min-h-5 text-center text-sm ${downloadStatus === 'error' ? 'text-rose-700' : 'text-gray-600'}`}>
                    {downloadStatus === 'success' && 'QR code downloaded successfully.'}
                    {downloadStatus === 'error' && 'We could not download the QR code. Please try again.'}
                  </p>

                  <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-[auto_minmax(0,1fr)]">
                    <div className="flex justify-center rounded-xl border border-gray-200 bg-white p-3">
                      <img src={qrImageUrl} alt="QR code for generated WhatsApp link" className="h-44 w-44 sm:h-52 sm:w-52" />
                    </div>
                    <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-3">
                      <p className="text-sm font-semibold text-gray-900">QR color</p>
                      <p className="mt-1 text-sm text-gray-500">Use the editor for advanced QR styling.</p>
                      <div className="mt-3 grid grid-cols-6 gap-2">
                        {qrColorPresets.map((preset) => (
                          <button key={preset.id} type="button" onClick={() => setQrForegroundColor(preset.value)} aria-label={`Use ${preset.id} for QR code`} className={`relative h-8 w-8 rounded-full border transition duration-150 ${qrForegroundColor === preset.value ? 'border-gray-900 ring-2 ring-gray-900/20' : 'border-gray-200 hover:border-gray-400'}`} style={preset.type === 'blend' ? { backgroundImage: preset.swatch } : { backgroundColor: preset.value }}>
                            {qrForegroundColor === preset.value ? <span className="absolute inset-0 grid place-items-center text-xs text-white">✓</span> : null}
                          </button>
                        ))}
                      </div>
                      <label className="mt-3 flex min-w-0 items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                        <span className="font-medium">Custom</span>
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-mono text-xs uppercase text-gray-500">{qrForegroundColor}</span>
                          <input type="color" value={qrForegroundColor} onChange={(event) => setQrForegroundColor(event.target.value)} className="h-8 w-10 cursor-pointer rounded-md border border-gray-300 bg-white p-1" aria-label="Pick custom QR foreground color" />
                        </span>
                      </label>
                      <Button onClick={() => onCustomizeQrCode?.(generatedLink)} variant="success" className="mt-3 w-full" icon={<Sparkles className="h-4 w-4" />} aria-label="Customize QR code on dedicated editor page">Customize QR</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Surface>
      </div>
    </section>
  );
}
