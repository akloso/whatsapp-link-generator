import { useState } from 'react';
import { Copy, Check, QrCode } from 'lucide-react';

export default function Generator() {
  const [countryCode, setCountryCode] = useState('+1');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const countryCodes = [
    { code: '+1', country: 'US/Canada' },
    { code: '+44', country: 'UK' },
    { code: '+91', country: 'India' },
    { code: '+86', country: 'China' },
    { code: '+81', country: 'Japan' },
    { code: '+49', country: 'Germany' },
    { code: '+33', country: 'France' },
    { code: '+34', country: 'Spain' },
    { code: '+39', country: 'Italy' },
    { code: '+55', country: 'Brazil' },
    { code: '+52', country: 'Mexico' },
    { code: '+61', country: 'Australia' },
    { code: '+971', country: 'UAE' },
    { code: '+966', country: 'Saudi Arabia' },
    { code: '+27', country: 'South Africa' },
  ];

  const generateLink = () => {
    if (!phoneNumber) {
      alert('Please enter a phone number');
      return;
    }

    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const fullNumber = `${countryCode.replace('+', '')}${cleanNumber}`;
    const encodedMessage = encodeURIComponent(message);

    const link = message
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
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert('Failed to copy link');
    }
  };

  const toggleQR = () => {
    if (!generatedLink) {
      alert('Please generate a link first');
      return;
    }
    setShowQR(!showQR);
  };

  return (
    <section id="generator" className="py-24 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-950 mb-4 tracking-tight">
            Create Your Link
          </h2>
          <p className="text-lg text-gray-600 font-light">
            Fill in your details to generate a custom WhatsApp link
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 p-10 sm:p-12">
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3 tracking-wide">
                  Country Code
                </label>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none font-medium transition-all hover:border-gray-400"
                >
                  {countryCodes.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} {c.country}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-gray-900 mb-3 tracking-wide">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="1234567890"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none font-medium transition-all hover:border-gray-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3 tracking-wide">
                Message (Optional)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hi! I'd like to discuss your services..."
                rows={4}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none font-medium transition-all hover:border-gray-400"
              />
            </div>

            <button
              onClick={generateLink}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 rounded-xl font-semibold text-base sm:text-lg hover:shadow-xl transition-all shadow-lg hover:from-green-700 hover:to-emerald-700"
            >
              Generate WhatsApp Link
            </button>

            {generatedLink && (
              <div className="mt-10 space-y-5 pt-8 border-t border-gray-200">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-100">
                  <label className="block text-sm font-semibold text-gray-900 mb-3 tracking-wide">
                    Your Generated Link
                  </label>
                  <div className="flex gap-3 flex-col sm:flex-row">
                    <input
                      type="text"
                      value={generatedLink}
                      readOnly
                      className="flex-1 px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-mono"
                    />
                    <button
                      onClick={copyToClipboard}
                      className={`px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
                        copied
                          ? 'bg-emerald-600 text-white shadow-lg'
                          : 'bg-green-600 text-white hover:bg-green-700 hover:shadow-lg'
                      }`}
                    >
                      {copied ? (
                        <>
                          <Check className="w-5 h-5" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-5 h-5" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  onClick={toggleQR}
                  className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-900 py-3 rounded-lg font-semibold hover:bg-gray-50 hover:border-green-400 transition-all"
                >
                  <QrCode className="w-5 h-5" />
                  {showQR ? 'Hide QR Code' : 'Show QR Code'}
                </button>

                {showQR && (
                  <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-8 border border-gray-200 flex flex-col items-center shadow-lg">
                    <p className="text-sm font-semibold text-gray-700 mb-6">
                      Scan with your phone camera or WhatsApp
                    </p>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-lg">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(generatedLink)}`}
                        alt="QR Code"
                        className="w-60 h-60"
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
