import { useEffect, useMemo, useState } from 'react';
import { History, ImageDown, Sparkles } from 'lucide-react';

const QR_EDITOR_STORAGE_KEY = 'zapora_qr_editor_link';
const QR_EDITOR_RECENTS_KEY = 'zapora_qr_editor_recent_designs';

type OutputStyle = 'plain' | 'whatsappCard' | 'posterCard';
type ColorMode = 'solid' | 'gradient' | 'custom';
type ExportSizeId = 'squareSocial' | 'storyVertical' | 'poster' | 'visitingCard';
type UseCaseId = 'businessContact' | 'customerSupport' | 'restaurantCafe' | 'retailStore' | 'freelancerPortfolio' | 'eventsRegistration';

type RecentDesign = {
  id: string;
  link: string;
  outputStyle: OutputStyle;
  titleText: string;
  subtitleText: string;
  colorMode: ColorMode;
  selectedSolidId: string;
  selectedGradientId: string;
  customColor: string;
  exportSizeId: ExportSizeId;
};

const solidPresets = [
  { id: 'black', name: 'Classic Black', color: '#000000' },
  { id: 'slate', name: 'Soft Slate', color: '#1f2937' },
  { id: 'ink', name: 'Midnight Ink', color: '#0f172a' },
  { id: 'forest', name: 'Forest Deep', color: '#14532d' },
  { id: 'navy', name: 'Calm Navy', color: '#1e3a8a' },
  { id: 'mocha', name: 'Warm Mocha', color: '#4b3a2f' },
] as const;

const gradientPresets = [
  { id: 'aurora-purple', name: 'Aurora Purple', swatch: 'linear-gradient(135deg, #7b61ff, #b16cea, #5ce1e6)', fallbackColor: '#7f72e3' },
  { id: 'sunset-candy', name: 'Sunset Candy', swatch: 'linear-gradient(90deg, #ff6ec7, #ffb86c)', fallbackColor: '#de7ea2' },
  { id: 'ocean-cyan', name: 'Ocean Cyan', swatch: 'linear-gradient(135deg, #00c6ff, #0072ff)', fallbackColor: '#1e8ae6' },
  { id: 'lime-energy', name: 'Lime Energy', swatch: 'linear-gradient(135deg, #bfff00, #00d9a6)', fallbackColor: '#3fbb7f' },
  { id: 'royal-dark-mode', name: 'Royal Dark Mode', swatch: 'linear-gradient(135deg, #141e30, #243b55, #6a11cb)', fallbackColor: '#3a3d7d' },
] as const;

const useCasePresets: Record<UseCaseId, { label: string; title: string; subtitle: string; outputStyle: OutputStyle; exportSizeId: ExportSizeId }> = {
  businessContact: { label: 'Business Contact', title: 'Chat with us on WhatsApp', subtitle: 'Scan to connect with our team instantly', outputStyle: 'whatsappCard', exportSizeId: 'squareSocial' },
  customerSupport: { label: 'Customer Support', title: 'Need help? Message our support team', subtitle: 'Fast answers and live assistance', outputStyle: 'whatsappCard', exportSizeId: 'visitingCard' },
  restaurantCafe: { label: 'Restaurant / Cafe', title: 'Order or ask on WhatsApp', subtitle: 'Menu, table booking, and quick support', outputStyle: 'posterCard', exportSizeId: 'poster' },
  retailStore: { label: 'Retail Store', title: 'Chat before you shop', subtitle: 'Ask for stock, offers, and delivery options', outputStyle: 'posterCard', exportSizeId: 'storyVertical' },
  freelancerPortfolio: { label: 'Freelancer / Portfolio', title: 'Let’s discuss your project', subtitle: 'Scan and message me directly on WhatsApp', outputStyle: 'whatsappCard', exportSizeId: 'squareSocial' },
  eventsRegistration: { label: 'Events / Registration', title: 'Scan to register or get event details', subtitle: 'Quick RSVP, tickets, and updates', outputStyle: 'posterCard', exportSizeId: 'storyVertical' },
};

const exportSizePresets: Record<ExportSizeId, { label: string; width: number; height: number }> = {
  squareSocial: { label: 'Square Social', width: 1200, height: 1200 },
  storyVertical: { label: 'Story / Vertical', width: 1080, height: 1920 },
  poster: { label: 'Poster', width: 1400, height: 2000 },
  visitingCard: { label: 'Visiting Card', width: 1400, height: 800 },
};

const isValidUrl = (value: string) => {
  if (!value.trim()) return false;
  try { new URL(value); return true; } catch { return false; }
};

