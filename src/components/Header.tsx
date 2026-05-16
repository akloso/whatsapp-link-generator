interface HeaderProps {
  onHomeClick: () => void;
  onQrEditorClick: () => void;
  currentPage: 'home' | 'privacy' | 'terms' | 'contact' | 'qrCodeEditor';
}

export default function Header({ onHomeClick, onQrEditorClick, currentPage }: HeaderProps) {
  const isQrEditorActive = currentPage === 'qrCodeEditor';

  return (
    <header className="border-b border-gray-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <a
          href="/"
          onClick={(event) => {
            event.preventDefault();
            onHomeClick();
          }}
          className="inline-flex items-center"
          aria-label="Zapora home"
        >
          <img src="/logo.svg" alt="Zapora" className="h-9 w-auto sm:h-10" loading="eager" decoding="async" />
        </a>

        <a
          href="/qr-code-editor"
          onClick={(event) => {
            event.preventDefault();
            onQrEditorClick();
          }}
          className={`inline-flex shrink-0 items-center rounded-xl border px-3 py-1.5 text-sm font-medium transition ${
            isQrEditorActive
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-gray-200 text-gray-700 hover:border-emerald-200 hover:bg-emerald-50/60 hover:text-emerald-800'
          }`}
        >
          QR Code Editor
        </a>
      </div>
    </header>
  );
}
