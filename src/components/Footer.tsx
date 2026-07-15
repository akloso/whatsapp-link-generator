type PageKey = 'home' | 'privacy' | 'terms' | 'contact' | 'qrCodeEditor' | 'blog' | 'whatsappButtonMaker' | 'bulkWhatsappGenerator' | 'icrTrendsDashboard' | 'htmlWidgetPreview';

interface FooterProps {
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  onGetStarted: () => void;
}

export default function Footer({ currentPage, onNavigate, onGetStarted }: FooterProps) {
  const currentYear = new Date().getFullYear();

  const linkClass =
    'rounded-lg px-2 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40 hover:text-green-700';

  return (
    <footer className="border-t border-gray-200 bg-white py-8 text-gray-700 sm:py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex items-center gap-3">
            <button
              type="button"
              onClick={onGetStarted}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400/80"
              aria-label="Go to Zapora"
            >
              <img src="/logo.svg" alt="Zapora" className="h-8 w-auto sm:h-9" loading="lazy" decoding="async" />
            </button>
          </div>
          <p className="mb-5 max-w-md text-sm leading-6 text-gray-600">
            Build a clean WhatsApp link in seconds with optional message text and a ready-to-share QR code.
          </p>

          <div className="w-full border-t border-gray-200 pt-5">
            <nav aria-label="Footer" className="mb-3">
              <div className="flex flex-col items-center justify-center gap-2 text-sm text-gray-600 sm:flex-row sm:gap-4">
                <button type="button" onClick={() => onNavigate('blog')} className={linkClass} aria-current={currentPage === 'blog' ? 'page' : undefined}>
                  Blog
                </button>
                <span className="hidden sm:inline">•</span>
                <button type="button" onClick={() => onNavigate('privacy')} className={linkClass} aria-current={currentPage === 'privacy' ? 'page' : undefined}>
                  Privacy
                </button>
                <span className="hidden sm:inline">•</span>
                <button type="button" onClick={() => onNavigate('terms')} className={linkClass} aria-current={currentPage === 'terms' ? 'page' : undefined}>
                  Terms
                </button>
                <span className="hidden sm:inline">•</span>
                <button type="button" onClick={() => onNavigate('contact')} className={linkClass} aria-current={currentPage === 'contact' ? 'page' : undefined}>
                  Contact
                </button>
              </div>
            </nav>
            <p className="text-sm text-gray-600">© {currentYear} Zapora. Built with care.</p>
            <p className="mt-3 text-xs font-light text-gray-500">Not affiliated with WhatsApp or Meta Platforms, Inc.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