const loadImage = async (url: string) => {
  const img = new Image(); img.crossOrigin = 'anonymous'; img.src = url;
  await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('Unable to render image')); });
  return img;
};

export default function QrCodeEditorPage() {
  const [targetLink, setTargetLink] = useState('');
  const [activeUseCase, setActiveUseCase] = useState<UseCaseId>('businessContact');
  const [colorMode, setColorMode] = useState<ColorMode>('solid');
  const [selectedSolidId, setSelectedSolidId] = useState('black');
  const [selectedGradientId, setSelectedGradientId] = useState('aurora-purple');
  const [customColor, setCustomColor] = useState('#000000');
  const [outputStyle, setOutputStyle] = useState<OutputStyle>('plain');
  const [exportSizeId, setExportSizeId] = useState<ExportSizeId>('squareSocial');
  const [titleText, setTitleText] = useState('Let’s Connect');
  const [subtitleText, setSubtitleText] = useState('Scan to chat on WhatsApp');
  const [downloadState, setDownloadState] = useState<'idle' | 'success' | 'error'>('idle');
  const [recentDesigns, setRecentDesigns] = useState<RecentDesign[]>([]);

  useEffect(() => {
    const storedLink = localStorage.getItem(QR_EDITOR_STORAGE_KEY);
    if (storedLink) setTargetLink(storedLink);
    const savedRecents = localStorage.getItem(QR_EDITOR_RECENTS_KEY);
    if (savedRecents) {
      try { setRecentDesigns(JSON.parse(savedRecents) as RecentDesign[]); } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(QR_EDITOR_RECENTS_KEY, JSON.stringify(recentDesigns.slice(0, 5)));
  }, [recentDesigns]);

  const hasValidLink = useMemo(() => isValidUrl(targetLink), [targetLink]);
  const selectedSolid = useMemo(() => solidPresets.find((preset) => preset.id === selectedSolidId) ?? solidPresets[0], [selectedSolidId]);
  const selectedGradient = useMemo(() => gradientPresets.find((preset) => preset.id === selectedGradientId) ?? gradientPresets[0], [selectedGradientId]);
  const exportSize = exportSizePresets[exportSizeId];

  const qrForegroundColor = useMemo(() => colorMode === 'custom' ? customColor : colorMode === 'gradient' ? selectedGradient.fallbackColor : selectedSolid.color, [colorMode, customColor, selectedGradient.fallbackColor, selectedSolid.color]);

  const qrImageUrl = useMemo(() => {
    if (!hasValidLink) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=640x640&color=${qrForegroundColor.replace('#', '')}&bgcolor=ffffff&data=${encodeURIComponent(targetLink.trim())}`;
  }, [hasValidLink, qrForegroundColor, targetLink]);

  const applyUseCasePreset = (useCaseId: UseCaseId) => {
    const preset = useCasePresets[useCaseId];
    setActiveUseCase(useCaseId);
    setOutputStyle(preset.outputStyle);
    setExportSizeId(preset.exportSizeId);
    setTitleText(preset.title);
    setSubtitleText(preset.subtitle);
  };

  const restoreRecent = (item: RecentDesign) => {
    setTargetLink(item.link);
    setOutputStyle(item.outputStyle);
    setTitleText(item.titleText);
    setSubtitleText(item.subtitleText);
    setColorMode(item.colorMode);
    setSelectedSolidId(item.selectedSolidId);
    setSelectedGradientId(item.selectedGradientId);
    setCustomColor(item.customColor);
    setExportSizeId(item.exportSizeId);
  };

  const pushRecent = () => {
    if (!hasValidLink) return;
    const next: RecentDesign = {
      id: `${Date.now()}`,
      link: targetLink.trim(), outputStyle, titleText, subtitleText, colorMode, selectedSolidId, selectedGradientId, customColor, exportSizeId,
    };
    setRecentDesigns((prev) => [next, ...prev.filter((item) => item.link !== next.link)].slice(0, 5));
  };

  const downloadPng = async () => {
    if (!hasValidLink || !qrImageUrl) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = exportSize.width; canvas.height = exportSize.height;
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas unavailable');
      const w = canvas.width; const h = canvas.height;
      ctx.fillStyle = '#f7f7fb'; ctx.fillRect(0, 0, w, h);
      const pad = Math.round(Math.min(w, h) * 0.08);
      const cardX = pad, cardY = pad, cardW = w - pad * 2, cardH = h - pad * 2;
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, 36); ctx.fill(); ctx.stroke();
      if (outputStyle !== 'plain') {
        const band = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + 120);
        if (colorMode === 'gradient') { band.addColorStop(0, '#7b61ff'); band.addColorStop(0.5, '#b16cea'); band.addColorStop(1, '#5ce1e6'); }
        else { band.addColorStop(0, qrForegroundColor); band.addColorStop(1, '#111827'); }
        ctx.fillStyle = band; ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, Math.round(cardH * 0.12), [36, 36, 18, 18]); ctx.fill();
      }
      const qr = await loadImage(qrImageUrl);
      const qrSize = Math.round(Math.min(cardW, cardH) * (outputStyle === 'posterCard' ? 0.48 : outputStyle === 'plain' ? 0.5 : 0.44));
      const qrX = (w - qrSize) / 2;
      const qrY = outputStyle === 'plain' ? cardY + Math.round(cardH * 0.2) : cardY + Math.round(cardH * 0.3);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(qrX - 24, qrY - 24, qrSize + 48, qrSize + 48, 24); ctx.fill(); ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);
      ctx.textAlign = 'center';
      if (outputStyle !== 'plain') {
        ctx.fillStyle = '#0f172a'; ctx.font = `700 ${Math.round(h * 0.04)}px Inter, Arial`; ctx.fillText(titleText, w / 2, cardY + Math.round(cardH * 0.16));
        ctx.fillStyle = '#475569'; ctx.font = `400 ${Math.round(h * 0.022)}px Inter, Arial`; ctx.fillText(subtitleText, w / 2, cardY + Math.round(cardH * 0.21));
      } else {
        ctx.fillStyle = '#334155'; ctx.font = `500 ${Math.round(h * 0.025)}px Inter, Arial`; ctx.fillText('Scan to open link', w / 2, qrY + qrSize + Math.round(h * 0.07));
      }
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a'); link.href = url; link.download = `zapora-${outputStyle}-${exportSizeId}.png`; link.click();
      pushRecent();
      setDownloadState('success'); window.setTimeout(() => setDownloadState('idle'), 2200);
    } catch { setDownloadState('error'); window.setTimeout(() => setDownloadState('idle'), 2500); }
  };

  return (
    <main className="relative overflow-hidden bg-gradient-to-b from-white via-gray-50 to-white py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8 text-center sm:mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">Advanced QR Design Studio</h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-gray-600 sm:text-lg">Business-ready QR presets, layouts, and export sizes for practical sharing.</p>
        </header>

        <section className="grid grid-cols-1 gap-6 rounded-[28px] border border-gray-200 bg-white p-4 shadow-[0_20px_70px_-30px_rgba(0,0,0,0.22)] sm:p-6 lg:grid-cols-2 lg:gap-8">
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4"><p className="mb-2 text-sm font-semibold text-gray-900">Link</p><input type="url" value={targetLink} onChange={(e) => setTargetLink(e.target.value)} placeholder="Paste your WhatsApp link or any URL" className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900" />{!targetLink.trim() ? <p className="mt-2 text-xs text-gray-500">Paste your WhatsApp link or URL, choose a preset, customize, and download.</p> : !hasValidLink ? <p className="mt-2 text-xs text-amber-700">Please enter a valid URL.</p> : null}</div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4"><p className="mb-3 text-sm font-semibold text-gray-900">Presets</p><div className="grid grid-cols-2 gap-2">{Object.entries(useCasePresets).map(([id, preset]) => <button key={id} onClick={() => applyUseCasePreset(id as UseCaseId)} className={`rounded-xl border px-3 py-2 text-left text-xs sm:text-sm ${activeUseCase === id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-700'}`}>{preset.label}</button>)}</div></div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4"><p className="mb-3 text-sm font-semibold text-gray-900">Style</p><div className="space-y-3"><div className="grid grid-cols-6 gap-2">{solidPresets.map((preset) => <button key={preset.id} onClick={() => { setColorMode('solid'); setSelectedSolidId(preset.id); }} className={`relative h-9 w-9 rounded-full border ${colorMode === 'solid' && selectedSolidId === preset.id ? 'border-gray-900 ring-2 ring-gray-900/20' : 'border-gray-200'}`} style={{ backgroundColor: preset.color }} />)}</div><div className="grid grid-cols-5 gap-2">{gradientPresets.map((preset) => <button key={preset.id} onClick={() => { setColorMode('gradient'); setSelectedGradientId(preset.id); }} className={`h-9 rounded-lg border ${colorMode === 'gradient' && selectedGradientId === preset.id ? 'border-gray-900 ring-2 ring-gray-900/20' : 'border-gray-200'}`} style={{ backgroundImage: preset.swatch }} />)}</div><label className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"><span>Custom color</span><input type="color" value={customColor} onChange={(e) => { setColorMode('custom'); setCustomColor(e.target.value); }} /></label></div></div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4"><p className="mb-3 text-sm font-semibold text-gray-900">Text & Output</p><div className="mb-3 grid grid-cols-3 gap-2">{[{ id: 'plain', label: 'Plain QR' }, { id: 'whatsappCard', label: 'WhatsApp Card' }, { id: 'posterCard', label: 'Poster Card' }].map((style) => <button key={style.id} onClick={() => setOutputStyle(style.id as OutputStyle)} className={`rounded-xl border px-2 py-2 text-xs sm:text-sm ${outputStyle === style.id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-700'}`}>{style.label}</button>)}</div>{outputStyle !== 'plain' ? <div className="grid gap-2"><input value={titleText} onChange={(e) => setTitleText(e.target.value)} className="rounded-xl border border-gray-300 px-3 py-2 text-sm" /><input value={subtitleText} onChange={(e) => setSubtitleText(e.target.value)} className="rounded-xl border border-gray-300 px-3 py-2 text-sm" /></div> : null}</div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4"><p className="mb-3 text-sm font-semibold text-gray-900">Export</p><div className="mb-3 grid grid-cols-2 gap-2">{Object.entries(exportSizePresets).map(([id, preset]) => <button key={id} onClick={() => setExportSizeId(id as ExportSizeId)} className={`rounded-xl border px-3 py-2 text-sm ${exportSizeId === id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-700'}`}>{preset.label}</button>)}</div><button onClick={downloadPng} disabled={!hasValidLink} className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-60"><ImageDown className="h-4 w-4" />Download {outputStyle} ({exportSize.label})</button><p className="mt-2 min-h-5 text-sm text-gray-600">{downloadState === 'success' ? 'PNG downloaded successfully.' : downloadState === 'error' ? 'Could not generate PNG. Please try again.' : ''}</p></div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4"><p className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900"><History className="h-4 w-4" />Recent</p><div className="space-y-2">{recentDesigns.length === 0 ? <p className="text-xs text-gray-500">Recent exports will appear here for quick reuse.</p> : recentDesigns.map((item) => <button key={item.id} onClick={() => restoreRecent(item)} className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-left text-xs"><p className="truncate font-medium text-gray-900">{item.titleText || item.link}</p><p className="truncate text-gray-500">{item.link}</p></button>)}</div></div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-5 shadow-inner sm:p-6"><h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Live preview canvas</h2>{hasValidLink && qrImageUrl ? <div className="mt-4 grid min-h-[460px] place-items-center rounded-2xl border border-dashed border-gray-300 bg-white p-4"><div className="w-full max-w-md" style={{ aspectRatio: `${exportSize.width} / ${exportSize.height}` }}><div className="flex h-full w-full flex-col rounded-3xl border border-gray-200 bg-white p-4 text-center shadow-lg"><div className={`mb-3 rounded-2xl p-3 text-white ${outputStyle === 'plain' ? 'hidden' : ''}`} style={colorMode === 'gradient' ? { backgroundImage: selectedGradient.swatch } : { backgroundColor: qrForegroundColor }}><p className="text-base font-semibold">{titleText}</p><p className="text-xs text-white/90">{subtitleText}</p></div><div className="mx-auto my-auto w-fit rounded-2xl border border-gray-200 bg-white p-3"><img src={qrImageUrl} alt="Styled QR preview" className="h-44 w-44 sm:h-56 sm:w-56" /></div><p className="mt-3 text-xs text-gray-600">{outputStyle === 'posterCard' ? 'Poster-ready layout' : outputStyle === 'whatsappCard' ? 'WhatsApp-ready card' : 'Plain QR output'}</p></div></div></div> : <div className="mt-4 flex min-h-[460px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white text-center"><div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-700"><Sparkles className="h-5 w-5" /></div><p className="text-base font-semibold text-gray-900">Start with a link</p><p className="mt-1 max-w-xs text-sm text-gray-600">Paste your WhatsApp link or URL, choose a preset, customize style, and download.</p></div>}<p className="mt-3 text-xs text-gray-500">Gradient QR modules are rendered using scan-safe solid fallback tones for reliability.</p></div>
        </section>
      </div>
    </main>
  );
}

export { QR_EDITOR_STORAGE_KEY };
