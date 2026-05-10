import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Headset, MapPin, MessageCircle, Phone, ShoppingBag, Sparkles, Type, UploadCloud } from 'lucide-react';

const QR_EDITOR_STORAGE_KEY = 'zapora_qr_editor_link';

type OutputStyle = 'plain' | 'whatsappCard';
type ExportSizeId = 'squarePost' | 'portraitPost' | 'story' | 'poster' | 'visitingCard';
type WorkspaceTab = 'content' | 'design' | 'appearance';
type ThemePack = 'zaporaClean' | 'minimalDark' | 'softGreen' | 'modernBlue' | 'boldPromo' | 'elegantBusiness';
type ModuleStyle = 'classic' | 'square' | 'rounded';
type EyeStyle = 'square' | 'rounded' | 'ring';
type SurfaceStyle = 'white' | 'mist' | 'slate';
type BadgeMode = 'none' | 'icon' | 'emoji' | 'image';

const exportSizes = { squarePost: { label: 'Square Post', ratio: '1:1', w: 1200, h: 1200 }, portraitPost: { label: 'Portrait Post', ratio: '4:5', w: 1080, h: 1350 }, story: { label: 'Story', ratio: '9:16', w: 1080, h: 1920 }, poster: { label: 'Poster', ratio: '7:10', w: 1400, h: 2000 }, visitingCard: { label: 'Visiting Card', ratio: '7:4', w: 1400, h: 800 } } as const;
const messageTemplates = { general: 'Hi, I’d like to know more about your services.', support: 'Hi, I need help regarding your service/product.', booking: 'Hi, I’d like to book an appointment.', pricing: 'Hi, I’d like to get pricing details.', order: 'Hi, I’d like to place an order.' } as const;
const themePacks: Record<ThemePack, { label: string; color: string; gradient: boolean; style: OutputStyle; preview: [string, string] }> = {
  zaporaClean: { label: 'Zapora', color: '#111827', gradient: false, style: 'whatsappCard', preview: ['#22c55e', '#0f172a'] },
  minimalDark: { label: 'Dark', color: '#111827', gradient: false, style: 'plain', preview: ['#0f172a', '#334155'] },
  softGreen: { label: 'Soft Green', color: '#166534', gradient: false, style: 'whatsappCard', preview: ['#16a34a', '#65a30d'] },
  modernBlue: { label: 'Blue', color: '#1d4ed8', gradient: false, style: 'whatsappCard', preview: ['#2563eb', '#0ea5e9'] },
  boldPromo: { label: 'Promo', color: '#7b61ff', gradient: true, style: 'whatsappCard', preview: ['#7b61ff', '#5ce1e6'] },
  elegantBusiness: { label: 'Business', color: '#1f2937', gradient: true, style: 'whatsappCard', preview: ['#111827', '#6366f1'] },
};

const baseInteractive = 'rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40';
const chipButton = (selected: boolean) => `${baseInteractive} ${selected ? 'border-emerald-300 bg-emerald-50 text-emerald-900 shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-violet-200 hover:bg-violet-50/40'}`;

