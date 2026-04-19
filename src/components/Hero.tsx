import { ArrowRight } from 'lucide-react';

interface HeroProps {
  onGetStarted: () => void;
}

export default function Hero({ onGetStarted }: HeroProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-green-50 to-white py-14 sm:py-16">
      <div className="absolute inset-0 opacity-40">
        <div className="absolute right-10 top-20 h-72 w-72 rounded-full bg-green-100 blur-3xl"></div>
        <div className="absolute bottom-0 left-20 h-80 w-80 rounded-full bg-emerald-50 blur-3xl"></div>
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-[2rem] bg-green-600/15 blur-2xl"></div>
              <div className="relative rounded-[2rem] bg-white/80 p-4 shadow-xl ring-1 ring-green-100">
                <img src="/logo-icon.svg" alt="Zapora icon" className="h-14 w-14 sm:h-16 sm:w-16" />
              </div>
            </div>
          </div>

          <h1 className="mb-5 text-4xl font-bold leading-tight tracking-tight text-gray-950 sm:text-5xl lg:text-6xl">
            WhatsApp Links, Instantly
          </h1>

          <p className="mx-auto mb-8 max-w-3xl text-base leading-relaxed text-gray-600 sm:text-lg">
            Generate a WhatsApp link with an optional pre-filled message in seconds, then share it anywhere using link or QR.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              onClick={onGetStarted}
              className="group relative flex items-center gap-3 overflow-hidden rounded-2xl bg-green-600 px-8 py-4 text-base font-semibold text-white shadow-xl transition-all duration-300 hover:-translate-y-0.5 hover:bg-green-700 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-500/30 sm:px-10 sm:text-lg"
            >
              <span>Get Started</span>
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </button>
            <a
              href="#how"
              className="rounded-2xl px-6 py-4 font-semibold text-gray-700 transition-colors hover:bg-white hover:text-green-600 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-500/20"
            >
              Learn More
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
