import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { ArrowUpRight, Download, Image as ImageIcon, Palette, Smile, Trash2 } from 'lucide-react';
import { QR_EDITOR_STORAGE_KEY } from './qrEditorConstants';

type Preset = {
  name: string;
  fg: string;
  bg: string;
  banner: string;
};

type SizeOption = {
  name: string;
  ratio: string;
  w: number;
  h: number;
};

type FormatOption = 'PNG' | 'JPG';
type CenterType = 'none' | 'emoji' | 'image';

const PRESETS: Preset[] = [
  { name: 'Classic', fg: '#0f1f17', bg: '#ffffff', banner: '#16a34a' },
  { name: 'WhatsApp', fg: '#0b3d2e', bg: '#ffffff', banner: '#25d366' },
  { name: 'Midnight', fg: '#0b1220', bg: '#ffffff', banner: '#1e293b' },
  { name: 'Royal', fg: '#1e1b4b', bg: '#ffffff', banner: '#4f46e5' },
  { name: 'Sunset', fg: '#3b0a0a', bg: '#ffffff', banner: '#f97316' },
  { name: 'Berry', fg: '#3b0764', bg: '#ffffff', banner: '#a21caf' },
];

const SIZES: SizeOption[] = [
  { name: 'Square Post', ratio: '1:1', w: 1080, h: 1080 },
  { name: 'Story', ratio: '9:16', w: 1080, h: 1920 },
  { name: 'Poster', ratio: '4:5', w: 1080, h: 1350 },
];

const FORMATS: FormatOption[] = ['PNG', 'JPG'];

