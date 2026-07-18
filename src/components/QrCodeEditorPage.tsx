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
  ShieldCheck,
  Smile,
  Sparkles,
  Store,
  Ticket,
  Trash2,
  Upload,
} from 'lucide-react';
import { QR_EDITOR_STORAGE_KEY } from './qrEditorConstants';
import { trackEvent } from '../lib/trackEvent';
import { Button, Surface, TextInput, Textarea } from './ui';

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

type FormatOption = 'PNG' | 'JPG' | 'SVG';
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

const FORMATS: FormatOption[] = ['PNG', 'JPG', 'SVG'];

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
  const [importFileName, setImportFileName] = useState('');
  const [centerImageFileName, setCenterImageFileName] = useState('');
  const [exportStatus, setExportStatus] = useState('');

  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const editorSectionRef = useRef<HTMLElement>(null);

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

    setCenterImageFileName(file.name);
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
    setImportFileName(file.name);
    setImportStatus('Reading QR image...');

    const acceptedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!acceptedTypes.includes(file.type)) {
      setImportFileName(file.name);
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
          const centerX = logoX + logoSize / 2;
          const centerY = logoY + logoSize / 2;
          const emojiSize = Math.round(logoSize * 0.82);
          ctx.font = `${emojiSize}px "Apple Color Emoji","Segoe UI Emoji",Inter,sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(centerEmoji, centerX, centerY + emojiSize * 0.04);
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
    setExportStatus('Preparing export...');

    await renderPreview();
    const canvas = previewRef.current;
    if (!canvas) return;

    let url = '';
    if (format === 'SVG') {
      const svgMarkup = await buildSvgExport({
        size,
        finalContent,
        fg,
        banner,
        title,
        subtitle,
        centerType,
        centerEmoji,
        centerImage,
      });
      const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
      url = URL.createObjectURL(blob);
    } else {
      const mimeType = format === 'PNG' ? 'image/png' : 'image/jpeg';
      url = canvas.toDataURL(mimeType, 0.95);
    }

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `zapora-qr-${size.name.toLowerCase().replace(/\s+/g, '-')}.${format.toLowerCase()}`;
    anchor.click();
    if (format === 'SVG') {
      URL.revokeObjectURL(url);
    }
    trackEvent('download_qr', {
      source: 'qr_editor',
      export_format: format.toLowerCase(),
    });
    setExportStatus(`${format} export ready. Your download has started.`);
    window.setTimeout(() => setExportStatus(''), 2200);
  };

  const scrollToEditor = () => {
    editorSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-hidden bg-[radial-gradient(circle_at_82%_7%,rgba(34,211,238,0.11),transparent_22rem),radial-gradient(circle_at_12%_16%,rgba(16,185,129,0.10),transparent_24rem),#ffffff] py-6 sm:py-8 lg:py-10">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <section className="relative mb-5 overflow-hidden rounded-[26px] border border-emerald-100 bg-white/90 px-4 py-5 shadow-[0_20px_60px_-42px_rgba(5,150,105,0.44)] sm:mb-6 sm:px-6 sm:py-6">
          <div aria-hidden="true" className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-violet-100/70 blur-3xl" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800">
                <Sparkles className="h-3.5 w-3.5" /> Zapora design studio
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-950 sm:text-3xl">
                QR Code Editor
              </h1>
              <p className="mt-1.5 text-sm leading-6 text-gray-600">
                Add content, shape the design, then export a QR built to scan reliably.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold text-gray-700 sm:justify-end">
              {[
                ['Import QR', Upload, 'text-cyan-700 bg-cyan-50 border-cyan-100'],
                ['Brand colors', Palette, 'text-violet-700 bg-violet-50 border-violet-100'],
                ['Logo or emoji', Smile, 'text-emerald-700 bg-emerald-50 border-emerald-100'],
                ['PNG/JPG/SVG', Download, 'text-gray-700 bg-gray-50 border-gray-200'],
                ['Safe scan area', ShieldCheck, 'text-amber-800 bg-amber-50 border-amber-100'],
              ].map(([label, Icon, colorClass]) => {
                const CapabilityIcon = Icon as React.ComponentType<{ className?: string }>;
                return <span key={label as string} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 ${colorClass as string}`}><CapabilityIcon className="h-3.5 w-3.5" />{label as string}</span>;
              })}
            </div>
          </div>
        </section>

        <section ref={editorSectionRef} className="qr-editor-workspace grid gap-5 lg:gap-0">
          <div className="qr-editor-controls min-w-0 space-y-4">
            <Section title="Content" icon={ScanBarcode} description="Start from a link, plain text, or an existing QR image.">
              <label className="group block cursor-pointer rounded-2xl border border-dashed border-cyan-200 bg-cyan-50/50 px-4 py-3.5 text-left transition hover:border-cyan-300 hover:bg-cyan-50 focus-within:ring-4 focus-within:ring-cyan-500/15">
                <span className="flex items-start gap-3">
                  <span className="rounded-xl bg-white p-2 text-cyan-700 shadow-sm ring-1 ring-cyan-100"><Upload className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="text-sm font-semibold text-gray-900">Import an existing QR</span>
                  <span className="mt-0.5 block text-xs leading-5 text-gray-600">Read its content, then rebuild it with your style. PNG, JPG, or WEBP.</span></span>
                </span>
                <span className="mt-3 inline-flex items-center gap-2 rounded-xl border border-cyan-200 bg-white px-3 py-2 text-xs font-semibold text-cyan-800 transition group-hover:border-cyan-300">
                  <ImageIcon className="h-3.5 w-3.5" /> {isImportingQr ? 'Importing...' : 'Choose QR image'}
                </span>
                {importFileName ? <span className="mt-2 block truncate text-xs font-medium text-gray-700">Selected: {importFileName}</span> : null}
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
                  className="sr-only"
                />
              </label>
              {importStatus ? (
                <p role="status" aria-live="polite" className={`mt-2 rounded-xl px-3 py-2 text-xs font-medium ${importStatus.includes('successfully') ? 'bg-emerald-50 text-emerald-800' : importStatus.includes('couldn') || importStatus.includes('Please') ? 'bg-rose-50 text-rose-800' : 'bg-cyan-50 text-cyan-800'}`}>{importStatus}</p>
              ) : null}

              <Field label="Link or text" hint="Paste a WhatsApp link, website URL, or any text.">
                <TextInput
                  value={rawContent}
                  onChange={(event) => handleRawContentChange(event.target.value)}
                  placeholder="https://wa.me/91XXXXXXXXXX"
                  className=""
                />
              </Field>

              <Field label="WhatsApp message" optional hint={isWhatsAppUrl(rawContent) ? 'This stays synced with your WhatsApp link.' : 'Added when your content is a WhatsApp link.'}>
                <Textarea
                  value={message}
                  onChange={(event) => handleMessageChange(event.target.value)}
                  rows={3}
                  placeholder="Optional pre-filled WhatsApp message"
                  className="min-h-[88px]"
                />
              </Field>

              <Field label="Title" counter={`${title.length}/40`}>
                <TextInput
                  value={title}
                  maxLength={40}
                  onChange={(event) => setTitle(event.target.value)}
                  className=""
                />
              </Field>

              <Field label="Subtitle" counter={`${subtitle.length}/60`}>
                <TextInput
                  value={subtitle}
                  maxLength={60}
                  onChange={(event) => setSubtitle(event.target.value)}
                  className=""
                />
              </Field>
            </Section>

            <Section title="Brand style" icon={Palette} description="Choose a restrained color pair that keeps every code easy to scan.">
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2 lg:gap-2.5">
                {PRESETS.map((presetOption) => (
                  <button
                    key={presetOption.name}
                    onClick={() => applyPreset(presetOption)}
                    aria-pressed={preset.name === presetOption.name}
                    className={`min-w-0 rounded-lg border p-1.5 text-left transition sm:p-2 ${
                      preset.name === presetOption.name
                        ? 'border-emerald-600 bg-emerald-50 font-semibold shadow-sm ring-2 ring-emerald-500/20'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex h-5 overflow-hidden rounded-md ring-1 ring-gray-200 sm:h-6">
                      <div className="flex-1" style={{ background: presetOption.banner }} />
                      <div className="flex-1" style={{ background: presetOption.fg }} />
                    </div>
                    <p className="mt-1 truncate text-[10px] font-medium text-gray-800 sm:text-xs">{presetOption.name}</p>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1.5 sm:gap-3">
                <ColorField label="QR color" value={fg} onChange={setFg} />
                <ColorField label="Banner" value={banner} onChange={setBanner} />
              </div>
            </Section>

            <Section title="Center mark" icon={Sparkles} description="Keep your mark small so the QR retains a protected scan area.">
              <div className="grid w-full grid-cols-3 gap-1.5 sm:w-auto sm:gap-2">
                {(['none', 'emoji', 'image'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setCenterType(type)}
                    aria-pressed={centerType === type}
                    className={`min-w-0 rounded-xl border px-2.5 py-2 text-[11px] font-medium capitalize transition sm:px-3 sm:text-xs ${
                      centerType === type
                        ? 'border-emerald-700 bg-emerald-700 text-white shadow-sm'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
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
                      aria-pressed={centerEmoji === emoji}
                    className={`flex aspect-square min-h-10 items-center justify-center rounded-lg text-xl leading-none transition ${
                        centerEmoji === emoji ? 'bg-emerald-50 ring-2 ring-emerald-500' : 'hover:bg-gray-50'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : null}

              {centerType === 'image' ? (
                <div className="mt-3 space-y-2">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-violet-200 bg-violet-50/40 px-4 py-4 text-sm font-medium text-violet-800 transition hover:border-violet-300 hover:bg-violet-50 focus-within:ring-4 focus-within:ring-violet-500/15">
                    <ImageIcon className="h-4 w-4" />
                    {centerImage ? 'Replace image' : 'Upload image (PNG, JPG, WEBP)'}
                    <input type="file" accept="image/*" onChange={onUpload} className="sr-only" />
                  </label>
                  {centerImageFileName ? <p className="truncate text-xs font-medium text-gray-700">Selected: {centerImageFileName}</p> : null}

                  {centerImage ? (
                    <button
                      onClick={() => {
                        setCenterImage(null);
                        setCenterImageFileName('');
                        setCenterType('none');
                      }}
                      className="inline-flex items-center gap-1.5 text-xs text-gray-500 transition hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove image
                    </button>
                  ) : null}
                </div>
              ) : null}
            </Section>
          </div>

          <div className="qr-editor-preview-panel min-w-0">
            <div className="qr-editor-preview-card rounded-[26px] border border-emerald-100 bg-[linear-gradient(155deg,#ffffff_0%,#f8fffb_54%,#f5f3ff_100%)] p-4 shadow-[0_24px_70px_-45px_rgba(5,150,105,0.34)] sm:rounded-[30px] sm:p-6">
              <div className="qr-preview-toolbar mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Live preview</p>
                  <p className="mt-1 text-sm font-medium text-gray-700">
                    {size.name} · {size.ratio}
                  </p>
                </div>

                <div className="grid w-full grid-cols-3 gap-1.5 sm:w-auto sm:gap-2">
                  {SIZES.map((sizeOption) => (
                    <button
                      key={sizeOption.name}
                      onClick={() => setSize(sizeOption)}
                      aria-pressed={size.name === sizeOption.name}
                      className={`min-w-0 rounded-xl border px-2 py-2 text-left transition sm:px-3 ${
                        size.name === sizeOption.name
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm ring-2 ring-emerald-500/15'
                          : 'border-gray-200 bg-white/80 text-gray-600 hover:border-gray-300 hover:bg-white'
                      }`}
                    >
                      <p className="text-[11px] font-semibold leading-tight">{sizeOption.name}</p>
                      <p className="text-[10px] text-gray-500">{sizeOption.ratio}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="qr-preview-stage max-w-full overflow-hidden rounded-2xl border border-white/80 bg-white/70 p-3 shadow-inner sm:rounded-[28px] sm:p-6">
                <div className="flex h-full w-full items-center justify-center">
                {isReady ? (
                  <div
                    key={size.name}
                    className={`qr-preview-artwork qr-preview-artwork-${size.name.toLowerCase().replace(/\s+/g, '-')} w-full max-w-full overflow-hidden rounded-[20px] bg-white shadow-[0_18px_50px_-30px_rgba(15,23,42,0.28)] ring-1 ring-gray-200 sm:rounded-[24px]`}
                    style={{
                      aspectRatio: `${size.w}/${size.h}`,
                      maxWidth: '100%',
                    }}
                  >
                    <canvas ref={previewRef} className="h-full w-full zapora-qr-preview-enter" aria-label={`Live QR preview in ${size.name} format`} role="img" />
                  </div>
                ) : (
                  <div className="flex min-h-[300px] w-full items-center justify-center rounded-[20px] border border-dashed border-gray-300 bg-gray-50 px-4 text-center text-sm text-gray-500 sm:min-h-[420px] sm:rounded-[24px] sm:px-6">
                    Add a link or text to generate your QR preview.
                  </div>
                )}
                </div>
              </div>

              <div className="qr-export-panel mt-4 rounded-2xl border border-emerald-100 bg-white p-3.5 shadow-[0_18px_42px_-30px_rgba(5,150,105,0.35)] sm:mt-5 sm:rounded-[24px] sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">Export setup</p>
                    <p className="mt-1 text-sm text-gray-600">
                      Choose a format, then download the exact preview.
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-gray-400" />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {FORMATS.map((formatOption) => (
                    <button
                      key={formatOption}
                      onClick={() => setFormat(formatOption)}
                      aria-pressed={format === formatOption}
                      className={`min-w-0 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                        format === formatOption
                          ? 'border-emerald-700 bg-emerald-700 text-white shadow-sm'
                          : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {formatOption}
                    </button>
                  ))}
                </div>

                <Button
                  onClick={handleDownload}
                  disabled={!isReady}
                  variant="primary"
                  className="mt-3 w-full sm:mt-4"
                  icon={<Download className="h-4 w-4" />}
                >
                  Download QR ({format})
                </Button>

                <p className="mt-3 text-center text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-amber-600" /> High error correction · Safe scan area protected</span>
                </p>
                {exportStatus ? <p role="status" aria-live="polite" className="mt-2 text-center text-xs font-medium text-green-700">{exportStatus}</p> : null}
              </div>

              {status ? <p className="mt-4 text-sm text-gray-500">{status}</p> : null}
            </div>
          </div>
        </section>

        <section className="mt-7 space-y-4 sm:mt-9 sm:space-y-6">
          <div className="grid gap-4 rounded-2xl border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fdf9_100%)] p-4 shadow-[0_22px_55px_-45px_rgba(5,150,105,0.45)] sm:rounded-[26px] sm:p-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="min-w-0">
              <p className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                QR Code Editor
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-gray-950 sm:text-[1.9rem]">
                Design QR codes worth scanning.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600 sm:text-[15px]">
                A premium QR design studio built into Zapora. Add a title, subtitle, brand colors, and a center
                logo - all while keeping the QR safely scannable.
              </p>

              <div className="mt-4 grid gap-2 text-sm text-gray-700">
                <FeatureBullet text="Color presets and custom picker" />
                <FeatureBullet text="Title & subtitle on a soft top banner" />
                <FeatureBullet text="Center emoji, icon, or uploaded logo" />
                <FeatureBullet text="Export sizes: Square, Story, Poster" />
                <FeatureBullet text="Always optimized for safe scanning" />
              </div>

              <Button onClick={scrollToEditor} variant="primary" className="mt-5">
                Customize QR Code
              </Button>
            </div>

            <div className="hidden min-h-[220px] items-center justify-center lg:flex">
              <PromoMockup />
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold tracking-tight text-gray-950 sm:text-2xl">
              Built for every kind of conversation
            </h3>
            <p className="mt-1.5 text-sm text-gray-600 sm:text-[15px]">
              From storefronts to social bios - Zapora fits anywhere a chat starts.
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

      <canvas ref={qrCanvasRef} className="hidden" />

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
    <div className="relative w-full max-w-[290px] rounded-[26px] border border-gray-200 bg-white p-4 shadow-[0_22px_45px_-38px_rgba(15,23,42,0.55)]">
      <div className="mb-3 rounded-xl bg-emerald-500 px-3 py-2 text-center text-xs font-semibold text-white">
        Scan to chat
      </div>
      <div className="rounded-2xl border border-gray-200 p-4">
        <div className="aspect-square rounded-xl bg-gray-100 p-3">
          <div className="grid h-full grid-cols-7 gap-1.5">
            {Array.from({ length: 49 }).map((_, idx) => (
              <span
                key={idx}
                className={`rounded-[3px] ${idx % 3 === 0 || idx % 5 === 0 ? 'bg-gray-950' : 'bg-white ring-1 ring-gray-200'}`}
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
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3 shadow-[0_14px_25px_-22px_rgba(15,23,42,0.35)] sm:rounded-2xl sm:px-3.5">
      <div className="rounded-full bg-emerald-50 p-2 ring-1 ring-emerald-100">
        <Icon className="h-4 w-4 text-emerald-700" />
      </div>
      <p className="text-sm font-medium text-gray-800">{title}</p>
    </div>
  );
}

function Section({ title, icon: Icon, description, children }: { title: string; icon?: React.ComponentType<{ className?: string }>; description?: string; children: React.ReactNode }) {
  return (
    <Surface className="min-w-0 p-4 sm:p-5">
      <div className="flex items-start gap-2.5">
        {Icon ? <span className="rounded-lg bg-emerald-50 p-1.5 text-emerald-700"><Icon className="h-3.5 w-3.5" /></span> : null}
        <div><h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-600">{title}</h3>{description ? <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p> : null}</div>
      </div>
      <div className="mt-3 space-y-3 sm:mt-4">{children}</div>
    </Surface>
  );
}

function Field({ label, hint, optional = false, counter, children }: { label: string; hint?: string; optional?: boolean; counter?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between gap-2 text-xs font-medium text-gray-700"><span>{label}{optional ? <span className="font-normal text-gray-400"> (Optional)</span> : null}</span>{counter ? <span className="font-normal text-gray-400">{counter}</span> : null}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-[11px] leading-4 text-gray-500">{hint}</span> : null}
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
      <span className="mb-1.5 block text-xs font-medium text-gray-700">{label}</span>
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-2 py-1.5">
        <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md border border-gray-300" style={{ backgroundColor: value }}>
          <input
            type="color"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none border-0 opacity-0"
            aria-label={`${label} color picker`}
          />
        </div>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent font-mono text-xs uppercase text-gray-700 outline-none"
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

async function buildSvgExport({
  size,
  finalContent,
  fg,
  banner,
  title,
  subtitle,
  centerType,
  centerEmoji,
  centerImage,
}: {
  size: SizeOption;
  finalContent: string;
  fg: string;
  banner: string;
  title: string;
  subtitle: string;
  centerType: CenterType;
  centerEmoji: string;
  centerImage: string | null;
}) {
  const W = size.w;
  const H = size.h;
  const layout = getQrLayout(W, H);
  const qrSvg = await QRCode.toString(finalContent, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'H',
    color: { dark: fg, light: '#ffffff' },
  });
  const qrInner = extractSvgInnerMarkup(qrSvg);
  const qrViewBox = getSvgViewBoxSize(qrSvg);
  const qrScale = qrViewBox.width > 0 ? layout.qrSize / qrViewBox.width : 1;
  const escapedTitle = escapeXml(truncate(title, 40));
  const escapedSubtitle = escapeXml(truncate(subtitle, 60));
  const gradientEnd = shade(banner, -15);
  const footerY = layout.cardY + layout.cardH - Math.round(H * 0.025);
  const logoPadding = Math.round(layout.logoSize * 0.18);
  const logoRadius = Math.round(layout.logoSize * 0.18);

  let centerMarkup = '';
  if (centerType !== 'none') {
    centerMarkup += `<rect x="${layout.logoX - logoPadding}" y="${layout.logoY - logoPadding}" width="${layout.logoSize + logoPadding * 2}" height="${layout.logoSize + logoPadding * 2}" rx="${Math.round(layout.logoSize * 0.25)}" fill="#ffffff" />`;
    if (centerType === 'emoji') {
      centerMarkup += `<foreignObject x="${layout.logoX}" y="${layout.logoY}" width="${layout.logoSize}" height="${layout.logoSize}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;line-height:1;font-size:${Math.round(layout.logoSize * 0.82)}px;font-family:Apple Color Emoji, Segoe UI Emoji, Inter, sans-serif;">${escapeXml(centerEmoji)}</div></foreignObject>`;
    } else if (centerType === 'image' && centerImage) {
      centerMarkup += `<defs><clipPath id="center-image-clip"><rect x="${layout.logoX}" y="${layout.logoY}" width="${layout.logoSize}" height="${layout.logoSize}" rx="${logoRadius}" /></clipPath></defs>`;
      centerMarkup += `<image href="${centerImage}" x="${layout.logoX}" y="${layout.logoY}" width="${layout.logoSize}" height="${layout.logoSize}" preserveAspectRatio="xMidYMid meet" clip-path="url(#center-image-clip)" />`;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none">
  <defs>
    <linearGradient id="banner-gradient" x1="${layout.cardX}" y1="${layout.cardY}" x2="${layout.cardX + layout.cardW}" y2="${layout.cardY + layout.bannerH}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${banner}" />
      <stop offset="100%" stop-color="${gradientEnd}" />
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#ffffff" />
  <rect x="${layout.cardX}" y="${layout.cardY}" width="${layout.cardW}" height="${layout.cardH}" rx="${layout.cardR}" fill="#ffffff" />
  <path d="${topRoundedRectPath(layout.cardX, layout.cardY, layout.cardW, layout.bannerH, layout.cardR)}" fill="url(#banner-gradient)" />
  <text x="${layout.centerX}" y="${layout.titleY - (subtitle ? layout.titleSize * 0.55 : 0)}" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-size="${layout.titleSize}" font-family="Inter, system-ui, sans-serif" font-weight="600">${escapedTitle}</text>
  ${subtitle ? `<text x="${layout.centerX}" y="${layout.titleY + layout.titleSize * 0.4}" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" fill-opacity="0.9" font-size="${layout.subtitleSize}" font-family="Inter, system-ui, sans-serif" font-weight="400">${escapedSubtitle}</text>` : ''}
  <rect x="${layout.qrX - layout.qrPadding}" y="${layout.qrY - layout.qrPadding}" width="${layout.qrSize + layout.qrPadding * 2}" height="${layout.qrSize + layout.qrPadding * 2}" rx="${Math.round(layout.qrSize * 0.06)}" fill="#ffffff" />
  <g transform="translate(${layout.qrX} ${layout.qrY}) scale(${qrScale})">${qrInner}</g>
  ${centerMarkup}
  <text x="${layout.centerX}" y="${footerY}" text-anchor="middle" fill="rgba(15,31,23,0.45)" font-size="${layout.footerSize}" font-family="Inter, system-ui, sans-serif" font-weight="500">Powered by Zapora</text>
</svg>`;
}

function getQrLayout(W: number, H: number) {
  const outerPadX = Math.round(W * 0.07);
  const cardX = outerPadX;
  const cardY = Math.round(H * 0.06);
  const cardW = W - outerPadX * 2;
  const cardH = H - cardY * 2;
  const cardR = Math.round(W * 0.05);
  const bannerH = Math.round(cardH * 0.18);
  const centerX = cardX + cardW / 2;
  const titleSize = Math.round(W * 0.045);
  const titleY = cardY + bannerH / 2;
  const subtitleSize = Math.round(W * 0.026);
  const bodyTop = cardY + bannerH;
  const bodyHeight = cardH - bannerH;
  const qrMaxByWidth = cardW - outerPadX * 1.5;
  const qrMaxByHeight = bodyHeight - Math.round(H * 0.08);
  const qrSize = Math.min(qrMaxByWidth, qrMaxByHeight);
  const qrX = cardX + (cardW - qrSize) / 2;
  const qrY = bodyTop + (bodyHeight - qrSize) / 2 - Math.round(H * 0.01);
  const qrPadding = Math.round(qrSize * 0.04);
  const logoSize = Math.round(qrSize * 0.18);
  const logoX = qrX + (qrSize - logoSize) / 2;
  const logoY = qrY + (qrSize - logoSize) / 2;
  const footerSize = Math.round(W * 0.02);
  return { outerPadX, cardX, cardY, cardW, cardH, cardR, bannerH, centerX, titleSize, titleY, subtitleSize, bodyTop, bodyHeight, qrSize, qrX, qrY, qrPadding, logoSize, logoX, logoY, footerSize };
}

function extractSvgInnerMarkup(svg: string) {
  return svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
}

function getSvgViewBoxSize(svg: string) {
  const viewBoxMatch = svg.match(/viewBox="([^"]+)"/i);
  if (!viewBoxMatch) {
    return { width: 0, height: 0 };
  }
  const parts = viewBoxMatch[1].trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    return { width: 0, height: 0 };
  }
  return { width: parts[2], height: parts[3] };
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function topRoundedRectPath(x: number, y: number, w: number, h: number, r: number) {
  return `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h} H ${x} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
}

export default QrCodeEditorPage;
