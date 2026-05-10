import { useEffect, useMemo, useState } from 'react';
import { ImageDown, Sparkles } from 'lucide-react';

const QR_EDITOR_STORAGE_KEY = 'zapora_qr_editor_link';
const QR_EDITOR_RECENTS_KEY = 'zapora_qr_editor_recent_designs';
const QR_EDITOR_TEMPLATES_KEY = 'zapora_qr_editor_saved_templates';

type OutputStyle = 'plain' | 'whatsappCard';
type ExportSizeId = 'squarePost' | 'portraitPost' | 'story' | 'poster' | 'visitingCard';
type PanelTab = 'content' | 'templates' | 'style' | 'recent';
type ThemePack = 'zaporaClean' | 'minimalDark' | 'softGreen' | 'modernBlue' | 'boldPromo' | 'elegantBusiness';

const exportSizes = { squarePost: { label: 'Square Post', ratio: '1:1', w: 1200, h: 1200 }, portraitPost: { label: 'Portrait Post', ratio: '4:5', w: 1080, h: 1350 }, story: { label: 'Story', ratio: '9:16', w: 1080, h: 1920 }, poster: { label: 'Poster', ratio: '7:10', w: 1400, h: 2000 }, visitingCard: { label: 'Visiting Card', ratio: '7:4', w: 1400, h: 800 } } as const;
const messageTemplates = { general: 'Hi, I’d like to know more about your services.', support: 'Hi, I need help regarding your service/product.', booking: 'Hi, I’d like to book an appointment.', pricing: 'Hi, I’d like to get pricing details.', order: 'Hi, I’d like to place an order.', event: 'Hi, I want to register for your event.', collab: 'Hi, I’d like to discuss a possible collaboration.', freelance: 'Hi, I’d like to discuss a project with you.' } as const;
const themePacks: Record<ThemePack, { label: string; color: string; gradient: boolean; style: OutputStyle; tint: string; border: string; text: string }> = {
  zaporaClean: { label: 'Zapora Clean', color: '#111827', gradient: false, style: 'whatsappCard', tint: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800' },
  minimalDark: { label: 'Minimal Dark', color: '#111827', gradient: false, style: 'plain', tint: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-800' },
  softGreen: { label: 'Soft Green', color: '#166534', gradient: false, style: 'whatsappCard', tint: 'bg-green-50', border: 'border-green-200', text: 'text-green-800' },
  modernBlue: { label: 'Modern Blue', color: '#1d4ed8', gradient: false, style: 'whatsappCard', tint: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800' },
  boldPromo: { label: 'Bold Promo', color: '#7b61ff', gradient: true, style: 'whatsappCard', tint: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-800' },
  elegantBusiness: { label: 'Elegant Business', color: '#1f2937', gradient: true, style: 'whatsappCard', tint: 'bg-zinc-100', border: 'border-zinc-300', text: 'text-zinc-800' },
};

const baseInteractive = 'rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45';
const tabButton = (selected: boolean) => `${baseInteractive} rounded-full px-4 py-2.5 ${selected ? 'border-emerald-300 bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-sm' : 'border-emerald-100 bg-emerald-50/60 text-emerald-900 hover:border-emerald-300 hover:bg-white'}`;
const chipButton = (selected: boolean) => `${baseInteractive} ${selected ? 'border-emerald-300 bg-emerald-50 text-emerald-900 shadow-sm' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900'}`;

export default function QrCodeEditorPage() {
  const [tab, setTab] = useState<PanelTab>('content');
  const [targetLink, setTargetLink] = useState('');
  const [msg, setMsg] = useState(messageTemplates.general);
  const [title, setTitle] = useState('Connect with us on WhatsApp');
  const [subtitle, setSubtitle] = useState('Scan to start a professional conversation');
  const [style, setStyle] = useState<OutputStyle>('whatsappCard');
  const [size, setSize] = useState<ExportSizeId>('squarePost');
  const [color, setColor] = useState('#111827');
  const [useGradient, setUseGradient] = useState(false);
  const [theme, setTheme] = useState<ThemePack>('zaporaClean');
  const [recent, setRecent] = useState<any[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<any[]>([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const s = localStorage.getItem(QR_EDITOR_STORAGE_KEY); if (s) setTargetLink(s);
    const r = localStorage.getItem(QR_EDITOR_RECENTS_KEY); if (r) setRecent(JSON.parse(r));
    const t = localStorage.getItem(QR_EDITOR_TEMPLATES_KEY); if (t) setSavedTemplates(JSON.parse(t));
    const d = new URLSearchParams(window.location.search).get('design');
    if (d) { try { applyDesign(JSON.parse(atob(d)), false); } catch {} }
  }, []);
  useEffect(() => { localStorage.setItem(QR_EDITOR_RECENTS_KEY, JSON.stringify(recent.slice(0, 5))); }, [recent]);
  useEffect(() => { localStorage.setItem(QR_EDITOR_TEMPLATES_KEY, JSON.stringify(savedTemplates.slice(0, 5))); }, [savedTemplates]);

  const valid = useMemo(() => { try { return !!targetLink.trim() && Boolean(new URL(targetLink)); } catch { return false; } }, [targetLink]);
  const finalLink = useMemo(() => { if (!valid) return ''; const u = new URL(targetLink); if ((u.hostname.includes('wa.me') || u.hostname.includes('whatsapp')) && msg.trim()) u.searchParams.set('text', msg.trim()); return u.toString(); }, [valid, targetLink, msg]);
  const qr = finalLink ? `https://api.qrserver.com/v1/create-qr-code/?size=720x720&color=${color.replace('#', '')}&bgcolor=ffffff&data=${encodeURIComponent(finalLink)}` : '';

  const applyTheme = (next: ThemePack) => { const p = themePacks[next]; setTheme(next); setColor(p.color); setUseGradient(p.gradient); setStyle(p.style); };
  const applyDesign = (d: any, withStatus = true) => { if (d.targetLink) setTargetLink(d.targetLink); if (d.msg) setMsg(d.msg); if (d.title) setTitle(d.title); if (d.subtitle) setSubtitle(d.subtitle); if (d.style === 'plain' || d.style === 'whatsappCard') setStyle(d.style); if (d.size) setSize(d.size); if (d.color) setColor(d.color); if (typeof d.useGradient === 'boolean') setUseGradient(d.useGradient); if (d.theme) setTheme(d.theme); if (withStatus) setStatus('Design applied.'); };
  const copyDesignLink = () => { const state = { targetLink, msg, title, subtitle, style, size, color, useGradient, theme }; navigator.clipboard.writeText(`${window.location.origin}/qr-code-editor?design=${encodeURIComponent(btoa(JSON.stringify(state)))}`); setStatus('Design link copied.'); };
  const saveTemplate = () => { const t = { id: Date.now(), name: title.slice(0, 26) || 'Untitled template', targetLink, msg, title, subtitle, style, size, color, useGradient, theme }; setSavedTemplates((prev) => [t, ...prev].slice(0, 5)); setStatus('Template saved.'); };

  const renderCanvas = async () => {
    if (!qr) return null;
    const cfg = exportSizes[size];
    const c = document.createElement('canvas');
    c.width = cfg.w; c.height = cfg.h;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, c.width, c.height);
    const pad = Math.round(Math.min(c.width, c.height) * 0.06);
    const w = c.width - pad * 2; const h = c.height - pad * 2;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(pad, pad, w, h, 32); ctx.fill(); ctx.stroke();
    if (style !== 'plain') { const g = ctx.createLinearGradient(pad, pad, c.width - pad, pad + 120); g.addColorStop(0, useGradient ? '#7b61ff' : color); g.addColorStop(1, useGradient ? '#5ce1e6' : '#111827'); ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(pad, pad, w, Math.round(h * 0.16), [32, 32, 18, 18]); ctx.fill(); }
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.src = qr; i.onload = () => res(i); i.onerror = () => rej(); });
    const qs = Math.round(Math.min(c.width, c.height) * 0.44);
    const qx = (c.width - qs) / 2;
    const qy = style === 'plain' ? pad + Math.round(h * 0.22) : pad + Math.round(h * 0.30);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(qx - 18, qy - 18, qs + 36, qs + 36, 20); ctx.fill();
    ctx.drawImage(img, qx, qy, qs, qs);
    if (style !== 'plain') { ctx.textAlign = 'center'; ctx.fillStyle = '#0f172a'; ctx.font = `700 ${Math.round(c.height * 0.04)}px Inter`; ctx.fillText(title, c.width / 2, pad + Math.round(h * 0.20)); ctx.fillStyle = '#475569'; ctx.font = `400 ${Math.round(c.height * 0.022)}px Inter`; ctx.fillText(subtitle, c.width / 2, pad + Math.round(h * 0.25)); }
    return c;
  };

  const downloadBlob = (blob: Blob, filename: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href); };
  const exportPNG = async () => { if (!valid) return; const c = await renderCanvas(); if (!c) return setStatus('Could not export PNG.'); c.toBlob((blob) => { if (!blob) return setStatus('Could not export PNG.'); downloadBlob(blob, `zapora-${style}-${size}.png`); setStatus('PNG downloaded.'); }, 'image/png'); };
  const exportSVG = async () => { if (!valid || !qr) return; const cfg = exportSizes[size]; const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${cfg.w}' height='${cfg.h}'><rect width='100%' height='100%' fill='#f8fafc'/><rect x='60' y='60' rx='32' width='${cfg.w - 120}' height='${cfg.h - 120}' fill='white' stroke='#e5e7eb'/><image href='${qr}' x='${(cfg.w - 620) / 2}' y='${(cfg.h - 620) / 2}' width='620' height='620'/></svg>`; downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `zapora-${style}-${size}.svg`); setStatus('SVG downloaded.'); };
  const exportPDF = async () => { if (!valid) return; const c = await renderCanvas(); if (!c) return setStatus('Could not prepare PDF.'); const w = window.open('', '_blank'); if (!w) return setStatus('Please allow popups to export PDF.'); w.document.write(`<img src='${c.toDataURL('image/png')}' style='width:100%;max-width:900px;display:block;margin:auto'/>`); w.document.close(); w.print(); setStatus('PDF print dialog opened.'); };

  return <main className='bg-gradient-to-b from-white via-emerald-50/30 to-white py-10 sm:py-14'><div className='mx-auto max-w-7xl px-4'><header className='mb-8 text-center'><h1 className='text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl'>Zapora QR Design Studio</h1><p className='mx-auto mt-3 max-w-2xl text-sm text-gray-600 sm:text-base'>A polished workspace for composing message-ready, brand-safe QR assets that look professional on every surface.</p></header><section className='grid gap-6 xl:grid-cols-[1.05fr_0.95fr]'><div className='rounded-3xl border border-gray-200/80 bg-white p-4 shadow-sm sm:p-6'><div className='mb-5 flex flex-wrap gap-2'>{(['content', 'templates', 'style', 'recent'] as PanelTab[]).map((t) => <button key={t} onClick={() => setTab(t)} className={tabButton(tab === t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div>
    {tab === 'content' && <div className='space-y-5'><div><p className='mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500'>Destination</p><input value={targetLink} onChange={(e) => setTargetLink(e.target.value)} className='w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 shadow-sm transition focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20' placeholder='Paste your WhatsApp link or URL' /></div><div><p className='mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500'>Prefilled message</p><textarea value={msg} onChange={(e) => setMsg(e.target.value)} className='w-full rounded-xl border border-gray-300 px-4 py-3 text-sm shadow-sm transition focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20' rows={3} /></div><div className='flex flex-wrap gap-2'><button onClick={copyDesignLink} className={chipButton(false)}>Copy design link</button><button onClick={saveTemplate} className={chipButton(false)}>Save as template</button></div></div>}
    {tab === 'templates' && <div className='space-y-4'><div className='grid grid-cols-2 gap-2'>{Object.entries(messageTemplates).map(([k, v]) => <button key={k} onClick={() => setMsg(v)} className={chipButton(msg === v)}>{k}</button>)}</div><p className='pt-1 text-xs font-semibold uppercase tracking-wide text-gray-500'>Visual themes</p><div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>{(Object.keys(themePacks) as ThemePack[]).map((k) => <button key={k} onClick={() => applyTheme(k)} className={`${baseInteractive} ${theme === k ? `${themePacks[k].border} ${themePacks[k].tint} ${themePacks[k].text} shadow-sm` : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}>{themePacks[k].label}</button>)}</div></div>}
    {tab === 'style' && <div className='space-y-5'><div><p className='mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500'>Output mode</p><div className='grid grid-cols-2 gap-2'>{(['plain', 'whatsappCard'] as OutputStyle[]).map((s) => <button key={s} onClick={() => setStyle(s)} className={chipButton(style === s)}>{s === 'whatsappCard' ? 'WhatsAppCard' : 'Plain'}</button>)}</div></div><input value={title} onChange={(e) => setTitle(e.target.value)} className='w-full rounded-xl border border-gray-300 px-3 py-2 text-sm' placeholder='Headline' /><input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className='w-full rounded-xl border border-gray-300 px-3 py-2 text-sm' placeholder='Support line' /><div className='flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-3'><input type='color' value={color} onChange={(e) => setColor(e.target.value)} className='h-10 w-10 rounded-md border border-gray-200' /><button onClick={() => setUseGradient((v) => !v)} className={chipButton(useGradient)}>{useGradient ? 'Gradient on' : 'Gradient off'}</button></div></div>}
    {tab === 'recent' && <div className='space-y-3'><p className='text-xs font-semibold uppercase tracking-wide text-gray-500'>Saved templates</p>{savedTemplates.length === 0 ? <p className='rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500'>No templates yet.</p> : savedTemplates.map((t: any) => <div key={t.id} className='flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/70 p-2'><button onClick={() => applyDesign(t)} className='flex-1 rounded-lg px-2 py-1 text-left text-xs hover:bg-white'><p className='font-medium text-gray-900'>{t.name}</p><p className='text-gray-500'>{t.style} · {t.size}</p></button><button onClick={() => setSavedTemplates((prev) => prev.filter((x: any) => x.id !== t.id))} className={chipButton(false)}>Remove</button></div>)}</div>}
    <p className='mt-5 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700'>{status || 'Adjust settings to refine your output.'}</p></div>
  <div className='space-y-4 lg:sticky lg:top-6 lg:self-start'><div className='rounded-3xl border border-gray-200/80 bg-white p-5 shadow-sm'><div className='mb-4 flex items-center justify-between'><h2 className='text-sm font-semibold uppercase tracking-wide text-gray-500'>Live Canvas</h2><span className='rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700'>{exportSizes[size].label}</span></div>{valid && qr ? <div className='grid h-[460px] place-items-center rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-5'><div className='w-full max-w-md rounded-3xl border border-gray-200 bg-white p-5 shadow-xl' style={{ aspectRatio: `${exportSizes[size].w}/${exportSizes[size].h}`, maxHeight: '380px' }}><div className={`${style === 'plain' ? 'hidden' : ''} mb-4 rounded-2xl p-4 text-center text-white`} style={useGradient ? { backgroundImage: 'linear-gradient(135deg,#7b61ff,#b16cea,#5ce1e6)' } : { backgroundColor: color }}><p className='text-base font-semibold'>{title}</p><p className='mt-1 text-xs opacity-90'>{subtitle}</p></div><div className='mx-auto w-fit rounded-2xl border border-gray-200 bg-white p-4 shadow-inner'><img src={qr} className='h-44 w-44 sm:h-52 sm:w-52' alt='preview' /></div></div></div> : <div className='flex h-[460px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 text-center'><Sparkles className='mb-2 h-5 w-5 text-green-600' /><p className='font-semibold'>Start with a link to preview and export</p></div>}</div>
  <div className='rounded-3xl border border-gray-200/80 bg-white p-5 shadow-sm'><div className='mb-3 flex items-center gap-2 text-gray-800'><ImageDown className='h-4 w-4 text-green-700' /><h3 className='text-sm font-semibold uppercase tracking-wide text-gray-500'>Export output</h3></div><div className='mb-4 grid grid-cols-2 gap-2'>{(Object.keys(exportSizes) as ExportSizeId[]).map((k) => <button key={k} onClick={() => setSize(k)} className={chipButton(size === k)}>{exportSizes[k].label} <span className='ml-1 text-[10px] text-gray-500'>{exportSizes[k].ratio}</span></button>)}</div><div className='grid grid-cols-3 gap-2'><button onClick={exportPNG} disabled={!valid} className={`${baseInteractive} border-transparent bg-gray-900 text-white hover:bg-gray-800`}>PNG</button><button onClick={exportSVG} disabled={!valid} className={chipButton(false)}>SVG</button><button onClick={exportPDF} disabled={!valid} className={chipButton(false)}>PDF</button></div></div></div></section></div></main>;
}

export { QR_EDITOR_STORAGE_KEY };