const EMOJIS = ['💬', '📱', '🛍️', '❤️', '✨', '🎉', '📷', '🍔', '☕', '🎵', '🚀', '🌟'];
type BarcodeDetectorLike = new (options: { formats: string[] }) => {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

function QrCodeEditorPage() {
  const [rawContent, setRawContent] = useState('');
  const [message, setMessage] = useState('');
  const [title, setTitle] = useState('Scan to chat');
  const [subtitle, setSubtitle] = useState('Connect with us on WhatsApp');
  const [preset, setPreset] = useState<Preset>(PRESETS[1]);
  const [fg, setFg] = useState(PRESETS[1].fg);
  const [banner, setBanner] = useState(PRESETS[1].banner);
  const [centerType, setCenterType] = useState<CenterType>('none');
  const [centerEmoji, setCenterEmoji] = useState('💬');
  const [centerImage, setCenterImage] = useState<string | null>(null);
  const [size, setSize] = useState<SizeOption>(SIZES[0]);
  const [format, setFormat] = useState<FormatOption>('PNG');
  const [status, setStatus] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [isImportingQr, setIsImportingQr] = useState(false);

  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(QR_EDITOR_STORAGE_KEY);
    if (saved) {
      setRawContent(saved);
      return;
    }
    setRawContent('https://wa.me/919999999999');
  }, []);

  const finalContent = useMemo(() => {
    const value = rawContent.trim();
    if (!value) return '';

    try {
      const url = new URL(value);
      const isWhatsAppLink = url.hostname.includes('wa.me') || url.hostname.includes('whatsapp');

      if (isWhatsAppLink && message.trim()) {
        url.searchParams.set('text', message.trim());
      }

      return url.toString();
    } catch {
      return value;
    }
  }, [message, rawContent]);

  const isReady = useMemo(() => finalContent.trim().length > 0, [finalContent]);

  const applyPreset = (nextPreset: Preset) => {
    setPreset(nextPreset);
    setFg(nextPreset.fg);
    setBanner(nextPreset.banner);
  };

  const onUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCenterImage(reader.result as string);
      setCenterType('image');
    };
    reader.readAsDataURL(file);
  };

  const handleImportQr = async (file: File) => {
    setImportStatus('Reading QR image...');

    const acceptedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!acceptedTypes.includes(file.type)) {
      setImportStatus('Please upload a PNG, JPG, or WEBP QR image.');
      return;
    }

    const BarcodeDetectorClass = (window as unknown as { BarcodeDetector?: BarcodeDetectorLike }).BarcodeDetector;
    if (!BarcodeDetectorClass) {
      setImportStatus('QR upload scanning is not supported in this browser yet. Please paste the QR link manually.');
      return;
    }

    setIsImportingQr(true);
    try {
      const imageDataUrl = await readFileAsDataUrl(file);
      const image = await loadImage(imageDataUrl);
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        setImportStatus('We couldn’t read this QR. Please upload a clearer QR image or paste the link manually.');
        return;
      }

      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const detector = new BarcodeDetectorClass({ formats: ['qr_code'] });
      const detections = await detector.detect(canvas);
      const decodedValue = detections[0]?.rawValue;

      if (!decodedValue) {
        setImportStatus('We couldn’t read this QR. Please upload a clearer QR image or paste the link manually.');
        return;
      }

      setRawContent(decodedValue.trim());
      setImportStatus('QR imported successfully. You can now customize and export it.');
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('QR import failed:', error);
      }
      setImportStatus('We couldn’t read this QR. Please upload a clearer QR image or paste the link manually.');
    } finally {
      setIsImportingQr(false);
    }
  };

  useEffect(() => {
    const qrCanvas = qrCanvasRef.current;
    if (!qrCanvas || !isReady) return;

    QRCode.toCanvas(qrCanvas, finalContent, {
      width: 1000,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: {
        dark: fg,
        light: '#ffffff',
      },
    }).catch(() => {
      setStatus('Unable to generate QR preview right now.');
    });
  }, [finalContent, fg, isReady]);

  const renderPreview = useMemo(
    () => async () => {
      const canvas = previewRef.current;
      const qrCanvas = qrCanvasRef.current;

      if (!canvas || !qrCanvas || !isReady) return;

      const W = size.w;
      const H = size.h;

      canvas.width = W;
      canvas.height = H;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      const outerPadX = Math.round(W * 0.07);
      const cardX = outerPadX;
      const cardY = Math.round(H * 0.06);
      const cardW = W - outerPadX * 2;
      const cardH = H - cardY * 2;
      const cardR = Math.round(W * 0.05);

      ctx.save();
      ctx.shadowColor = 'rgba(15, 31, 23, 0.10)';
      ctx.shadowBlur = 40;
      ctx.shadowOffsetY = 12;
      roundedRect(ctx, cardX, cardY, cardW, cardH, cardR);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();

      const bannerH = Math.round(cardH * 0.18);

      ctx.save();
      roundedRectTop(ctx, cardX, cardY, cardW, bannerH, cardR);
      ctx.clip();

      const gradient = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + bannerH);
      gradient.addColorStop(0, banner);
      gradient.addColorStop(1, shade(banner, -15));

      ctx.fillStyle = gradient;
      ctx.fillRect(cardX, cardY, cardW, bannerH);
      ctx.restore();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const centerX = cardX + cardW / 2;

      const titleSize = Math.round(W * 0.045);
      ctx.font = `600 ${titleSize}px Inter, system-ui, sans-serif`;

      const titleY = cardY + bannerH / 2 - (subtitle ? titleSize * 0.55 : 0);
      ctx.fillText(truncate(title, 40), centerX, titleY);

      if (subtitle) {
        const subtitleSize = Math.round(W * 0.026);
        ctx.font = `400 ${subtitleSize}px Inter, system-ui, sans-serif`;
        ctx.globalAlpha = 0.9;
        ctx.fillText(truncate(subtitle, 60), centerX, titleY + titleSize * 0.95);
        ctx.globalAlpha = 1;
      }

      const bodyTop = cardY + bannerH;
      const bodyHeight = cardH - bannerH;

      const qrMaxByWidth = cardW - outerPadX * 1.5;
      const qrMaxByHeight = bodyHeight - Math.round(H * 0.08);
      const qrSize = Math.min(qrMaxByWidth, qrMaxByHeight);

      const qrX = cardX + (cardW - qrSize) / 2;
      const qrY = bodyTop + (bodyHeight - qrSize) / 2 - Math.round(H * 0.01);

      const qrPadding = Math.round(qrSize * 0.04);

      roundedRect(
        ctx,
        qrX - qrPadding,
        qrY - qrPadding,
        qrSize + qrPadding * 2,
        qrSize + qrPadding * 2,
        Math.round(qrSize * 0.06),
      );
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

      const logoSize = Math.round(qrSize * 0.18);
      const logoX = qrX + (qrSize - logoSize) / 2;
      const logoY = qrY + (qrSize - logoSize) / 2;

      if (centerType !== 'none') {
        const logoPadding = Math.round(logoSize * 0.18);

        roundedRect(
          ctx,
          logoX - logoPadding,
          logoY - logoPadding,
          logoSize + logoPadding * 2,
          logoSize + logoPadding * 2,
          Math.round(logoSize * 0.25),
        );
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        if (centerType === 'emoji') {
          ctx.font = `${Math.round(logoSize * 0.85)}px "Apple Color Emoji","Segoe UI Emoji",Inter,sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(centerEmoji, logoX + logoSize / 2, logoY + logoSize / 2 + logoSize * 0.05);
        } else if (centerType === 'image' && centerImage) {
          const image = await loadImage(centerImage);
          const ratio = Math.min(logoSize / image.width, logoSize / image.height);
          const imageWidth = image.width * ratio;
          const imageHeight = image.height * ratio;

          ctx.save();
          roundedRect(ctx, logoX, logoY, logoSize, logoSize, Math.round(logoSize * 0.18));
          ctx.clip();
          ctx.drawImage(
            image,
            logoX + (logoSize - imageWidth) / 2,
            logoY + (logoSize - imageHeight) / 2,
            imageWidth,
            imageHeight,
          );
          ctx.restore();
        }
      }

      const footerSize = Math.round(W * 0.02);
      ctx.fillStyle = 'rgba(15, 31, 23, 0.45)';
      ctx.font = `500 ${footerSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Powered by Zapora', centerX, cardY + cardH - Math.round(H * 0.025));
    },
    [banner, centerEmoji, centerImage, centerType, isReady, size, subtitle, title],
  );

  useEffect(() => {
    renderPreview();
  }, [renderPreview, finalContent, fg]);

  const handleDownload = async () => {
    if (!isReady) return;

    await renderPreview();
    const canvas = previewRef.current;
    if (!canvas) return;

    const mimeType = format === 'PNG' ? 'image/png' : 'image/jpeg';
    const url = canvas.toDataURL(mimeType, 0.95);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `zapora-qr-${size.name.toLowerCase().replace(/\s+/g, '-')}.${format.toLowerCase()}`;
    anchor.click();
  };

  return (
    <main className="min-h-screen bg-white py-8 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <section className="mb-6 rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.18)] sm:mb-8 sm:px-7 sm:py-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="mb-2 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Zapora Studio
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                QR Code Editor
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Design and export a clean, premium, scannable QR in one place.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
              <Palette className="h-3.5 w-3.5 text-violet-600" />
              Premium editor
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <div className="space-y-5">
            <Section title="Content">
              <label className="block rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100">
                <span className="text-sm font-semibold text-slate-900">Upload existing QR</span>
                <span className="mt-1 block text-xs text-slate-600">
                  Upload a QR image to rebuild it as an editable Zapora QR.
                </span>
                <span className="mt-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
                  <ImageIcon className="h-3.5 w-3.5" /> {isImportingQr ? 'Importing…' : 'Choose QR image'}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void handleImportQr(file);
                    }
                    event.currentTarget.value = '';
                  }}
                  className="hidden"
                />
              </label>
              {importStatus ? (
                <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">{importStatus}</p>
              ) : null}

              <Field label="Link or text">
                <input
                  value={rawContent}
                  onChange={(event) => setRawContent(event.target.value)}
                  placeholder="https://wa.me/91XXXXXXXXXX"
                  className="zapora-input"
                />
              </Field>

              <Field label="WhatsApp message">
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={3}
                  placeholder="Optional pre-filled WhatsApp message"
                  className="zapora-input min-h-[96px] resize-none"
                />
              </Field>

              <Field label="Title">
                <input
                  value={title}
                  maxLength={40}
                  onChange={(event) => setTitle(event.target.value)}
                  className="zapora-input"
                />
              </Field>

              <Field label="Subtitle">
                <input
                  value={subtitle}
                  maxLength={60}
                  onChange={(event) => setSubtitle(event.target.value)}
                  className="zapora-input"
                />
              </Field>
            </Section>

            <Section title="Color">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PRESETS.map((presetOption) => (
                  <button
                    key={presetOption.name}
                    onClick={() => applyPreset(presetOption)}
                    className={`rounded-xl border p-2.5 text-left transition ${
                      preset.name === presetOption.name
                        ? 'border-slate-900 bg-slate-50 shadow-sm'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex h-8 overflow-hidden rounded-md ring-1 ring-slate-200">
                      <div className="flex-1" style={{ background: presetOption.banner }} />
                      <div className="flex-1" style={{ background: presetOption.fg }} />
                    </div>
                    <p className="mt-1.5 text-xs font-medium text-slate-800">{presetOption.name}</p>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
                <ColorField label="QR color" value={fg} onChange={setFg} />
                <ColorField label="Banner" value={banner} onChange={setBanner} />
              </div>
            </Section>

            <Section title="Center content">
              <div className="grid grid-cols-3 gap-2">
                {(['none', 'emoji', 'image'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setCenterType(type)}
                    className={`rounded-xl border px-3 py-2 text-xs font-medium capitalize transition ${
                      centerType === type
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {type === 'none' ? (
                      'None'
                    ) : type === 'emoji' ? (
                      <span className="inline-flex items-center gap-1">
                        <Smile className="h-3.5 w-3.5" /> Emoji
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <ImageIcon className="h-3.5 w-3.5" /> Image
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {centerType === 'emoji' ? (
                <div className="mt-3 grid grid-cols-6 gap-1.5">
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setCenterEmoji(emoji)}
                      className={`flex aspect-square items-center justify-center rounded-lg text-xl transition ${
                        centerEmoji === emoji ? 'bg-emerald-50 ring-1 ring-emerald-500' : 'hover:bg-slate-50'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : null}

              {centerType === 'image' ? (
                <div className="mt-3 space-y-2">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600 transition hover:bg-slate-100">
                    <ImageIcon className="h-4 w-4" />
                    {centerImage ? 'Replace image' : 'Upload image (PNG, JPG, WEBP)'}
                    <input type="file" accept="image/*" onChange={onUpload} className="hidden" />
                  </label>

                  {centerImage ? (
                    <button
                      onClick={() => {
                        setCenterImage(null);
                        setCenterType('none');
                      }}
                      className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove image
                    </button>
                  ) : null}
                </div>
              ) : null}
            </Section>
          </div>

          <div className="xl:sticky xl:top-24 xl:self-start">
            <div className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#fafafa_0%,#f8fafc_100%)] p-5 shadow-[0_20px_70px_-45px_rgba(15,23,42,0.28)] sm:p-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Live preview</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {size.name} · {size.ratio}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {SIZES.map((sizeOption) => (
                    <button
                      key={sizeOption.name}
                      onClick={() => setSize(sizeOption)}
                      className={`rounded-xl border px-3 py-2 text-left transition ${
                        size.name === sizeOption.name
                          ? 'border-slate-900 bg-white text-slate-950 shadow-sm'
                          : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white'
                      }`}
                    >
                      <p className="text-[11px] font-semibold leading-tight">{sizeOption.name}</p>
                      <p className="text-[10px] text-slate-500">{sizeOption.ratio}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-center rounded-[28px] border border-slate-200 bg-white/70 p-4 sm:p-6">
                {isReady ? (
                  <div
                    className="overflow-hidden rounded-[24px] bg-white shadow-[0_18px_50px_-30px_rgba(15,23,42,0.28)] ring-1 ring-slate-200"
                    style={{
                      aspectRatio: `${size.w}/${size.h}`,
                      width: size.ratio === '9:16' ? '260px' : size.ratio === '4:5' ? '320px' : '380px',
                      maxWidth: '100%',
                    }}
                  >
                    <canvas ref={previewRef} className="h-full w-full" />
                  </div>
                ) : (
                  <div className="flex min-h-[420px] w-full items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm text-slate-500">
                    Add a link or text to generate your QR preview.
                  </div>
                )}
              </div>

              <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Download</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Export your QR in a clean, presentation-ready format.
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-slate-400" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {FORMATS.map((formatOption) => (
                    <button
                      key={formatOption}
                      onClick={() => setFormat(formatOption)}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                        format === formatOption
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {formatOption}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleDownload}
                  disabled={!isReady}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#16a34a_0%,#059669_100%)] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_18px_40px_-24px_rgba(5,150,105,0.8)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-4 w-4" /> Download QR ({format})
                </button>

                <p className="mt-3 text-center text-xs text-slate-500">
                  High error correction enabled · Safe scan area protected
                </p>
              </div>

              {status ? <p className="mt-4 text-sm text-slate-500">{status}</p> : null}
            </div>
          </div>
        </section>
      </div>

      <canvas ref={qrCanvasRef} className="hidden" />

      <style>{`
        .zapora-input {
          width: 100%;
          border-radius: 0.9rem;
          border: 1px solid rgb(203 213 225);
          background: #ffffff;
          padding: 0.85rem 1rem;
          font-size: 0.875rem;
          color: rgb(15 23 42);
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .zapora-input:focus {
          border-color: rgb(16 185 129);
          box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.12);
        }
      `}</style>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_16px_40px_-36px_rgba(15,23,42,0.3)]">
      <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</h3>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-700">{label}</span>
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-7 w-9 cursor-pointer rounded-md border-0 bg-transparent p-0"
        />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="flex-1 bg-transparent text-xs text-slate-700 outline-none"
        />
      </div>
    </label>
  );
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function roundedRectTop(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function truncate(value: string, limit: number) {
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

function shade(hex: string, percent: number) {
  const cleanHex = hex.replace('#', '');
  const normalized =
    cleanHex.length === 3 ? cleanHex.split('').map((item) => item + item).join('') : cleanHex;

  const numeric = parseInt(normalized, 16);

  let red = (numeric >> 16) + Math.round((percent / 100) * 255);
  let green = ((numeric >> 8) & 0xff) + Math.round((percent / 100) * 255);
  let blue = (numeric & 0xff) + Math.round((percent / 100) * 255);

  red = Math.max(0, Math.min(255, red));
  green = Math.max(0, Math.min(255, green));
  blue = Math.max(0, Math.min(255, blue));

  return `#${((red << 16) | (green << 8) | blue).toString(16).padStart(6, '0')}`;
}

export default QrCodeEditorPage;
