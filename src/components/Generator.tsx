import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Copy,
  QrCode,
  Search,
  Sparkles,
} from 'lucide-react';

type CountryOption = {
  code: string;
  country: string;
};

const countryOptions: CountryOption[] = [
  { code: '+1', country: 'United States' },
  { code: '+1', country: 'Canada' },
  { code: '+7', country: 'Russia' },
  { code: '+20', country: 'Egypt' },
  { code: '+27', country: 'South Africa' },
  { code: '+31', country: 'Netherlands' },
  { code: '+32', country: 'Belgium' },
  { code: '+33', country: 'France' },
  { code: '+34', country: 'Spain' },
  { code: '+39', country: 'Italy' },
  { code: '+41', country: 'Switzerland' },
  { code: '+43', country: 'Austria' },
  { code: '+44', country: 'United Kingdom' },
  { code: '+45', country: 'Denmark' },
  { code: '+46', country: 'Sweden' },
  { code: '+47', country: 'Norway' },
  { code: '+48', country: 'Poland' },
  { code: '+49', country: 'Germany' },
  { code: '+52', country: 'Mexico' },
  { code: '+55', country: 'Brazil' },
  { code: '+60', country: 'Malaysia' },
  { code: '+61', country: 'Australia' },
  { code: '+62', country: 'Indonesia' },
  { code: '+63', country: 'Philippines' },
  { code: '+64', country: 'New Zealand' },
  { code: '+65', country: 'Singapore' },
  { code: '+66', country: 'Thailand' },
  { code: '+81', country: 'Japan' },
  { code: '+82', country: 'South Korea' },
  { code: '+84', country: 'Vietnam' },
  { code: '+86', country: 'China' },
  { code: '+90', country: 'Turkey' },
  { code: '+91', country: 'India' },
  { code: '+92', country: 'Pakistan' },
  { code: '+93', country: 'Afghanistan' },
  { code: '+94', country: 'Sri Lanka' },
  { code: '+95', country: 'Myanmar' },
  { code: '+98', country: 'Iran' },
  { code: '+212', country: 'Morocco' },
  { code: '+213', country: 'Algeria' },
  { code: '+216', country: 'Tunisia' },
  { code: '+218', country: 'Libya' },
  { code: '+234', country: 'Nigeria' },
  { code: '+254', country: 'Kenya' },
  { code: '+255', country: 'Tanzania' },
  { code: '+256', country: 'Uganda' },
  { code: '+264', country: 'Namibia' },
  { code: '+351', country: 'Portugal' },
  { code: '+352', country: 'Luxembourg' },
  { code: '+353', country: 'Ireland' },
  { code: '+358', country: 'Finland' },
  { code: '+380', country: 'Ukraine' },
  { code: '+420', country: 'Czech Republic' },
  { code: '+421', country: 'Slovakia' },
  { code: '+880', country: 'Bangladesh' },
  { code: '+960', country: 'Maldives' },
  { code: '+966', country: 'Saudi Arabia' },
  { code: '+971', country: 'United Arab Emirates' },
  { code: '+972', country: 'Israel' },
  { code: '+974', country: 'Qatar' },
  { code: '+977', country: 'Nepal' },
];

