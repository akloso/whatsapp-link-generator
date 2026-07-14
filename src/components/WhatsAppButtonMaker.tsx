import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, MessageCircle, Search } from 'lucide-react';
import { countryOptions } from '../data/countryOptions';
import { trackEvent } from '../lib/trackEvent';
import { ToolFaqSection, ToolHowItWorksSection } from './ToolPageSupportSections';
import { Button, Surface, TextInput, Textarea } from './ui';

type ButtonStyle = 'primary' | 'dark' | 'light' | 'outline' | 'minimal';
type ButtonShape = 'rounded' | 'pill' | 'square-soft';
type IconStyle = 'whatsapp' | 'chat' | 'none';
type PlacementStyle = 'inline' | 'floating-right' | 'floating-left';
type CodeFormat = 'inline-html' | 'html-css' | 'react';

type ButtonConfig = {
  countryCode: string;
  phoneNumber: string;
  message: string;
  label: string;
  iconOnly: boolean;
  customColor: string;
  buttonStyle: ButtonStyle;
  buttonShape: ButtonShape;
  iconStyle: IconStyle;
  placement: PlacementStyle;
};

const MIN_PHONE_LENGTH = 6;
const MAX_PHONE_LENGTH = 15;
const ariaLabel = 'Chat on WhatsApp';

const buttonStyles: Record<ButtonStyle, { label: string; background: string; color: string; border: string; shadow: string }> = {
  primary: { label: 'Primary', background: '#25D366', color: '#ffffff', border: '#25D366', shadow: '0 8px 20px rgba(22, 163, 74, 0.22)' },
  dark: { label: 'Dark', background: '#111827', color: '#ffffff', border: '#111827', shadow: '0 8px 20px rgba(17, 24, 39, 0.18)' },
  light: { label: 'Light', background: '#f9fafb', color: '#111827', border: '#e5e7eb', shadow: '0 8px 18px rgba(17, 24, 39, 0.08)' },
  outline: { label: 'Outline', background: '#ffffff', color: '#166534', border: '#22c55e', shadow: '0 8px 18px rgba(34, 197, 94, 0.12)' },
  minimal: { label: 'Minimal', background: '#f0fdf4', color: '#166534', border: '#4ade80', shadow: 'none' },
};

const shapeLabels: Record<ButtonShape, string> = { rounded: 'Rounded', pill: 'Pill', 'square-soft': 'Soft square' };
const iconLabels: Record<IconStyle, string> = { whatsapp: 'WhatsApp', chat: 'Chat', none: 'No icon' };
const placementLabels: Record<PlacementStyle, string> = { inline: 'Inline', 'floating-left': 'Floating left', 'floating-right': 'Floating right' };
const radiusMap: Record<ButtonShape, string> = { rounded: '12px', pill: '999px', 'square-soft': '8px' };

