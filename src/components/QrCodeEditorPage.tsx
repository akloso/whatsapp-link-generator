import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Headset, ImageDown, MapPin, MessageCircle, Phone, ShoppingBag, Sparkles, Type, UploadCloud } from 'lucide-react';

const QR_EDITOR_STORAGE_KEY = 'zapora_qr_editor_link';
const QR_EDITOR_RECENTS_KEY = 'zapora_qr_editor_recent_designs';
const QR_EDITOR_TEMPLATES_KEY = 'zapora_qr_editor_saved_templates';

type OutputStyle = 'plain' | 'whatsappCard';
type ExportSizeId = 'squarePost' | 'portraitPost' | 'story' | 'poster' | 'visitingCard';
type WorkspaceTab = 'content' | 'appearance' | 'branding' | 'library';
type ThemePack = 'zaporaClean' | 'minimalDark' | 'softGreen' | 'modernBlue' | 'boldPromo' | 'elegantBusiness';
type ModuleStyle = 'square' | 'rounded' | 'dots' | 'smooth';
type EyeStyle = 'square' | 'rounded' | 'ring';
type FrameStyle = 'none' | 'soft' | 'premium' | 'accent';
type SurfaceStyle = 'white' | 'mist' | 'mint' | 'slate';
type TextAlign = 'left' | 'center';
type Density = 'cozy' | 'balanced' | 'airy';
type BadgeMode = 'none' | 'icon' | 'emoji' | 'logo';

