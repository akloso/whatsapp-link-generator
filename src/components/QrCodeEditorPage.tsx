import { useEffect, useMemo, useState } from 'react';
import { Calendar, HelpCircle, History, ImageDown, MapPin, MessageCircle, Phone, ShoppingBag, Sparkles } from 'lucide-react';

const QR_EDITOR_STORAGE_KEY = 'zapora_qr_editor_link';
const QR_EDITOR_RECENTS_KEY = 'zapora_qr_editor_recent_designs';

type OutputStyle = 'plain' | 'whatsappCard' | 'posterCard';
type ExportSizeId = 'squarePost' | 'portraitPost' | 'story' | 'poster' | 'visitingCard';
type PanelTab = 'content' | 'templates' | 'style' | 'recent';
type CenterIcon = 'none' | 'whatsapp' | 'phone' | 'chat' | 'support' | 'calendar' | 'shop' | 'location' | 'emoji-wave' | 'emoji-star' | 'emoji-heart';

const exportSizes = { squarePost: { label: 'Square Post', ratio: '1:1', w: 1200, h: 1200 }, portraitPost: { label: 'Portrait Post', ratio: '4:5', w: 1080, h: 1350 }, story: { label: 'Story', ratio: '9:16', w: 1080, h: 1920 }, poster: { label: 'Poster', ratio: '7:10', w: 1400, h: 2000 }, visitingCard: { label: 'Visiting Card', ratio: '7:4', w: 1400, h: 800 } } as const;
const messageTemplates = { general: 'Hi, I’d like to know more about your services.', support: 'Hi, I need help regarding your service/product.', booking: 'Hi, I’d like to book an appointment.', pricing: 'Hi, I’d like to get pricing details.', order: 'Hi, I’d like to place an order.', event: 'Hi, I want to register for your event.', collab: 'Hi, I’d like to discuss a possible collaboration.', freelance: 'Hi, I’d like to discuss a project with you.' } as const;
const tones = { professional: ['Connect with us on WhatsApp', 'Scan to start a professional conversation'], friendly: ['Let’s chat on WhatsApp', 'We’re one message away'], sales: ['Message us for offers and pricing', 'Get a quick quote today'], support: ['Need help? Reach us on WhatsApp', 'Our support team is ready'], minimal: ['Chat on WhatsApp', 'Scan to message'] } as const;

const iconOptions: Array<{ id: CenterIcon; label: string }> = [
  { id: 'none', label: 'None' }, { id: 'whatsapp', label: 'WhatsApp' }, { id: 'phone', label: 'Phone' }, { id: 'chat', label: 'Chat' }, { id: 'support', label: 'Support' }, { id: 'calendar', label: 'Calendar' }, { id: 'shop', label: 'Shop' }, { id: 'location', label: 'Location' }, { id: 'emoji-wave', label: '👋' }, { id: 'emoji-star', label: '⭐' }, { id: 'emoji-heart', label: '❤️' },
];

