import { ArrowRight } from 'lucide-react';
import { Button } from './ui';

interface HeroProps {
  onGetStarted: () => void;
}

export default function Hero({ onGetStarted }: HeroProps) {
  return (
    <section className="border-b border-gray-100 bg-white py-8 sm:py-10 lg:py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700">
            <img src="/logo-icon.svg" alt="" className="h-4 w-4" /> Zapora tools for faster chats
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl lg:text-5xl">
            WhatsApp links and QR codes made simple.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600 sm:text-lg">
            Create a clean WhatsApp click-to-chat link with an optional pre-filled message, then copy it, open it, or share it as a QR code.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Button onClick={onGetStarted} variant="primary" className="w-full sm:w-auto" icon={<ArrowRight className="h-4 w-4" />}>
              Start generating
            </Button>
            <a
              href="#how"
              className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-700 transition duration-150 hover:bg-gray-100 hover:text-gray-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gray-400/20"
            >
              See how it works
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
