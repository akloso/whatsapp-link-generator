import { type CSSProperties, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, MessageCircle, Search } from 'lucide-react';
import { countryOptions } from '../data/countryOptions';
import { trackEvent } from '../lib/trackEvent';
import { ToolFaqSection, ToolHowItWorksSection } from './ToolPageSupportSections';

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

const radiusMap: Record<ButtonShape, string> = { rounded: '12px', pill: '999px', 'square-soft': '8px' };

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M20.5 3.5A11.3 11.3 0 0 0 2.7 17.1L1 23l6.1-1.6a11.3 11.3 0 0 0 5.3 1.3h0A11.4 11.4 0 0 0 23.8 11.3c0-3-1.2-5.9-3.3-7.8Zm-8.1 17.3h0a9.3 9.3 0 0 1-4.8-1.3l-.3-.2-3.6.9 1-3.5-.2-.4a9.2 9.2 0 1 1 7.9 4.5Zm5.1-7c-.3-.2-1.7-.9-2-1s-.5-.2-.7.2-.8 1-1 1.1-.4.1-.7 0a7.6 7.6 0 0 1-2.2-1.4 8.3 8.3 0 0 1-1.5-1.9c-.2-.3 0-.4.1-.6l.5-.6c.2-.2.2-.4.3-.6 0-.1 0-.3-.1-.5l-1-2.3c-.2-.5-.5-.4-.7-.4h-.6c-.2 0-.5.1-.7.3-.2.3-1 1-.9 2.4.1 1.4 1 2.7 1.2 2.9.1.2 2 3.1 4.9 4.2.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.1-1.4-.1-.2-.3-.2-.6-.3Z" />
    </svg>
  );
}