const exportSizes = { squarePost: { label: 'Square Post', ratio: '1:1', w: 1200, h: 1200 }, portraitPost: { label: 'Portrait Post', ratio: '4:5', w: 1080, h: 1350 }, story: { label: 'Story', ratio: '9:16', w: 1080, h: 1920 }, poster: { label: 'Poster', ratio: '7:10', w: 1400, h: 2000 }, visitingCard: { label: 'Visiting Card', ratio: '7:4', w: 1400, h: 800 } } as const;
const messageTemplates = { general: 'Hi, I’d like to know more about your services.', support: 'Hi, I need help regarding your service/product.', booking: 'Hi, I’d like to book an appointment.', pricing: 'Hi, I’d like to get pricing details.', order: 'Hi, I’d like to place an order.', event: 'Hi, I want to register for your event.', collab: 'Hi, I’d like to discuss a possible collaboration.', freelance: 'Hi, I’d like to discuss a project with you.' } as const;
const themePacks: Record<ThemePack, { label: string; color: string; gradient: boolean; style: OutputStyle; tint: string; border: string; text: string; mood: string; preview: [string, string] }> = {
  zaporaClean: { label: 'Zapora Clean', color: '#111827', gradient: false, style: 'whatsappCard', tint: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', mood: 'Clean · Brand Neutral', preview: ['#22c55e', '#0f172a'] },
  minimalDark: { label: 'Minimal Dark', color: '#111827', gradient: false, style: 'plain', tint: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-800', mood: 'Dark · Minimal', preview: ['#0f172a', '#334155'] },
  softGreen: { label: 'Soft Green', color: '#166534', gradient: false, style: 'whatsappCard', tint: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', mood: 'Friendly · Organic', preview: ['#16a34a', '#65a30d'] },
  modernBlue: { label: 'Modern Blue', color: '#1d4ed8', gradient: false, style: 'whatsappCard', tint: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', mood: 'Calm · Corporate', preview: ['#2563eb', '#0ea5e9'] },
  boldPromo: { label: 'Bold Promo', color: '#7b61ff', gradient: true, style: 'whatsappCard', tint: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-800', mood: 'Energetic · Campaign', preview: ['#7b61ff', '#5ce1e6'] },
  elegantBusiness: { label: 'Elegant Business', color: '#1f2937', gradient: true, style: 'whatsappCard', tint: 'bg-zinc-100', border: 'border-zinc-300', text: 'text-zinc-800', mood: 'Premium · Formal', preview: ['#111827', '#6366f1'] },
};

const baseInteractive = 'rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40';
const chipButton = (selected: boolean) => `${baseInteractive} ${selected ? 'border-emerald-300 bg-emerald-50 text-emerald-900 shadow-sm shadow-emerald-100' : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-[1px] hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950'}`;

export default function QrCodeEditorPage() {
  const [tab, setTab] = useState<WorkspaceTab>('content');
  const [targetLink, setTargetLink] = useState('');
  const [msg, setMsg] = useState(messageTemplates.general);
  const [title, setTitle] = useState('Connect with us on WhatsApp');
  const [subtitle, setSubtitle] = useState('Scan to start a professional conversation');
  const [style, setStyle] = useState<OutputStyle>('whatsappCard');
  const [size, setSize] = useState<ExportSizeId>('squarePost');
  const [color, setColor] = useState('#111827');
  const [useGradient, setUseGradient] = useState(false);
  const [theme, setTheme] = useState<ThemePack>('zaporaClean');
  const [savedTemplates, setSavedTemplates] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [moduleStyle, setModuleStyle] = useState<ModuleStyle>('square');
  const [eyeStyle, setEyeStyle] = useState<EyeStyle>('rounded');
  const [frameStyle, setFrameStyle] = useState<FrameStyle>('soft');
  const [surfaceStyle, setSurfaceStyle] = useState<SurfaceStyle>('white');
  const [showTitle, setShowTitle] = useState(true);
  const [showSubtitle, setShowSubtitle] = useState(true);
  const [textAlign, setTextAlign] = useState<TextAlign>('center');
  const [density, setDensity] = useState<Density>('balanced');
  const [previewQr, setPreviewQr] = useState('');
  const [badgeMode, setBadgeMode] = useState<BadgeMode>('none');
  const [badgeIcon, setBadgeIcon] = useState('chat');
  const [badgeEmoji, setBadgeEmoji] = useState('💬');
  const [badgeLogo, setBadgeLogo] = useState('');
  const [badgeUploadName, setBadgeUploadName] = useState('');

  useEffect(() => {
    const s = localStorage.getItem(QR_EDITOR_STORAGE_KEY); if (s) setTargetLink(s);
    const t = localStorage.getItem(QR_EDITOR_TEMPLATES_KEY); if (t) setSavedTemplates(JSON.parse(t));
    const d = new URLSearchParams(window.location.search).get('design');
    if (d) { try { applyDesign(JSON.parse(atob(d)), false); } catch {} }
  }, []);
  useEffect(() => { localStorage.setItem(QR_EDITOR_TEMPLATES_KEY, JSON.stringify(savedTemplates.slice(0, 5))); }, [savedTemplates]);

  const valid = useMemo(() => { try { return !!targetLink.trim() && Boolean(new URL(targetLink)); } catch { return false; } }, [targetLink]);
  const finalLink = useMemo(() => { if (!valid) return ''; const u = new URL(targetLink); if ((u.hostname.includes('wa.me') || u.hostname.includes('whatsapp')) && msg.trim()) u.searchParams.set('text', msg.trim()); return u.toString(); }, [valid, targetLink, msg]);
  const qr = finalLink ? `https://api.qrserver.com/v1/create-qr-code/?size=900x900&color=000000&bgcolor=ffffff&data=${encodeURIComponent(finalLink)}` : '';

  const applyTheme = (next: ThemePack) => { const p = themePacks[next]; setTheme(next); setColor(p.color); setUseGradient(p.gradient); setStyle(p.style); };
  const applyDesign = (d: any, withStatus = true) => { if (d.targetLink) setTargetLink(d.targetLink); if (d.msg) setMsg(d.msg); if (d.title) setTitle(d.title); if (d.subtitle) setSubtitle(d.subtitle); if (d.style === 'plain' || d.style === 'whatsappCard') setStyle(d.style); if (d.size) setSize(d.size); if (d.color) setColor(d.color); if (d.theme) setTheme(d.theme); if (d.moduleStyle) setModuleStyle(d.moduleStyle); if (d.eyeStyle) setEyeStyle(d.eyeStyle); if (d.frameStyle) setFrameStyle(d.frameStyle); if (d.surfaceStyle) setSurfaceStyle(d.surfaceStyle); if (d.badgeMode) setBadgeMode(d.badgeMode); if (d.badgeIcon) setBadgeIcon(d.badgeIcon); if (d.badgeEmoji) setBadgeEmoji(d.badgeEmoji); if (d.badgeLogo) setBadgeLogo(d.badgeLogo); if (withStatus) setStatus('Design applied.'); };
  const copyDesignLink = () => { const state = { targetLink, msg, title, subtitle, style, size, color, useGradient, theme, moduleStyle, eyeStyle, frameStyle, surfaceStyle, badgeMode, badgeIcon, badgeEmoji, badgeLogo }; navigator.clipboard.writeText(`${window.location.origin}/qr-code-editor?design=${encodeURIComponent(btoa(JSON.stringify(state)))}`); setStatus('Design link copied.'); };
  const saveTemplate = () => { const t = { id: Date.now(), name: title.slice(0, 26) || 'Untitled template', targetLink, msg, title, subtitle, style, size, color, useGradient, theme, moduleStyle, eyeStyle, frameStyle, surfaceStyle, badgeMode, badgeIcon, badgeEmoji, badgeLogo }; setSavedTemplates((prev) => [t, ...prev].slice(0, 5)); setStatus('Template saved.'); };


  const handleImportQr = async (file: File) => {
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result as string); fr.onerror = reject; fr.readAsDataURL(file); });
      const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = dataUrl; });
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d'); if (!ctx) throw new Error('ctx');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, c.width, c.height);
      const detector = 'BarcodeDetector' in window ? new (window as any).BarcodeDetector({ formats: ['qr_code'] }) : null;
      if (!detector) { setStatus('QR import is not supported in this browser yet.'); return; }
      const codes = await detector.detect(c);
      const rawValue = codes?.[0]?.rawValue;
      if (!rawValue) { setStatus('We couldn’t read this QR. Try a clearer image or a standard QR code.'); return; }
      setTargetLink(rawValue.trim());
      setStatus('QR imported and rebuilt in studio.');
      void imageData;
    } catch {
      setStatus('We couldn’t read this QR. Try a clearer image or a standard QR code.');
    }
  };

  const handleLogoUpload = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result as string); fr.onerror = reject; fr.readAsDataURL(file); });
    setBadgeLogo(dataUrl);
    setBadgeUploadName(file.name);
    setBadgeMode('logo');
  };

  const drawStyledQr = async (ctx: CanvasRenderingContext2D, x: number, y: number, sizePx: number) => {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.src = qr; i.onload = () => res(i); i.onerror = () => rej(); });
    const m = 45;
    const t = document.createElement('canvas'); t.width = m; t.height = m;
    const tctx = t.getContext('2d'); if (!tctx) return;
    tctx.drawImage(img, 0, 0, m, m);
    const data = tctx.getImageData(0, 0, m, m).data;
    const cell = sizePx / m;
    ctx.fillStyle = color;
    for (let r = 0; r < m; r++) {
      for (let c = 0; c < m; c++) {
        const idx = (r * m + c) * 4;
        if (data[idx] < 120) {
          const px = x + c * cell;
          const py = y + r * cell;
          const inEye = (r < 8 && c < 8) || (r < 8 && c > 36) || (r > 36 && c < 8);
          if (inEye) continue;
          if (moduleStyle === 'square') ctx.fillRect(px, py, cell, cell);
          if (moduleStyle === 'rounded') { ctx.beginPath(); ctx.roundRect(px + cell * 0.06, py + cell * 0.06, cell * 0.88, cell * 0.88, cell * 0.28); ctx.fill(); }
          if (moduleStyle === 'dots') { ctx.beginPath(); ctx.arc(px + cell / 2, py + cell / 2, cell * 0.34, 0, Math.PI * 2); ctx.fill(); }
          if (moduleStyle === 'smooth') { ctx.beginPath(); ctx.roundRect(px + cell * 0.02, py + cell * 0.02, cell * 0.96, cell * 0.96, cell * 0.42); ctx.fill(); }
        }
      }
    }
    const drawEye = (ex: number, ey: number) => {
      const e = cell * 7;
      ctx.lineWidth = cell * 0.9;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      if (eyeStyle === 'square') {
        ctx.strokeRect(ex, ey, e, e);
        ctx.fillRect(ex + cell * 2.2, ey + cell * 2.2, cell * 2.6, cell * 2.6);
      } else if (eyeStyle === 'rounded') {
        ctx.beginPath(); ctx.roundRect(ex, ey, e, e, cell * 1.3); ctx.stroke();
        ctx.beginPath(); ctx.roundRect(ex + cell * 2.2, ey + cell * 2.2, cell * 2.6, cell * 2.6, cell * 0.8); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(ex + e / 2, ey + e / 2, e / 2, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(ex + e / 2, ey + e / 2, e * 0.21, 0, Math.PI * 2); ctx.fill();
      }
    };
    drawEye(x + cell, y + cell);
    drawEye(x + sizePx - cell * 8, y + cell);
    drawEye(x + cell, y + sizePx - cell * 8);
  };

  const renderCanvas = async () => {
    if (!qr) return null; const cfg = exportSizes[size]; const c = document.createElement('canvas'); c.width = cfg.w; c.height = cfg.h; const ctx = c.getContext('2d'); if (!ctx) return null;
    const bg = { white: '#ffffff', mist: '#f8fafc', mint: '#f0fdf4', slate: '#f1f5f9' }[surfaceStyle];
    ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);
    const pad = Math.round(Math.min(c.width, c.height) * 0.06); const w = c.width - pad * 2; const h = c.height - pad * 2;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = frameStyle === 'accent' ? color : frameStyle === 'premium' ? '#cbd5e1' : '#e5e7eb'; ctx.lineWidth = frameStyle === 'none' ? 0 : frameStyle === 'premium' ? 4 : 2;
    const radius = frameStyle === 'soft' ? 24 : frameStyle === 'premium' ? 36 : 16;
    ctx.beginPath(); ctx.roundRect(pad, pad, w, h, radius); ctx.fill(); if (frameStyle !== 'none') ctx.stroke();
    const headerH = style === 'plain' ? 0 : Math.round(h * (density === 'cozy' ? 0.13 : density === 'airy' ? 0.2 : 0.16));
    if (style !== 'plain') { const g = ctx.createLinearGradient(pad, pad, c.width - pad, pad + 120); g.addColorStop(0, useGradient ? '#7b61ff' : color); g.addColorStop(1, useGradient ? '#5ce1e6' : '#111827'); ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(pad, pad, w, headerH, [radius, radius, 18, 18]); ctx.fill(); }
    const qs = Math.round(Math.min(c.width, c.height) * (density === 'cozy' ? 0.48 : density === 'airy' ? 0.38 : 0.44));
    const alignX = textAlign === 'left' ? pad + Math.round(w * 0.1) : c.width / 2;
    const qx = textAlign === 'left' ? pad + Math.round(w * 0.1) : (c.width - qs) / 2;
    const qy = style === 'plain' ? pad + Math.round(h * 0.2) : pad + headerH + Math.round(h * 0.12);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(qx - 18, qy - 18, qs + 36, qs + 36, 20); ctx.fill();
    await drawStyledQr(ctx, qx, qy, qs);
    const badgeSize = Math.round(qs * 0.22);
    if (badgeMode !== 'none') {
      const bx = qx + qs / 2; const by = qy + qs / 2;
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bx, by, badgeSize / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = color;
      if (badgeMode === 'emoji') { ctx.font = `${Math.round(badgeSize * 0.46)}px Inter`; ctx.textAlign = 'center'; ctx.fillText(badgeEmoji, bx, by + badgeSize * 0.13); }
      if (badgeMode === 'icon') { ctx.font = `700 ${Math.round(badgeSize * 0.42)}px Inter`; const map: Record<string,string> = { chat: '✆', phone: '☎', support: '?', calendar: '◷', shop: '🛍', location: '⌖' }; ctx.textAlign='center'; ctx.fillText(map[badgeIcon] || '✆', bx, by + badgeSize * 0.12);}
      if (badgeMode === 'logo' && badgeLogo) {
        try { const lg = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = badgeLogo; });
          ctx.save(); ctx.beginPath(); ctx.arc(bx, by, badgeSize * 0.34, 0, Math.PI * 2); ctx.clip();
          ctx.drawImage(lg, bx - badgeSize * 0.34, by - badgeSize * 0.34, badgeSize * 0.68, badgeSize * 0.68); ctx.restore();
        } catch {}
      }
    }
    if (style !== 'plain') { ctx.textAlign = textAlign; if (showTitle) { ctx.fillStyle = '#0f172a'; ctx.font = `700 ${Math.round(c.height * 0.04)}px Inter`; ctx.fillText(title, alignX, pad + Math.round(headerH * 1.45)); } if (showSubtitle) { ctx.fillStyle = '#475569'; ctx.font = `400 ${Math.round(c.height * 0.022)}px Inter`; ctx.fillText(subtitle, alignX, pad + Math.round(headerH * 1.8)); } }
    return c;
  };

  useEffect(() => {
    let active = true;
    (async () => {
      if (!valid || !qr) return setPreviewQr('');
      const c = document.createElement('canvas'); c.width = 520; c.height = 520; const ctx = c.getContext('2d'); if (!ctx) return;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 520, 520); await drawStyledQr(ctx, 40, 40, 440);
      if (active) setPreviewQr(c.toDataURL('image/png'));
    })();
    return () => { active = false; };
  }, [qr, moduleStyle, eyeStyle, color, valid, badgeMode, badgeIcon, badgeEmoji, badgeLogo]);

  const downloadBlob = (blob: Blob, filename: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href); };
  const exportPNG = async () => { if (!valid) return; const c = await renderCanvas(); if (!c) return setStatus('Could not export PNG.'); c.toBlob((blob) => { if (!blob) return setStatus('Could not export PNG.'); downloadBlob(blob, `zapora-${style}-${size}.png`); setStatus('PNG downloaded.'); }, 'image/png'); };
  const exportSVG = async () => { if (!valid || !previewQr) return; const cfg = exportSizes[size]; const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${cfg.w}' height='${cfg.h}'><rect width='100%' height='100%' fill='#f8fafc'/><image href='${previewQr}' x='${(cfg.w - 620) / 2}' y='${(cfg.h - 620) / 2}' width='620' height='620'/></svg>`; downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `zapora-${style}-${size}.svg`); setStatus('SVG downloaded.'); };
  const exportPDF = async () => { if (!valid) return; const c = await renderCanvas(); if (!c) return setStatus('Could not prepare PDF.'); const w = window.open('', '_blank'); if (!w) return setStatus('Please allow popups to export PDF.'); w.document.write(`<img src='${c.toDataURL('image/png')}' style='width:100%;max-width:900px;display:block;margin:auto'/>`); w.document.close(); w.print(); setStatus('PDF print dialog opened.'); };

  return <main className='min-h-screen bg-slate-950 bg-[radial-gradient(circle_at_20%_0%,rgba(16,185,129,0.18),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(99,102,241,0.2),transparent_35%)] py-8 sm:py-12'><div className='mx-auto max-w-7xl px-4 lg:px-6'><header className='mb-6 rounded-3xl border border-white/15 bg-white/[0.06] p-5 backdrop-blur sm:mb-8 sm:p-7'><p className='mb-2 inline-flex items-center rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200'>Zapora Studio</p><h1 className='text-2xl font-semibold tracking-tight text-white sm:text-4xl'>QR Code Editor</h1></header>
    <section className='grid gap-5 xl:grid-cols-[1.08fr_0.92fr]'><div className='rounded-3xl border border-slate-200/80 bg-white p-4 shadow-2xl shadow-slate-900/10 sm:p-6'><div className='mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5 sm:grid-cols-4'>{([{ id: 'content', label: 'Content' }, { id: 'appearance', label: 'Appearance' }, { id: 'branding', label: 'Branding' }, { id: 'library', label: 'Library' }] as { id: WorkspaceTab; label: string }[]).map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`${baseInteractive} border-0 px-3 py-2.5 text-sm ${tab === item.id ? 'bg-white text-slate-950 shadow-md shadow-emerald-100 ring-1 ring-emerald-200' : 'bg-transparent text-slate-600 hover:bg-white/80 hover:text-slate-900'}`}>{item.label}</button>)}</div>
      {tab === 'content' && <div className='space-y-3'><label className='block cursor-pointer rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/60 p-4 text-sm text-emerald-900 hover:bg-emerald-50'> <span className='mb-1 inline-flex items-center gap-2 font-semibold'><UploadCloud className='h-4 w-4' />Import QR</span><p className='text-xs text-emerald-800'>Upload QR image (PNG, JPG, WEBP) to rebuild in studio.</p><input type='file' accept='image/png,image/jpeg,image/jpg,image/webp' className='hidden' onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImportQr(f); }} /></label><input value={targetLink} onChange={(e) => setTargetLink(e.target.value)} className='w-full rounded-xl border border-slate-300 px-4 py-3 text-sm' placeholder='Paste your WhatsApp link or URL' /><textarea value={msg} onChange={(e) => setMsg(e.target.value)} className='w-full rounded-xl border border-slate-300 px-4 py-3 text-sm' rows={3} /></div>}
      {tab === 'appearance' && <div className='space-y-3'><div className='grid grid-cols-2 gap-2'>{(['square', 'rounded', 'dots', 'smooth'] as ModuleStyle[]).map((m) => <button key={m} onClick={() => setModuleStyle(m)} className={chipButton(moduleStyle === m)}><span className='mr-2 inline-block h-3 w-3 rounded-sm bg-slate-700' style={{ borderRadius: m === 'square' ? 0 : m === 'rounded' ? 3 : 9999 }} />{m}</button>)}</div><div className='grid grid-cols-3 gap-2'>{(['square', 'rounded', 'ring'] as EyeStyle[]).map((e) => <button key={e} onClick={() => setEyeStyle(e)} className={chipButton(eyeStyle === e)}>{e}</button>)}</div><div className='grid grid-cols-2 gap-2'>{(['none', 'soft', 'premium', 'accent'] as FrameStyle[]).map((f) => <button key={f} onClick={() => setFrameStyle(f)} className={chipButton(frameStyle === f)}>{f}</button>)}</div><div className='grid grid-cols-2 gap-2'>{(['white', 'mist', 'mint', 'slate'] as SurfaceStyle[]).map((s) => <button key={s} onClick={() => setSurfaceStyle(s)} className={chipButton(surfaceStyle === s)}>{s}</button>)}</div></div>}
      {tab === 'branding' && <div className='space-y-3'><div className='grid gap-2 sm:grid-cols-2'>{(Object.keys(themePacks) as ThemePack[]).map((k) => { const p = themePacks[k]; return <button key={k} onClick={() => applyTheme(k)} className={`rounded-xl border p-3 text-left ${theme === k ? `ring-2 ring-emerald-400 ${p.border} ${p.tint}` : 'border-slate-200'}`}><div className='mb-2 h-8 rounded-lg' style={{ backgroundImage: `linear-gradient(135deg,${p.preview[0]},${p.preview[1]})` }} /><p className='text-sm font-semibold'>{p.label}</p></button>; })}</div><div className='flex gap-2'><input value={title} onChange={(e) => setTitle(e.target.value)} className='w-full rounded-xl border border-slate-300 px-3 py-2' placeholder='Headline' /><input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className='w-full rounded-xl border border-slate-300 px-3 py-2' placeholder='Subtitle / CTA' /></div><div className='flex flex-wrap gap-2'><button onClick={() => setShowTitle((v) => !v)} className={chipButton(showTitle)}><Type className='mr-1 inline h-3 w-3' />Title</button><button onClick={() => setShowSubtitle((v) => !v)} className={chipButton(showSubtitle)}>Subtitle</button><button onClick={() => setTextAlign('left')} className={chipButton(textAlign === 'left')}>Left align</button><button onClick={() => setTextAlign('center')} className={chipButton(textAlign === 'center')}>Center align</button><button onClick={() => setDensity('cozy')} className={chipButton(density === 'cozy')}>Cozy</button><button onClick={() => setDensity('balanced')} className={chipButton(density === 'balanced')}>Balanced</button><button onClick={() => setDensity('airy')} className={chipButton(density === 'airy')}>Airy</button></div><section className='rounded-2xl border border-slate-200 p-3'><p className='mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500'>Center badge</p><div className='mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4'>{(['none','icon','emoji','logo'] as BadgeMode[]).map((m)=><button key={m} onClick={() => setBadgeMode(m)} className={chipButton(badgeMode===m)}>{m}</button>)}</div>{badgeMode==='icon' && <div className='grid grid-cols-3 gap-2'>{[{id:'chat',label:'Chat',icon:MessageCircle},{id:'phone',label:'Phone',icon:Phone},{id:'support',label:'Support',icon:Headset},{id:'calendar',label:'Book',icon:CalendarDays},{id:'shop',label:'Shop',icon:ShoppingBag},{id:'location',label:'Visit',icon:MapPin}].map((opt)=><button key={opt.id} onClick={() => setBadgeIcon(opt.id)} className={`${chipButton(badgeIcon===opt.id)} flex items-center gap-1`}><opt.icon className='h-3 w-3' />{opt.label}</button>)}</div>}{badgeMode==='emoji' && <div className='grid grid-cols-6 gap-2'>{['💬','❤️','⭐','📅','📍','🛍️'].map((emo)=><button key={emo} onClick={() => setBadgeEmoji(emo)} className={`${chipButton(badgeEmoji===emo)} text-lg`}>{emo}</button>)}</div>}{badgeMode==='logo' && <label className='mt-1 block cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-700 hover:bg-slate-100'>Upload logo (PNG/JPG/WEBP)<input type='file' accept='image/png,image/jpeg,image/jpg,image/webp' className='hidden' onChange={(e)=>{const f=e.target.files?.[0]; if(f) void handleLogoUpload(f);}} />{badgeUploadName && <span className='ml-1 font-medium text-slate-900'>{badgeUploadName}</span>}</label>}</section><div className='flex items-center gap-3'><input type='color' value={color} onChange={(e) => setColor(e.target.value)} className='h-10 w-10 rounded-md border border-slate-300' /><button onClick={() => setUseGradient((v) => !v)} className={chipButton(useGradient)}>{useGradient ? 'Gradient On' : 'Gradient Off'}</button></div></div>}
      {tab === 'library' && <div className='space-y-3'><div className='flex gap-2'><button onClick={copyDesignLink} className={chipButton(false)}>Copy design link</button><button onClick={saveTemplate} className={chipButton(false)}>Save template</button></div>{savedTemplates.map((t: any) => <button key={t.id} onClick={() => applyDesign(t)} className='block w-full rounded-xl border border-slate-200 p-2 text-left text-xs'>{t.name}</button>)}</div>}
      <p className='mt-4 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-900'>{status || 'Advanced styles are constrained for scan reliability.'}</p></div>
      <div className='space-y-4 xl:sticky xl:top-5 xl:self-start'><section className='rounded-3xl border border-white/20 bg-white/[0.08] p-4 shadow-2xl backdrop-blur sm:p-5'><div className='mb-4 flex items-center justify-between'><h2 className='inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-100'><LayoutTemplate className='h-4 w-4 text-emerald-300' />Live Canvas</h2><span className='rounded-full border border-emerald-300/40 bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-100'>{exportSizes[size].label}</span></div>{valid && previewQr ? <div className='grid min-h-[420px] place-items-center rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5'><div className='w-full max-w-md rounded-[1.75rem] border border-white/20 bg-white p-5 shadow-2xl' style={{ aspectRatio: `${exportSizes[size].w}/${exportSizes[size].h}`, maxHeight: '420px' }}><div className={`${style === 'plain' ? 'hidden' : ''} mb-4 rounded-2xl p-4 text-center text-white`} style={useGradient ? { backgroundImage: 'linear-gradient(135deg,#7b61ff,#b16cea,#5ce1e6)' } : { backgroundColor: color }}><p className='text-base font-semibold'>{showTitle ? title : ''}</p><p className='mt-1 text-xs opacity-90'>{showSubtitle ? subtitle : ''}</p></div><div className='mx-auto w-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-inner shadow-slate-300/50'><img src={previewQr} className='h-44 w-44 sm:h-52 sm:w-52' alt='preview' /></div></div></div> : <div className='flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/30 bg-white/5 text-center text-slate-100'><Sparkles className='mb-2 h-5 w-5 text-emerald-300' /><p className='font-semibold'>Start with a link to preview and export</p></div>}</section><section className='rounded-3xl border border-white/20 bg-white p-5 shadow-xl'><div className='mb-3 flex items-center gap-2 text-slate-800'><ImageDown className='h-4 w-4 text-emerald-700' /><h3 className='text-sm font-semibold uppercase tracking-wide text-slate-500'>Finalize & Export</h3></div><div className='mb-4 grid grid-cols-2 gap-2'>{(Object.keys(exportSizes) as ExportSizeId[]).map((k) => <button key={k} onClick={() => setSize(k)} className={`${chipButton(size === k)} text-left`}>{exportSizes[k].label}</button>)}</div><div className='grid grid-cols-3 gap-2'><button onClick={exportPNG} disabled={!valid} className={`${baseInteractive} border-transparent bg-gradient-to-r from-emerald-600 to-green-500 text-white`}>PNG</button><button onClick={exportSVG} disabled={!valid} className={chipButton(false)}>SVG</button><button onClick={exportPDF} disabled={!valid} className={chipButton(false)}>PDF</button></div></section></div></section></div></main>;
}

export { QR_EDITOR_STORAGE_KEY };
