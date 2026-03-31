type PageKey = 'home' | 'privacy' | 'terms' | 'contact';

interface FooterProps {
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  onGetStarted: () => void;
}

export default function Footer({ currentPage, onNavigate, onGetStarted }: FooterProps) {
  const currentYear = new Date().getFullYear();

  const linkClass =
    'rounded-lg px-2 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400/70 hover:text-green-400';

  return (
    <footer className="relative border-t border-gray-800 bg-gradient-to-b from-gray-950 to-gray-900 py-14 text-gray-300 sm:py-16">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-600 blur-3xl"></div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 flex items-center gap-3">
            <button
              type="button"
              onClick={onGetStarted}
              className="rounded-lg text-2xl font-bold tracking-tight text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400/80"
              aria-label="Go to Zapora"
            >
              Zapora
            </button>
          </div>
          <p className="mb-8 max-w-md text-gray-400">
            Build a clean WhatsApp link in seconds with optional message text and a ready-to-share QR code.
          </p>

          <div className="w-full border-t border-gray-800 pt-8">
            <nav aria-label="Footer" className="mb-4">
              <div className="flex flex-col items-center justify-center gap-2 text-sm text-gray-500 sm:flex-row sm:gap-4">
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
            <p className="text-sm text-gray-500">© {currentYear} Zapora. Built with care.</p>
            <p className="mt-3 text-xs font-light text-gray-600">Not affiliated with WhatsApp or Meta Platforms, Inc.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
