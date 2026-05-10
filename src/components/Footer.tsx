type PageKey = 'home' | 'privacy' | 'terms' | 'contact' | 'qrCodeEditor';

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
    <footer className="relative border-t border-gray-200 bg-gradient-to-b from-gray-50 to-white py-8 text-gray-700 sm:py-12">
      <div className="absolute inset-0 opacity-45 sm:opacity-60">
        <div className="absolute left-1/2 top-1/2 h-56 w-56 sm:h-80 sm:w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-100 blur-3xl"></div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex items-center gap-2.5 sm:mb-6">
            <button
              type="button"
              onClick={onGetStarted}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400/80"
              aria-label="Go to Zapora"
            >
              <img src="/logo.svg" alt="Zapora" className="h-7 w-auto sm:h-9" loading="lazy" decoding="async" />
            </button>
          </div>
          <p className="mb-5 max-w-md text-sm text-gray-600 sm:mb-8 sm:text-base">
            Build a clean WhatsApp link in seconds with optional message text and a ready-to-share QR code.
          </p>

          <div className="w-full border-t border-gray-200 pt-5 sm:pt-8">
            <nav aria-label="Footer" className="mb-3 sm:mb-4">
              <div className="flex flex-col items-center justify-center gap-1.5 text-sm text-gray-600 sm:flex-row sm:gap-4">
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
            <p className="text-xs text-gray-600 sm:text-sm">© {currentYear} Zapora. Built with care.</p>
            <p className="mt-2 text-xs font-light text-gray-500 sm:mt-3">Not affiliated with WhatsApp or Meta Platforms, Inc.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