export default function WhatsAppButtonMaker() {
  const indiaOption = countryOptions.find((option) => option.country === 'India') ?? countryOptions[0];
  const [countryCode, setCountryCode] = useState(indiaOption.code);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [label, setLabel] = useState('Chat on WhatsApp');
  const [iconOnly, setIconOnly] = useState(false);
  const [customColor, setCustomColor] = useState('#16a34a');
  const [buttonStyle, setButtonStyle] = useState<ButtonStyle>('primary');
  const [buttonShape, setButtonShape] = useState<ButtonShape>('rounded');
  const [iconStyle, setIconStyle] = useState<IconStyle>('whatsapp');
  const [placement, setPlacement] = useState<PlacementStyle>('inline');
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const countryDropdownRef = useRef<HTMLDivElement | null>(null);

  const phoneError = getPhoneError(phoneNumber);
  const digitsOnlyPhone = phoneNumber.replace(/\D/g, '');
  const selectedCountry = useMemo(
    () => countryOptions.find((option) => option.code === countryCode) ?? indiaOption,
    [countryCode, indiaOption],
  );
  const filteredCountries = useMemo(() => {
    const normalizedQuery = countrySearch.trim().toLowerCase();
    if (!normalizedQuery) return countryOptions;
    return countryOptions.filter((option) => {
      const normalizedCode = option.code.toLowerCase();
      const normalizedCodeDigits = normalizedCode.replace('+', '');
      const queryDigits = normalizedQuery.replace('+', '');
      return option.country.toLowerCase().includes(normalizedQuery) || normalizedCode.includes(normalizedQuery) || normalizedCodeDigits.includes(queryDigits);
    });
  }, [countrySearch]);

  const waLink = useMemo(() => {
    const base = `https://wa.me/${countryCode.replace('+', '')}${digitsOnlyPhone}`;
    return message.trim() ? `${base}?text=${encodeURIComponent(message.trim())}` : base;
  }, [countryCode, digitsOnlyPhone, message]);

  const previewStyle: CSSProperties = {
    ...styleMap[buttonStyle],
    ...(buttonStyle === 'primary' ? { backgroundColor: customColor, border: `1px solid ${customColor}` } : {}),
    borderRadius: radiusMap[buttonShape],
  };

  const buttonCss = useMemo(() => {
    const base = styleMap[buttonStyle];
    const bg = buttonStyle === 'primary' ? customColor : String(base.backgroundColor);
    const border = buttonStyle === 'primary' ? `1px solid ${customColor}` : String(base.border);
    return [`display:inline-flex`, `align-items:center`, `gap:8px`, `font-family:Arial,sans-serif`, `font-size:14px`, `font-weight:600`, `text-decoration:none`, `padding:12px 16px`, `border-radius:${radiusMap[buttonShape]}`, `background:${bg}`, `color:${base.color}`, `border:${border}`, 'box-shadow:0 8px 20px rgba(0,0,0,.12)'].join(';');
  }, [buttonShape, buttonStyle, customColor]);

  const safeLabel = (label.trim() || 'Chat on WhatsApp');
  const ariaLabel = 'Chat on WhatsApp';
  const placementCss = placement === 'inline' ? 'position: static;' : `position: fixed; bottom: 20px; ${placement === 'floating-right' ? 'right: 20px;' : 'left: 20px;'}`;
  const htmlSnippet = `<a href="${waLink}" target="_blank" rel="noopener noreferrer" aria-label="${ariaLabel}" style="${placementCss} ${buttonCss}">${iconStyle === 'none' ? '' : '<span aria-hidden="true">💬</span>'}${iconOnly ? '' : `<span>${safeLabel}</span>`}</a>`;

  const copyHtml = async () => {
    trackEvent('generate_whatsapp_button', { style: buttonStyle, placement, has_message: Boolean(message.trim()) });
    try { await navigator.clipboard.writeText(htmlSnippet); setCopyState('success'); setTimeout(() => setCopyState('idle'), 1800); } catch { setCopyState('error'); }
  };

  return (<main className="overflow-x-hidden bg-gradient-to-b from-white via-green-50/40 to-white py-10 sm:py-14"><section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
    <header className="mb-8 space-y-2"><h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">WhatsApp Click-to-Chat Button Maker</h1></header>
    <div className="grid gap-6 lg:grid-cols-2"><article className="min-w-0 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"><div className="space-y-4">
      <label className="block text-sm font-semibold tracking-wide text-gray-900">Country Code</label>
      <div ref={countryDropdownRef} className="relative">
        <button type="button" onClick={() => setIsCountryOpen((prev) => !prev)} className="flex w-full items-center justify-between rounded-2xl border border-gray-300 bg-white px-4 py-3 text-left shadow-sm transition-all hover:border-gray-400 focus-visible:border-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/20" aria-expanded={isCountryOpen} aria-haspopup="listbox">
          <span className="min-w-0"><span className="block truncate text-sm font-semibold text-gray-900">{selectedCountry.country}</span><span className="block text-sm text-gray-500">{selectedCountry.code}</span></span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${isCountryOpen ? 'rotate-180' : ''}`} />
        </button>
        {isCountryOpen ? <div className="absolute left-0 z-20 mt-2 w-full max-w-full rounded-2xl border border-gray-200 bg-white p-3 shadow-2xl">
          <div className="relative mb-3"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={countrySearch} onChange={(e) => setCountrySearch(e.target.value)} placeholder="Search country or +code" className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none transition-all focus-visible:border-green-500 focus-visible:ring-2 focus-visible:ring-green-500/20" /></div>
          <div role="listbox" className="max-h-60 overflow-y-auto rounded-xl border border-gray-100">
            {filteredCountries.length ? filteredCountries.map((option) => <button key={`${option.country}-${option.code}`} type="button" onClick={() => { setCountryCode(option.code); setIsCountryOpen(false); setCountrySearch(''); }} className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors ${countryCode === option.code ? 'bg-green-50 text-green-700' : 'text-gray-700 hover:bg-gray-50'}`}><span className="font-medium">{option.country}</span><span>{option.code}</span></button>) : <p className="px-3 py-3 text-sm text-gray-500">No country found.</p>}
          </div>
        </div> : null}
      </div>
      <label className="block text-sm font-semibold tracking-wide text-gray-900">WhatsApp phone number</label><div className="flex items-center rounded-2xl border border-gray-300 bg-white px-4 shadow-sm transition-all hover:border-gray-400 focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-500/20"><span className="pr-3 text-sm font-semibold text-gray-500">{countryCode}</span><input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))} className="w-full border-none bg-transparent py-3 text-gray-900 outline-none" /></div>
      {phoneNumber && phoneError ? <p className="text-sm text-red-600">{phoneError}</p> : null}
      <label className="block text-sm font-medium text-gray-700">Pre-filled message (optional)</label><textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="w-full rounded-xl border border-gray-300 px-3 py-2" />
      <label className="block text-sm font-medium text-gray-700">Button label (optional)</label><input value={label} onChange={(e) => setLabel(e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2" />
      <label className="inline-flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={iconOnly} onChange={(e) => setIconOnly(e.target.checked)} /> Icon-only button</label>
      <div className="grid gap-3 sm:grid-cols-2"><SelectField label="Button style" value={buttonStyle} onChange={(v) => setButtonStyle(v as ButtonStyle)} options={['primary','dark','light','outline','minimal']} /><SelectField label="Button shape" value={buttonShape} onChange={(v) => setButtonShape(v as ButtonShape)} options={['rounded','pill','square-soft']} /><SelectField label="Icon style" value={iconStyle} onChange={(v) => setIconStyle(v as IconStyle)} options={['whatsapp','chat','none']} /><SelectField label="Placement style" value={placement} onChange={(v) => setPlacement(v as PlacementStyle)} options={['inline','floating-right','floating-left']} /><label className="block text-sm font-medium text-gray-700"><span className="mb-1.5 block">Custom primary color</span><input type="color" value={customColor} onChange={(e) => setCustomColor(e.target.value)} className="h-10 w-full rounded-xl border border-gray-300" /></label></div>
    </div></article>
    <article className="min-w-0 space-y-6"><div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="mb-4 text-lg font-semibold text-gray-900">Live preview</h2><div className="relative h-72 overflow-hidden rounded-2xl border border-gray-300 bg-gray-50 p-4"><div className="absolute inset-x-0 top-0 h-9 border-b border-gray-200 bg-white" /><div className="absolute left-3 top-3 flex gap-1.5"> <span className="h-2.5 w-2.5 rounded-full bg-red-300" /> <span className="h-2.5 w-2.5 rounded-full bg-amber-300" /> <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" /></div><div className="absolute inset-x-4 top-14 h-5 rounded bg-white/80" /><div className="absolute inset-x-4 top-24 h-24 rounded bg-white/80" /><div className={`absolute max-w-[calc(100%-2.5rem)] ${placement === 'inline' ? 'left-5 top-16' : placement === 'floating-right' ? 'right-5 bottom-5' : 'left-5 bottom-5'}`}><a href={phoneError ? '#' : waLink} target="_blank" rel="noopener noreferrer" onClick={(e) => phoneError && e.preventDefault()} className="inline-flex max-w-full items-center gap-2 px-4 py-3 text-sm font-semibold shadow-sm" style={previewStyle}>{iconStyle === 'none' ? null : iconStyle === 'whatsapp' ? <WhatsAppIcon /> : <MessageCircle className="h-4 w-4" />}{iconOnly ? null : <span className="truncate">{safeLabel}</span>}</a></div></div></div>
    <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"><pre className="mt-2 max-h-56 overflow-auto rounded-2xl bg-gray-950 p-4 text-xs text-green-200"><code>{htmlSnippet}</code></pre><button type="button" onClick={copyHtml} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700" disabled={Boolean(phoneError)}>{copyState === 'success' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copyState === 'success' ? 'Copied' : 'Copy HTML'}</button>{copyState === 'error' ? <p className="mt-2 text-sm text-amber-700">Clipboard access failed. Please copy manually.</p> : null}</div>
    </article></div>

    <ToolHowItWorksSection
      heading="How the WhatsApp button maker works"
      intro="Create a click-to-chat WhatsApp button for your website without writing custom code from scratch."
      steps={[
        {
          title: 'Add your WhatsApp number',
          description: 'Choose your country code, enter your phone number, and optionally add a pre-filled message.',
        },
        {
          title: 'Customize the button',
          description: 'Choose the button label, icon style, color, and placement based on where you want to show it on your website.',
        },
        {
          title: 'Copy the HTML',
          description: 'Copy the generated HTML and add it to your website where you want the WhatsApp button to appear.',
        },
      ]}
    />

    <ToolFaqSection
      heading="WhatsApp Button Maker FAQs"
      items={[
        {
          question: 'Can I create a WhatsApp button without coding?',
          answer: 'Yes. Zapora creates copy-ready HTML for your WhatsApp button, so you can add it to your website with minimal setup.',
        },
        {
          question: 'Can I create an icon-only WhatsApp button?',
          answer: 'Yes. You can leave the label empty and use an icon-only button. The generated HTML still includes an accessible aria-label.',
        },
        {
          question: 'Can I customize the button color?',
          answer: 'Yes. You can choose a button color and preview how it will look before copying the HTML.',
        },
        {
          question: 'Where should I place the WhatsApp button on my website?',
          answer: 'You can use it inline inside a page section or as a floating button on the left or right side, depending on your website layout.',
        },
        {
          question: 'Does the button open WhatsApp in a new tab?',
          answer: 'Yes. The generated HTML opens WhatsApp in a new tab using target="_blank" and rel="noopener noreferrer".',
        },
      ]}
    />
  </section></main>);
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="block text-sm font-medium text-gray-700"><span className="mb-1.5 block">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}