export default function QrCodeEditorPage() {
  const [tab, setTab] = useState<WorkspaceTab>('content');
  const [targetLink, setTargetLink] = useState('');
  const [msg, setMsg] = useState(messageTemplates.general);
  const [title, setTitle] = useState('Connect with us on WhatsApp');
  const [subtitle, setSubtitle] = useState('Scan to start a professional conversation');
  const [titleBold, setTitleBold] = useState(false);
  const [titleItalic, setTitleItalic] = useState(false);
  const [subtitleBold, setSubtitleBold] = useState(false);
  const [subtitleItalic, setSubtitleItalic] = useState(false);
  const [style, setStyle] = useState<OutputStyle>('whatsappCard');
  const [size, setSize] = useState<ExportSizeId>('squarePost');
  const [color, setColor] = useState('#111827');
  const [useGradient, setUseGradient] = useState(false);
  const [theme, setTheme] = useState<ThemePack>('zaporaClean');
  const [status, setStatus] = useState('');
  const [moduleStyle, setModuleStyle] = useState<ModuleStyle>('classic');
  const [eyeStyle, setEyeStyle] = useState<EyeStyle>('rounded');
  const [surfaceStyle, setSurfaceStyle] = useState<SurfaceStyle>('white');
  const [previewQr, setPreviewQr] = useState('');
  const [badgeMode, setBadgeMode] = useState<BadgeMode>('none');
  const [badgeIcon, setBadgeIcon] = useState('chat');
  const [badgeEmoji, setBadgeEmoji] = useState('💬');
  const [badgeImage, setBadgeImage] = useState('');

  useEffect(() => {
    const s = localStorage.getItem(QR_EDITOR_STORAGE_KEY); if (s) setTargetLink(s);
  }, []);

  const valid = useMemo(() => { try { return !!targetLink.trim() && Boolean(new URL(targetLink)); } catch { return false; } }, [targetLink]);
  const finalLink = useMemo(() => { if (!valid) return ''; const u = new URL(targetLink); if ((u.hostname.includes('wa.me') || u.hostname.includes('whatsapp')) && msg.trim()) u.searchParams.set('text', msg.trim()); return u.toString(); }, [valid, targetLink, msg]);
  const qr = finalLink ? `https://api.qrserver.com/v1/create-qr-code/?size=1024x1024&ecc=H&color=${color.replace('#','')}&bgcolor=ffffff&data=${encodeURIComponent(finalLink)}` : '';

  const applyTheme = (next: ThemePack) => { const p = themePacks[next]; setTheme(next); setColor(p.color); setUseGradient(p.gradient); setStyle(p.style); };

  const handleImportQr = async (file: File) => {
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result as string); fr.onerror = reject; fr.readAsDataURL(file); });
      const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = dataUrl; });
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d'); if (!ctx) throw new Error('ctx');
      ctx.drawImage(img, 0, 0);
      const detector = 'BarcodeDetector' in window ? new (window as any).BarcodeDetector({ formats: ['qr_code'] }) : null;
      if (!detector) { setStatus('QR import is not supported in this browser yet.'); return; }
      const codes = await detector.detect(c);
      const rawValue = codes?.[0]?.rawValue;
      if (!rawValue) { setStatus('We couldn’t read this QR. Try a clearer image or a standard QR code.'); return; }
      setTargetLink(rawValue.trim());
      setStatus('Imported QR rebuilt successfully.');
    } catch {
      setStatus('We couldn’t read this QR. Try a clearer image or a standard QR code.');
    }
  };

  const drawStyledQr = async (ctx: CanvasRenderingContext2D, x: number, y: number, sizePx: number) => {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.src = qr; i.onload = () => res(i); i.onerror = () => rej(); });
    if (moduleStyle === 'classic') { ctx.drawImage(img, x, y, sizePx, sizePx); return; }
    const m = 45;
    const t = document.createElement('canvas'); t.width = m; t.height = m;
    const tctx = t.getContext('2d'); if (!tctx) return;
    tctx.drawImage(img, 0, 0, m, m);
    const data = tctx.getImageData(0, 0, m, m).data;
    const cell = sizePx / m;
    ctx.fillStyle = color;
    for (let r = 0; r < m; r++) for (let c = 0; c < m; c++) {
      const idx = (r * m + c) * 4;
      if (data[idx] >= 120) continue;
      const px = x + c * cell; const py = y + r * cell;
      const inEye = (r < 8 && c < 8) || (r < 8 && c > 36) || (r > 36 && c < 8);
      if (inEye) continue;
      if (moduleStyle === 'square') ctx.fillRect(px, py, cell, cell);
      if (moduleStyle === 'rounded') { ctx.beginPath(); ctx.roundRect(px + cell * 0.08, py + cell * 0.08, cell * 0.84, cell * 0.84, cell * 0.25); ctx.fill(); }
    }
    const drawEye = (ex: number, ey: number) => {
      const e = cell * 7; ctx.lineWidth = cell * 0.9; ctx.strokeStyle = color; ctx.fillStyle = color;
      if (eyeStyle === 'square') { ctx.strokeRect(ex, ey, e, e); ctx.fillRect(ex + cell * 2.2, ey + cell * 2.2, cell * 2.6, cell * 2.6); }
      else if (eyeStyle === 'rounded') { ctx.beginPath(); ctx.roundRect(ex, ey, e, e, cell * 1.2); ctx.stroke(); ctx.beginPath(); ctx.roundRect(ex + cell * 2.2, ey + cell * 2.2, cell * 2.6, cell * 2.6, cell * 0.8); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(ex + e / 2, ey + e / 2, e / 2, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(ex + e / 2, ey + e / 2, e * 0.21, 0, Math.PI * 2); ctx.fill(); }
    };
    drawEye(x + cell, y + cell); drawEye(x + sizePx - cell * 8, y + cell); drawEye(x + cell, y + sizePx - cell * 8);
  };

  const renderCanvas = async () => {
    if (!qr) return null;
    const cfg = exportSizes[size];
    const c = document.createElement('canvas'); c.width = cfg.w; c.height = cfg.h;
    const ctx = c.getContext('2d'); if (!ctx) return null;
    ctx.fillStyle = { white: '#ffffff', mist: '#f8fafc', slate: '#f1f5f9' }[surfaceStyle]; ctx.fillRect(0, 0, c.width, c.height);
    const pad = Math.round(Math.min(c.width, c.height) * 0.058); const w = c.width - pad * 2; const h = c.height - pad * 2;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(pad, pad, w, h, 24); ctx.fill(); ctx.stroke();
    const headerH = style === 'plain' ? 0 : Math.round(h * 0.215);
    if (style !== 'plain') {
      const g = ctx.createLinearGradient(pad, pad, c.width - pad, pad + 120); g.addColorStop(0, useGradient ? '#7b61ff' : color); g.addColorStop(1, useGradient ? '#5ce1e6' : '#111827');
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(pad, pad, w, headerH, [24, 24, 18, 18]); ctx.fill();
    }
    const textZone = style === 'plain' ? Math.round(h * 0.055) : Math.round(h * 0.15);
    const qrTop = pad + headerH + textZone;
    const qrBottomSafe = pad + h - Math.round(h * 0.075);
    const maxQrByHeight = Math.max(220, qrBottomSafe - qrTop);
    const qs = Math.round(Math.min(Math.min(c.width, c.height) * 0.6, maxQrByHeight));
    const qx = (c.width - qs) / 2;
    const qy = qrTop;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(qx - 16, qy - 16, qs + 32, qs + 32, 20); ctx.fill();
    await drawStyledQr(ctx, qx, qy, qs);

    const badgeSize = Math.round(qs * 0.14);
    if (badgeMode !== 'none') {
      const bx = qx + qs / 2; const by = qy + qs / 2;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, badgeSize / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (badgeMode === 'emoji') { ctx.font = `${Math.round(badgeSize * 0.46)}px Inter`; ctx.textAlign = 'center'; ctx.fillStyle = '#0f172a'; ctx.fillText(badgeEmoji, bx, by + badgeSize * 0.13); }
      if (badgeMode === 'icon') { const map: Record<string, string> = { chat: '💬', phone: '☎', support: '✚', calendar: '📅', shop: '🛍', location: '⌖' }; ctx.font = `700 ${Math.round(badgeSize * 0.42)}px Inter`; ctx.textAlign = 'center'; ctx.fillStyle = '#0f172a'; ctx.fillText(map[badgeIcon] || '💬', bx, by + badgeSize * 0.12); }
      if (badgeMode === 'image' && badgeImage) { try { const lg = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = badgeImage; }); ctx.save(); ctx.beginPath(); ctx.arc(bx, by, badgeSize * 0.34, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(lg, bx - badgeSize * 0.34, by - badgeSize * 0.34, badgeSize * 0.68, badgeSize * 0.68); ctx.restore(); } catch {} }
    }

    if (style !== 'plain') {
      ctx.textAlign = 'center';
      ctx.font = `${titleItalic ? 'italic ' : ''}${titleBold ? '700' : '500'} ${Math.round(c.height * 0.038)}px Inter`;
      ctx.fillStyle = '#ffffff'; ctx.fillText(title, c.width / 2, pad + Math.round(headerH * 0.52));
      ctx.font = `${subtitleItalic ? 'italic ' : ''}${subtitleBold ? '700' : '400'} ${Math.round(c.height * 0.022)}px Inter`;
      ctx.fillStyle = '#475569'; ctx.fillText(subtitle, c.width / 2, pad + headerH + Math.round(h * 0.14));
    }
    return c;
  };

  useEffect(() => {
    let active = true;
    (async () => { if (!valid || !qr) return setPreviewQr(''); const c = await renderCanvas(); if (c && active) setPreviewQr(c.toDataURL('image/png')); })();
    return () => { active = false; };
  }, [qr, valid, size, style, color, useGradient, title, subtitle, moduleStyle, eyeStyle, badgeMode, badgeIcon, badgeEmoji, badgeImage, titleBold, titleItalic, subtitleBold, subtitleItalic, surfaceStyle]);

  const downloadBlob = (blob: Blob, filename: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href); };
  const exportPNG = async () => { if (!valid) return; const c = await renderCanvas(); if (!c) return; c.toBlob((blob) => { if (!blob) return; downloadBlob(blob, `zapora-${style}-${size}.png`); }, 'image/png'); };
  const exportSVG = async () => { if (!valid || !previewQr) return; const cfg = exportSizes[size]; const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${cfg.w}' height='${cfg.h}'><rect width='100%' height='100%' fill='#ffffff'/><image href='${previewQr}' x='0' y='0' width='${cfg.w}' height='${cfg.h}'/></svg>`; downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `zapora-${style}-${size}.svg`); };
  const exportPDF = async () => { if (!valid) return; const c = await renderCanvas(); if (!c) return; const w = window.open('', '_blank'); if (!w) return; w.document.write(`<img src='${c.toDataURL('image/png')}' style='width:100%;max-width:900px;display:block;margin:auto'/>`); w.document.close(); w.print(); };

  return <main className='min-h-screen bg-white py-8 sm:py-12'><div className='mx-auto max-w-7xl px-4 lg:px-6'><header className='mb-6 rounded-3xl border border-slate-200 bg-white p-5 sm:mb-8 sm:p-7'><p className='mb-2 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700'>Zapora Studio</p><h1 className='text-2xl font-semibold tracking-tight text-slate-900 sm:text-4xl'>QR Code Editor</h1></header>
    <section className='grid gap-5 xl:grid-cols-[1fr_1fr]'><div className='rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 min-h-[760px]'><div className='mb-5 grid grid-cols-3 gap-2 rounded-2xl bg-slate-100/90 p-1.5 ring-1 ring-slate-200'>{([{ id: 'content', label: 'Content' }, { id: 'design', label: 'Design' }, { id: 'appearance', label: 'Appearance' }] as { id: WorkspaceTab; label: string }[]).map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`${baseInteractive} border-0 px-3 py-2.5 text-sm ${tab === item.id ? 'bg-white text-slate-950 shadow-md ring-2 ring-violet-200' : 'bg-transparent text-slate-600 hover:bg-white/80'}`}>{item.label}</button>)}</div>
      {tab === 'content' && <div className='space-y-3'><label className='block cursor-pointer rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/60 p-4 text-sm text-emerald-900 hover:bg-emerald-50'><span className='mb-1 inline-flex items-center gap-2 font-semibold'><UploadCloud className='h-4 w-4' />Import QR</span><p className='text-xs'>Upload QR image (PNG, JPG, WEBP) to rebuild in studio.</p><input type='file' accept='image/png,image/jpeg,image/jpg,image/webp' className='hidden' onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImportQr(f); }} /></label><input value={targetLink} onChange={(e) => setTargetLink(e.target.value)} className='w-full rounded-xl border border-slate-300 px-4 py-3 text-sm' placeholder='Paste your WhatsApp link or URL' /><textarea value={msg} onChange={(e) => setMsg(e.target.value)} className='w-full rounded-xl border border-slate-300 px-4 py-3 text-sm' rows={3} /></div>}
      {tab === 'design' && <div className='space-y-4'><section className='rounded-2xl border border-slate-200 p-3'><p className='mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500'>QR body style</p><div className='grid grid-cols-2 gap-2'>{(['classic', 'square', 'rounded'] as ModuleStyle[]).map((m) => <button key={m} onClick={() => setModuleStyle(m)} className={chipButton(moduleStyle === m)}>{m}</button>)}</div></section><section className='rounded-2xl border border-slate-200 p-3 bg-slate-50/60'><div className='mb-2 flex items-center justify-between'><p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>Center content</p><span className='text-[11px] text-slate-500'>Scan-safe badge</span></div><div className='mb-2 grid grid-cols-4 gap-2'>{(['none', 'icon', 'emoji', 'image'] as BadgeMode[]).map((m) => <button key={m} onClick={() => setBadgeMode(m)} className={`${chipButton(badgeMode === m)} capitalize`}>{m}</button>)}</div>{badgeMode === 'icon' && <div className='grid grid-cols-3 gap-2'>{[{ id: 'chat', label: 'Chat', icon: MessageCircle }, { id: 'phone', label: 'Phone', icon: Phone }, { id: 'support', label: 'Help', icon: Headset }, { id: 'calendar', label: 'Book', icon: CalendarDays }, { id: 'shop', label: 'Shop', icon: ShoppingBag }, { id: 'location', label: 'Visit', icon: MapPin }].map((opt) => <button key={opt.id} onClick={() => setBadgeIcon(opt.id)} className={`${chipButton(badgeIcon === opt.id)} flex items-center gap-1`}><opt.icon className='h-3 w-3' />{opt.label}</button>)}</div>}{badgeMode === 'emoji' && <div className='grid grid-cols-6 gap-2'>{['💬', '❤️', '⭐', '📅', '📍', '🛍️'].map((emo) => <button key={emo} onClick={() => setBadgeEmoji(emo)} className={`${chipButton(badgeEmoji === emo)} text-lg`}>{emo}</button>)}</div>}{badgeMode === 'image' && <label className='block cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs'>Upload center image<input type='file' accept='image/png,image/jpeg,image/jpg,image/webp' className='hidden' onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const fr = new FileReader(); fr.onload = () => setBadgeImage(fr.result as string); fr.readAsDataURL(f); }} /></label>}</section></div>}
      {tab === 'appearance' && <div className='space-y-4'><section className='rounded-2xl border border-slate-200 p-3'><p className='mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500'>Preset colors</p><div className='grid grid-cols-6 gap-2'>{(Object.keys(themePacks) as ThemePack[]).map((k) => { const p = themePacks[k]; return <button key={k} title={p.label} onClick={() => applyTheme(k)} className={`h-7 w-7 rounded-full border ${theme === k ? 'ring-2 ring-emerald-500' : 'border-slate-200'}`} style={{ backgroundImage: `linear-gradient(135deg,${p.preview[0]},${p.preview[1]})` }} />; })}<button className='h-7 w-7 rounded-full border border-slate-200' style={{ backgroundImage: 'linear-gradient(135deg,#f97316,#fb7185)' }} onClick={() => { setColor('#f97316'); setUseGradient(true); }} /><button className='h-7 w-7 rounded-full border border-slate-200' style={{ backgroundImage: 'linear-gradient(135deg,#0891b2,#6366f1)' }} onClick={() => { setColor('#0891b2'); setUseGradient(true); }} /><button className='h-7 w-7 rounded-full border border-slate-200' style={{ backgroundImage: 'linear-gradient(135deg,#a855f7,#ec4899)' }} onClick={() => { setColor('#a855f7'); setUseGradient(true); }} /></div><label className='mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs'>Custom color <input type='color' value={color} onChange={(e) => setColor(e.target.value)} className='h-6 w-6 rounded border border-slate-300' /></label></section><section className='rounded-2xl border border-slate-200 p-3'><p className='mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500'>Title & subtitle</p><div className='flex gap-2'><input value={title} onChange={(e) => setTitle(e.target.value)} className='w-full rounded-xl border border-slate-300 px-3 py-2 text-sm' placeholder='Headline' /><input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className='w-full rounded-xl border border-slate-300 px-3 py-2 text-sm' placeholder='Subtitle' /></div><div className='mt-2 flex flex-wrap gap-2'><button onClick={() => setTitleBold((v) => !v)} className={chipButton(titleBold)}><Type className='mr-1 inline h-3 w-3' />Title Bold</button><button onClick={() => setTitleItalic((v) => !v)} className={chipButton(titleItalic)}>Title Italic</button><button onClick={() => setSubtitleBold((v) => !v)} className={chipButton(subtitleBold)}>Subtitle Bold</button><button onClick={() => setSubtitleItalic((v) => !v)} className={chipButton(subtitleItalic)}>Subtitle Italic</button><button onClick={() => setUseGradient((v) => !v)} className={chipButton(useGradient)}>{useGradient ? 'Gradient On' : 'Gradient Off'}</button></div></section></div>}
    </div>
      <div className='xl:sticky xl:top-5 xl:self-start'><section className='rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm sm:p-6'><div className='mb-4 flex items-center justify-between'><h2 className='inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-600'><Sparkles className='h-4 w-4 text-violet-500' />Live Canvas</h2><span className='rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700'>{exportSizes[size].label}</span></div>{valid && previewQr ? <div className='grid min-h-[500px] place-items-center rounded-3xl border border-slate-200 bg-slate-100/80 p-6'><div className='w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-6 shadow-lg'><img src={previewQr} className='mx-auto block w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white p-2 object-contain' alt='preview' /></div></div> : <div className='flex min-h-[500px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-100 text-center text-slate-700'><Sparkles className='mb-2 h-5 w-5 text-violet-500' /><p className='font-semibold'>Start with a link to preview and export</p></div>}</section></div></section></div></main>;
}

export { QR_EDITOR_STORAGE_KEY };
