import { ShieldCheck } from 'lucide-react';

export default function Features() {
  return (
    <section className="bg-gradient-to-b from-gray-50 to-white py-7 sm:py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm ring-1 ring-green-100/50 sm:px-5">
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
