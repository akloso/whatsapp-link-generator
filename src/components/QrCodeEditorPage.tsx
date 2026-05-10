import { useEffect, useMemo, useState } from 'react';
import { History, ImageDown, Sparkles } from 'lucide-react';

const QR_EDITOR_STORAGE_KEY = 'zapora_qr_editor_link';
const QR_EDITOR_RECENTS_KEY = 'zapora_qr_editor_recent_designs';

type OutputStyle = 'plain' | 'whatsappCard' | 'posterCard';
type ColorMode = 'solid' | 'gradient' | 'custom';
type ExportSizeId = 'squareSocial' | 'storyVertical' | 'poster' | 'visitingCard';
type UseCaseId = 'businessContact' | 'customerSupport' | 'restaurantCafe' | 'retailStore' | 'freelancerPortfolio' | 'eventsRegistration';
type ToneId = 'professional' | 'friendly' | 'sales' | 'support' | 'minimal';
type MessageTemplateId = 'generalInquiry' | 'customerSupport' | 'bookingAppointment' | 'pricingQuote' | 'orderPurchase' | 'eventRegistration' | 'collaboration' | 'freelanceProject';
type PosterPresetId = 'cleanBusiness' | 'softModern' | 'boldPromo' | 'minimalContact' | 'eventStyle';

type RecentDesign = { id: string; link: string; outputStyle: OutputStyle; titleText: string; subtitleText: string; colorMode: ColorMode; selectedSolidId: string; selectedGradientId: string; customColor: string; exportSizeId: ExportSizeId; posterPreset: PosterPresetId };

const messageTemplates: Record<MessageTemplateId, { label: string; text: string }> = {
  generalInquiry: { label: 'General Inquiry', text: 'Hi, I’d like to know more about your services.' },
  customerSupport: { label: 'Customer Support', text: 'Hi, I need help regarding your service/product.' },
  bookingAppointment: { label: 'Booking / Appointment', text: 'Hi, I’d like to book an appointment.' },
  pricingQuote: { label: 'Pricing / Quote Request', text: 'Hi, I’d like to get pricing details.' },
  orderPurchase: { label: 'Order / Purchase', text: 'Hi, I’d like to place an order.' },
  eventRegistration: { label: 'Event Registration', text: 'Hi, I want to register for your event.' },
  collaboration: { label: 'Collaboration / Business Inquiry', text: 'Hi, I’d like to discuss a possible collaboration.' },
  freelanceProject: { label: 'Freelance / Project Inquiry', text: 'Hi, I’d like to discuss a project with you.' },
};

const toneTemplates: Record<ToneId, { label: string; title: string; subtitle: string }> = {
  professional: { label: 'Professional', title: 'Connect with us on WhatsApp', subtitle: 'Scan to start a professional conversation' },
  friendly: { label: 'Friendly', title: 'Let’s chat on WhatsApp', subtitle: 'We’re just one message away' },
  sales: { label: 'Sales', title: 'Message us for offers and pricing', subtitle: 'Get the best option for your needs' },
  support: { label: 'Support', title: 'Need help? Reach us on WhatsApp', subtitle: 'Our support team is ready to assist' },
  minimal: { label: 'Minimal', title: 'Chat on WhatsApp', subtitle: 'Scan to message' },
};

const posterPresets: Record<PosterPresetId, { label: string; shellClass: string }> = {
  cleanBusiness: { label: 'Clean Business', shellClass: 'bg-white border-gray-200' },
  softModern: { label: 'Soft Modern', shellClass: 'bg-slate-50 border-slate-200' },
  boldPromo: { label: 'Bold Promo', shellClass: 'bg-gray-900 border-gray-800' },
  minimalContact: { label: 'Minimal Contact', shellClass: 'bg-white border-gray-100' },
  eventStyle: { label: 'Event Style', shellClass: 'bg-indigo-50 border-indigo-200' },
};

