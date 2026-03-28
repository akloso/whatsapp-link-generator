import { MessageCircle, ArrowRight } from 'lucide-react';

interface HeroProps {
  onGetStarted: () => void;
}

export default function Hero({ onGetStarted }: HeroProps) {
  return (
    <section className="relative bg-gradient-to-b from-white via-green-50 to-white overflow-hidden py-24 sm:py-32">
      <div className="absolute inset-0 opacity-40">
        <div className="absolute top-20 right-10 w-72 h-72 bg-green-100 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-20 w-80 h-80 bg-emerald-50 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-green-600 rounded-3xl blur-2xl opacity-20"></div>
              <div className="relative bg-gradient-to-br from-green-600 to-emerald-600 p-5 rounded-3xl shadow-2xl">
                <MessageCircle className="w-14 h-14 text-white" strokeWidth={1.5} />
              </div>
            </div>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-950 mb-6 leading-tight tracking-tight">
            WhatsApp Links, Instantly
          </h1>

          <p className="text-lg sm:text-xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed font-light">
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
