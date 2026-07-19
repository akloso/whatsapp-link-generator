import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {
  Check,
  ChevronDown,
  Download,
  Grid3X3,
  Layers,
  Palette,
  ScanBarcode,
  Smartphone,
  Sparkles,
  SunMedium,
  Upload,
  Zap,
} from 'lucide-react';
import { QR_EDITOR_STORAGE_KEY } from './qrEditorConstants';
import { trackEvent } from '../lib/trackEvent';
import { Button } from './ui';

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
  { name: 'Emerald', fg: '#111827', bg: '#ffffff', banner: '#16a34a' },
  { name: 'Ocean', fg: '#0f172a', bg: '#ffffff', banner: '#0ea5e9' },
  { name: 'Sunset', fg: '#24130f', bg: '#ffffff', banner: '#fb923c' },
  { name: 'Royal', fg: '#111827', bg: '#ffffff', banner: '#5b7cfa' },
  { name: 'Purple', fg: '#231942', bg: '#ffffff', banner: '#a855f7' },
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
  const [message, setMessage] = useState("Hi! I'm interested in your product.");
  const [title, setTitle] = useState('Chat with us');
  const [subtitle] = useState("We're here to help!");
  const [preset, setPreset] = useState<Preset>(PRESETS[1]);
  const [fg, setFg] = useState(PRESETS[1].fg);
  const [banner, setBanner] = useState(PRESETS[1].banner);
  const [centerType, setCenterType] = useState<CenterType>('emoji');
  const [centerEmoji, setCenterEmoji] = useState('⚡');
  const [centerImage, setCenterImage] = useState<string | null>(null);
  const [size, setSize] = useState<SizeOption>(SIZES[0]);
  const [format, setFormat] = useState<FormatOption>('PNG');
  const [status, setStatus] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [isImportingQr, setIsImportingQr] = useState(false);
  const [exportStatus, setExportStatus] = useState('');

  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const editorSectionRef = useRef<HTMLElement>(null);
  const controlsPanelRef = useRef<HTMLDivElement>(null);
  const centerImageInputRef = useRef<HTMLInputElement>(null);

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
    setRawContent('https://wa.me/918448848888');
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

  const openCenterImagePicker = () => {
    centerImageInputRef.current?.click();
  };

  const onUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      event.currentTarget.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCenterImage(reader.result as string);
      setCenterType('image');
    };
    reader.readAsDataURL(file);
    event.currentTarget.value = '';
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

      const artboardGlow = ctx.createRadialGradient(W * 0.5, H * 0.32, W * 0.08, W * 0.5, H * 0.32, W * 0.62);
      artboardGlow.addColorStop(0, 'rgba(209, 250, 229, 0.78)');
      artboardGlow.addColorStop(0.48, 'rgba(224, 242, 254, 0.44)');
      artboardGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = artboardGlow;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = 'rgba(196, 181, 253, 0.16)';
      roundedRect(ctx, Math.round(W * 0.07), Math.round(H * 0.78), Math.round(W * 0.18), Math.round(W * 0.055), Math.round(W * 0.028));
      ctx.fill();
      ctx.fillStyle = 'rgba(251, 191, 36, 0.12)';
      roundedRect(ctx, Math.round(W * 0.76), Math.round(H * 0.08), Math.round(W * 0.14), Math.round(W * 0.045), Math.round(W * 0.023));
      ctx.fill();

      const outerPadX = Math.round(W * 0.05);
      const cardX = outerPadX;
      const cardY = Math.round(H * 0.035);
      const cardW = W - outerPadX * 2;
      const cardH = H - cardY * 2;
      const cardR = Math.round(W * 0.055);

      ctx.save();
      ctx.shadowColor = 'rgba(5, 150, 105, 0.16)';
      ctx.shadowBlur = 54;
      ctx.shadowOffsetY = 18;
      roundedRect(ctx, cardX, cardY, cardW, cardH, cardR);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();

      const bannerH = Math.round(cardH * 0.16);

      ctx.save();
      roundedRectTop(ctx, cardX, cardY, cardW, bannerH, cardR);
      ctx.clip();

      const gradient = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + bannerH);
      gradient.addColorStop(0, banner);
      gradient.addColorStop(0.52, shade(banner, 8));
      gradient.addColorStop(1, shade(banner, -18));

      ctx.fillStyle = gradient;
      ctx.fillRect(cardX, cardY, cardW, bannerH);
      ctx.restore();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const centerX = cardX + cardW / 2;

      const titleSize = Math.round(W * 0.047);
      ctx.font = `700 ${titleSize}px Inter, system-ui, sans-serif`;

      const titleY = cardY + bannerH / 2 - (subtitle ? titleSize * 0.55 : 0);
      ctx.fillText(truncate(title, 40), centerX, titleY);

      if (subtitle) {
        const subtitleSize = Math.round(W * 0.025);
        ctx.font = `500 ${subtitleSize}px Inter, system-ui, sans-serif`;
        ctx.globalAlpha = 0.9;
        ctx.fillText(truncate(subtitle, 60), centerX, titleY + titleSize * 0.95);
        ctx.globalAlpha = 1;
      }

      const bodyTop = cardY + bannerH;
      const bodyHeight = cardH - bannerH;

      const qrMaxByWidth = cardW - outerPadX * 0.45;
      const footerBarH = Math.round(cardH * 0.105);
      const qrMaxByHeight = bodyHeight - footerBarH - Math.round(H * 0.045);
      const qrSize = Math.min(qrMaxByWidth, qrMaxByHeight);

      const qrX = cardX + (cardW - qrSize) / 2;
      const qrY = bodyTop + (bodyHeight - footerBarH - qrSize) / 2 + Math.round(H * 0.012);

      const qrPadding = Math.round(qrSize * 0.035);

      ctx.save();
      ctx.shadowColor = 'rgba(15, 23, 42, 0.09)';
      ctx.shadowBlur = 28;
      ctx.shadowOffsetY = 10;
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
      ctx.restore();

      ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

      const logoSize = Math.round(qrSize * 0.17);
      const logoX = qrX + (qrSize - logoSize) / 2;
      const logoY = qrY + (qrSize - logoSize) / 2;

      if (centerType !== 'none') {
        const logoPadding = Math.round(logoSize * 0.2);

        roundedRect(
          ctx,
          logoX - logoPadding,
          logoY - logoPadding,
          logoSize + logoPadding * 2,
          logoSize + logoPadding * 2,
          Math.round(logoSize * 0.25),
        );
        ctx.shadowColor = 'rgba(15, 23, 42, 0.12)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 5;
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.shadowColor = 'transparent';

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

      const footerY = cardY + cardH - footerBarH;
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.08)';
      ctx.lineWidth = Math.max(1, W * 0.001);
      ctx.beginPath();
      ctx.moveTo(cardX, footerY);
      ctx.lineTo(cardX + cardW, footerY);
      ctx.stroke();

      const buttonW = Math.round(cardW * 0.34);
      const buttonH = Math.round(footerBarH * 0.54);
      const buttonX = cardX + Math.round(cardW * 0.06);
      const buttonY = footerY + (footerBarH - buttonH) / 2;
      roundedRect(ctx, buttonX, buttonY, buttonW, buttonH, Math.round(buttonH * 0.45));
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.11)';
      ctx.stroke();
      ctx.fillStyle = '#16a34a';
      ctx.font = `700 ${Math.round(W * 0.025)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('☘', buttonX + Math.round(buttonH * 0.55), buttonY + buttonH / 2);
      ctx.fillStyle = '#111827';
      ctx.font = `700 ${Math.round(W * 0.019)}px Inter, system-ui, sans-serif`;
      ctx.fillText(truncate(title, 22), buttonX + buttonW * 0.56, buttonY + buttonH / 2);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.5)';
      ctx.font = `500 ${Math.round(W * 0.016)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText('Powered by', cardX + cardW - Math.round(cardW * 0.15), footerY + footerBarH / 2);
      ctx.fillStyle = '#111827';
      ctx.font = `800 ${Math.round(W * 0.024)}px Inter, system-ui, sans-serif`;
      ctx.fillText('⚡ Zapora', cardX + cardW - Math.round(cardW * 0.04), footerY + footerBarH / 2);
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


  return (
    <main className="qr-editor-page min-h-screen w-full max-w-full overflow-x-hidden bg-[#f7f3ff]">
      <header className="qr-studio-topbar sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 px-4 py-3 shadow-[0_16px_48px_-42px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-[1920px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-5">
            <div className="inline-flex items-center gap-3 pr-5 lg:border-r lg:border-slate-200">
              <span className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-[0_14px_30px_-18px_rgba(5,150,105,0.9)]"><Zap className="h-5 w-5 fill-current" /></span>
              <span className="text-xl font-black tracking-tight text-slate-950">Zapora</span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-lg font-black tracking-tight text-slate-950 sm:text-xl">QR Code Editor</h1>
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Live export canvas</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/50 focus-within:ring-4 focus-within:ring-emerald-500/15">
              <Upload className="h-4 w-4" /> {isImportingQr ? 'Importing...' : 'Import QR'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleImportQr(file);
                  event.currentTarget.value = '';
                }}
                className="sr-only"
              />
            </label>
            <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {FORMATS.map((formatOption) => (
                <button
                  key={formatOption}
                  onClick={() => setFormat(formatOption)}
                  aria-pressed={format === formatOption}
                  className={`min-h-11 min-w-[72px] border-r border-slate-200 px-4 text-sm font-black last:border-r-0 ${format === formatOption ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-400' : 'text-slate-800 hover:bg-slate-50'}`}
                >
                  {formatOption}
                </button>
              ))}
            </div>
            <Button onClick={handleDownload} disabled={!isReady} variant="primary" className="min-w-[180px] rounded-2xl bg-emerald-600 shadow-[0_16px_34px_-22px_rgba(5,150,105,0.9)]" icon={<Download className="h-4 w-4" />}>
              Download QR
            </Button>
          </div>
        </div>
      </header>

      <section ref={editorSectionRef} className="qr-editor-workspace qr-living-shell mx-auto grid w-full max-w-[1920px] gap-0 p-3 sm:p-5 lg:grid-cols-[500px_minmax(0,1fr)] lg:p-6">
        <aside ref={controlsPanelRef} className="qr-editor-controls order-2 min-w-0 overflow-hidden rounded-[24px] bg-gradient-to-b from-slate-950 via-[#11243a] to-[#164e63] text-white shadow-[0_28px_90px_-54px_rgba(15,23,42,0.95)] lg:order-1 lg:rounded-[20px]">
          <EditorSection title="Content" icon={ScanBarcode}>
            <Field label="WhatsApp Link">
              <DarkInputWrap icon={<LinkGlyph />} ok>
                <input value={rawContent} onChange={(event) => handleRawContentChange(event.target.value)} placeholder="https://wa.me/91XXXXXXXXXX" className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-500" />
              </DarkInputWrap>
            </Field>
            <Field label="Button Text" counter={`${title.length}/25`}>
              <DarkInputWrap>
                <input value={title} maxLength={25} onChange={(event) => setTitle(event.target.value)} className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-500" />
              </DarkInputWrap>
            </Field>
            <Field label="WhatsApp Message" optional counter={`${message.length}/140`}>
              <textarea value={message} maxLength={140} onChange={(event) => handleMessageChange(event.target.value)} rows={3} className="min-h-[82px] w-full resize-none rounded-xl border border-white/15 bg-white/[0.03] px-4 py-3 text-sm font-medium leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-500/15" />
            </Field>
            {importStatus ? <p role="status" aria-live="polite" className={`rounded-xl px-3 py-2 text-xs font-semibold ${importStatus.includes('successfully') ? 'bg-emerald-400/15 text-emerald-100' : importStatus.includes('couldn') || importStatus.includes('Please') ? 'bg-rose-400/15 text-rose-100' : 'bg-cyan-400/15 text-cyan-100'}`}>{importStatus}</p> : null}
          </EditorSection>

          <EditorSection title="Brand Style" icon={Palette}>
            <div>
              <p className="mb-2 text-xs font-bold text-white">Color Presets</p>
              <div className="grid grid-cols-5 gap-3">
                {PRESETS.map((presetOption) => (
                  <button key={presetOption.name} onClick={() => applyPreset(presetOption)} aria-pressed={preset.name === presetOption.name} className="group min-w-0 text-center">
                    <span className={`relative block h-12 overflow-hidden rounded-xl border p-1 shadow-lg transition ${preset.name === presetOption.name ? 'border-emerald-300 ring-2 ring-emerald-400' : 'border-white/15 hover:border-white/40'}`}>
                      <span className="block h-full rounded-lg" style={{ background: `linear-gradient(135deg, ${presetOption.banner}, ${presetOption.fg})` }} />
                      {preset.name === presetOption.name ? <Check className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-emerald-500 p-0.5 text-white" /> : null}
                    </span>
                    <span className="mt-2 block truncate text-[11px] font-medium text-slate-300">{presetOption.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold text-white">Custom Colors</p>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <DarkColorField label="Banner Color" value={banner} onChange={setBanner} />
                <DarkColorField label="QR Color" value={fg} onChange={setFg} />
                <DarkColorField label="Foreground Text" value="#ffffff" onChange={() => undefined} readonly />
              </div>
            </div>
          </EditorSection>

          <EditorSection title="Center Mark" icon={Sparkles}>
            <div className="flex items-center gap-4">
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-white text-4xl text-emerald-600 shadow-inner">{centerType === 'image' && centerImage ? <img src={centerImage} alt="Center mark" className="h-full w-full rounded-full object-cover" /> : centerEmoji}</div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setCenterType('emoji')} className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-bold text-white transition hover:bg-white/10">Use Emoji</button>
                <button type="button" onClick={openCenterImagePicker} className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-bold text-white transition hover:bg-white/10">Change Image</button>
                <button type="button" onClick={() => { setCenterImage(null); setCenterType('none'); }} className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-xs font-bold text-rose-300 transition hover:bg-rose-500/20">Remove</button>
              </div>
              <input ref={centerImageInputRef} type="file" accept="image/*" onChange={onUpload} className="hidden" tabIndex={-1} aria-hidden="true" />
            </div>
            <div className="grid grid-cols-6 gap-2">
              {EMOJIS.map((emoji) => <button key={emoji} onClick={() => { setCenterEmoji(emoji); setCenterType('emoji'); }} aria-pressed={centerEmoji === emoji && centerType === 'emoji'} className="grid aspect-square place-items-center rounded-xl bg-white/5 text-xl transition hover:bg-white/10 aria-pressed:bg-emerald-500/30">{emoji}</button>)}
            </div>
            <p className="text-xs leading-5 text-slate-400">Recommended: Square image, at least 512x512px.</p>
          </EditorSection>

          <EditorSection title="Footer" icon={Download} trailing={<button type="button" className="h-7 w-12 rounded-full bg-emerald-500 p-1"><span className="block h-5 w-5 translate-x-5 rounded-full bg-white" /></button>}>
            <p className="text-xs text-slate-400">The export includes a clean Zapora powered-by footer.</p>
          </EditorSection>
        </aside>

        <div className="qr-editor-preview-panel order-1 min-w-0 lg:order-2">
          <div className="qr-editor-preview-card relative min-h-[640px] overflow-hidden rounded-[30px] border border-white/80 bg-gradient-to-br from-[#fff7ed] via-[#f0fdfa] to-[#e0f2fe] p-4 shadow-[0_36px_100px_-64px_rgba(20,184,166,0.7)] sm:p-6 lg:min-h-full lg:rounded-[34px]">
            <div className="qr-preview-toolbar qr-action-bar mx-auto grid w-full max-w-[540px] grid-cols-3 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/85 p-1 shadow-sm backdrop-blur-xl">
              {SIZES.map((sizeOption) => (
                <button key={sizeOption.name} onClick={() => setSize(sizeOption)} aria-pressed={size.name === sizeOption.name} className={`flex min-h-14 items-center justify-center gap-3 rounded-2xl px-2 transition ${size.name === sizeOption.name ? 'border border-emerald-300 bg-white text-slate-950 shadow-[0_16px_30px_-24px_rgba(5,150,105,0.8)]' : 'text-slate-500 hover:bg-white/70'}`}>
                  <span className={`grid h-7 w-7 place-items-center rounded-xl ${size.name === sizeOption.name ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}><Smartphone className="h-4 w-4" /></span>
                  <span className="text-left"><span className="block text-sm font-black leading-tight">{sizeOption.name}</span><span className="block text-xs font-medium text-slate-500">{sizeOption.ratio}</span></span>
                </button>
              ))}
            </div>

            <div className="qr-preview-stage qr-canvas-grid relative mt-5 flex min-h-[520px] items-center justify-center overflow-hidden rounded-[30px] border border-white/70 p-4 sm:p-8">
              <PlantDecor />
              <div className="absolute right-5 top-1/3 z-10 hidden overflow-hidden rounded-3xl bg-white/90 shadow-xl backdrop-blur md:block">
                {[Grid3X3, SunMedium, Layers].map((Icon, index) => <button key={index} type="button" className="grid h-14 w-14 place-items-center border-b border-slate-100 text-slate-600 last:border-b-0 hover:bg-emerald-50"><Icon className="h-5 w-5" /></button>)}
              </div>
              {isReady ? (
                <div key={size.name} className={`qr-preview-artwork qr-preview-artwork-${size.name.toLowerCase().replace(/\s+/g, '-')} relative z-[2] w-full max-w-full overflow-hidden rounded-[28px] bg-white shadow-2xl ring-1 ring-amber-300/60`} style={{ aspectRatio: `${size.w}/${size.h}`, maxWidth: '100%' }}>
                  <canvas ref={previewRef} className="block h-full w-full zapora-qr-preview-enter" aria-label={`Live QR preview in ${size.name} format`} role="img" />
                </div>
              ) : <div className="relative z-[2] rounded-3xl border border-dashed border-emerald-300 bg-white/75 px-8 py-14 text-center text-sm font-semibold text-slate-600">Add a link or text to generate your QR preview.</div>}
            </div>

            <div className="qr-export-panel qr-export-dock mt-4 rounded-[28px] bg-slate-950/95 p-5 text-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.9)] backdrop-blur-xl">
              <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr_auto] lg:items-center">
                <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Output Size</p><p className="mt-2 text-xl font-medium">{size.w} x {size.h} px <span className="ml-3 rounded-lg bg-emerald-500/20 px-3 py-1 text-sm font-bold text-emerald-300">{size.ratio}</span></p></div>
                <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Format</p><div className="mt-2 grid max-w-xs grid-cols-3 gap-2">{FORMATS.map((formatOption) => <button key={formatOption} onClick={() => setFormat(formatOption)} aria-pressed={format === formatOption} className={`min-h-12 rounded-xl text-sm font-black transition ${format === formatOption ? 'bg-emerald-500 text-white ring-2 ring-emerald-300/70' : 'bg-white/10 text-white hover:bg-white/15'}`}>{formatOption}</button>)}</div></div>
                <Button onClick={handleDownload} disabled={!isReady} variant="primary" className="min-w-[260px] rounded-2xl bg-emerald-600 py-4 text-base" icon={<Download className="h-5 w-5" />}>Download QR</Button>
              </div>
              {exportStatus ? <p role="status" aria-live="polite" className="mt-3 text-center text-xs font-semibold text-emerald-300">{exportStatus}</p> : null}
            </div>
            {status ? <p className="mt-4 text-sm text-slate-600">{status}</p> : null}
          </div>
        </div>
      </section>
      <canvas ref={qrCanvasRef} className="hidden" />
    </main>
  );
}

function LinkGlyph() {
  return <span className="text-slate-300">↗</span>;
}

function DarkInputWrap({ children, icon, ok = false }: { children: React.ReactNode; icon?: React.ReactNode; ok?: boolean }) {
  return <div className="flex min-h-12 items-center gap-3 rounded-xl border border-white/15 bg-white/[0.03] px-4 transition focus-within:border-emerald-300 focus-within:ring-4 focus-within:ring-emerald-500/15">{icon}<div className="min-w-0 flex-1">{children}</div>{ok ? <Check className="h-5 w-5 text-emerald-400" /> : null}</div>;
}

function DarkColorField({ label, value, onChange, readonly = false }: { label: string; value: string; onChange: (value: string) => void; readonly?: boolean }) {
  return <label className="block min-w-0"><span className="mb-1.5 block text-xs font-medium text-slate-300">{label}</span><span className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2"><span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-lg border border-white/20" style={{ backgroundColor: value }}>{!readonly ? <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label={`${label} color picker`} /> : null}</span><input value={value} readOnly={readonly} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent font-mono text-xs uppercase text-white outline-none" /></span></label>;
}

function EditorSection({ title, icon: Icon, children, trailing }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; trailing?: React.ReactNode }) {
  return <section className="border-b border-white/10 p-5 last:border-b-0"><div className="mb-5 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><Icon className="h-4 w-4 text-slate-300" /><h2 className="text-xs font-black uppercase tracking-wide text-slate-200">{title}</h2></div>{trailing ?? <ChevronDown className="h-4 w-4 text-slate-300" />}</div><div className="space-y-5">{children}</div></section>;
}

function PlantDecor() {
  return <><div aria-hidden="true" className="absolute -left-12 bottom-10 z-[1] h-56 w-56 rounded-full bg-gradient-to-tr from-emerald-300/45 to-lime-200/20 blur-2xl" /><div aria-hidden="true" className="absolute -right-16 bottom-4 z-[1] h-44 w-44 rounded-full bg-gradient-to-tr from-lime-300/50 to-emerald-200/20 blur-2xl" /><div aria-hidden="true" className="absolute bottom-10 left-[18%] z-[1] h-7 w-32 rounded-full bg-emerald-300/35 blur-xl" /></>;
}


function Field({ label, optional = false, counter, children }: { label: string; optional?: boolean; counter?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-2 text-xs font-bold text-white">
        <span>{label}{optional ? <span className="font-medium text-slate-400"> (Optional)</span> : null}</span>
        {counter ? <span className="font-medium text-slate-400">{counter}</span> : null}
      </span>
      {children}
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
  const gradientMid = shade(banner, 8);
  const gradientEnd = shade(banner, -18);
  const footerY = layout.cardY + layout.cardH - Math.round(H * 0.025);
  const logoPadding = Math.round(layout.logoSize * 0.2);
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
      <stop offset="52%" stop-color="${gradientMid}" />
      <stop offset="100%" stop-color="${gradientEnd}" />
    </linearGradient>
    <radialGradient id="artboard-glow" cx="50%" cy="32%" r="62%">
      <stop offset="0%" stop-color="#d1fae5" stop-opacity="0.78" />
      <stop offset="48%" stop-color="#e0f2fe" stop-opacity="0.44" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
    </radialGradient>
    <filter id="soft-card-shadow" x="-12%" y="-12%" width="124%" height="128%">
      <feDropShadow dx="0" dy="18" stdDeviation="27" flood-color="#059669" flood-opacity="0.16" />
    </filter>
    <filter id="soft-qr-shadow" x="-8%" y="-8%" width="116%" height="116%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#0f172a" flood-opacity="0.09" />
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="#ffffff" />
  <rect width="${W}" height="${H}" fill="url(#artboard-glow)" />
  <rect x="${Math.round(W * 0.07)}" y="${Math.round(H * 0.78)}" width="${Math.round(W * 0.18)}" height="${Math.round(W * 0.055)}" rx="${Math.round(W * 0.028)}" fill="#c4b5fd" fill-opacity="0.16" />
  <rect x="${Math.round(W * 0.76)}" y="${Math.round(H * 0.08)}" width="${Math.round(W * 0.14)}" height="${Math.round(W * 0.045)}" rx="${Math.round(W * 0.023)}" fill="#fbbf24" fill-opacity="0.12" />
  <rect x="${layout.cardX}" y="${layout.cardY}" width="${layout.cardW}" height="${layout.cardH}" rx="${layout.cardR}" fill="#ffffff" filter="url(#soft-card-shadow)" />
  <path d="${topRoundedRectPath(layout.cardX, layout.cardY, layout.cardW, layout.bannerH, layout.cardR)}" fill="url(#banner-gradient)" />
  <text x="${layout.centerX}" y="${layout.titleY - (subtitle ? layout.titleSize * 0.55 : 0)}" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-size="${layout.titleSize}" font-family="Inter, system-ui, sans-serif" font-weight="700">${escapedTitle}</text>
  ${subtitle ? `<text x="${layout.centerX}" y="${layout.titleY + layout.titleSize * 0.4}" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" fill-opacity="0.9" font-size="${layout.subtitleSize}" font-family="Inter, system-ui, sans-serif" font-weight="500">${escapedSubtitle}</text>` : ''}
  <rect x="${layout.qrX - layout.qrPadding}" y="${layout.qrY - layout.qrPadding}" width="${layout.qrSize + layout.qrPadding * 2}" height="${layout.qrSize + layout.qrPadding * 2}" rx="${Math.round(layout.qrSize * 0.06)}" fill="#ffffff" filter="url(#soft-qr-shadow)" />
  <g transform="translate(${layout.qrX} ${layout.qrY}) scale(${qrScale})">${qrInner}</g>
  ${centerMarkup}
  <text x="${layout.centerX}" y="${footerY}" text-anchor="middle" fill="rgba(15,31,23,0.38)" font-size="${layout.footerSize}" font-family="Inter, system-ui, sans-serif" font-weight="600">Powered by Zapora</text>
</svg>`;
}

function getQrLayout(W: number, H: number) {
  const outerPadX = Math.round(W * 0.05);
  const cardX = outerPadX;
  const cardY = Math.round(H * 0.035);
  const cardW = W - outerPadX * 2;
  const cardH = H - cardY * 2;
  const cardR = Math.round(W * 0.055);
  const bannerH = Math.round(cardH * 0.16);
  const centerX = cardX + cardW / 2;
  const titleSize = Math.round(W * 0.047);
  const titleY = cardY + bannerH / 2;
  const subtitleSize = Math.round(W * 0.025);
  const bodyTop = cardY + bannerH;
  const bodyHeight = cardH - bannerH;
  const qrMaxByWidth = cardW - outerPadX * 0.45;
  const qrMaxByHeight = bodyHeight - Math.round(H * 0.075);
  const qrSize = Math.min(qrMaxByWidth, qrMaxByHeight);
  const qrX = cardX + (cardW - qrSize) / 2;
  const qrY = bodyTop + (bodyHeight - qrSize) / 2 - Math.round(H * 0.004);
  const qrPadding = Math.round(qrSize * 0.035);
  const logoSize = Math.round(qrSize * 0.17);
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
