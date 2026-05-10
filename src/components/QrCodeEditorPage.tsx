import { useEffect, useMemo, useState } from 'react';
import { ImageDown, Sparkles } from 'lucide-react';

const QR_EDITOR_STORAGE_KEY = 'zapora_qr_editor_link';

type OutputStyle = 'plain' | 'whatsappCard' | 'posterCard';
type ColorMode = 'solid' | 'gradient' | 'custom';

type SolidPreset = { id: string; name: string; color: string };
type GradientPreset = { id: string; name: string; swatch: string; fallbackColor: string };

const solidPresets: SolidPreset[] = [
  { id: 'black', name: 'Classic Black', color: '#000000' },
  { id: 'slate', name: 'Soft Slate', color: '#1f2937' },
  { id: 'ink', name: 'Midnight Ink', color: '#0f172a' },
  { id: 'forest', name: 'Forest Deep', color: '#14532d' },
  { id: 'navy', name: 'Calm Navy', color: '#1e3a8a' },
  { id: 'mocha', name: 'Warm Mocha', color: '#4b3a2f' },
];

const gradientPresets: GradientPreset[] = [
  { id: 'aurora-purple', name: 'Aurora Purple', swatch: 'linear-gradient(135deg, #7b61ff, #b16cea, #5ce1e6)', fallbackColor: '#7f72e3' },
  { id: 'sunset-candy', name: 'Sunset Candy', swatch: 'linear-gradient(90deg, #ff6ec7, #ffb86c)', fallbackColor: '#de7ea2' },
  { id: 'ocean-cyan', name: 'Ocean Cyan', swatch: 'linear-gradient(135deg, #00c6ff, #0072ff)', fallbackColor: '#1e8ae6' },
  { id: 'lime-energy', name: 'Lime Energy', swatch: 'linear-gradient(135deg, #bfff00, #00d9a6)', fallbackColor: '#3fbb7f' },
  { id: 'royal-dark-mode', name: 'Royal Dark Mode', swatch: 'linear-gradient(135deg, #141e30, #243b55, #6a11cb)', fallbackColor: '#3a3d7d' },
];

const isValidUrl = (value: string) => {
  if (!value.trim()) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const loadImage = async (url: string) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Unable to render image'));
  });
  return img;
};

