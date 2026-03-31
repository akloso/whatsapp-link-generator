interface HeaderProps {
  onHomeClick: () => void;
}

export default function Header({ onHomeClick }: HeaderProps) {
  return (
    <header className="border-b border-gray-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="mx-auto flex max-w-7xl items-center px-4 py-3 sm:px-6 lg:px-8">
        <a
          href="/"
          onClick={(event) => {
            event.preventDefault();
            onHomeClick();
          }}
          className="inline-flex items-center"
          aria-label="Zapora home"
        >
          <img src="/logo.svg" alt="Zapora" className="h-9 w-auto" loading="eager" decoding="async" />
        </a>
      </div>
    </header>
  );
}
