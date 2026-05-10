import { useEffect, useMemo, useState } from 'react';
import { Download, Sparkles } from 'lucide-react';

const QR_EDITOR_STORAGE_KEY = 'zapora_qr_editor_link';

const isValidUrl = (value: string) => {
  if (!value.trim()) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

export default function QrCodeEditorPage() {
  const [targetLink, setTargetLink] = useState('');

  useEffect(() => {
    const storedLink = localStorage.getItem(QR_EDITOR_STORAGE_KEY);
    if (storedLink) setTargetLink(storedLink);
  }, []);

  const hasValidLink = useMemo(() => isValidUrl(targetLink), [targetLink]);

  const qrImageUrl = useMemo(() => {
    if (!hasValidLink) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=480x480&color=000000&bgcolor=ffffff&data=${encodeURIComponent(targetLink.trim())}`;
  }, [hasValidLink, targetLink]);

  return (
    <main className="relative overflow-hidden bg-gradient-to-b from-white via-gray-50 to-white py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8 text-center sm:mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">Customize your QR code</h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-gray-600 sm:text-lg">
            Advanced QR design foundation for branded sharing, business campaigns, and polished downloads.
          </p>
        </header>

        <section className="grid grid-cols-1 gap-6 rounded-[28px] border border-gray-200 bg-white p-4 shadow-[0_20px_70px_-30px_rgba(0,0,0,0.22)] sm:p-6 lg:grid-cols-2 lg:gap-8">
          <div className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="qr-link-input" className="block text-sm font-semibold text-gray-900">
                Link to encode
              </label>
              <input
                id="qr-link-input"
                type="url"
                value={targetLink}
                onChange={(event) => setTargetLink(event.target.value)}
                placeholder="Paste your WhatsApp link or any URL"
                className="w-full rounded-2xl border border-gray-300 px-4 py-3.5 text-gray-900 outline-none transition-all hover:border-gray-400 focus-visible:border-green-500 focus-visible:ring-2 focus-visible:ring-green-500/20"
              />
              {!targetLink.trim() ? (
                <p className="text-sm text-gray-500">Enter a link to start designing your QR code.</p>
              ) : !hasValidLink ? (
                <p className="text-sm text-amber-700">Please enter a valid URL (example: https://wa.me/1234567890).</p>
              ) : (
                <p className="text-sm text-green-700">Great! Your live preview is ready.</p>
              )}
            </div>

            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-900">Customization options coming next</p>
              <p className="mt-1 text-sm text-gray-600">Upcoming controls for colors, branding, styles, and export presets.</p>
            </div>

            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
              <div className="flex items-center gap-2 text-gray-700">
                <Download className="h-4 w-4" />
                <p className="text-sm font-semibold">Download controls placeholder</p>
              </div>
              <p className="mt-1 text-sm text-gray-600">High-resolution download options will be added in the next step.</p>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-5 shadow-inner sm:p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Live preview</h2>
            {hasValidLink && qrImageUrl ? (
              <div className="mt-4 flex flex-col items-center text-center">
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <img src={qrImageUrl} alt="Live QR preview" className="h-56 w-56 sm:h-64 sm:w-64" />
                </div>
                <p className="mt-4 text-sm text-gray-600">Preview updates instantly as your target link changes.</p>
              </div>
            ) : (
              <div className="mt-4 flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white text-center">
                <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-700">
                  <Sparkles className="h-5 w-5" />
                </div>
                <p className="text-base font-semibold text-gray-900">Preview will appear here</p>
                <p className="mt-1 max-w-xs text-sm text-gray-600">Add a valid link on the left to generate your QR preview.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export { QR_EDITOR_STORAGE_KEY };
