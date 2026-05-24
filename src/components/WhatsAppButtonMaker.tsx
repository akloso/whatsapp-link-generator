import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, MessageCircle, Search } from 'lucide-react';
import { countryOptions, type CountryOption } from '../data/countryOptions';
import { trackEvent } from '../lib/trackEvent';

type ButtonStyle = 'primary' | 'dark' | 'light' | 'outline' | 'minimal';
type ButtonShape = 'rounded' | 'pill' | 'square-soft';
type IconStyle = 'whatsapp' | 'chat' | 'none';
type PlacementStyle = 'inline' | 'floating-right' | 'floating-left';

const MIN_PHONE_LENGTH = 6;
const MAX_PHONE_LENGTH = 15;

const getPhoneError = (rawValue: string) => {
  const digits = rawValue.replace(/\D/g, '');
  if (!digits) return 'Enter your WhatsApp number.';
  if (digits.length < MIN_PHONE_LENGTH) return `Use at least ${MIN_PHONE_LENGTH} digits.`;
  if (digits.length > MAX_PHONE_LENGTH) return `Use no more than ${MAX_PHONE_LENGTH} digits.`;
  if (/^(\d)\1+$/.test(digits)) return 'Enter a valid phone number.';
  return '';
};

const styleMap: Record<ButtonStyle, CSSProperties> = {
  primary: { backgroundColor: '#25D366', color: '#ffffff', border: '1px solid #25D366' },
  dark: { backgroundColor: '#111827', color: '#ffffff', border: '1px solid #111827' },
  light: { backgroundColor: '#f9fafb', color: '#111827', border: '1px solid #e5e7eb' },
  outline: { backgroundColor: '#ffffff', color: '#166534', border: '1px solid #22c55e' },
  minimal: { backgroundColor: '#f0fdf4', color: '#166534', border: '1px dashed #4ade80' },
};

const radiusMap: Record<ButtonShape, string> = {
  rounded: '12px', pill: '999px', 'square-soft': '8px',
};

const iconGlyph = (iconStyle: IconStyle) => (iconStyle === 'whatsapp' ? '💬' : iconStyle === 'chat' ? '🗨️' : '');