export default function Generator() {
  const [countryCode, setCountryCode] = useState('+91');
  const [countrySearch, setCountrySearch] = useState('India');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase();

    if (!query) return countryOptions;

    return countryOptions.filter((option) => {
      return (
        option.country.toLowerCase().includes(query) ||
        option.code.toLowerCase().includes(query)
      );
    });
  }, [countrySearch]);

  const selectedCountry = useMemo(() => {
    return (
      countryOptions.find(
        (option) => option.code === countryCode && option.country === countrySearch
      ) ?? countryOptions.find((option) => option.code === countryCode) ?? countryOptions[0]
    );
  }, [countryCode, countrySearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        event.target instanceof Node &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsCountryOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const generateLink = () => {
    if (!phoneNumber.trim()) {
      alert('Please enter a phone number');
      return;
    }

    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const fullNumber = `${countryCode.replace('+', '')}${cleanNumber}`;
    const encodedMessage = encodeURIComponent(message.trim());

    const link = message.trim()
      ? `https://wa.me/${fullNumber}?text=${encodedMessage}`
      : `https://wa.me/${fullNumber}`;

    setGeneratedLink(link);
    setShowQR(false);
  };

  const copyToClipboard = async () => {
    if (!generatedLink) return;

    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('Failed to copy link');
    }
  };

  const toggleQR = () => {
    if (!generatedLink) {
      alert('Please generate a link first');
      return;
    }

    setShowQR((current) => !current);
  };

  const selectCountry = (option: CountryOption) => {
    setCountryCode(option.code);
    setCountrySearch(option.country);
    setIsCountryOpen(false);
  };

  return (
    <section
      id="generator"
      className="relative overflow-hidden bg-gradient-to-b from-gray-50 via-white to-white py-20 sm:py-24"
    >
      <div className="absolute inset-0 opacity-60">
        <div className="absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-green-100 blur-3xl"></div>
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-emerald-50 blur-3xl"></div>
      </div>

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center sm:mb-14">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-green-100 bg-white px-4 py-2 text-sm font-medium text-green-700 shadow-sm">
            <Sparkles className="h-4 w-4" />
            Fast, clean, and ready to share
          </div>
          <h2 className="mb-4 text-4xl font-bold tracking-tight text-gray-950 sm:text-5xl">
            Create Your WhatsApp Link
          </h2>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-gray-600 sm:text-lg">
            Pick a country, add your WhatsApp number, write an optional pre-filled
            message, and generate a clean wa.me link instantly.
          </p>
        </div>

        <div className="rounded-[32px] border border-gray-200 bg-white/95 p-6 shadow-[0_20px_70px_-30px_rgba(0,0,0,0.25)] backdrop-blur sm:p-8 lg:p-10">
          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-3" ref={dropdownRef}>
                <label className="block text-sm font-semibold tracking-wide text-gray-900">
                  Country / Code
                </label>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsCountryOpen((current) => !current)}
                    className="flex w-full items-center justify-between rounded-2xl border border-gray-300 bg-white px-4 py-3.5 text-left text-gray-900 shadow-sm transition-all hover:border-gray-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  >
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        {selectedCountry.country}
                      </div>
                      <div className="text-sm text-gray-500">{selectedCountry.code}</div>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 text-gray-500 transition-transform ${
                        isCountryOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isCountryOpen && (
                    <div className="absolute z-20 mt-3 w-full rounded-2xl border border-gray-200 bg-white p-3 shadow-2xl">
                      <div className="relative mb-3">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          placeholder="Search country or code"
                          className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                        />
                      </div>

                      <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-100">
                        {filteredCountries.length > 0 ? (
                          filteredCountries.map((option) => {
                            const isSelected =
                              option.code === selectedCountry.code &&
                              option.country === selectedCountry.country;

                            return (
                              <button
                                key={`${option.country}-${option.code}`}
                                type="button"
                                onClick={() => selectCountry(option)}
                                className={`flex w-full items-center justify-between px-3 py-3 text-left text-sm transition-colors ${
                                  isSelected
                                    ? 'bg-green-50 text-green-700'
                                    : 'text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                <span className="font-medium">{option.country}</span>
                                <span className="text-gray-500">{option.code}</span>
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-3 py-4 text-sm text-gray-500">
                            No country found for that search.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-semibold tracking-wide text-gray-900">
                  Phone Number
                </label>
                <div className="flex items-center rounded-2xl border border-gray-300 bg-white px-4 shadow-sm transition-all hover:border-gray-400 focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-500/20">
                  <span className="pr-3 text-sm font-semibold text-gray-500">
                    {selectedCountry.code}
                  </span>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="9876543210"
                    className="w-full border-none bg-transparent py-3.5 text-gray-900 outline-none"
                  />
                </div>
                <p className="text-sm text-gray-500">
                  Enter only the main number. We automatically add the country code.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-semibold tracking-wide text-gray-900">
                Pre-filled Message <span className="font-medium text-gray-400">(Optional)</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hi! I would like to know more about your service."
                rows={5}
                className="w-full resize-none rounded-2xl border border-gray-300 px-4 py-3.5 text-gray-900 outline-none transition-all hover:border-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
              />
            </div>

            <button
              onClick={generateLink}
              className="w-full rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 text-base font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl hover:from-green-700 hover:to-emerald-700 sm:text-lg"
            >
              Generate WhatsApp Link
            </button>

            {generatedLink && (
              <div className="space-y-5 border-t border-gray-200 pt-8">
                <div className="rounded-3xl border border-green-100 bg-gradient-to-br from-green-50 to-emerald-50 p-5 sm:p-6">
                  <label className="mb-3 block text-sm font-semibold tracking-wide text-gray-900">
                    Your Generated Link
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      type="text"
                      value={generatedLink}
                      readOnly
                      className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none"
                    />
                    <button
                      onClick={copyToClipboard}
                      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold transition-all ${
                        copied
                          ? 'bg-emerald-600 text-white shadow-lg'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      {copied ? (
                        <>
                          <Check className="h-5 w-5" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-5 w-5" />
                          Copy Link
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  onClick={toggleQR}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-300 bg-white py-3.5 font-semibold text-gray-900 transition-all hover:border-green-400 hover:bg-gray-50"
                >
                  <QrCode className="h-5 w-5" />
                  {showQR ? 'Hide QR Code' : 'Show QR Code'}
                </button>

                {showQR && (
                  <div className="flex flex-col items-center rounded-3xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-8 text-center shadow-lg">
                    <p className="mb-6 text-sm font-medium text-gray-600">
                      Scan this QR code with your phone camera or WhatsApp.
                    </p>
                    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(generatedLink)}`}
                        alt="QR Code for generated WhatsApp link"
                        className="h-60 w-60"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
