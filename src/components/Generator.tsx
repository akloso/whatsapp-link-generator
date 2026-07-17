import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, ChevronDown, Copy, Download, ExternalLink, Link2, QrCode, Search, Sparkles } from 'lucide-react';
import QRCode from 'qrcode';
import { trackEvent } from '../lib/trackEvent';
import { logToGoogleSheets } from '../lib/sheetsLogger';
import { countryOptions, type CountryOption } from '../data/countryOptions';
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
    <section id="generator" className="relative isolate overflow-hidden bg-[#f8fcfa] py-12 sm:py-16">
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 top-16 h-80 w-80 rounded-full bg-cyan-100/60 blur-3xl" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-7 max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800"><Sparkles className="h-3.5 w-3.5" />Free, instant, yours to share</div>
          <h2 className="text-3xl font-bold tracking-[-0.035em] text-slate-950 sm:text-4xl">Build the link. Make it unmistakably yours.</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">Add the destination details on the left. Your share-ready link and QR appear on the right.</p>
        </div>
        <Surface className="relative overflow-visible border-emerald-100 bg-white/95 p-3 shadow-[0_28px_70px_-42px_rgba(15,80,55,0.36)] sm:p-5 lg:p-6">
          <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,0.94fr)_minmax(360px,1.06fr)] lg:gap-8">
            <div className="min-w-0 rounded-2xl bg-slate-50/80 p-3 sm:p-5">
              <div className="mb-5 flex items-center gap-3"><span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-600 text-xs font-bold text-white">1</span><div><h3 className="text-sm font-bold text-slate-900">Chat details</h3><p className="text-xs text-slate-500">A number is all you need to begin.</p></div></div>
              <div className="space-y-4">
                <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,.92fr)_minmax(0,1fr)]">
                  <div className="min-w-0 space-y-1.5" ref={dropdownRef}>
                    <FieldLabel htmlFor="country-dropdown">Country / Code</FieldLabel>
                    <div className="relative min-w-0"><button id="country-dropdown" type="button" aria-haspopup="listbox" aria-expanded={isCountryOpen} aria-controls="country-listbox" onClick={() => setIsCountryOpen((current) => !current)} className={`flex min-h-12 w-full min-w-0 items-center justify-between gap-3 rounded-xl border bg-white px-3.5 py-2 text-left text-slate-900 transition hover:border-emerald-300 focus-visible:outline-none focus-visible:ring-4 ${countryError ? 'border-rose-300 focus-visible:ring-rose-200' : 'border-slate-200 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/15'}`}><span className="min-w-0"><span className="block truncate text-sm font-semibold">{selectedCountry ? selectedCountry.country : 'Select a country'}</span><span className="block text-xs text-slate-500">{selectedCountry ? selectedCountry.code : 'Pick country code'}</span></span><ChevronDown className={`h-4 w-4 flex-none text-slate-500 transition-transform ${isCountryOpen ? 'rotate-180' : ''}`} /></button>
                      {isCountryOpen ? <div className="absolute left-0 right-0 z-20 mt-2 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"><div className="relative mb-2"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input ref={searchInputRef} type="text" value={countrySearch} onChange={(e) => setCountrySearch(e.target.value)} placeholder="Search country or code" aria-label="Search country" className="min-h-10 w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus-visible:border-emerald-500 focus-visible:ring-4 focus-visible:ring-emerald-500/15" /></div><div id="country-listbox" role="listbox" aria-label="Country options" className="max-h-60 overflow-y-auto rounded-xl border border-slate-100">{filteredCountries.length > 0 ? filteredCountries.map((option) => { const isSelected = option.code === selectedCountry?.code && option.country === selectedCountry.country; return <button key={`${option.country}-${option.code}`} type="button" role="option" aria-selected={isSelected} onClick={() => selectCountry(option)} className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/20 ${isSelected ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-slate-50'}`}><span className="min-w-0 truncate font-medium">{option.country}</span><span className="flex-none text-slate-500">{option.code}</span></button>; }) : <div className="px-3 py-4 text-sm text-slate-500">No country found for that search.</div>}</div></div> : null}</div>
                    {countryError ? <p className="flex items-start gap-2 text-sm text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4" />{countryError}</p> : null}
                  </div>
                  <div className="min-w-0 space-y-1.5"><FieldLabel htmlFor="phone-number">Phone Number</FieldLabel><div className={`flex min-h-12 items-center rounded-xl border bg-white px-3.5 transition focus-within:ring-4 ${phoneError ? 'border-rose-300 focus-within:border-rose-400 focus-within:ring-rose-100' : 'border-slate-200 hover:border-emerald-300 focus-within:border-emerald-500 focus-within:ring-emerald-500/15'}`}><span className="border-r border-slate-200 pr-2 text-sm font-semibold text-slate-500">{selectedCountry?.code ?? '+'}</span><input id="phone-number" ref={phoneInputRef} type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[0-9]*" aria-invalid={Boolean(phoneError)} aria-describedby="phone-helper" value={phoneNumber} onBlur={() => { setPhoneTouched(true); setPhoneError(getPhoneError(phoneNumber)); }} onChange={(e) => handlePhoneNumberChange(e.target.value)} placeholder="9876543210" className="min-w-0 flex-1 border-none bg-transparent px-2 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400" /></div><p id="phone-helper" className={`text-xs leading-5 ${phoneError ? 'flex items-start gap-2 text-rose-700' : 'text-slate-500'}`}>{phoneError ? <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" /> : null}{phoneError || 'Digits only. Include area code if needed.'}</p></div>
                </div>
                <div className="space-y-1.5"><FieldLabel htmlFor="prefilled-message" optional>Pre-filled Message</FieldLabel><Textarea id="prefilled-message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Hi! I would like to know more about your service." rows={3} /><p className="text-xs text-slate-500">Encoded into your link only after you generate.</p></div>
                <Button onClick={generateLink} disabled={!isFormValid} aria-disabled={!isFormValid} variant="primary" className="w-full !rounded-xl text-base" icon={<Link2 className="h-4 w-4" />}>Generate WhatsApp Link</Button>
              </div>
            </div>
            <div className="min-w-0 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 via-white to-cyan-50/50 p-3 sm:p-4">
              {!generatedLink ? <div className="flex min-h-[340px] flex-col items-center justify-center rounded-xl border border-dashed border-emerald-200 bg-white/80 px-5 py-8 text-center"><div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><QrCode className="h-7 w-7" /></div><h3 className="text-base font-bold text-slate-950">Your share kit will appear here</h3><p className="mt-2 max-w-xs text-sm leading-6 text-slate-600">Generate a link to copy it, test it in WhatsApp, and download a print-ready QR.</p><div className="mt-5 flex items-center gap-2 text-xs font-semibold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" />Ready when you are</div></div> : <div className="zapora-result-enter space-y-3">
                <p role="status" aria-live="polite" className="sr-only">WhatsApp link generated. Your link and QR code are ready.</p>
                <div className="rounded-xl border border-emerald-200 bg-white p-3.5 shadow-sm"><div className="mb-2 flex items-center justify-between gap-3"><label htmlFor="generated-link" className="inline-flex items-center gap-2 text-sm font-bold text-slate-900"><Check className="h-4 w-4 text-emerald-600" />Link ready</label><span aria-live="polite" className={`text-xs font-bold ${copied ? 'text-emerald-700' : 'text-slate-500'}`}>{copied ? 'Copied to clipboard' : 'Ready to share'}</span></div><input id="generated-link" type="text" value={generatedLink} readOnly className="w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-xs leading-5 text-slate-700 outline-none" /></div>
                <div className="grid grid-cols-2 gap-2"><Button onClick={copyToClipboard} variant={copied ? 'success' : 'secondary'} aria-label="Copy generated WhatsApp link" icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} className="w-full">{copied ? 'Copied' : 'Copy link'}</Button><Button onClick={openWhatsApp} variant="primary" aria-label="Open generated WhatsApp link" icon={<ExternalLink className="h-4 w-4" />} className="w-full">Open WhatsApp</Button></div>
                <div className="grid min-w-0 gap-3 sm:grid-cols-[auto_minmax(0,1fr)]"><div className="flex flex-col rounded-xl border border-slate-200 bg-white p-3"><img src={qrImageUrl} alt="QR code for generated WhatsApp link" className="h-40 w-40 sm:h-44 sm:w-44" /><Button onClick={downloadQrCode} variant="secondary" aria-label="Download QR code" icon={downloadStatus === 'success' ? <Check className="h-4 w-4 text-emerald-600" /> : <Download className="h-4 w-4" />} className="mt-3 w-full !px-2 text-xs">{downloadStatus === 'success' ? 'QR saved' : 'Download PNG'}</Button></div><div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3"><p className="text-sm font-bold text-slate-900">Make the QR yours</p><p className="mt-1 text-xs leading-5 text-slate-500">Pick a foreground color or move into the full editor.</p><div className="mt-3 flex flex-wrap gap-2">{qrColorPresets.map((preset) => <button key={preset.id} type="button" onClick={() => setQrForegroundColor(preset.value)} aria-label={`Use ${preset.id} for QR code`} aria-pressed={qrForegroundColor === preset.value} className={`relative h-8 w-8 rounded-full border transition ${qrForegroundColor === preset.value ? 'border-slate-900 ring-2 ring-slate-900/20' : 'border-slate-200 hover:border-slate-400'}`} style={preset.type === 'blend' ? { backgroundImage: preset.swatch } : { backgroundColor: preset.value }}>{qrForegroundColor === preset.value ? <span className="absolute inset-0 grid place-items-center text-xs text-white">✓</span> : null}</button>)}</div><label className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700"><span className="font-medium">Custom</span><input type="color" value={qrForegroundColor} onChange={(event) => setQrForegroundColor(event.target.value)} className="h-7 w-9 cursor-pointer rounded border border-slate-300 bg-white p-0.5" aria-label="Pick custom QR foreground color" /></label><Button onClick={() => onCustomizeQrCode?.(generatedLink)} variant="success" className="mt-3 w-full !px-2 text-xs" icon={<Sparkles className="h-4 w-4" />} aria-label="Customize QR code on dedicated editor page">Customize in QR Editor</Button></div></div>
                <p role="status" aria-live="polite" className={`min-h-5 text-center text-xs ${downloadStatus === 'error' ? 'text-rose-700' : 'text-slate-600'}`}>{downloadStatus === 'success' && 'QR code downloaded successfully.'}{downloadStatus === 'error' && 'We could not download the QR code. Please try again.'}</p>
              </div>}
            </div>
          </div>
        </Surface>
      </div>
    </section>
  );
}