const htmlEscape = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const reactEscape = (value: string) => value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
const cssEscape = (value: string) => value.replace(/[^#(),.%\-\w\s]/g, '');

const getPhoneError = (rawValue: string) => {
  const digits = rawValue.replace(/\D/g, '');
  if (!digits) return 'Enter your WhatsApp number.';
  if (digits.length < MIN_PHONE_LENGTH) return `Use at least ${MIN_PHONE_LENGTH} digits.`;
  if (digits.length > MAX_PHONE_LENGTH) return `Use no more than ${MAX_PHONE_LENGTH} digits.`;
  if (/^(\d)\1+$/.test(digits)) return 'Enter a valid phone number.';
  return '';
};

const getVisualStyle = (config: ButtonConfig) => {
  const token = buttonStyles[config.buttonStyle];
  const background = config.buttonStyle === 'primary' ? config.customColor : token.background;
  const borderColor = config.buttonStyle === 'primary' ? config.customColor : token.border;
  return { background, color: token.color, borderColor, boxShadow: token.shadow, borderRadius: radiusMap[config.buttonShape] };
};

const getWaLink = ({ countryCode, phoneNumber, message }: Pick<ButtonConfig, 'countryCode' | 'phoneNumber' | 'message'>) => {
  const base = `https://wa.me/${countryCode.replace('+', '')}${phoneNumber.replace(/\D/g, '')}`;
  return message.trim() ? `${base}?text=${encodeURIComponent(message.trim())}` : base;
};

const getIconMarkup = (iconStyle: IconStyle) => (iconStyle === 'none' ? '' : '<span class="zapora-whatsapp-button__icon" aria-hidden="true">💬</span>');
const getSafeLabel = (label: string) => label.trim() || ariaLabel;

function generateInlineHtmlCode(config: ButtonConfig) {
  const visual = getVisualStyle(config);
  const placementCss = config.placement === 'inline' ? 'position: static;' : `position: fixed; bottom: 20px; ${config.placement === 'floating-right' ? 'right' : 'left'}: 20px; z-index: 9999;`;
  const padding = config.iconOnly ? '12px' : '12px 16px';
  const styles = [
    placementCss,
    'display: inline-flex',
    'align-items: center',
    'justify-content: center',
    'gap: 8px',
    'font-family: Arial, sans-serif',
    'font-size: 14px',
    'font-weight: 700',
    'line-height: 1',
    'text-decoration: none',
    `padding: ${padding}`,
    `border-radius: ${visual.borderRadius}`,
    `background: ${visual.background}`,
    `color: ${visual.color}`,
    `border: 1px solid ${visual.borderColor}`,
    `box-shadow: ${visual.boxShadow}`,
  ].join('; ');
  return `<a href="${htmlEscape(getWaLink(config))}" target="_blank" rel="noopener noreferrer" aria-label="${ariaLabel}" style="${styles}">${getIconMarkup(config.iconStyle)}${config.iconOnly ? '' : `<span>${htmlEscape(getSafeLabel(config.label))}</span>`}</a>`;
}

function generateHtmlCssCode(config: ButtonConfig) {
  const visual = getVisualStyle(config);
  const placementClass = config.placement === 'inline' ? '' : ` zapora-whatsapp-button--${config.placement}`;
  const iconOnlyClass = config.iconOnly ? ' zapora-whatsapp-button--icon-only' : '';
  return `<!-- HTML -->\n<a class="zapora-whatsapp-button${placementClass}${iconOnlyClass}" href="${htmlEscape(getWaLink(config))}" target="_blank" rel="noopener noreferrer" aria-label="${ariaLabel}">\n  ${getIconMarkup(config.iconStyle)}${config.iconOnly ? '' : `\n  <span class="zapora-whatsapp-button__label">${htmlEscape(getSafeLabel(config.label))}</span>`}\n</a>\n\n<!-- CSS -->\n<style>\n.zapora-whatsapp-button {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: 8px;\n  font-family: Arial, sans-serif;\n  font-size: 14px;\n  font-weight: 700;\n  line-height: 1;\n  text-decoration: none;\n  padding: 12px 16px;\n  border-radius: ${cssEscape(visual.borderRadius)};\n  background: ${cssEscape(visual.background)};\n  color: ${cssEscape(String(visual.color))};\n  border: 1px solid ${cssEscape(visual.borderColor)};\n  box-shadow: ${cssEscape(visual.boxShadow)};\n}\n.zapora-whatsapp-button--icon-only {\n  padding: 12px;\n}\n.zapora-whatsapp-button--floating-left,\n.zapora-whatsapp-button--floating-right {\n  position: fixed;\n  bottom: 20px;\n  z-index: 9999;\n}\n.zapora-whatsapp-button--floating-left { left: 20px; }\n.zapora-whatsapp-button--floating-right { right: 20px; }\n.zapora-whatsapp-button__icon { flex: 0 0 auto; }\n.zapora-whatsapp-button__label { white-space: nowrap; }\n@media (max-width: 480px) {\n  .zapora-whatsapp-button--floating-left { left: 14px; }\n  .zapora-whatsapp-button--floating-right { right: 14px; }\n  .zapora-whatsapp-button--floating-left,\n  .zapora-whatsapp-button--floating-right { bottom: 14px; }\n}\n</style>`;
}

function generateReactCode(config: ButtonConfig) {
  const visual = getVisualStyle(config);
  const position = config.placement === 'inline' ? '' : `\n    position: 'fixed',\n    bottom: 20,\n    ${config.placement === 'floating-right' ? 'right' : 'left'}: 20,\n    zIndex: 9999,`;
  return `export default function WhatsAppButton() {\n  const href = \`${reactEscape(getWaLink(config))}\`;\n\n  const buttonStyle = {\n    display: 'inline-flex',\n    alignItems: 'center',\n    justifyContent: 'center',\n    gap: 8,\n    fontFamily: 'Arial, sans-serif',\n    fontSize: 14,\n    fontWeight: 700,\n    lineHeight: 1,\n    textDecoration: 'none',\n    padding: '${config.iconOnly ? '12px' : '12px 16px'}',\n    borderRadius: '${visual.borderRadius}',\n    background: '${visual.background}',\n    color: '${visual.color}',\n    border: '1px solid ${visual.borderColor}',\n    boxShadow: '${visual.boxShadow}',${position}\n  };\n\n  return (\n    <a href={href} target="_blank" rel="noopener noreferrer" aria-label="${ariaLabel}" style={buttonStyle}>\n      ${config.iconStyle === 'none' ? '' : '<span aria-hidden="true">💬</span>'}${config.iconOnly ? '' : `\n      <span>{\`${reactEscape(getSafeLabel(config.label))}\`}</span>`}\n    </a>\n  );\n}`;
}

function WhatsAppIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M20.5 3.5A11.3 11.3 0 0 0 2.7 17.1L1 23l6.1-1.6a11.3 11.3 0 0 0 5.3 1.3h0A11.4 11.4 0 0 0 23.8 11.3c0-3-1.2-5.9-3.3-7.8Zm-8.1 17.3h0a9.3 9.3 0 0 1-4.8-1.3l-.3-.2-3.6.9 1-3.5-.2-.4a9.2 9.2 0 1 1 7.9 4.5Zm5.1-7c-.3-.2-1.7-.9-2-1s-.5-.2-.7.2-.8 1-1 1.1-.4.1-.7 0a7.6 7.6 0 0 1-2.2-1.4 8.3 8.3 0 0 1-1.5-1.9c-.2-.3 0-.4.1-.6l.5-.6c.2-.2.2-.4.3-.6 0-.1 0-.3-.1-.5l-1-2.3c-.2-.5-.5-.4-.7-.4h-.6c-.2 0-.5.1-.7.3-.2.3-1 1-.9 2.4.1 1.4 1 2.7 1.2 2.9.1.2 2 3.1 4.9 4.2.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.1-1.4-.1-.2-.3-.2-.6-.3Z" /></svg>;
}

export default function WhatsAppButtonMaker() {
  const indiaOption = countryOptions.find((option) => option.country === 'India') ?? countryOptions[0];
  const [countryCode, setCountryCode] = useState(indiaOption.code);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [label, setLabel] = useState(ariaLabel);
  const [iconOnly, setIconOnly] = useState(false);
  const [customColor, setCustomColor] = useState('#16a34a');
  const [buttonStyle, setButtonStyle] = useState<ButtonStyle>('primary');
  const [buttonShape, setButtonShape] = useState<ButtonShape>('rounded');
  const [iconStyle, setIconStyle] = useState<IconStyle>('whatsapp');
  const [placement, setPlacement] = useState<PlacementStyle>('inline');
  const [codeFormat, setCodeFormat] = useState<CodeFormat>('inline-html');
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const countryDropdownRef = useRef<HTMLDivElement | null>(null);
  const countrySearchRef = useRef<HTMLInputElement | null>(null);

  const config = useMemo<ButtonConfig>(() => ({ countryCode, phoneNumber, message, label, iconOnly, customColor, buttonStyle, buttonShape, iconStyle, placement }), [buttonShape, buttonStyle, countryCode, customColor, iconOnly, iconStyle, label, message, phoneNumber, placement]);
  const phoneError = getPhoneError(phoneNumber);
  const selectedCountry = useMemo(() => countryOptions.find((option) => option.code === countryCode) ?? indiaOption, [countryCode, indiaOption]);
  const filteredCountries = useMemo(() => {
    const normalizedQuery = countrySearch.trim().toLowerCase();
    const sorted = [...countryOptions].sort((a, b) => a.country.localeCompare(b.country));
    const ordered = [indiaOption, ...sorted.filter((option) => option.country !== indiaOption.country)];
    if (!normalizedQuery) return ordered;
    const queryDigits = normalizedQuery.replace('+', '');
    return ordered.filter((option) => option.country.toLowerCase().includes(normalizedQuery) || option.code.toLowerCase().includes(normalizedQuery) || option.code.replace('+', '').includes(queryDigits));
  }, [countrySearch, indiaOption]);

  const waLink = useMemo(() => getWaLink(config), [config]);
  const generatedCode = useMemo(() => ({ 'inline-html': generateInlineHtmlCode(config), 'html-css': generateHtmlCssCode(config), react: generateReactCode(config) }), [config]);
  const activeCode = generatedCode[codeFormat];
  const previewStyle: CSSProperties = { ...getVisualStyle(config), borderWidth: 1, borderStyle: 'solid' };

  useEffect(() => {
    if (isCountryOpen) window.setTimeout(() => countrySearchRef.current?.focus(), 0);
  }, [isCountryOpen]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) setIsCountryOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => setCopyState('idle'), [activeCode]);

  const copyCode = async () => {
    if (phoneError) return;
    trackEvent('generate_whatsapp_button', { style: buttonStyle, placement, code_format: codeFormat, has_message: Boolean(message.trim()) });
    try {
      await navigator.clipboard.writeText(activeCode);
      setCopyState('success');
      window.setTimeout(() => setCopyState('idle'), 1800);
    } catch {
      setCopyState('error');
    }
  };

  return (
    <main className="overflow-x-hidden zapora-page-bg py-6 sm:py-8 lg:py-10">
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="mb-5 max-w-3xl sm:mb-7">
          <p className="mb-2 inline-flex rounded-full border border-emerald-100 bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">Free WhatsApp website widget</p>
          <h1 className="text-2xl font-bold tracking-tight text-gray-950 sm:text-4xl">WhatsApp Click-to-Chat Button Maker</h1>
          <p className="mt-2 text-sm leading-6 text-gray-600 sm:text-base">Design a compact WhatsApp button, preview it safely, then copy Inline HTML, HTML + CSS, or React code for your website.</p>
        </header>

        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:items-start">
          <Surface className="min-w-0 p-4 sm:p-5">
            <div className="space-y-5">
              <ConfigSection title="WhatsApp details">
                <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                  <div className="min-w-0 space-y-1.5" ref={countryDropdownRef}>
                    <label htmlFor="button-maker-country" className="block text-sm font-semibold text-gray-900">Country code</label>
                    <div className="relative">
                      <button id="button-maker-country" type="button" onClick={() => setIsCountryOpen((prev) => !prev)} className="flex h-11 w-full min-w-0 items-center justify-between rounded-xl border border-gray-300 bg-white px-3 text-left shadow-sm transition hover:border-gray-400 focus-visible:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/20" aria-expanded={isCountryOpen} aria-haspopup="listbox" aria-controls="button-maker-country-options">
                        <span className="min-w-0 truncate text-sm font-semibold text-gray-900">{selectedCountry.country} <span className="font-medium text-gray-500">{selectedCountry.code}</span></span>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${isCountryOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isCountryOpen ? (
                        <div className="absolute left-0 right-0 z-20 mt-2 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl sm:max-w-none" onKeyDown={(event) => { if (event.key === 'Escape') setIsCountryOpen(false); }}>
                          <div className="relative mb-2"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input ref={countrySearchRef} value={countrySearch} onChange={(e) => setCountrySearch(e.target.value)} placeholder="Search India, +91, 66..." aria-label="Search country" className="h-10 w-full rounded-xl border border-gray-200 pl-9 pr-3 text-sm text-gray-900 outline-none transition focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/20" /></div>
                          <div id="button-maker-country-options" role="listbox" aria-label="Country options" className="max-h-56 overflow-y-auto rounded-xl border border-gray-100">
                            {filteredCountries.length ? filteredCountries.map((option) => {
                              const isSelected = option.code === countryCode && option.country === selectedCountry.country;
                              return <button key={`${option.country}-${option.code}`} type="button" role="option" aria-selected={isSelected} onClick={() => { setCountryCode(option.code); setIsCountryOpen(false); setCountrySearch(''); }} className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/20 ${isSelected ? 'bg-emerald-50 font-semibold text-emerald-800' : 'text-gray-700 hover:bg-gray-50'}`}><span className="min-w-0 truncate">{option.country}</span><span className="shrink-0 text-gray-500">{option.code}</span></button>;
                            }) : <p className="px-3 py-3 text-sm text-gray-500">No country found.</p>}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <Field label="WhatsApp phone number" htmlFor="button-maker-phone">
                    <div className={`flex h-11 min-w-0 items-center rounded-xl border bg-white px-3 shadow-sm transition focus-within:ring-2 ${phoneError && phoneNumber ? 'border-rose-300 focus-within:border-rose-400 focus-within:ring-rose-100' : 'border-gray-300 hover:border-gray-400 focus-within:border-emerald-500 focus-within:ring-emerald-500/20'}`}>
                      <span className="shrink-0 pr-2 text-sm font-semibold text-gray-500">{countryCode}</span>
                      <input id="button-maker-phone" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))} inputMode="numeric" autoComplete="tel-national" placeholder="9876543210" aria-invalid={Boolean(phoneError && phoneNumber)} aria-describedby="button-maker-phone-error" className="h-full min-w-0 flex-1 border-none bg-transparent text-sm text-gray-900 outline-none" />
                    </div>
                    {phoneNumber && phoneError ? <p id="button-maker-phone-error" className="mt-1.5 text-xs font-medium text-rose-600">{phoneError}</p> : null}
                  </Field>
                </div>
                <Field label="Pre-filled message (optional)" htmlFor="button-maker-message"><Textarea id="button-maker-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Hi, I’d like to know more." className="min-h-[88px]" /></Field>
              </ConfigSection>

              <ConfigSection title="Button content">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <Field label="Button label" htmlFor="button-maker-label"><TextInput id="button-maker-label" value={label} onChange={(e) => setLabel(e.target.value)} disabled={iconOnly} /></Field>
                  <label className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-gray-700 transition hover:border-emerald-200 hover:bg-emerald-50/50"><input type="checkbox" checked={iconOnly} onChange={(e) => setIconOnly(e.target.checked)} className="h-4 w-4 rounded border-gray-300 accent-emerald-600" /> Icon only</label>
                </div>
                <SegmentedOptions label="Icon style" value={iconStyle} options={Object.entries(iconLabels)} onChange={(value) => setIconStyle(value as IconStyle)} />
              </ConfigSection>

              <ConfigSection title="Appearance">
                <SegmentedOptions label="Button style" value={buttonStyle} options={Object.entries(buttonStyles).map(([value, item]) => [value, item.label])} onChange={(value) => setButtonStyle(value as ButtonStyle)} />
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
                  <SegmentedOptions label="Shape" value={buttonShape} options={Object.entries(shapeLabels)} onChange={(value) => setButtonShape(value as ButtonShape)} />
                  <Field label="Primary color" htmlFor="button-maker-color"><input id="button-maker-color" type="color" value={customColor} onChange={(e) => setCustomColor(e.target.value)} className="h-11 w-full cursor-pointer rounded-xl border border-gray-300 bg-white p-1 shadow-sm" aria-label="Custom primary color" /></Field>
                </div>
              </ConfigSection>

              <ConfigSection title="Placement"><SegmentedOptions label="Placement style" value={placement} options={Object.entries(placementLabels)} onChange={(value) => setPlacement(value as PlacementStyle)} /></ConfigSection>
            </div>
          </Surface>

          <aside className="min-w-0 space-y-5 lg:sticky lg:top-5">
            <Surface className="p-4 sm:p-5" aria-label="Live preview">
              <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-base font-bold text-gray-950">Live Preview</h2><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{placementLabels[placement]}</span></div>
              <div className="relative h-56 overflow-hidden rounded-2xl border border-gray-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ecfeff_52%,#f0fdf4_100%)] p-4" aria-hidden="true">
                <div className="absolute inset-x-0 top-0 h-8 border-b border-gray-200 bg-white" /><div className="absolute left-3 top-3 flex gap-1.5"><span className="h-2 w-2 rounded-full bg-red-300" /><span className="h-2 w-2 rounded-full bg-amber-300" /><span className="h-2 w-2 rounded-full bg-emerald-300" /></div>
                <div className="absolute inset-x-4 top-12 h-4 rounded bg-white/90" /><div className="absolute left-4 top-20 h-24 w-[58%] rounded-xl bg-white/80" /><div className="absolute right-4 top-20 h-24 w-[30%] rounded-xl bg-white/80" />
                <div className={`absolute max-w-[calc(100%-2rem)] ${placement === 'inline' ? 'left-4 top-16' : placement === 'floating-right' ? 'right-4 bottom-4' : 'left-4 bottom-4'}`}>
                  <a href={phoneError ? '#' : waLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.preventDefault()} className="inline-flex max-w-full items-center justify-center gap-2 px-4 py-3 text-sm font-bold leading-none no-underline" style={previewStyle}>{iconStyle === 'none' ? null : iconStyle === 'whatsapp' ? <WhatsAppIcon /> : <MessageCircle className="h-4 w-4" />}{iconOnly ? null : <span className="truncate">{getSafeLabel(label)}</span>}</a>
                </div>
              </div>
              {phoneError ? <p className="mt-2 text-xs font-medium text-rose-600">Add a valid number to enable copying generated code.</p> : null}
            </Surface>

            <Surface className="min-w-0 p-4 sm:p-5" aria-label="Generated code">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-base font-bold text-gray-950">Generated code</h2><p className="mt-1 text-sm text-gray-600">{codeFormat === 'inline-html' ? 'Inline HTML: easiest to paste anywhere' : codeFormat === 'html-css' ? 'HTML + CSS: cleaner and reusable' : 'React: for React-based projects'}</p></div><div role="tablist" aria-label="Code format" className="grid grid-cols-3 rounded-xl bg-gray-100 p-1 text-xs font-semibold text-gray-600">{(['inline-html', 'html-css', 'react'] as CodeFormat[]).map((format) => <button key={format} type="button" role="tab" aria-selected={codeFormat === format} onClick={() => setCodeFormat(format)} className={`rounded-lg px-2.5 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 ${codeFormat === format ? 'bg-white text-emerald-700 shadow-sm' : 'hover:text-gray-900'}`}>{format === 'html-css' ? 'HTML + CSS' : format === 'react' ? 'React' : 'Inline HTML'}</button>)}</div></div>
              <pre className="max-h-64 max-w-full overflow-auto rounded-2xl bg-gray-950 p-3 text-xs leading-5 text-green-100"><code>{activeCode}</code></pre>
              <Button type="button" onClick={copyCode} disabled={Boolean(phoneError)} aria-label={`Copy ${codeFormat === 'html-css' ? 'HTML and CSS' : codeFormat === 'react' ? 'React' : 'Inline HTML'} code`} variant={copyState === 'success' ? 'success' : 'primary'} className="mt-3" icon={copyState === 'success' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>{copyState === 'success' ? 'Copied' : `Copy ${codeFormat === 'html-css' ? 'HTML + CSS' : codeFormat === 'react' ? 'React' : 'Inline HTML'}`}</Button>
              {copyState === 'error' ? <p className="mt-2 text-sm text-amber-700">Clipboard access failed. Please copy manually.</p> : null}
            </Surface>
          </aside>
        </div>

        <ToolHowItWorksSection heading="How the WhatsApp button maker works" intro="Create a click-to-chat WhatsApp button for your website without writing custom code from scratch." steps={[{ title: 'Add your WhatsApp number', description: 'Choose the country code, enter the phone number, and optionally add a pre-filled message.' }, { title: 'Customize the button', description: 'Choose the label, icon style, color, and placement.' }, { title: 'Copy the code', description: 'Choose Inline HTML, HTML + CSS, or React, then copy the generated code and add it to your website.' }]} />
        <ToolFaqSection heading="WhatsApp Button Maker FAQs" items={[{ question: 'Can I create a WhatsApp button without coding?', answer: 'Yes. Zapora creates copy-ready code with minimal setup required.' }, { question: 'Which code formats can I generate?', answer: 'You can generate Inline HTML, separate HTML and CSS, or a React component.' }, { question: 'Can I create an icon-only WhatsApp button?', answer: 'Yes. The label can be empty. Generated code should still include an accessible aria-label.' }, { question: 'Can I customize the button color?', answer: 'Yes. Users can choose a color and preview it before copying the code.' }, { question: 'Where should I place the WhatsApp button?', answer: 'It can be inline or floating on the left or right, depending on the website layout.' }, { question: 'Does the button open WhatsApp in a new tab?', answer: 'Yes. Generated links should use target="_blank" and rel="noopener noreferrer".' }]} />
      </section>
    </main>
  );
}

function ConfigSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border-b border-gray-100 pb-4 last:border-b-0 last:pb-0"><h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-emerald-700">{title}</h2><div className="space-y-3">{children}</div></section>;
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return <label className="block min-w-0 text-sm font-semibold text-gray-900" htmlFor={htmlFor}><span className="mb-1.5 block">{label}</span>{children}</label>;
}

function SegmentedOptions({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string, string][] }) {
  return <fieldset className="min-w-0"><legend className="mb-1.5 text-sm font-semibold text-gray-900">{label}</legend><div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">{options.map(([optionValue, optionLabel]) => { const selected = value === optionValue; return <button key={optionValue} type="button" onClick={() => onChange(optionValue)} aria-pressed={selected} className={`min-h-10 rounded-xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 ${selected ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm' : 'border-gray-200 bg-white text-gray-700 hover:border-emerald-200 hover:bg-emerald-50/40'}`}><span className="inline-flex items-center gap-1.5">{selected ? <Check className="h-3.5 w-3.5" /> : null}{optionLabel}</span></button>; })}</div></fieldset>;
}
