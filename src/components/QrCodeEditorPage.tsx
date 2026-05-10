import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';

type ExportSizeId = 'square' | 'story' | 'poster';
type ExportFormat = 'png' | 'jpg';
type CenterContent = 'none' | 'emoji' | 'image';

const QR_EDITOR_STORAGE_KEY = 'zapora_qr_editor_link';

const exportSizes: Record<ExportSizeId, { label: string; ratio: string; width: number; height: number }> = {
  square: { label: 'Square Post', ratio: '1:1', width: 1200, height: 1200 },
  story: { label: 'Story', ratio: '9:16', width: 1080, height: 1920 },
  poster: { label: 'Poster', ratio: '4:5', width: 1080, height: 1350 },
};

const colorPresets = [
  { name: 'Classic', qr: '#111827', banner: '#0f172a' },
  { name: 'WhatsApp', qr: '#075e54', banner: '#128c7e' },
  { name: 'Midnight', qr: '#0b1220', banner: '#1e293b' },
  { name: 'Royal', qr: '#312e81', banner: '#4338ca' },
  { name: 'Sunset', qr: '#9a3412', banner: '#ea580c' },
  { name: 'Berry', qr: '#831843', banner: '#be185d' },
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'>
      <h3 className='mb-3 text-sm font-semibold text-slate-900'>{title}</h3>
      <div className='space-y-3'>{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className='block'>
      <span className='mb-1.5 block text-xs font-medium text-slate-600'>{label}</span>
      {children}
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className='flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2'>
      <span className='text-xs font-medium text-slate-600'>{label}</span>
      <input type='color' value={value} onChange={(e) => onChange(e.target.value)} className='h-8 w-10 cursor-pointer rounded border border-slate-300 bg-transparent' />
    </label>
  );
}

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none';

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawTopRoundedBanner(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = src;
  });
}