const solidPresets = [{ id: 'black', color: '#000000' }, { id: 'slate', color: '#1f2937' }, { id: 'ink', color: '#0f172a' }, { id: 'forest', color: '#14532d' }, { id: 'navy', color: '#1e3a8a' }, { id: 'mocha', color: '#4b3a2f' }] as const;
const gradientPresets = [{ id: 'aurora-purple', swatch: 'linear-gradient(135deg, #7b61ff, #b16cea, #5ce1e6)', fallbackColor: '#7f72e3' }, { id: 'sunset-candy', swatch: 'linear-gradient(90deg, #ff6ec7, #ffb86c)', fallbackColor: '#de7ea2' }, { id: 'ocean-cyan', swatch: 'linear-gradient(135deg, #00c6ff, #0072ff)', fallbackColor: '#1e8ae6' }, { id: 'lime-energy', swatch: 'linear-gradient(135deg, #bfff00, #00d9a6)', fallbackColor: '#3fbb7f' }, { id: 'royal-dark-mode', swatch: 'linear-gradient(135deg, #141e30, #243b55, #6a11cb)', fallbackColor: '#3a3d7d' }] as const;
const useCasePresets: Record<UseCaseId, { label: string; outputStyle: OutputStyle; exportSizeId: ExportSizeId }> = { businessContact: { label: 'Business Contact', outputStyle: 'whatsappCard', exportSizeId: 'squareSocial' }, customerSupport: { label: 'Customer Support', outputStyle: 'whatsappCard', exportSizeId: 'visitingCard' }, restaurantCafe: { label: 'Restaurant / Cafe', outputStyle: 'posterCard', exportSizeId: 'poster' }, retailStore: { label: 'Retail Store', outputStyle: 'posterCard', exportSizeId: 'storyVertical' }, freelancerPortfolio: { label: 'Freelancer / Portfolio', outputStyle: 'whatsappCard', exportSizeId: 'squareSocial' }, eventsRegistration: { label: 'Events / Registration', outputStyle: 'posterCard', exportSizeId: 'storyVertical' } };
const exportSizePresets: Record<ExportSizeId, { label: string; width: number; height: number }> = { squareSocial: { label: 'Square Social', width: 1200, height: 1200 }, storyVertical: { label: 'Story / Vertical', width: 1080, height: 1920 }, poster: { label: 'Poster', width: 1400, height: 2000 }, visitingCard: { label: 'Visiting Card', width: 1400, height: 800 } };
const isValidUrl = (v: string) => { try { return !!v.trim() && Boolean(new URL(v)); } catch { return false; } };