export default function QrCodeEditorPage() {
  const [tab, setTab] = useState<PanelTab>('content');
  const [targetLink, setTargetLink] = useState('');
  const [msg, setMsg] = useState(messageTemplates.general);
  const [title, setTitle] = useState(tones.professional[0]);
  const [subtitle, setSubtitle] = useState(tones.professional[1]);
  const [style, setStyle] = useState<OutputStyle>('whatsappCard');
  const [size, setSize] = useState<ExportSizeId>('squarePost');
  const [color, setColor] = useState('#000000');
  const [useGradient, setUseGradient] = useState(false);
  const [centerIcon, setCenterIcon] = useState<CenterIcon>('none');
  const [recent, setRecent] = useState<any[]>([]);
  const [status, setStatus] = useState('');

  useEffect(() => { const s = localStorage.getItem(QR_EDITOR_STORAGE_KEY); if (s) setTargetLink(s); const r = localStorage.getItem(QR_EDITOR_RECENTS_KEY); if (r) setRecent(JSON.parse(r)); }, []);
  useEffect(() => { localStorage.setItem(QR_EDITOR_RECENTS_KEY, JSON.stringify(recent.slice(0, 5))); }, [recent]);

  const valid = useMemo(() => { try { return !!targetLink.trim() && Boolean(new URL(targetLink)); } catch { return false; } }, [targetLink]);
  const finalLink = useMemo(() => {
    if (!valid) return '';
    const u = new URL(targetLink);
    if ((u.hostname.includes('wa.me') || u.hostname.includes('whatsapp')) && msg.trim()) u.searchParams.set('text', msg.trim());
    return u.toString();
  }, [valid, targetLink, msg]);
  const qr = finalLink ? `https://api.qrserver.com/v1/create-qr-code/?size=720x720&color=${color.replace('#', '')}&bgcolor=ffffff&data=${encodeURIComponent(finalLink)}` : '';

  const drawCenterBadge = (ctx: CanvasRenderingContext2D, x: number, y: number, sizePx: number) => {
    if (centerIcon === 'none') return;
    const badge = Math.round(sizePx * 0.17); // scan-safe limit
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, badge, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#111827'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `600 ${Math.round(badge * 0.75)}px Inter`;
    const emojiMap: Record<string, string> = { 'emoji-wave': '👋', 'emoji-star': '⭐', 'emoji-heart': '❤️' };
    if (emojiMap[centerIcon]) { ctx.fillText(emojiMap[centerIcon], x, y + 1); return; }
    const glyphMap: Record<string, string> = { whatsapp: 'W', phone: '☎', chat: '💬', support: '?', calendar: '📅', shop: '🛍', location: '⌖' };
    ctx.fillText(glyphMap[centerIcon] ?? 'W', x, y + 1);
  };

  const renderCanvas = async () => {
    const cfg = exportSizes[size];
    const c = document.createElement('canvas'); c.width = cfg.w; c.height = cfg.h; const ctx = c.getContext('2d'); if (!ctx || !qr) return null;
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, c.width, c.height);
    const pad = Math.round(Math.min(c.width, c.height) * 0.06); const w = c.width - pad * 2; const h = c.height - pad * 2;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(pad, pad, w, h, 32); ctx.fill(); ctx.stroke();
    if (style !== 'plain') { const g = ctx.createLinearGradient(pad, pad, c.width - pad, pad + 120); g.addColorStop(0, useGradient ? '#7b61ff' : color); g.addColorStop(1, useGradient ? '#5ce1e6' : '#111827'); ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(pad, pad, w, Math.round(h * 0.14), [32, 32, 18, 18]); ctx.fill(); }
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.src = qr; i.onload = () => res(i); i.onerror = () => rej(); });
    const qs = Math.round(Math.min(c.width, c.height) * (style === 'posterCard' ? 0.46 : 0.42)); const qx = (c.width - qs) / 2; const qy = style === 'plain' ? pad + Math.round(h * 0.24) : pad + Math.round(h * 0.32);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(qx - 18, qy - 18, qs + 36, qs + 36, 20); ctx.fill(); ctx.drawImage(img, qx, qy, qs, qs);
    drawCenterBadge(ctx, qx + qs / 2, qy + qs / 2, qs);
    if (style !== 'plain') { ctx.textAlign = 'center'; ctx.fillStyle = '#0f172a'; ctx.font = `700 ${Math.round(c.height * 0.04)}px Inter`; ctx.fillText(title, c.width / 2, pad + Math.round(h * 0.18)); ctx.fillStyle = '#475569'; ctx.font = `400 ${Math.round(c.height * 0.022)}px Inter`; ctx.fillText(subtitle, c.width / 2, pad + Math.round(h * 0.23)); }
    return c;
  };

  const decodeQrImage = async (file: File) => {
    try {
      if (!('BarcodeDetector' in window)) { setStatus('QR import is not supported in this browser yet.'); return; }
      const bitmap = await createImageBitmap(file);
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      const barcodes = await detector.detect(bitmap);
      if (!barcodes.length || !barcodes[0].rawValue) { setStatus('We couldn’t read this QR. Try a clearer image or a standard QR code.'); return; }
      setTargetLink(barcodes[0].rawValue);
      setStatus('QR imported successfully. You can now customize and export it.');
      setTab('content');
    } catch {
      setStatus('We couldn’t read this QR. Try a clearer image or a standard QR code.');
    }
  };

  const exportPNG = async () => { const c = await renderCanvas(); if (!c) return; const a = document.createElement('a'); a.download = `zapora-${style}-${size}.png`; a.href = c.toDataURL('image/png'); a.click(); setStatus('PNG downloaded'); };
  const exportSVG = async () => { const cfg = exportSizes[size]; if (!qr) return; const badge = centerIcon === 'none' ? '' : `<circle cx='50%' cy='50%' r='42' fill='white' stroke='#e5e7eb'/><text x='50%' y='50%' text-anchor='middle' dominant-baseline='middle' font-size='28'>${centerIcon.startsWith('emoji') ? (centerIcon === 'emoji-wave' ? '👋' : centerIcon === 'emoji-star' ? '⭐' : '❤️') : 'W'}</text>`; const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${cfg.w}' height='${cfg.h}'><rect width='100%' height='100%' fill='#f8fafc'/><rect x='60' y='60' rx='32' width='${cfg.w - 120}' height='${cfg.h - 120}' fill='white' stroke='#e5e7eb'/><image href='${qr}' x='${(cfg.w - 620) / 2}' y='${(cfg.h - 620) / 2}' width='620' height='620'/>${badge}</svg>`; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); a.download = `zapora-${style}-${size}.svg`; a.click(); setStatus('SVG exported'); };
  const exportPDF = async () => { const c = await renderCanvas(); if (!c) return; const w = window.open('', '_blank'); if (!w) return; w.document.write(`<img src='${c.toDataURL('image/png')}' style='width:100%;max-width:900px;display:block;margin:auto'/>`); w.document.close(); w.print(); setStatus('PDF print dialog opened'); };

  return <main className='bg-gradient-to-b from-white via-green-50/30 to-white py-14'><div className='mx-auto max-w-7xl px-4'><header className='mb-8 text-center'><h1 className='text-3xl font-bold text-gray-950 sm:text-4xl'>Zapora QR Design Studio</h1><p className='mt-2 text-gray-600'>Import, rebuild, style, and export premium QR assets.</p></header><section className='grid gap-6 lg:grid-cols-[1.1fr_0.9fr]'><div className='rounded-3xl border border-gray-200 bg-white p-4 sm:p-6'><div className='mb-4 flex flex-wrap gap-2'>{(['content', 'templates', 'style', 'recent'] as PanelTab[]).map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-2 text-sm font-medium ${tab === t ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div>
  {tab==='content'&&<div className='space-y-4'><input value={targetLink} onChange={(e)=>setTargetLink(e.target.value)} className='w-full rounded-xl border border-gray-300 px-4 py-3' placeholder='Paste your WhatsApp link or URL'/><label className='block rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm font-medium text-gray-700 hover:bg-gray-100'>Upload existing QR<input type='file' accept='image/png,image/jpeg,image/jpg,image/webp' className='hidden' onChange={(e)=>{const f=e.target.files?.[0]; if(f) decodeQrImage(f);}}/><p className='mt-1 text-xs text-gray-500'>Import QR image to decode and rebuild in Zapora</p></label><textarea value={msg} onChange={(e)=>setMsg(e.target.value)} className='w-full rounded-xl border border-gray-300 px-4 py-3' rows={3}/></div>}
  {tab==='templates'&&<div className='space-y-3'><div className='grid grid-cols-2 gap-2'>{Object.entries(messageTemplates).map(([k,v])=><button key={k} onClick={()=>setMsg(v)} className='rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-left text-sm'>{k}</button>)}</div><div className='grid grid-cols-2 gap-2 sm:grid-cols-5'>{Object.entries(tones).map(([k,v])=><button key={k} onClick={()=>{setTitle(v[0]);setSubtitle(v[1]);}} className='rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm'>{k}</button>)}</div></div>}
  {tab==='style'&&<div className='space-y-4'><div className='grid grid-cols-3 gap-2'>{(['plain','whatsappCard','posterCard'] as OutputStyle[]).map((s)=><button key={s} onClick={()=>setStyle(s)} className={`rounded-xl border px-3 py-2 text-sm ${style===s?'border-gray-900 bg-gray-900 text-white':'border-gray-300'}`}>{s}</button>)}</div><input value={title} onChange={(e)=>setTitle(e.target.value)} className='w-full rounded-xl border border-gray-300 px-3 py-2'/><input value={subtitle} onChange={(e)=>setSubtitle(e.target.value)} className='w-full rounded-xl border border-gray-300 px-3 py-2'/><div className='flex items-center gap-3'><input type='color' value={color} onChange={(e)=>setColor(e.target.value)}/><button onClick={()=>setUseGradient(v=>!v)} className='rounded-xl border border-gray-300 px-3 py-2 text-sm'>{useGradient?'Gradient On':'Gradient Off'}</button></div><div><p className='mb-2 text-sm font-semibold text-gray-800'>Center icon / emoji</p><div className='grid grid-cols-4 gap-2 sm:grid-cols-6'>{iconOptions.map((opt)=><button key={opt.id} onClick={()=>setCenterIcon(opt.id)} className={`rounded-xl border px-2 py-2 text-xs ${centerIcon===opt.id?'border-gray-900 bg-gray-900 text-white':'border-gray-300 bg-white'}`}>{opt.id==='whatsapp'?<MessageCircle className='mx-auto h-4 w-4'/>:opt.id==='phone'?<Phone className='mx-auto h-4 w-4'/>:opt.id==='chat'?<MessageCircle className='mx-auto h-4 w-4'/>:opt.id==='support'?<HelpCircle className='mx-auto h-4 w-4'/>:opt.id==='calendar'?<Calendar className='mx-auto h-4 w-4'/>:opt.id==='shop'?<ShoppingBag className='mx-auto h-4 w-4'/>:opt.id==='location'?<MapPin className='mx-auto h-4 w-4'/>:opt.label}</button>)}</div><p className='mt-1 text-xs text-gray-500'>Badge size is constrained for scan-safety.</p></div></div>}
  {tab==='recent'&&<div className='space-y-2'>{recent.length===0?<p className='text-sm text-gray-500'>No recent designs yet.</p>:recent.map((r:any)=><button key={r.id} onClick={()=>{setTargetLink(r.link); setTitle(r.title); setSubtitle(r.subtitle); setStyle(r.style); setSize(r.size);}} className='w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-left text-xs'><p className='truncate font-medium'>{r.title}</p><p className='truncate text-gray-500'>{r.link}</p></button>)}</div>}
  <p className='mt-4 text-sm text-gray-600'>{status}</p></div>
  <div className='space-y-4 lg:sticky lg:top-6 lg:self-start'><div className='rounded-3xl border border-gray-200 bg-white p-5 shadow-inner'><h2 className='text-sm font-semibold uppercase tracking-wide text-gray-500'>Live Preview</h2>{valid&&qr?<div className='mt-4 grid min-h-[420px] place-items-center rounded-2xl border border-dashed border-gray-300 bg-white p-4'><div className='relative w-full max-w-md rounded-3xl border border-gray-200 bg-white p-4 shadow-lg' style={{aspectRatio:`${exportSizes[size].w}/${exportSizes[size].h}`}}><div className={`${style==='plain'?'hidden':''} mb-3 rounded-2xl p-3 text-center text-white`} style={useGradient?{backgroundImage:'linear-gradient(135deg, #7b61ff, #b16cea, #5ce1e6)'}:{backgroundColor:color}}><p className='text-sm font-semibold sm:text-base'>{title}</p><p className='text-xs opacity-90'>{subtitle}</p></div><div className='mx-auto w-fit rounded-2xl border border-gray-200 bg-white p-3'><div className='relative'><img src={qr} className='h-44 w-44 sm:h-56 sm:w-56' alt='preview'/>{centerIcon!=='none'&&<div className='absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-gray-200 bg-white text-base shadow-sm'>{centerIcon==='whatsapp'?<MessageCircle className='h-5 w-5'/>:centerIcon==='phone'?<Phone className='h-5 w-5'/>:centerIcon==='chat'?<MessageCircle className='h-5 w-5'/>:centerIcon==='support'?<HelpCircle className='h-5 w-5'/>:centerIcon==='calendar'?<Calendar className='h-5 w-5'/>:centerIcon==='shop'?<ShoppingBag className='h-5 w-5'/>:centerIcon==='location'?<MapPin className='h-5 w-5'/>:centerIcon==='emoji-wave'?'👋':centerIcon==='emoji-star'?'⭐':'❤️'}</div>}</div></div></div></div>:<div className='mt-4 flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white text-center'><Sparkles className='mb-2 h-5 w-5 text-green-600'/><p className='font-semibold'>Start with a link or import QR</p></div>}</div>
  <div className='rounded-3xl border border-gray-200 bg-white p-5'><h3 className='mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500'>Export</h3><div className='mb-3 grid grid-cols-2 gap-2'>{(Object.keys(exportSizes) as ExportSizeId[]).map((k)=><button key={k} onClick={()=>setSize(k)} className={`rounded-xl border px-2 py-2 text-xs ${size===k?'border-gray-900 bg-gray-900 text-white':'border-gray-300 bg-gray-50'}`}>{exportSizes[k].label} <span className='text-[10px] opacity-70'>{exportSizes[k].ratio}</span></button>)}</div><div className='grid grid-cols-3 gap-2'><button onClick={exportPNG} disabled={!valid} className='rounded-xl bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60'>PNG</button><button onClick={exportSVG} disabled={!valid} className='rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm'>SVG</button><button onClick={exportPDF} disabled={!valid} className='rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm'>PDF</button></div></div></div></section></div></main>;
}

export { QR_EDITOR_STORAGE_KEY };
