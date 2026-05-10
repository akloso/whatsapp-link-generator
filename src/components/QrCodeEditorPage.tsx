import { useEffect, useMemo, useState } from 'react';
import { ImageDown, LayoutTemplate, Palette, Sparkles } from 'lucide-react';

const QR_EDITOR_STORAGE_KEY = 'zapora_qr_editor_link';
const QR_EDITOR_RECENTS_KEY = 'zapora_qr_editor_recent_designs';
const QR_EDITOR_TEMPLATES_KEY = 'zapora_qr_editor_saved_templates';

type OutputStyle = 'plain' | 'whatsappCard';
type ExportSizeId = 'squarePost' | 'portraitPost' | 'story' | 'poster' | 'visitingCard';
type WorkspaceTab = 'content' | 'appearance' | 'branding' | 'library';
type ThemePack = 'zaporaClean' | 'minimalDark' | 'softGreen' | 'modernBlue' | 'boldPromo' | 'elegantBusiness';

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

  return <main className='min-h-screen bg-slate-950 bg-[radial-gradient(circle_at_20%_0%,rgba(16,185,129,0.18),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(99,102,241,0.2),transparent_35%)] py-8 sm:py-12'><div className='mx-auto max-w-7xl px-4 lg:px-6'><header className='mb-6 rounded-3xl border border-white/15 bg-white/[0.06] p-5 backdrop-blur sm:mb-8 sm:p-7'><p className='mb-2 inline-flex items-center rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200'>Zapora Studio</p><h1 className='text-2xl font-semibold tracking-tight text-white sm:text-4xl'>QR Code Editor</h1><p className='mt-3 max-w-3xl text-sm text-slate-200/90 sm:text-base'>Design on the left. Validate and export on the right. A structured workspace for premium QR assets that stay clear, branded, and scan-safe.</p></header>
    <section className='grid gap-5 xl:grid-cols-[1.08fr_0.92fr]'>
      <div className='rounded-3xl border border-slate-200/80 bg-white p-4 shadow-2xl shadow-slate-900/10 sm:p-6'>
        <div className='mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5 sm:grid-cols-4'>
          {([{ id: 'content', label: 'Content' }, { id: 'appearance', label: 'Appearance' }, { id: 'branding', label: 'Branding' }, { id: 'library', label: 'Library' }] as { id: WorkspaceTab; label: string }[]).map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`${baseInteractive} border-0 px-3 py-2.5 text-sm ${tab === item.id ? 'bg-white text-slate-950 shadow-md shadow-emerald-100 ring-1 ring-emerald-200' : 'bg-transparent text-slate-600 hover:bg-white/80 hover:text-slate-900'}`}>{item.label}</button>)}
        </div>

        <div className='space-y-4'>
          {tab === 'content' && <><section className='rounded-2xl border border-slate-200 p-4'><p className='mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500'>Destination link</p><input value={targetLink} onChange={(e) => setTargetLink(e.target.value)} className='w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20' placeholder='Paste your WhatsApp link or URL' /></section><section className='rounded-2xl border border-slate-200 p-4'><p className='mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500'>Prefilled message</p><textarea value={msg} onChange={(e) => setMsg(e.target.value)} className='w-full rounded-xl border border-slate-300 px-4 py-3 text-sm shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20' rows={3} /></section></>}

          {tab === 'appearance' && <><section className='rounded-2xl border border-slate-200 p-4'><p className='mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500'>Layout mode</p><div className='grid grid-cols-2 gap-2'>{(['plain', 'whatsappCard'] as OutputStyle[]).map((s) => <button key={s} onClick={() => setStyle(s)} className={chipButton(style === s)}>{s === 'whatsappCard' ? 'Branded Card' : 'Minimal Plain'}</button>)}</div></section><section className='rounded-2xl border border-slate-200 p-4'><p className='mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500'>Message templates</p><div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>{Object.entries(messageTemplates).map(([k, v]) => <button key={k} onClick={() => setMsg(v)} className={chipButton(msg === v)}>{k}</button>)}</div></section></>}

          {tab === 'branding' && <><section className='rounded-2xl border border-slate-200 p-4'><div className='mb-3 flex items-center gap-2 text-slate-900'><Palette className='h-4 w-4 text-emerald-600' /><p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>Theme packs</p></div><div className='grid gap-2 sm:grid-cols-2'>{(Object.keys(themePacks) as ThemePack[]).map((k) => { const p = themePacks[k]; return <button key={k} onClick={() => applyTheme(k)} className={`relative overflow-hidden rounded-xl border p-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${theme === k ? `ring-2 ring-emerald-400 ${p.border} ${p.tint} shadow-md` : 'border-slate-200 bg-white hover:-translate-y-[1px] hover:border-slate-300 hover:shadow-sm'}`}><div className='mb-2 h-8 rounded-lg' style={{ backgroundImage: `linear-gradient(135deg,${p.preview[0]},${p.preview[1]})` }} /><p className='text-sm font-semibold text-slate-900'>{p.label}</p><p className='text-xs text-slate-500'>{p.mood}</p></button>; })}</div></section><section className='rounded-2xl border border-slate-200 p-4'><p className='mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500'>Titles</p><input value={title} onChange={(e) => setTitle(e.target.value)} className='mb-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm' placeholder='Headline' /><input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className='w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm' placeholder='Support line' /></section><section className='flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4'><input type='color' value={color} onChange={(e) => setColor(e.target.value)} className='h-11 w-11 rounded-md border border-slate-300' /><button onClick={() => setUseGradient((v) => !v)} className={chipButton(useGradient)}>{useGradient ? 'Gradient Enabled' : 'Gradient Disabled'}</button></section></>}

          {tab === 'library' && <><section className='rounded-2xl border border-slate-200 p-4'><div className='mb-3 flex gap-2'><button onClick={copyDesignLink} className={chipButton(false)}>Copy design link</button><button onClick={saveTemplate} className={chipButton(false)}>Save template</button></div><p className='mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500'>Saved templates</p>{savedTemplates.length === 0 ? <p className='rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500'>No templates yet.</p> : savedTemplates.map((t: any) => <div key={t.id} className='mb-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2'><button onClick={() => applyDesign(t)} className='flex-1 rounded-lg px-2 py-1 text-left text-xs transition hover:bg-white'><p className='font-medium text-slate-900'>{t.name}</p><p className='text-slate-500'>{t.style} · {t.size}</p></button><button onClick={() => setSavedTemplates((prev) => prev.filter((x: any) => x.id !== t.id))} className={chipButton(false)}>Remove</button></div>)}</section></>}
        </div>

        <p className='mt-4 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-900'>{status || 'Use sections above to refine content, appearance, and brand treatment.'}</p>
      </div>

      <div className='space-y-4 xl:sticky xl:top-5 xl:self-start'>
        <section className='rounded-3xl border border-white/20 bg-white/[0.08] p-4 shadow-2xl backdrop-blur sm:p-5'>
          <div className='mb-4 flex items-center justify-between'><h2 className='inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-100'><LayoutTemplate className='h-4 w-4 text-emerald-300' />Live Canvas</h2><span className='rounded-full border border-emerald-300/40 bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-100'>{exportSizes[size].label}</span></div>
          {valid && qr ? <div className='grid min-h-[420px] place-items-center rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5'><div className='w-full max-w-md rounded-[1.75rem] border border-white/20 bg-white p-5 shadow-2xl' style={{ aspectRatio: `${exportSizes[size].w}/${exportSizes[size].h}`, maxHeight: '420px' }}><div className={`${style === 'plain' ? 'hidden' : ''} mb-4 rounded-2xl p-4 text-center text-white`} style={useGradient ? { backgroundImage: 'linear-gradient(135deg,#7b61ff,#b16cea,#5ce1e6)' } : { backgroundColor: color }}><p className='text-base font-semibold'>{title}</p><p className='mt-1 text-xs opacity-90'>{subtitle}</p></div><div className='mx-auto w-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-inner shadow-slate-300/50'><img src={qr} className='h-44 w-44 sm:h-52 sm:w-52' alt='preview' /></div></div></div> : <div className='flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/30 bg-white/5 text-center text-slate-100'><Sparkles className='mb-2 h-5 w-5 text-emerald-300' /><p className='font-semibold'>Start with a link to preview and export</p></div>}
        </section>

        <section className='rounded-3xl border border-white/20 bg-white p-5 shadow-xl'>
          <div className='mb-3 flex items-center gap-2 text-slate-800'><ImageDown className='h-4 w-4 text-emerald-700' /><h3 className='text-sm font-semibold uppercase tracking-wide text-slate-500'>Finalize & Export</h3></div>
          <div className='mb-4 grid grid-cols-2 gap-2'>{(Object.keys(exportSizes) as ExportSizeId[]).map((k) => <button key={k} onClick={() => setSize(k)} className={`${chipButton(size === k)} text-left`}><span>{exportSizes[k].label}</span><span className='ml-1 text-[10px] text-slate-500'>{exportSizes[k].ratio}</span></button>)}</div>
          <div className='grid grid-cols-3 gap-2'><button onClick={exportPNG} disabled={!valid} className={`${baseInteractive} border-transparent bg-gradient-to-r from-emerald-600 to-green-500 text-white hover:from-emerald-700 hover:to-green-600`}>PNG</button><button onClick={exportSVG} disabled={!valid} className={chipButton(false)}>SVG</button><button onClick={exportPDF} disabled={!valid} className={chipButton(false)}>PDF</button></div>
        </section>
      </div>
    </section></div></main>;
}

export { QR_EDITOR_STORAGE_KEY };
