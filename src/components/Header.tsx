import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';

type PageKey = 'home' | 'privacy' | 'terms' | 'contact' | 'qrCodeEditor';

type HeaderProps = {
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
};

const navItems: Array<{ label: string; page: PageKey }> = [
  { label: 'Home', page: 'home' },
  { label: 'QR Code Editor', page: 'qrCodeEditor' },
  { label: 'Privacy', page: 'privacy' },
  { label: 'Contact', page: 'contact' },
];

export default function Header({ currentPage, onNavigate }: HeaderProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [currentPage]);

  const getPath = (page: PageKey) => (page === 'home' ? '/' : page === 'qrCodeEditor' ? '/qr-code-editor' : `/${page}`);

  return (
    <header className="glass-surface sticky top-0 z-40 border-b border-gray-100">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <a
          href="/"
          onClick={(event) => {
            event.preventDefault();
            onNavigate('home');
          }}
          className="inline-flex items-center"
          aria-label="Zapora home"
        >
          <img src="/logo.svg" alt="Zapora" className="h-9 w-auto sm:h-10" loading="eager" decoding="async" />
        </a>

        <nav className="hidden items-center gap-1 sm:flex" aria-label="Primary">
          {navItems.map((item) => {
            const isActive = currentPage === item.page;
            return (
              <a
                key={item.page}
                href={getPath(item.page)}
                onClick={(event) => {
                  event.preventDefault();
                  onNavigate(item.page);
                }}
                className={`rounded-xl px-3 py-2 text-sm transition ${
                  isActive
                    ? 'bg-emerald-50 font-semibold text-emerald-800'
                    : 'font-medium text-gray-700 hover:bg-gray-50 hover:text-emerald-800'
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => setIsMobileOpen((value) => !value)}
          className="inline-flex items-center justify-center rounded-xl border border-gray-200 p-2 text-gray-700 transition hover:bg-gray-50 sm:hidden"
          aria-expanded={isMobileOpen}
          aria-controls="mobile-nav"
          aria-label={isMobileOpen ? 'Close menu' : 'Open menu'}
        >
          {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {isMobileOpen ? (
        <nav id="mobile-nav" className="glass-surface border-t border-gray-100 px-4 py-3 sm:hidden" aria-label="Mobile primary">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = currentPage === item.page;
              return (
                <a
                  key={item.page}
                  href={getPath(item.page)}
                  onClick={(event) => {
                    event.preventDefault();
                    onNavigate(item.page);
                    setIsMobileOpen(false);
                  }}
                  className={`rounded-xl px-3 py-2.5 text-sm transition ${
                    isActive
                      ? 'bg-emerald-50 font-semibold text-emerald-800'
                      : 'font-medium text-gray-700 hover:bg-gray-50 hover:text-emerald-800'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
