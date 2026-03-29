import { MessageCircle, ArrowRight } from 'lucide-react';

interface HeroProps {
  onGetStarted: () => void;
}

export default function Hero({ onGetStarted }: HeroProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-green-50 to-white py-14 sm:py-16">
      <div className="absolute inset-0 opacity-40">
        <div className="absolute top-20 right-10 w-72 h-72 bg-green-100 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-20 w-80 h-80 bg-emerald-50 rounded-full blur-3xl"></div>
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-green-600 rounded-3xl blur-2xl opacity-20"></div>
              <div className="relative rounded-3xl bg-gradient-to-br from-green-600 to-emerald-600 p-4 shadow-2xl">
                <MessageCircle className="h-11 w-11 text-white" strokeWidth={1.5} />
              </div>
            </div>
          </div>

          <h1 className="mb-5 text-4xl font-bold leading-tight tracking-tight text-gray-950 sm:text-5xl lg:text-6xl">
            WhatsApp Links, Instantly
          </h1>

          <p className="mx-auto mb-8 max-w-3xl text-base font-light leading-relaxed text-gray-600 sm:text-lg">
            Generate custom WhatsApp links with pre-filled messages in seconds. Share, scan, and connect. Perfect for businesses, support teams, and campaigns.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={onGetStarted}
              className="group relative bg-green-600 text-white px-8 sm:px-10 py-4 rounded-2xl font-semibold text-base sm:text-lg shadow-xl hover:shadow-2xl transition-all duration-300 hover:bg-green-700 flex items-center gap-3 overflow-hidden"
            >
              <span>Get Started</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <a
              href="#how"
              className="text-gray-700 font-semibold hover:text-green-600 transition-colors py-4 px-6 rounded-2xl hover:bg-white hover:shadow-lg"
            >
              Learn More
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