function truncateString(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function shadeColor(hex: string, amount: number) {
  const normalized = hex.replace('#', '');
  const safeHex = normalized.length === 3
    ? normalized.split('').map((c) => `${c}${c}`).join('')
    : normalized;
  const n = Number.parseInt(safeHex, 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp((n >> 16) + amount);
  const g = clamp(((n >> 8) & 0x00ff) + amount);
  const b = clamp((n & 0x0000ff) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export default function QrCodeEditorPage() {
  const [targetLink, setTargetLink] = useState('');
  const [message, setMessage] = useState('Hi! I found you on Zapora and wanted to connect.');
  const [title, setTitle] = useState('Connect with us on WhatsApp');
  const [subtitle, setSubtitle] = useState('Scan to start a conversation');
  const [qrColor, setQrColor] = useState('#111827');
  const [bannerColor, setBannerColor] = useState('#0f172a');
  const [centerContent, setCenterContent] = useState<CenterContent>('none');
  const [centerEmoji, setCenterEmoji] = useState('💬');
  const [centerImageData, setCenterImageData] = useState('');
  const [size, setSize] = useState<ExportSizeId>('square');
  const [format, setFormat] = useState<ExportFormat>('png');

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseQrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(QR_EDITOR_STORAGE_KEY);
    if (stored) setTargetLink(stored);
  }, []);

  const finalQrData = useMemo(() => {
    const raw = targetLink.trim();
    if (!raw) return '';

    try {
      const parsed = new URL(raw);
      const host = parsed.hostname.toLowerCase();
      const isWhatsApp = host.includes('wa.me') || host.includes('whatsapp.');
      if (isWhatsApp && message.trim()) parsed.searchParams.set('text', message.trim());
      return parsed.toString();
    } catch {
      return raw;
    }
  }, [targetLink, message]);

  const renderComposition = useCallback(async () => {
    const previewCanvas = previewCanvasRef.current;
    const baseCanvas = baseQrCanvasRef.current;
    if (!previewCanvas || !baseCanvas || !finalQrData) return;

    const selectedSize = exportSizes[size];
    previewCanvas.width = selectedSize.width;
    previewCanvas.height = selectedSize.height;
    baseCanvas.width = 1200;
    baseCanvas.height = 1200;

    await QRCode.toCanvas(baseCanvas, finalQrData, {
      width: 1200,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: { dark: qrColor, light: '#ffffff' },
    });

    const ctx = previewCanvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = previewCanvas;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    const outerPad = Math.round(Math.min(width, height) * 0.06);
    const cardX = outerPad;
    const cardY = outerPad;
    const cardW = width - outerPad * 2;
    const cardH = height - outerPad * 2;

    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.12)';
    ctx.shadowBlur = 38;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 32);
    ctx.fill();
    ctx.restore();

    const bannerH = Math.round(cardH * 0.19);
    const bannerBase = shadeColor(bannerColor, -18);
    const bannerGradient = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + bannerH);
    bannerGradient.addColorStop(0, bannerColor);
    bannerGradient.addColorStop(1, bannerBase);
    ctx.fillStyle = bannerGradient;
    drawTopRoundedBanner(ctx, cardX, cardY, cardW, bannerH, 32);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.round(height * 0.042)}px Inter, ui-sans-serif`;
    ctx.fillText(truncateString(title.trim() || 'Scan me', 40), width / 2, cardY + bannerH * 0.48);

    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = `${Math.round(height * 0.024)}px Inter, ui-sans-serif`;
    ctx.fillText(truncateString(subtitle.trim() || 'Quick access', 54), width / 2, cardY + bannerH * 0.75);

    const footerH = Math.round(cardH * 0.09);
    const qrZoneTop = cardY + bannerH + Math.round(cardH * 0.045);
    const qrZoneBottom = cardY + cardH - footerH - Math.round(cardH * 0.03);
    const qrZoneH = qrZoneBottom - qrZoneTop;
    const qrSize = Math.round(Math.min(cardW * 0.74, qrZoneH * 0.92));
    const qrX = Math.round(cardX + (cardW - qrSize) / 2);
    const qrY = Math.round(qrZoneTop + (qrZoneH - qrSize) / 2);

    const qrPad = Math.round(qrSize * 0.07);
    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, qrX - qrPad, qrY - qrPad, qrSize + qrPad * 2, qrSize + qrPad * 2, 24);
    ctx.fill();

    ctx.drawImage(baseCanvas, qrX, qrY, qrSize, qrSize);

    if (centerContent !== 'none') {
      const overlay = Math.round(qrSize * 0.17);
      const cx = qrX + qrSize / 2;
      const cy = qrY + qrSize / 2;

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = Math.max(2, Math.round(overlay * 0.04));
      ctx.beginPath();
      ctx.arc(cx, cy, overlay / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (centerContent === 'emoji') {
        ctx.textAlign = 'center';
        ctx.font = `${Math.round(overlay * 0.5)}px Inter, ui-sans-serif`;
        ctx.fillStyle = '#0f172a';
        ctx.fillText(centerEmoji || '💬', cx, cy + overlay * 0.16);
      }

      if (centerContent === 'image' && centerImageData) {
        try {
          const logo = await loadImage(centerImageData);
          const safe = overlay * 0.64;
          const ratio = logo.width / logo.height;
          const drawW = ratio >= 1 ? safe : safe * ratio;
          const drawH = ratio >= 1 ? safe / ratio : safe;
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, overlay * 0.33, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(logo, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
          ctx.restore();
        } catch {
          // ignore invalid image data silently for stable preview rendering
        }
      }
    }

    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.font = `${Math.round(height * 0.017)}px Inter, ui-sans-serif`;
    ctx.fillText('Powered by Zapora', width / 2, cardY + cardH - footerH * 0.35);
  }, [bannerColor, centerContent, centerEmoji, centerImageData, finalQrData, qrColor, size, subtitle, title]);

  useEffect(() => {
    void renderComposition();
  }, [renderComposition]);

  const download = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !finalQrData) return;

    const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
    const ext = format === 'jpg' ? 'jpg' : 'png';
    const quality = format === 'jpg' ? 0.95 : undefined;
    const dataUrl = canvas.toDataURL(mimeType, quality);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `zapora-qr-${size}.${ext}`;
    link.click();
  }, [finalQrData, format, size]);

  return (
    <main className='min-h-screen bg-white py-8 sm:py-12'>
      <div className='mx-auto max-w-7xl px-4 lg:px-6'>
        <header className='mb-6 rounded-3xl border border-slate-200 bg-white p-5 sm:mb-8 sm:p-7'>
          <p className='mb-2 inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600'>Zapora Studio</p>
          <h1 className='text-2xl font-semibold tracking-tight text-slate-900 sm:text-4xl'>Premium QR Editor</h1>
        </header>

        <section className='grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,520px)]'>
          <div className='space-y-4'>
            <Section title='Content'>
              <Field label='Link or text'>
                <input value={targetLink} onChange={(e) => setTargetLink(e.target.value)} className={inputClass} placeholder='Paste WhatsApp link, URL, or plain text' />
              </Field>
              <Field label='WhatsApp message'>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} className={inputClass} rows={3} placeholder='Optional message appended to WhatsApp links' />
              </Field>
              <Field label='Title'>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder='Card title' />
              </Field>
              <Field label='Subtitle'>
                <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={inputClass} placeholder='Card subtitle' />
              </Field>
            </Section>

            <Section title='Color'>
              <div className='grid grid-cols-3 gap-2'>
                {colorPresets.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => {
                      setQrColor(preset.qr);
                      setBannerColor(preset.banner);
                    }}
                    className='rounded-xl border border-slate-200 bg-white p-2 text-left transition hover:border-slate-300'
                    type='button'
                  >
                    <div className='mb-1 flex gap-1.5'>
                      <span className='h-4 w-4 rounded-full border border-white shadow-sm' style={{ backgroundColor: preset.qr }} />
                      <span className='h-4 w-4 rounded-full border border-white shadow-sm' style={{ backgroundColor: preset.banner }} />
                    </div>
                    <p className='text-xs font-medium text-slate-700'>{preset.name}</p>
                  </button>
                ))}
              </div>
              <ColorField label='Custom QR color' value={qrColor} onChange={setQrColor} />
              <ColorField label='Custom banner color' value={bannerColor} onChange={setBannerColor} />
            </Section>

            <Section title='Center content'>
              <div className='grid grid-cols-3 gap-2'>
                {(['none', 'emoji', 'image'] as CenterContent[]).map((option) => (
                  <button
                    key={option}
                    type='button'
                    onClick={() => setCenterContent(option)}
                    className={`rounded-xl border px-3 py-2 text-sm capitalize transition ${centerContent === option ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'}`}
                  >
                    {option}
                  </button>
                ))}
              </div>

              {centerContent === 'emoji' && (
                <Field label='Emoji'>
                  <input value={centerEmoji} onChange={(e) => setCenterEmoji(e.target.value)} className={inputClass} maxLength={2} placeholder='💬' />
                </Field>
              )}

              {centerContent === 'image' && (
                <div className='space-y-2'>
                  <label className='block cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-700'>
                    Upload center image
                    <input
                      type='file'
                      accept='image/png,image/jpeg,image/jpg,image/webp'
                      className='hidden'
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => setCenterImageData(String(reader.result || ''));
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  {centerImageData && (
                    <button type='button' onClick={() => setCenterImageData('')} className='text-xs font-medium text-slate-500 underline underline-offset-2'>
                      Remove uploaded image
                    </button>
                  )}
                </div>
              )}
            </Section>
          </div>

          <aside className='xl:sticky xl:top-6 xl:self-start'>
            <div className='rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'>
              <div className='mb-4 grid gap-3 sm:grid-cols-2'>
                <Field label='Size'>
                  <select value={size} onChange={(e) => setSize(e.target.value as ExportSizeId)} className={inputClass}>
                    {Object.entries(exportSizes).map(([id, config]) => (
                      <option key={id} value={id}>{config.label} {config.ratio}</option>
                    ))}
                  </select>
                </Field>
                <Field label='Format'>
                  <select value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)} className={inputClass}>
                    <option value='png'>PNG</option>
                    <option value='jpg'>JPG</option>
                  </select>
                </Field>
              </div>

              <div className='rounded-2xl border border-slate-200 bg-slate-50 p-3'>
                <canvas ref={previewCanvasRef} className='w-full rounded-xl border border-slate-200 bg-white' />
                {!finalQrData && <p className='mt-2 text-center text-xs text-slate-500'>Enter a link or text to generate your QR preview.</p>}
              </div>

              <button
                type='button'
                onClick={download}
                disabled={!finalQrData}
                className='mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300'
              >
                Download QR ({format.toUpperCase()})
              </button>
            </div>
          </aside>
        </section>
      </div>

      <canvas ref={baseQrCanvasRef} className='hidden' />
    </main>
  );
}

export { QR_EDITOR_STORAGE_KEY };