export default function QrCodeEditorPage() {
  const [targetLink, setTargetLink] = useState(''); const [messageTemplate, setMessageTemplate] = useState<MessageTemplateId>('generalInquiry'); const [messageText, setMessageText] = useState(messageTemplates.generalInquiry.text);
  const [toneId, setToneId] = useState<ToneId>('professional'); const [activeUseCase, setActiveUseCase] = useState<UseCaseId>('businessContact');
  const [colorMode, setColorMode] = useState<ColorMode>('solid'); const [selectedSolidId, setSelectedSolidId] = useState('black'); const [selectedGradientId, setSelectedGradientId] = useState('aurora-purple'); const [customColor, setCustomColor] = useState('#000000');
  const [outputStyle, setOutputStyle] = useState<OutputStyle>('plain'); const [exportSizeId, setExportSizeId] = useState<ExportSizeId>('squareSocial'); const [posterPreset, setPosterPreset] = useState<PosterPresetId>('cleanBusiness');
  const [titleText, setTitleText] = useState(toneTemplates.professional.title); const [subtitleText, setSubtitleText] = useState(toneTemplates.professional.subtitle);
  const [recentDesigns, setRecentDesigns] = useState<RecentDesign[]>([]); const [downloadState, setDownloadState] = useState<'idle'|'success'|'error'>('idle');

  useEffect(() => { const s = localStorage.getItem(QR_EDITOR_STORAGE_KEY); if (s) setTargetLink(s); const r = localStorage.getItem(QR_EDITOR_RECENTS_KEY); if (r) try { setRecentDesigns(JSON.parse(r)); } catch {} }, []);
  useEffect(() => { localStorage.setItem(QR_EDITOR_RECENTS_KEY, JSON.stringify(recentDesigns.slice(0, 5))); }, [recentDesigns]);

  const hasValidLink = useMemo(() => isValidUrl(targetLink), [targetLink]);
  const selectedGradient = useMemo(() => gradientPresets.find((preset) => preset.id === selectedGradientId) ?? gradientPresets[0], [selectedGradientId]);
  const selectedSolid = useMemo(() => solidPresets.find((preset) => preset.id === selectedSolidId) ?? solidPresets[0], [selectedSolidId]);
  const exportSize = exportSizePresets[exportSizeId];
  const qrForegroundColor = colorMode === 'custom' ? customColor : colorMode === 'gradient' ? selectedGradient.fallbackColor : selectedSolid.color;
  const finalLink = useMemo(() => {
    if (!hasValidLink) return '';
    const url = new URL(targetLink.trim());
    if ((url.hostname.includes('wa.me') || url.hostname.includes('whatsapp')) && messageText.trim()) url.searchParams.set('text', messageText.trim());
    return url.toString();
  }, [hasValidLink, targetLink, messageText]);
  const qrImageUrl = finalLink ? `https://api.qrserver.com/v1/create-qr-code/?size=640x640&color=${qrForegroundColor.replace('#', '')}&bgcolor=ffffff&data=${encodeURIComponent(finalLink)}` : '';

  const applySmartDefaults = (nextUseCase = activeUseCase, nextTone = toneId, nextStyle = outputStyle) => {
    const tone = toneTemplates[nextTone];
    let title = tone.title; let subtitle = tone.subtitle;
    if (nextUseCase === 'customerSupport' && nextTone === 'support') { title = 'Need help? Message our support team'; subtitle = 'Fast support for your questions'; }
    if (nextUseCase === 'freelancerPortfolio' && nextTone === 'professional') { title = 'Let’s discuss your project'; subtitle = 'Scan to connect professionally on WhatsApp'; }
    if (nextUseCase === 'eventsRegistration' && nextTone === 'friendly' && nextStyle === 'posterCard') { title = 'Join us at the event'; subtitle = 'Scan to register and get event details'; }
    setTitleText(title); setSubtitleText(subtitle);
  };

  const applyUseCasePreset = (id: UseCaseId) => { const p = useCasePresets[id]; setActiveUseCase(id); setOutputStyle(p.outputStyle); setExportSizeId(p.exportSizeId); applySmartDefaults(id, toneId, p.outputStyle); };
  const applyTone = (tone: ToneId) => { setToneId(tone); applySmartDefaults(activeUseCase, tone, outputStyle); };
  const applyMessageTemplate = (id: MessageTemplateId) => { setMessageTemplate(id); setMessageText(messageTemplates[id].text); };

  const downloadPng = async () => {
    if (!qrImageUrl) return;
    try {
      const c = document.createElement('canvas'); c.width = exportSize.width; c.height = exportSize.height; const ctx = c.getContext('2d'); if (!ctx) return;
      ctx.fillStyle = '#f7f7fb'; ctx.fillRect(0,0,c.width,c.height);
      const pad = Math.round(Math.min(c.width,c.height)*0.07); const x=pad,y=pad,w=c.width-pad*2,h=c.height-pad*2;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x,y,w,h,34); ctx.fill(); ctx.stroke();
      if (outputStyle !== 'plain') { const grad = ctx.createLinearGradient(x,y,x+w,y+100); if (colorMode==='gradient'){grad.addColorStop(0,'#7b61ff');grad.addColorStop(0.5,'#b16cea');grad.addColorStop(1,'#5ce1e6');} else {grad.addColorStop(0,qrForegroundColor);grad.addColorStop(1,'#111827');} ctx.fillStyle=grad; ctx.beginPath(); ctx.roundRect(x,y,w,Math.round(h*0.13),[34,34,18,18]); ctx.fill(); }
      const qr = await new Promise<HTMLImageElement>((res,rej)=>{ const i=new Image(); i.crossOrigin='anonymous'; i.src=qrImageUrl; i.onload=()=>res(i); i.onerror=()=>rej(); });
      const q=Math.round(Math.min(w,h)*(outputStyle==='posterCard'?0.5:0.44)); const qx=(c.width-q)/2; const qy=outputStyle==='plain'?y+Math.round(h*0.2):y+Math.round(h*0.31);
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.roundRect(qx-20,qy-20,q+40,q+40,20); ctx.fill(); ctx.drawImage(qr,qx,qy,q,q);
      if(outputStyle!=='plain'){ctx.textAlign='center';ctx.fillStyle=posterPreset==='boldPromo'?'#f8fafc':'#0f172a';ctx.font=`700 ${Math.round(c.height*0.04)}px Inter`;ctx.fillText(titleText,c.width/2,y+Math.round(h*0.16));ctx.fillStyle=posterPreset==='boldPromo'?'#cbd5e1':'#475569';ctx.font=`400 ${Math.round(c.height*0.022)}px Inter`;ctx.fillText(subtitleText,c.width/2,y+Math.round(h*0.21));}
      const download = document.createElement('a');
      const stylePart = outputStyle === 'posterCard' ? `poster-${posterPreset}` : outputStyle === 'whatsappCard' ? 'whatsapp-card' : 'plain-qr';
      download.download = `zapora-${stylePart}-${exportSizeId}.png`; download.href = c.toDataURL('image/png'); download.click();
      setRecentDesigns((prev)=>[{id:`${Date.now()}`,link:targetLink,outputStyle,titleText,subtitleText,colorMode,selectedSolidId,selectedGradientId,customColor,exportSizeId,posterPreset},...prev].slice(0,5));
      setDownloadState('success'); setTimeout(()=>setDownloadState('idle'),1800);
    } catch { setDownloadState('error'); setTimeout(()=>setDownloadState('idle'),2000); }
  };

  return <main className="relative overflow-hidden bg-gradient-to-b from-white via-gray-50 to-white py-14 sm:py-16"><div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"><header className="mb-8 text-center sm:mb-10"><h1 className="text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">Advanced QR Design Studio</h1><p className="mx-auto mt-3 max-w-2xl text-base text-gray-600 sm:text-lg">Smarter messaging, branded posters, and conversion-focused WhatsApp QR assets.</p></header>
  <section className="grid grid-cols-1 gap-6 rounded-[28px] border border-gray-200 bg-white p-4 shadow-[0_20px_70px_-30px_rgba(0,0,0,0.22)] sm:p-6 lg:grid-cols-2 lg:gap-8"><div className="space-y-4">
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4"><p className="mb-2 text-sm font-semibold">Quick Start</p><div className="flex flex-wrap gap-2">{(['businessContact','customerSupport','eventsRegistration','freelancerPortfolio','restaurantCafe'] as UseCaseId[]).map((id)=><button key={id} onClick={()=>applyUseCasePreset(id)} className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs">{useCasePresets[id].label.split(' / ')[0]}</button>)}</div></div>
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4"><p className="mb-2 text-sm font-semibold">Link</p><input type="url" value={targetLink} onChange={(e)=>setTargetLink(e.target.value)} placeholder="Paste your WhatsApp link or URL" className="w-full rounded-xl border border-gray-300 px-4 py-3" /></div>
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4"><p className="mb-2 text-sm font-semibold">Message Template</p><select value={messageTemplate} onChange={(e)=>applyMessageTemplate(e.target.value as MessageTemplateId)} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm">{Object.entries(messageTemplates).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select><textarea value={messageText} onChange={(e)=>setMessageText(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" rows={3} /></div>
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4"><p className="mb-2 text-sm font-semibold">Tone / CTA</p><div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{(Object.keys(toneTemplates) as ToneId[]).map((id)=><button key={id} onClick={()=>applyTone(id)} className={`rounded-xl border px-2 py-2 text-xs ${toneId===id?'border-gray-900 bg-gray-900 text-white':'border-gray-300 bg-white'}`}>{toneTemplates[id].label}</button>)}</div></div>
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4"><p className="mb-2 text-sm font-semibold">Style + Output</p><div className="mb-2 grid grid-cols-3 gap-2">{(['plain','whatsappCard','posterCard'] as OutputStyle[]).map((id)=><button key={id} onClick={()=>setOutputStyle(id)} className={`rounded-xl border px-2 py-2 text-xs ${outputStyle===id?'border-gray-900 bg-gray-900 text-white':'border-gray-300 bg-white'}`}>{id}</button>)}</div><input value={titleText} onChange={(e)=>setTitleText(e.target.value)} className="mb-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" /><input value={subtitleText} onChange={(e)=>setSubtitleText(e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />{outputStyle==='posterCard'?<div className="mt-2 grid grid-cols-2 gap-2">{(Object.keys(posterPresets) as PosterPresetId[]).map((id)=><button key={id} onClick={()=>setPosterPreset(id)} className={`rounded-xl border px-2 py-2 text-xs ${posterPreset===id?'border-gray-900 bg-gray-900 text-white':'border-gray-300 bg-white'}`}>{posterPresets[id].label}</button>)}</div>:null}</div>
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4"><p className="mb-2 text-sm font-semibold">Export</p><div className="mb-2 grid grid-cols-2 gap-2">{(Object.keys(exportSizePresets) as ExportSizeId[]).map((id)=><button key={id} onClick={()=>setExportSizeId(id)} className={`rounded-xl border px-2 py-2 text-xs ${exportSizeId===id?'border-gray-900 bg-gray-900 text-white':'border-gray-300 bg-white'}`}>{exportSizePresets[id].label}</button>)}</div><button onClick={downloadPng} disabled={!hasValidLink} className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm disabled:opacity-60"><ImageDown className="h-4 w-4"/>Download PNG ({exportSize.label})</button><p className="mt-1 text-xs text-gray-500">{downloadState==='success'?'Downloaded.':downloadState==='error'?'Download failed.':''}</p></div>
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4"><p className="mb-2 flex items-center gap-2 text-sm font-semibold"><History className="h-4 w-4"/>Recent</p>{recentDesigns.length===0?<p className="text-xs text-gray-500">Recent designs appear after downloads.</p>:<div className="space-y-2">{recentDesigns.map((r)=><button key={r.id} onClick={()=>{setTargetLink(r.link);setOutputStyle(r.outputStyle);setTitleText(r.titleText);setSubtitleText(r.subtitleText);setExportSizeId(r.exportSizeId);setPosterPreset(r.posterPreset);}} className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-left text-xs"><p className="truncate font-medium">{r.titleText}</p><p className="truncate text-gray-500">{r.link}</p></button>)}</div>}</div>
  </div>
  <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-5 shadow-inner sm:p-6"><h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Live Preview</h2>{hasValidLink&&qrImageUrl?<div className="mt-4 grid min-h-[460px] place-items-center rounded-2xl border border-dashed border-gray-300 bg-white p-4"><div className={`w-full max-w-md rounded-3xl border p-4 shadow-lg ${posterPresets[posterPreset].shellClass}`} style={{aspectRatio:`${exportSize.width}/${exportSize.height}`}}><div className={`${outputStyle==='plain'?'hidden':''} mb-3 rounded-2xl p-3 text-center text-white`} style={colorMode==='gradient'?{backgroundImage:selectedGradient.swatch}:{backgroundColor:qrForegroundColor}}><p className="text-sm font-semibold sm:text-base">{titleText}</p><p className="text-xs opacity-90">{subtitleText}</p></div><div className="mx-auto grid place-items-center rounded-2xl border border-gray-200 bg-white p-3"><img src={qrImageUrl} className="h-44 w-44 sm:h-56 sm:w-56" alt="QR preview"/></div><p className="mt-3 text-center text-xs text-gray-600">{outputStyle==='posterCard'?posterPresets[posterPreset].label:outputStyle==='whatsappCard'?'WhatsApp Card':'Plain QR'} · {exportSize.label}</p></div></div>:<div className="mt-4 flex min-h-[460px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white text-center"><div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-700"><Sparkles className="h-5 w-5"/></div><p className="text-base font-semibold">Start with a link</p><p className="mt-1 max-w-xs text-sm text-gray-600">Paste URL → pick template/tone → customize → download.</p></div>}<p className="mt-3 text-xs text-gray-500">Gradient modules use scan-safe solid fallback for reliability.</p></div></section></div></main>;
}

export { QR_EDITOR_STORAGE_KEY };
