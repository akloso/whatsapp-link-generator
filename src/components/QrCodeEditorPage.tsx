import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {
  ArrowUpRight,
  Briefcase,
  Download,
  Headset,
  Image as ImageIcon,
  Megaphone,
  Palette,
  PartyPopper,
  ScanBarcode,
  Smile,
  Store,
  Ticket,
  Trash2,
} from 'lucide-react';
import { QR_EDITOR_STORAGE_KEY } from './qrEditorConstants';
import { trackEvent } from '../lib/trackEvent';

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
  const [isMainPreviewVisible, setIsMainPreviewVisible] = useState(true);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');

  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const editorSectionRef = useRef<HTMLElement>(null);
  const mainPreviewCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(QR_EDITOR_STORAGE_KEY);
    if (saved) {
      const normalizedSaved = saved.trim();
      setRawContent(normalizedSaved);
      const extractedMessage = extractWhatsAppMessage(normalizedSaved);
      if (extractedMessage) {
        setMessage(extractedMessage);
      }
      return;
    }
    setRawContent('https://wa.me/919999999999');
  }, []);

  const finalContent = useMemo(() => {
    const value = rawContent.trim();
    if (!value) return '';

    if (isWhatsAppUrl(value)) {
      return syncWhatsAppMessageInUrl(value, message);
    }

    return value;
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

  const applyDecodedQrContent = (decodedValue: string) => {
    const nextValue = decodedValue.trim();
    setRawContent(nextValue);
    const extractedMessage = extractWhatsAppMessage(nextValue);
    if (extractedMessage) {
      setMessage(extractedMessage);
    }
  };

  const handleRawContentChange = (nextValue: string) => {
    setRawContent(nextValue);
    const extractedMessage = extractWhatsAppMessage(nextValue);
    if (extractedMessage) {
      setMessage(extractedMessage);
    }
  };

  const handleMessageChange = (nextMessage: string) => {
    setMessage(nextMessage);
    if (isWhatsAppUrl(rawContent)) {
      setRawContent((currentValue) => syncWhatsAppMessageInUrl(currentValue, nextMessage));
    }
  };

  const handleImportQr = async (file: File) => {
    setImportStatus('Reading QR image...');

    const acceptedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!acceptedTypes.includes(file.type)) {
      setImportStatus('Please upload a PNG, JPG, or WEBP QR image.');
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

      const BarcodeDetectorClass = (window as unknown as { BarcodeDetector?: BarcodeDetectorLike }).BarcodeDetector;
      if (BarcodeDetectorClass) {
        try {
          const detector = new BarcodeDetectorClass({ formats: ['qr_code'] });
          const detections = await detector.detect(canvas);
          const decodedValue = detections[0]?.rawValue;

          if (decodedValue) {
            applyDecodedQrContent(decodedValue);
            setImportStatus('QR imported successfully. You can now customize and export it.');
            return;
          }
        } catch (barcodeError) {
          if (import.meta.env.DEV) {
            console.warn('BarcodeDetector QR import failed, trying jsQR fallback:', barcodeError);
          }
        }
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const decoded = jsQR(imageData.data, imageData.width, imageData.height);

      if (decoded?.data) {
        applyDecodedQrContent(decoded.data);
        setImportStatus('QR imported successfully. You can now customize and export it.');
        return;
      }

      setImportStatus('We couldn’t read this QR. Please upload a clearer QR image or paste the link manually.');
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
    void renderPreview().then(() => {
      const canvas = previewRef.current;
      if (!canvas || !isReady) {
        setPreviewImageUrl('');
        return;
      }
      setPreviewImageUrl(canvas.toDataURL('image/png', 0.92));
    });
  }, [renderPreview, finalContent, fg, isReady]);

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
    trackEvent('download_qr', {
      source: 'qr_editor',
      export_format: format.toLowerCase(),
    });
  };

  const scrollToEditor = () => {
    editorSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const isFloatingPreviewVisible = !isMainPreviewVisible && Boolean(previewImageUrl);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;

    const target = mainPreviewCardRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsMainPreviewVisible(entry.isIntersecting);
      },
      { threshold: 0.2 },
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!isPreviewModalOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isPreviewModalOpen]);

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-hidden bg-white py-5 sm:py-12">
      <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 lg:px-8">
        <section className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.18)] sm:mb-8 sm:rounded-[28px] sm:px-7 sm:py-6">
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

        <section ref={editorSectionRef} className="grid gap-4 pb-28 sm:gap-6 sm:pb-24 lg:grid-cols-[420px_1fr] lg:pb-10">
          <div className="min-w-0 space-y-4 sm:space-y-5">
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
                  onChange={(event) => handleRawContentChange(event.target.value)}
                  placeholder="https://wa.me/91XXXXXXXXXX"
                  className="zapora-input"
                />
              </Field>

              <Field label="WhatsApp message">
                <textarea
                  value={message}
                  onChange={(event) => handleMessageChange(event.target.value)}
                  rows={3}
                  placeholder="Optional pre-filled WhatsApp message"
                  className="zapora-input min-h-[84px] resize-none sm:min-h-[96px]"
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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {PRESETS.map((presetOption) => (
                  <button
                    key={presetOption.name}
                    onClick={() => applyPreset(presetOption)}
                    className={`min-w-0 rounded-xl border p-2.5 text-left transition ${
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
              <div className="grid w-full grid-cols-3 gap-1.5 sm:w-auto sm:gap-2">
                {(['none', 'emoji', 'image'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setCenterType(type)}
                    className={`min-w-0 rounded-xl border px-2.5 py-2 text-[11px] font-medium capitalize transition sm:px-3 sm:text-xs ${
                      centerType === type
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {type === 'none' ? (
                      'None'
                    ) : type === 'emoji' ? (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <Smile className="h-3.5 w-3.5" /> Emoji
                      </span>
                    ) : (
                      <span className="inline-flex min-w-0 items-center gap-1">
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

          <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#fafafa_0%,#f8fafc_100%)] p-4 shadow-[0_20px_70px_-45px_rgba(15,23,42,0.28)] sm:rounded-[30px] sm:p-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Live preview</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {size.name} · {size.ratio}
                  </p>
                </div>

                <div className="grid w-full grid-cols-3 gap-1.5 sm:w-auto sm:gap-2">
                  {SIZES.map((sizeOption) => (
                    <button
                      key={sizeOption.name}
                      onClick={() => setSize(sizeOption)}
                      className={`min-w-0 rounded-xl border px-2 py-2 text-left transition sm:px-3 ${
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

              <div ref={mainPreviewCardRef} className="max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white/70 p-3 sm:rounded-[28px] sm:p-6">
                <div className="flex w-full justify-center">
                {isReady ? (
                  <div
                    className="w-full max-w-full overflow-hidden rounded-[20px] bg-white shadow-[0_18px_50px_-30px_rgba(15,23,42,0.28)] ring-1 ring-slate-200 sm:rounded-[24px]"
                    style={{
                      aspectRatio: `${size.w}/${size.h}`,
                      width: size.ratio === '9:16' ? 'min(100%, 220px)' : size.ratio === '4:5' ? 'min(100%, 280px)' : 'min(100%, 300px)',
                      maxWidth: '100%',
                    }}
                  >
                    <canvas ref={previewRef} className="h-full w-full" />
                  </div>
                ) : (
                  <div className="flex min-h-[300px] w-full items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-500 sm:min-h-[420px] sm:rounded-[24px] sm:px-6">
                    Add a link or text to generate your QR preview.
                  </div>
                )}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:mt-5 sm:rounded-[24px] sm:p-5">
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
                      className={`min-w-0 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
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
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#16a34a_0%,#059669_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_-24px_rgba(5,150,105,0.8)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50 sm:mt-4 sm:py-3.5"
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

        <section className="mt-7 space-y-4 sm:mt-9 sm:space-y-6">
          <div className="grid gap-4 rounded-2xl border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fdf9_100%)] p-4 shadow-[0_22px_55px_-45px_rgba(5,150,105,0.45)] sm:rounded-[26px] sm:p-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="min-w-0">
              <p className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                QR Code Editor
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-[1.9rem]">
                Design QR codes worth scanning.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
                A premium QR design studio built into Zapora. Add a title, subtitle, brand colors, and a center
                logo — all while keeping the QR safely scannable.
              </p>

              <div className="mt-4 grid gap-2 text-sm text-slate-700">
                <FeatureBullet text="Color presets and custom picker" />
                <FeatureBullet text="Title & subtitle on a soft top banner" />
                <FeatureBullet text="Center emoji, icon, or uploaded logo" />
                <FeatureBullet text="Export sizes: Square, Story, Poster" />
                <FeatureBullet text="Always optimized for safe scanning" />
              </div>

              <button
                onClick={scrollToEditor}
                className="mt-5 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_30px_-20px_rgba(5,150,105,0.8)] transition hover:bg-emerald-700"
              >
                Customize QR Code
              </button>
            </div>

            <div className="hidden min-h-[220px] items-center justify-center lg:flex">
              <PromoMockup />
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
              Built for every kind of conversation
            </h3>
            <p className="mt-1.5 text-sm text-slate-600 sm:text-[15px]">
              From storefronts to social bios — Zapora fits anywhere a chat starts.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:mt-5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
              <UseCaseCard icon={Store} title="Small businesses" />
              <UseCaseCard icon={ImageIcon} title="Instagram sellers" />
              <UseCaseCard icon={Briefcase} title="Service providers" />
              <UseCaseCard icon={PartyPopper} title="Events" />
              <UseCaseCard icon={Ticket} title="Flyers & posters" />
              <UseCaseCard icon={Headset} title="Customer support" />
              <UseCaseCard icon={Megaphone} title="Marketing campaigns" />
            </div>
          </div>
        </section>
      </div>

      {isFloatingPreviewVisible ? (
        <button
          type="button"
          onClick={() => setIsPreviewModalOpen(true)}
          className="fixed inset-x-4 bottom-4 z-40 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 p-2.5 text-left shadow-[0_14px_36px_-22px_rgba(15,23,42,0.45)] backdrop-blur sm:inset-x-auto sm:right-4 sm:w-[250px] lg:hidden"
        >
          <img src={previewImageUrl} alt="Live QR preview thumbnail" className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 bg-white object-cover" />
          <span className="min-w-0">
            <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Live preview</span>
            <span className="block truncate text-sm font-medium text-slate-800">View larger</span>
          </span>
        </button>
      ) : null}

      {isPreviewModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 lg:hidden">
          <button type="button" aria-label="Close preview" onClick={() => setIsPreviewModalOpen(false)} className="absolute inset-0" />
          <div className="relative z-10 w-full rounded-t-3xl bg-white p-4 pb-6 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Live preview</p>
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600"
              >
                Close
              </button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2">
              <img src={previewImageUrl} alt="Expanded live QR preview" className="mx-auto h-auto w-full max-w-[420px] rounded-xl bg-white" />
            </div>
          </div>
        </div>
      ) : null}

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

function FeatureBullet({ text }: { text: string }) {
  return (
    <p className="inline-flex items-start gap-2">
      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
      <span>{text}</span>
    </p>
  );
}

function PromoMockup() {
  return (
    <div className="relative w-full max-w-[290px] rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_22px_45px_-38px_rgba(15,23,42,0.55)]">
      <div className="mb-3 rounded-xl bg-emerald-500 px-3 py-2 text-center text-xs font-semibold text-white">
        Scan to chat
      </div>
      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="aspect-square rounded-xl bg-slate-100 p-3">
          <div className="grid h-full grid-cols-7 gap-1.5">
            {Array.from({ length: 49 }).map((_, idx) => (
              <span
                key={idx}
                className={`rounded-[3px] ${idx % 3 === 0 || idx % 5 === 0 ? 'bg-slate-900' : 'bg-white ring-1 ring-slate-200'}`}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="absolute -right-2 -top-2 rounded-full border border-emerald-200 bg-emerald-50 p-2">
        <ScanBarcode className="h-4 w-4 text-emerald-700" />
      </div>
    </div>
  );
}

function UseCaseCard({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-[0_14px_25px_-22px_rgba(15,23,42,0.35)] sm:rounded-2xl sm:px-3.5">
      <div className="rounded-full bg-emerald-50 p-2 ring-1 ring-emerald-100">
        <Icon className="h-4 w-4 text-emerald-700" />
      </div>
      <p className="text-sm font-medium text-slate-800">{title}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_40px_-36px_rgba(15,23,42,0.3)] sm:rounded-[24px] sm:p-5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</h3>
      <div className="mt-3 space-y-3 sm:mt-4">{children}</div>
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

function isWhatsAppUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.hostname.includes('wa.me') || url.hostname.includes('whatsapp');
  } catch {
    return false;
  }
}

function extractWhatsAppMessage(value: string) {
  try {
    const url = new URL(value.trim());
    if (!isWhatsAppUrl(value)) return '';
    return url.searchParams.get('text') || '';
  } catch {
    return '';
  }
}

function syncWhatsAppMessageInUrl(value: string, nextMessage: string) {
  try {
    const url = new URL(value.trim());
    if (!isWhatsAppUrl(value)) return value;
    if (nextMessage.trim()) {
      url.searchParams.set('text', nextMessage.trim());
    } else {
      url.searchParams.delete('text');
    }
    return url.toString();
  } catch {
    return value;
  }
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
