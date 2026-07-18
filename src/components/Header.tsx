import { ChevronDown, ChevronRight, Menu, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

type PageKey = 'home' | 'privacy' | 'terms' | 'contact' | 'qrCodeEditor' | 'blog' | 'whatsappButtonMaker' | 'bulkWhatsappGenerator' | 'icrTrendsDashboard';
type HeaderProps = { currentPage: PageKey; onNavigate: (page: PageKey) => void };

const tools = [
  { label: 'WhatsApp Link Generator', desc: 'Create single wa.me links', page: 'home' as PageKey },
  { label: 'Bulk WhatsApp Link Generator', desc: 'Generate links from many numbers', page: 'bulkWhatsappGenerator' as PageKey },
  { label: 'QR Code Editor', desc: 'Design and export QR codes', page: 'qrCodeEditor' as PageKey },
  { label: 'WhatsApp Button Maker', desc: 'Create website click-to-chat buttons', page: 'whatsappButtonMaker' as PageKey },
];
const navItems = [{ label: 'Blog', page: 'blog' as PageKey }, { label: 'Privacy', page: 'privacy' as PageKey }, { label: 'Contact', page: 'contact' as PageKey }];
const getPath = (p: PageKey) => p === 'home' ? '/' : p === 'qrCodeEditor' ? '/qr-code-editor' : p === 'whatsappButtonMaker' ? '/whatsapp-button-maker' : p === 'bulkWhatsappGenerator' ? '/bulk-whatsapp-link-generator' : p === 'icrTrendsDashboard' ? '/icr-trends-dashboard' : `/${p}`;

const icrDashboardPath = '/icr-trends-dashboard';
const htmlWidgetPreviewUrl = 'https://akloso.github.io/HTML---Widget-Preview/';
const submenuWidth = 256;
const submenuGap = 8;
const viewportSafeMargin = 16;

export default function Header({ currentPage, onNavigate }: HeaderProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [otherToolsOpen, setOtherToolsOpen] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [mobileOtherToolsOpen, setMobileOtherToolsOpen] = useState(false);
  const [otherToolsSubmenuLeft, setOtherToolsSubmenuLeft] = useState(submenuGap);
  const [otherToolsDirection, setOtherToolsDirection] = useState<'right' | 'left'>('right');
  const closeTimer = useRef<number | null>(null);
  const toolsRef = useRef<HTMLDivElement | null>(null);
  const otherToolsItemRef = useRef<HTMLDivElement | null>(null);
  const otherToolsSubmenuRef = useRef<HTMLDivElement | null>(null);

  const clearCloseTimer = () => { if (closeTimer.current) { window.clearTimeout(closeTimer.current); closeTimer.current = null; } };
  const closeToolsMenu = () => { setToolsOpen(false); setOtherToolsOpen(false); };
  const closeMobileMenu = () => { setIsMobileOpen(false); setMobileToolsOpen(false); setMobileOtherToolsOpen(false); };
  const scheduleClose = () => { clearCloseTimer(); closeTimer.current = window.setTimeout(closeToolsMenu, 900); };

  const updateOtherToolsPosition = useCallback(() => {
    const parent = otherToolsItemRef.current;
    if (!parent) return;

    const parentRect = parent.getBoundingClientRect();
    const measuredSubmenuWidth = otherToolsSubmenuRef.current?.getBoundingClientRect().width ?? submenuWidth;
    const rightOffset = parentRect.width + submenuGap;
    const rightEdge = parentRect.left + rightOffset + measuredSubmenuWidth;

    if (rightEdge <= window.innerWidth - viewportSafeMargin) {
      setOtherToolsDirection('right');
      setOtherToolsSubmenuLeft(rightOffset);
      return;
    }

    const leftOffset = -measuredSubmenuWidth - submenuGap;
    const leftEdge = parentRect.left + leftOffset;
    const clampedLeftOffset = leftEdge < viewportSafeMargin
      ? viewportSafeMargin - parentRect.left
      : leftOffset;

    setOtherToolsDirection('left');
    setOtherToolsSubmenuLeft(clampedLeftOffset);
  }, []);

  const openOtherTools = () => {
    updateOtherToolsPosition();
    setOtherToolsOpen(true);
  };

  useEffect(() => { closeMobileMenu(); closeToolsMenu(); clearCloseTimer(); }, [currentPage]);
  useEffect(() => {
    if (!otherToolsOpen) return undefined;

    updateOtherToolsPosition();
    window.addEventListener('resize', updateOtherToolsPosition);
    return () => window.removeEventListener('resize', updateOtherToolsPosition);
  }, [otherToolsOpen, updateOtherToolsPosition]);
  useEffect(() => {
    const onOutside = (event: MouseEvent) => {
      if (toolsRef.current && event.target instanceof Node && !toolsRef.current.contains(event.target)) { clearCloseTimer(); closeToolsMenu(); }
    };
    document.addEventListener('mousedown', onOutside);
    return () => { document.removeEventListener('mousedown', onOutside); clearCloseTimer(); };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white" onKeyDown={(event) => { if (event.key === 'Escape') { closeMobileMenu(); closeToolsMenu(); } }}>
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <a href="/" onClick={(e) => { e.preventDefault(); onNavigate('home'); }} className="inline-flex h-10 items-center" aria-label="Zapora home"><img src="/logo.svg" alt="Zapora" className="h-8 w-auto sm:h-9" /></a>

        <nav className="hidden items-center gap-2 sm:flex" aria-label="Primary">
          <div
            ref={toolsRef}
            onMouseEnter={() => { clearCloseTimer(); setToolsOpen(true); }}
            onMouseLeave={scheduleClose}
            onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) closeToolsMenu(); }}
            className="relative"
          >
            <button
              type="button"
              onClick={() => { clearCloseTimer(); setToolsOpen((v) => !v); }}
              onFocus={() => { clearCloseTimer(); setToolsOpen(true); }}
              className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40"
              aria-expanded={toolsOpen}
              aria-haspopup="menu"
            >
              All Tools <ChevronDown className={`h-4 w-4 transition-transform ${toolsOpen ? 'rotate-180' : ''}`} />
            </button>
            {toolsOpen ? (
              <div className="absolute left-0 top-full z-50 mt-2 w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-emerald-100 bg-white p-2 shadow-xl" role="menu">
                {tools.map((t) => (
                  <a key={t.page} href={getPath(t.page)} onClick={(e) => { e.preventDefault(); onNavigate(t.page); }} className="block rounded-xl border border-transparent p-3 hover:border-emerald-100 hover:bg-white focus-visible:border-emerald-100 focus-visible:bg-white focus-visible:outline-none" role="menuitem"><p className="text-sm font-semibold text-gray-900">{t.label}</p><p className="text-xs text-gray-600">{t.desc}</p></a>
                ))}
                <div
                  ref={otherToolsItemRef}
                  className="relative"
                  onMouseEnter={() => { clearCloseTimer(); openOtherTools(); }}
                  onMouseLeave={() => setOtherToolsOpen(false)}
                >
                  <button
                    type="button"
                    onClick={() => { if (!otherToolsOpen) updateOtherToolsPosition(); setOtherToolsOpen((v) => !v); }}
                    onFocus={openOtherTools}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-transparent p-3 text-left hover:border-emerald-100 hover:bg-white focus-visible:border-emerald-100 focus-visible:bg-white focus-visible:outline-none"
                    aria-expanded={otherToolsOpen}
                    aria-haspopup="menu"
                    role="menuitem"
                  >
                    <span className="text-sm font-semibold text-gray-900">Other Tools</span>
                    <ChevronRight className={`h-4 w-4 flex-none text-gray-500 transition-transform ${otherToolsOpen ? 'translate-x-0.5 text-emerald-700' : ''}`} />
                  </button>
                  {otherToolsOpen ? (
                    <div
                      ref={otherToolsSubmenuRef}
                      className="absolute top-0 z-[60] w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-emerald-100 bg-white p-2 shadow-xl"
                      style={{ left: otherToolsSubmenuLeft }}
                      role="menu"
                    >
                      <span
                        aria-hidden="true"
                        className={`absolute top-0 h-full w-3 ${otherToolsDirection === 'right' ? '-left-3' : '-right-3'}`}
                      />
                      <a href={icrDashboardPath} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-transparent p-3 text-sm font-semibold text-gray-900 hover:border-emerald-100 hover:bg-white focus-visible:border-emerald-100 focus-visible:bg-white focus-visible:outline-none" role="menuitem">ICR Trends Dashboard</a>
                      <a href={htmlWidgetPreviewUrl} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-transparent p-3 text-sm font-semibold text-gray-900 hover:border-emerald-100 hover:bg-white focus-visible:border-emerald-100 focus-visible:bg-white focus-visible:outline-none" role="menuitem">HTML &amp; Widget Preview</a>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
          {navItems.map((item) => <a key={item.page} href={getPath(item.page)} onClick={(e) => { e.preventDefault(); onNavigate(item.page); }} className={`rounded-xl px-3 py-2 text-sm transition ${currentPage === item.page ? 'bg-emerald-50 font-semibold text-emerald-800' : 'font-medium text-gray-700 hover:bg-gray-50 hover:text-emerald-800'}`}>{item.label}</a>)}
        </nav>

        <button type="button" onClick={() => setIsMobileOpen((v) => { if (v) { setMobileToolsOpen(false); setMobileOtherToolsOpen(false); } return !v; })} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 p-2 text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-500/20 sm:hidden" aria-label="Toggle navigation menu" aria-expanded={isMobileOpen}>{isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
      </div>

      {isMobileOpen ? (
        <nav className="relative z-50 border-t border-gray-100 bg-white px-4 py-3 shadow-sm sm:hidden" aria-label="Mobile">
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setMobileToolsOpen((v) => !v)}
              className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-gray-800 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40"
              aria-expanded={mobileToolsOpen}
            >
              All Tools <ChevronDown className={`h-4 w-4 transition-transform ${mobileToolsOpen ? 'rotate-180' : ''}`} />
            </button>
            {mobileToolsOpen ? (
              <div className="space-y-1 rounded-2xl border border-emerald-100 bg-emerald-50/30 p-1.5">
                {tools.map((t) => (
                  <a key={t.page} href={getPath(t.page)} onClick={(e) => { e.preventDefault(); onNavigate(t.page); closeMobileMenu(); }} className={`block min-h-11 rounded-xl px-3 py-2.5 text-sm ${currentPage === t.page ? 'bg-white font-semibold text-emerald-800 shadow-sm' : 'text-gray-700 hover:bg-white/80'}`}>{t.label}</a>
                ))}
                <button type="button" onClick={() => setMobileOtherToolsOpen((v) => !v)} className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40" aria-expanded={mobileOtherToolsOpen}>Other Tools <ChevronDown className={`h-4 w-4 transition-transform ${mobileOtherToolsOpen ? 'rotate-180' : ''}`} /></button>
                {mobileOtherToolsOpen ? (
                  <div className="space-y-1 border-l border-emerald-200 pl-2">
                    <a href={icrDashboardPath} target="_blank" rel="noopener noreferrer" onClick={(event) => { event.stopPropagation(); closeMobileMenu(); }} className="block min-h-11 rounded-xl px-3 py-2.5 text-sm text-gray-700 hover:bg-white/80">ICR Trends Dashboard</a>
                    <a href={htmlWidgetPreviewUrl} target="_blank" rel="noopener noreferrer" onClick={(event) => { event.stopPropagation(); closeMobileMenu(); }} className="block min-h-11 rounded-xl px-3 py-2.5 text-sm text-gray-700 hover:bg-white/80">HTML &amp; Widget Preview</a>
                  </div>
                ) : null}
              </div>
            ) : null}
            {navItems.map((item) => <a key={item.page} href={getPath(item.page)} onClick={(e) => { e.preventDefault(); onNavigate(item.page); closeMobileMenu(); }} className={`block min-h-11 rounded-xl px-3 py-2.5 text-sm ${currentPage === item.page ? 'bg-emerald-50 font-semibold text-emerald-800' : 'text-gray-700 hover:bg-gray-50'}`}>{item.label}</a>)}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
