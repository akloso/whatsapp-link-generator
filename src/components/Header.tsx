import { ChevronDown, Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type PageKey = 'home' | 'privacy' | 'terms' | 'contact' | 'qrCodeEditor' | 'blog' | 'whatsappButtonMaker' | 'bulkWhatsappGenerator';
type HeaderProps = { currentPage: PageKey; onNavigate: (page: PageKey) => void };

const tools = [
  { label: 'WhatsApp Link Generator', desc: 'Create single wa.me links', page: 'home' as PageKey },
  { label: 'Bulk WhatsApp Link Generator', desc: 'Generate links from many numbers', page: 'bulkWhatsappGenerator' as PageKey },
  { label: 'QR Code Editor', desc: 'Design and export QR codes', page: 'qrCodeEditor' as PageKey },
  { label: 'WhatsApp Button Maker', desc: 'Create website click-to-chat buttons', page: 'whatsappButtonMaker' as PageKey },
];
const navItems = [{ label: 'Blog', page: 'blog' as PageKey }, { label: 'Privacy', page: 'privacy' as PageKey }, { label: 'Contact', page: 'contact' as PageKey }];
const getPath = (p: PageKey) => p === 'home' ? '/' : p === 'qrCodeEditor' ? '/qr-code-editor' : p === 'whatsappButtonMaker' ? '/whatsapp-button-maker' : p === 'bulkWhatsappGenerator' ? '/bulk-whatsapp-link-generator' : `/${p}`;

export default function Header({ currentPage, onNavigate }: HeaderProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const toolsRef = useRef<HTMLDivElement | null>(null);

  const clearCloseTimer = () => { if (closeTimer.current) { window.clearTimeout(closeTimer.current); closeTimer.current = null; } };
  const scheduleClose = () => { clearCloseTimer(); closeTimer.current = window.setTimeout(() => setToolsOpen(false), 900); };

  useEffect(() => { setIsMobileOpen(false); setToolsOpen(false); clearCloseTimer(); }, [currentPage]);
  useEffect(() => {
    const onOutside = (event: MouseEvent) => {
      if (toolsRef.current && event.target instanceof Node && !toolsRef.current.contains(event.target)) { clearCloseTimer(); setToolsOpen(false); }
    };
    document.addEventListener('mousedown', onOutside);
    return () => { document.removeEventListener('mousedown', onOutside); clearCloseTimer(); };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <a href="/" onClick={(e) => { e.preventDefault(); onNavigate('home'); }} className="inline-flex items-center" aria-label="Zapora home"><img src="/logo.svg" alt="Zapora" className="h-9 w-auto sm:h-10" /></a>

        <nav className="hidden items-center gap-2 sm:flex" aria-label="Primary">
          <div ref={toolsRef} onMouseEnter={() => { clearCloseTimer(); setToolsOpen(true); }} onMouseLeave={scheduleClose} className="relative">
            <button type="button" onClick={() => { clearCloseTimer(); setToolsOpen((v) => !v); }} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-emerald-800" aria-expanded={toolsOpen}>All Tools <ChevronDown className={`h-4 w-4 transition-transform ${toolsOpen ? 'rotate-180' : ''}`} /></button>
            {toolsOpen ? <div className="absolute left-0 top-full mt-2 w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-emerald-100 bg-gradient-to-b from-emerald-50/40 to-white p-2 shadow-xl">{tools.map((t) => <a key={t.page} href={getPath(t.page)} onClick={(e) => { e.preventDefault(); onNavigate(t.page); }} className="block rounded-xl border border-transparent p-3 hover:border-emerald-100 hover:bg-white"><p className="text-sm font-semibold text-gray-900">{t.label}</p><p className="text-xs text-gray-600">{t.desc}</p></a>)}</div> : null}
          </div>
          {navItems.map((item) => <a key={item.page} href={getPath(item.page)} onClick={(e) => { e.preventDefault(); onNavigate(item.page); }} className={`rounded-xl px-3 py-2 text-sm transition ${currentPage === item.page ? 'bg-emerald-50 font-semibold text-emerald-800' : 'font-medium text-gray-700 hover:bg-gray-50 hover:text-emerald-800'}`}>{item.label}</a>)}
        </nav>

        <button type="button" onClick={() => setIsMobileOpen((v) => !v)} className="inline-flex items-center justify-center rounded-xl border border-gray-200 p-2 text-gray-700 transition hover:bg-gray-50 sm:hidden">{isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
      </div>

      {isMobileOpen ? <nav className="border-t border-gray-100 bg-white px-4 py-3 sm:hidden"><div className="space-y-1">{tools.map((t) => <a key={t.page} href={getPath(t.page)} onClick={(e) => { e.preventDefault(); onNavigate(t.page); setIsMobileOpen(false); }} className={`block rounded-xl px-3 py-2.5 text-sm ${currentPage === t.page ? 'bg-emerald-50 font-semibold text-emerald-800' : 'text-gray-700 hover:bg-gray-50'}`}>{t.label}</a>)}{navItems.map((item) => <a key={item.page} href={getPath(item.page)} onClick={(e) => { e.preventDefault(); onNavigate(item.page); setIsMobileOpen(false); }} className={`block rounded-xl px-3 py-2.5 text-sm ${currentPage === item.page ? 'bg-emerald-50 font-semibold text-emerald-800' : 'text-gray-700 hover:bg-gray-50'}`}>{item.label}</a>)}</div></nav> : null}
    </header>
  );
}