export default function QrCodeEditorPage() {
  const [targetLink, setTargetLink] = useState('');
  const [colorMode, setColorMode] = useState<ColorMode>('solid');
  const [selectedSolidId, setSelectedSolidId] = useState('black');
  const [selectedGradientId, setSelectedGradientId] = useState('aurora-purple');
  const [customColor, setCustomColor] = useState('#000000');
  const [outputStyle, setOutputStyle] = useState<OutputStyle>('plain');
  const [titleText, setTitleText] = useState('Let’s Connect');
  const [subtitleText, setSubtitleText] = useState('Scan to chat on WhatsApp');
  const [downloadState, setDownloadState] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    const storedLink = localStorage.getItem(QR_EDITOR_STORAGE_KEY);
    if (storedLink) setTargetLink(storedLink);
  }, []);

  const hasValidLink = useMemo(() => isValidUrl(targetLink), [targetLink]);

  const selectedSolid = useMemo(() => solidPresets.find((preset) => preset.id === selectedSolidId) ?? solidPresets[0], [selectedSolidId]);
  const selectedGradient = useMemo(() => gradientPresets.find((preset) => preset.id === selectedGradientId) ?? gradientPresets[0], [selectedGradientId]);

  const qrForegroundColor = useMemo(() => {
    if (colorMode === 'custom') return customColor;
    if (colorMode === 'gradient') return selectedGradient.fallbackColor;
    return selectedSolid.color;
  }, [colorMode, customColor, selectedGradient.fallbackColor, selectedSolid.color]);

  const qrImageUrl = useMemo(() => {
    if (!hasValidLink) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=640x640&color=${qrForegroundColor.replace('#', '')}&bgcolor=ffffff&data=${encodeURIComponent(targetLink.trim())}`;
  }, [hasValidLink, qrForegroundColor, targetLink]);

  const downloadPng = async () => {
    if (!hasValidLink || !qrImageUrl) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1200;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');

      ctx.fillStyle = '#f7f7fb';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cardX = 140;
      const cardY = 120;
      const cardW = 920;
      const cardH = 960;

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 40);
      ctx.fill();
      ctx.stroke();

      if (outputStyle !== 'plain') {
        const topBand = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + 100);
        if (colorMode === 'gradient') {
          topBand.addColorStop(0, '#7b61ff');
          topBand.addColorStop(0.5, '#b16cea');
          topBand.addColorStop(1, '#5ce1e6');
        } else {
          topBand.addColorStop(0, qrForegroundColor);
          topBand.addColorStop(1, '#111827');
        }
        ctx.fillStyle = topBand;
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, 120, [40, 40, 20, 20]);
        ctx.fill();
      }

      const qr = await loadImage(qrImageUrl);
      const qrSize = outputStyle === 'posterCard' ? 520 : 460;
      const qrX = (canvas.width - qrSize) / 2;
      const qrY = outputStyle === 'plain' ? 260 : outputStyle === 'posterCard' ? 360 : 330;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(qrX - 24, qrY - 24, qrSize + 48, qrSize + 48, 26);
      ctx.fill();
      ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);

      ctx.fillStyle = outputStyle === 'plain' ? '#111827' : '#0f172a';
      ctx.textAlign = 'center';
      if (outputStyle !== 'plain') {
        ctx.font = '700 54px Inter, Arial, sans-serif';
        ctx.fillText(titleText, canvas.width / 2, 220);
        ctx.font = '400 32px Inter, Arial, sans-serif';
        ctx.fillStyle = '#475569';
        ctx.fillText(subtitleText, canvas.width / 2, 280);
      } else {
        ctx.font = '500 28px Inter, Arial, sans-serif';
        ctx.fillText('Scan to open link', canvas.width / 2, 860);
      }

      if (outputStyle === 'posterCard') {
        ctx.font = '600 26px Inter, Arial, sans-serif';
        ctx.fillStyle = '#334155';
        ctx.fillText('Powered by Zapora QR Editor', canvas.width / 2, 980);
      }

      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `zapora-qr-${outputStyle}.png`;
      link.click();

      setDownloadState('success');
      window.setTimeout(() => setDownloadState('idle'), 2200);
    } catch {
      setDownloadState('error');
      window.setTimeout(() => setDownloadState('idle'), 2500);
    }
  };

  return (
    <main className="relative overflow-hidden bg-gradient-to-b from-white via-gray-50 to-white py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8 text-center sm:mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">Advanced QR Design Studio</h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-gray-600 sm:text-lg">Customize your QR style, preview polished layouts, and download a share-ready design.</p>
        </header>

        <section className="grid grid-cols-1 gap-6 rounded-[28px] border border-gray-200 bg-white p-4 shadow-[0_20px_70px_-30px_rgba(0,0,0,0.22)] sm:p-6 lg:grid-cols-2 lg:gap-8">
          <div className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="qr-link-input" className="block text-sm font-semibold text-gray-900">Link to encode</label>
              <input id="qr-link-input" type="url" value={targetLink} onChange={(event) => setTargetLink(event.target.value)} placeholder="Paste your WhatsApp link or any URL" className="w-full rounded-2xl border border-gray-300 px-4 py-3.5 text-gray-900 outline-none transition-all hover:border-gray-400 focus-visible:border-green-500 focus-visible:ring-2 focus-visible:ring-green-500/20" />
              {!targetLink.trim() ? <p className="text-sm text-gray-500">Enter a link to start designing your QR code.</p> : !hasValidLink ? <p className="text-sm text-amber-700">Please enter a valid URL (example: https://wa.me/1234567890).</p> : <p className="text-sm text-green-700">Great! Live preview is ready.</p>}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="mb-3 text-sm font-semibold text-gray-900">QR color style</p>
              <div className="space-y-3">
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Solid presets</p>
                  <div className="grid grid-cols-6 gap-2">
                    {solidPresets.map((preset) => {
                      const selected = colorMode === 'solid' && selectedSolidId === preset.id;
                      return <button key={preset.id} type="button" title={preset.name} onClick={() => { setColorMode('solid'); setSelectedSolidId(preset.id); }} className={`relative h-9 w-9 rounded-full border transition-all ${selected ? 'border-gray-900 ring-2 ring-gray-900/20' : 'border-gray-200 hover:border-gray-400'}`} style={{ backgroundColor: preset.color }}>{selected ? <span className="absolute inset-0 grid place-items-center text-white">✓</span> : null}</button>;
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Gradient presets</p>
                  <div className="grid grid-cols-5 gap-2">
                    {gradientPresets.map((preset) => {
                      const selected = colorMode === 'gradient' && selectedGradientId === preset.id;
                      return <button key={preset.id} type="button" title={preset.name} onClick={() => { setColorMode('gradient'); setSelectedGradientId(preset.id); }} className={`relative h-10 rounded-xl border transition-all ${selected ? 'border-gray-900 ring-2 ring-gray-900/20' : 'border-gray-200 hover:border-gray-400'}`} style={{ backgroundImage: preset.swatch }}>{selected ? <span className="absolute inset-0 grid place-items-center text-white">✓</span> : null}</button>;
                    })}
                  </div>
                </div>

                <label className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700">
                  <span className="font-medium">Custom color</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs uppercase text-gray-500">{customColor}</span>
                    <input type="color" value={customColor} onChange={(event) => { setColorMode('custom'); setCustomColor(event.target.value); }} className="h-9 w-12 cursor-pointer rounded-md border border-gray-300 bg-white p-1" aria-label="Pick custom QR foreground color" />
                  </div>
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="mb-3 text-sm font-semibold text-gray-900">Output style</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'plain', label: 'Plain QR' },
                  { id: 'whatsappCard', label: 'WhatsApp Card' },
                  { id: 'posterCard', label: 'Poster Card' },
                ].map((style) => (
                  <button key={style.id} type="button" onClick={() => setOutputStyle(style.id as OutputStyle)} className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${outputStyle === style.id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'}`}>
                    {style.label}
                  </button>
                ))}
              </div>

              {outputStyle !== 'plain' ? (
                <div className="mt-4 grid gap-3">
                  <input value={titleText} onChange={(event) => setTitleText(event.target.value)} placeholder="Title" className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
                  <input value={subtitleText} onChange={(event) => setSubtitleText(event.target.value)} placeholder="Subtitle or CTA" className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Download output</p>
                  <p className="text-xs text-gray-500">PNG export of current style layout</p>
                </div>
                <button onClick={downloadPng} disabled={!hasValidLink} className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 disabled:cursor-not-allowed disabled:opacity-60">
                  <ImageDown className="h-4 w-4" /> Download PNG
                </button>
              </div>
              <p className="mt-2 min-h-5 text-sm text-gray-600">{downloadState === 'success' ? 'PNG downloaded successfully.' : downloadState === 'error' ? 'Could not generate PNG. Please try again.' : ''}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-5 shadow-inner sm:p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Live preview canvas</h2>
            {hasValidLink && qrImageUrl ? (
              <div className="mt-4 grid min-h-[460px] place-items-center rounded-2xl border border-dashed border-gray-300 bg-white p-4">
                {outputStyle === 'plain' ? (
                  <div className="flex flex-col items-center">
                    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"><img src={qrImageUrl} alt="Live QR preview" className="h-56 w-56 sm:h-64 sm:w-64" /></div>
                    <p className="mt-3 text-sm text-gray-600">Plain QR output</p>
                  </div>
                ) : (
                  <div className={`w-full max-w-md rounded-3xl border border-gray-200 bg-white p-5 text-center shadow-lg ${outputStyle === 'posterCard' ? 'sm:p-7' : ''}`}>
                    <div className="mb-4 rounded-2xl p-3 text-white" style={colorMode === 'gradient' ? { backgroundImage: selectedGradient.swatch } : { backgroundColor: qrForegroundColor }}>
                      <p className="text-lg font-semibold">{titleText}</p>
                      <p className="text-sm text-white/90">{subtitleText}</p>
                    </div>
                    <div className="mx-auto w-fit rounded-2xl border border-gray-200 bg-white p-3 shadow-sm"><img src={qrImageUrl} alt="Styled QR preview" className="h-52 w-52 sm:h-60 sm:w-60" /></div>
                    <p className="mt-4 text-sm text-gray-600">{outputStyle === 'whatsappCard' ? 'Scan to chat on WhatsApp' : 'Scan to connect and save contact'}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 flex min-h-[460px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white text-center">
                <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-700"><Sparkles className="h-5 w-5" /></div>
                <p className="text-base font-semibold text-gray-900">Preview will appear here</p>
                <p className="mt-1 max-w-xs text-sm text-gray-600">Add a valid link to unlock style controls and preview output.</p>
              </div>
            )}
            <p className="mt-3 text-xs text-gray-500">Gradient QR modules are not supported by this QR engine. Zapora uses scan-safe solid fallback tones for readability.</p>
          </div>
        </section>
      </div>
    </main>
  );
}

export { QR_EDITOR_STORAGE_KEY };
