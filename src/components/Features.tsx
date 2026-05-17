import { ShieldCheck } from 'lucide-react';

export default function Features() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-gray-50 to-white py-7 sm:py-8">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/4 top-0 h-48 w-48 rounded-full bg-green-100/55 blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 h-48 w-48 rounded-full bg-cyan-100/40 blur-3xl"></div>
      </div>

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="glass-surface-soft flex items-center gap-3 rounded-2xl px-4 py-3 ring-1 ring-green-100/60 sm:px-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 sm:text-base">Why choose this tool</h2>
            <p className="text-sm text-gray-600">
              Built for speed and trust: private input handling, clean wa.me links, and share-ready QR in one compact flow.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