export default function WhatsAppButtonMaker() {
  const indiaOption = countryOptions.find((option) => option.country === 'India') ?? countryOptions[0];
  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(indiaOption);
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [label, setLabel] = useState('Chat on WhatsApp');
  const [buttonStyle, setButtonStyle] = useState<ButtonStyle>('primary');
  const [buttonShape, setButtonShape] = useState<ButtonShape>('rounded');
  const [iconStyle, setIconStyle] = useState<IconStyle>('whatsapp');
  const [placement, setPlacement] = useState<PlacementStyle>('inline');
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');

  const digitsOnlyPhone = phoneNumber.replace(/\D/g, '');
  const phoneError = getPhoneError(phoneNumber);
  const countryRef = useRef<HTMLDivElement>(null);
  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase();
    const sortedCountries = [...countryOptions].sort((a, b) => a.country.localeCompare(b.country));
    const orderedCountries = indiaOption
      ? [indiaOption, ...sortedCountries.filter((option) => option.country !== indiaOption.country)]
      : sortedCountries;
    if (!query) return orderedCountries;
    return orderedCountries.filter((option) => option.country.toLowerCase().includes(query) || option.code.toLowerCase().includes(query));
  }, [countrySearch, indiaOption]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!countryRef.current) return;
      if (!countryRef.current.contains(event.target as Node)) {
        setIsCountryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const waLink = useMemo(() => {
    const base = `https://wa.me/${selectedCountry.code.replace('+', '')}${digitsOnlyPhone}`;
    const trimmedMessage = message.trim();
    return trimmedMessage ? `${base}?text=${encodeURIComponent(trimmedMessage)}` : base;
  }, [digitsOnlyPhone, message, selectedCountry.code]);

  const placementCss = placement === 'inline'
    ? 'position: static;'
    : `position: fixed; bottom: 20px; ${placement === 'floating-right' ? 'right: 20px;' : 'left: 20px;'}`;

  const buttonCss = useMemo(() => {
    const style = styleMap[buttonStyle];
    return [
      'display: inline-flex',
      'align-items: center',
      'gap: 8px',
      'font-family: Arial, sans-serif',
      'font-size: 14px',
      'font-weight: 600',
      'text-decoration: none',
      'padding: 12px 16px',
      `border-radius: ${radiusMap[buttonShape]}`,
      `background: ${style.backgroundColor}`,
      `color: ${style.color}`,
      `border: ${style.border}`,
      'box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12)',
    ].join('; ');
  }, [buttonShape, buttonStyle]);

  const htmlSnippet = `<a href="${waLink}" target="_blank" rel="noopener noreferrer" style="${placementCss} ${buttonCss}">${iconGlyph(iconStyle) ? `<span>${iconGlyph(iconStyle)}</span> ` : ''}<span>${label || 'Chat on WhatsApp'}</span></a>`;

  const copyHtml = async () => {
    trackEvent('generate_whatsapp_button', { style: buttonStyle, placement, has_message: Boolean(message.trim()) });
    try {
      await navigator.clipboard.writeText(htmlSnippet);
      setCopyState('success');
      trackEvent('copy_button_html', { style: buttonStyle, placement, has_message: Boolean(message.trim()) });
      window.setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('error');
    }
  };

  const previewStyle: CSSProperties = { ...styleMap[buttonStyle], borderRadius: radiusMap[buttonShape] };

  return (
    <main className="bg-gradient-to-b from-white via-green-50/40 to-white py-10 sm:py-14">
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8 space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">WhatsApp Click-to-Chat Button Maker</h1>
          <p className="text-gray-600">Design a WhatsApp button for your website and copy the ready-to-use HTML code.</p>
        </header>
        <div className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="space-y-4">
              <div className="space-y-2.5" ref={countryRef}>
                <label className="block text-sm font-semibold tracking-wide text-gray-900">Country / Code</label>
                <div className="relative">
                  <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={isCountryOpen}
                    onClick={() => setIsCountryOpen((current) => !current)}
                    className="flex w-full items-center justify-between rounded-2xl border border-gray-300 bg-white px-4 py-3 text-left text-gray-900 shadow-sm transition-all hover:border-gray-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-500/20"
                  >
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{selectedCountry.country}</div>
                      <div className="text-sm text-gray-500">{selectedCountry.code}</div>
                    </div>
                    <ChevronDown className={`h-5 w-5 text-gray-500 transition-transform ${isCountryOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isCountryOpen ? (
                    <div className="absolute z-20 mt-3 w-full rounded-2xl border border-gray-200 bg-white p-3 shadow-2xl">
                      <div className="relative mb-3">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={countrySearch}
                          onChange={(event) => setCountrySearch(event.target.value)}
                          placeholder="Search country or code"
                          className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none transition-all focus-visible:border-green-500 focus-visible:ring-2 focus-visible:ring-green-500/20"
                        />
                      </div>
                      <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-100">
                        {filteredCountries.map((option) => {
                          const isSelected = option.code === selectedCountry.code && option.country === selectedCountry.country;
                          return (
                            <button
                              key={`${option.country}-${option.code}`}
                              type="button"
                              onClick={() => {
                                setSelectedCountry(option);
                                setCountrySearch('');
                                setIsCountryOpen(false);
                              }}
                              className={`flex w-full items-center justify-between px-3 py-3 text-left text-sm transition-colors ${
                                isSelected ? 'bg-green-50 text-green-700' : 'text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              <span className="font-medium">{option.country}</span>
                              <span className="text-gray-500">{option.code}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              <label className="block text-sm font-medium text-gray-700">WhatsApp phone number</label>
              <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))} className="w-full rounded-xl border border-gray-300 px-3 py-2" placeholder="9876543210" />
              {phoneNumber && phoneError ? <p className="text-sm text-red-600">{phoneError}</p> : null}
              <label className="block text-sm font-medium text-gray-700">Pre-filled message (optional)</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2" rows={3} />
              <label className="block text-sm font-medium text-gray-700">Button label</label>
              <input value={label} onChange={(e) => setLabel(e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2" />
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectField label="Button style" value={buttonStyle} onChange={(v) => setButtonStyle(v as ButtonStyle)} options={['primary','dark','light','outline','minimal']} />
                <SelectField label="Button shape" value={buttonShape} onChange={(v) => setButtonShape(v as ButtonShape)} options={['rounded','pill','square-soft']} />
                <SelectField label="Icon style" value={iconStyle} onChange={(v) => setIconStyle(v as IconStyle)} options={['whatsapp','chat','none']} />
                <SelectField label="Placement style" value={placement} onChange={(v) => setPlacement(v as PlacementStyle)} options={['inline','floating-right','floating-left']} />
              </div>
            </div>
          </article>

          <article className="space-y-6">
            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Live preview</h2>
              <div className="relative h-64 overflow-hidden rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
                <div className="absolute inset-x-0 top-0 h-9 border-b border-gray-200 bg-white" />
                <div className={`absolute ${placement === 'inline' ? 'left-4 top-16' : placement === 'floating-right' ? 'bottom-4 right-4' : 'bottom-4 left-4'}`}>
                  <a href={phoneError ? '#' : waLink} target="_blank" rel="noopener noreferrer" onClick={(e) => phoneError && e.preventDefault()} className="inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold shadow-sm" style={previewStyle}>
                    {iconStyle === 'none' ? null : iconStyle === 'whatsapp' ? <span aria-hidden="true">💬</span> : <MessageCircle className="h-4 w-4" />}
                    <span>{label || 'Chat on WhatsApp'}</span>
                  </a>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900">Generated HTML snippet</h2>
              <p className="mt-2 text-sm text-gray-600">Paste this snippet into your website where you want the button to appear.</p>
              <pre className="mt-4 max-h-52 overflow-auto rounded-2xl bg-gray-950 p-4 text-xs text-green-200"><code>{htmlSnippet}</code></pre>
              <button type="button" onClick={copyHtml} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700" disabled={Boolean(phoneError)}>
                {copyState === 'success' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copyState === 'success' ? 'Copied' : 'Copy HTML'}
              </button>
              {copyState === 'error' ? <p className="mt-2 text-sm text-amber-700">Clipboard access failed. Please copy manually from the snippet box.</p> : null}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      <span className="mb-1.5 block">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}
