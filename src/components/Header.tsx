import { ChevronDown, Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type PageKey = 'home' | 'privacy' | 'terms' | 'contact' | 'qrCodeEditor' | 'blog' | 'whatsappButtonMaker' | 'bulkWhatsappGenerator';

type HeaderProps = { currentPage: PageKey; onNavigate: (page: PageKey) => void };
const tools = [
  { label: 'WhatsApp Link Generator', desc: 'Create single wa.me links', page: 'home' as PageKey },
  { label: 'QR Code Editor', desc: 'Design and export QR codes', page: 'qrCodeEditor' as PageKey },
  { label: 'Bulk WhatsApp Link Generator', desc: 'Generate links from many numbers', page: 'bulkWhatsappGenerator' as PageKey },
  { label: 'WhatsApp Button Maker', desc: 'Create website click-to-chat buttons', page: 'whatsappButtonMaker' as PageKey },
];
const navItems = [{ label: 'Blog', page: 'blog' as PageKey }, { label: 'Privacy', page: 'privacy' as PageKey }, { label: 'Contact', page: 'contact' as PageKey }];
const getPath = (p: PageKey) => p === 'home' ? '/' : p === 'qrCodeEditor' ? '/qr-code-editor' : p === 'whatsappButtonMaker' ? '/whatsapp-button-maker' : p === 'bulkWhatsappGenerator' ? '/bulk-whatsapp-link-generator' : `/${p}`;

export default function Header({ currentPage, onNavigate }: HeaderProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false); const [toolsOpen, setToolsOpen] = useState(false); const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => { setIsMobileOpen(false); setToolsOpen(false); }, [currentPage]);
  useEffect(() => { const h=(e:MouseEvent)=>{ if(ref.current && e.target instanceof Node && !ref.current.contains(e.target)) setToolsOpen(false);}; document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h);},[]);
  return <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8"><a href="/" onClick={(e) => { e.preventDefault(); onNavigate('home'); }} className="inline-flex items-center" aria-label="Zapora home"><img src="/logo.svg" alt="Zapora" className="h-9 w-auto sm:h-10" /></a>
    <nav className="hidden items-center gap-2 sm:flex" aria-label="Primary"><div className="relative" ref={ref}><button type="button" onClick={() => setToolsOpen((v) => !v)} onMouseEnter={() => setToolsOpen(true)} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-emerald-800" aria-expanded={toolsOpen}>Tools <ChevronDown className={`h-4 w-4 ${toolsOpen ? 'rotate-180' : ''}`} /></button>{toolsOpen ? <div className="absolute left-0 top-full mt-2 w-[340px] rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">{tools.map((t) => <a key={t.page} href={getPath(t.page)} onClick={(e) => { e.preventDefault(); onNavigate(t.page); }} className="block rounded-xl p-3 hover:bg-emerald-50"><p className="text-sm font-semibold text-gray-900">{t.label}</p><p className="text-xs text-gray-600">{t.desc}</p></a>)}</div> : null}</div>{navItems.map((item) => <a key={item.page} href={getPath(item.page)} onClick={(e) => { e.preventDefault(); onNavigate(item.page); }} className={`rounded-xl px-3 py-2 text-sm transition ${currentPage===item.page?'bg-emerald-50 font-semibold text-emerald-800':'font-medium text-gray-700 hover:bg-gray-50 hover:text-emerald-800'}`}>{item.label}</a>)}</nav>
    <button type="button" onClick={() => setIsMobileOpen((v) => !v)} className="inline-flex items-center justify-center rounded-xl border border-gray-200 p-2 text-gray-700 transition hover:bg-gray-50 sm:hidden">{isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button></div>
    {isMobileOpen ? <nav className="border-t border-gray-100 bg-white px-4 py-3 sm:hidden"><div className="space-y-1">{tools.map((t) => <a key={t.page} href={getPath(t.page)} onClick={(e) => { e.preventDefault(); onNavigate(t.page); setIsMobileOpen(false); }} className={`block rounded-xl px-3 py-2.5 text-sm ${currentPage===t.page?'bg-emerald-50 font-semibold text-emerald-800':'text-gray-700 hover:bg-gray-50'}`}>{t.label}</a>)}{navItems.map((item) => <a key={item.page} href={getPath(item.page)} onClick={(e) => { e.preventDefault(); onNavigate(item.page); setIsMobileOpen(false); }} className={`block rounded-xl px-3 py-2.5 text-sm ${currentPage===item.page?'bg-emerald-50 font-semibold text-emerald-800':'text-gray-700 hover:bg-gray-50'}`}>{item.label}</a>)}</div></nav> : null}
  </header>;
}
