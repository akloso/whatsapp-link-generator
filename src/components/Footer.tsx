import { MessageCircle } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative bg-gradient-to-b from-gray-950 to-gray-900 text-gray-300 py-16 border-t border-gray-800">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-green-600 rounded-full blur-3xl transform -translate-x-1/2 -translate-y-1/2"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-gradient-to-br from-green-500 to-emerald-500 p-2 rounded-xl">
              <MessageCircle className="w-6 h-6 text-white" strokeWidth={1.5} />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">
              WhatsApp Link
            </span>
          </div>
          <p className="text-gray-400 mb-8 max-w-md font-light leading-relaxed">
            The simplest way to create custom WhatsApp links with pre-filled messages. Free, fast, and secure for everyone.
          </p>

          <div className="border-t border-gray-800 pt-8 w-full">
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center text-sm text-gray-500 mb-4">
              <a href="#" className="hover:text-green-400 transition-colors">Privacy</a>
              <span className="hidden sm:inline">•</span>
              <a href="#" className="hover:text-green-400 transition-colors">Terms</a>
              <span className="hidden sm:inline">•</span>
              <a href="#" className="hover:text-green-400 transition-colors">Contact</a>
            </div>
            <p className="text-sm text-gray-500">
              © {currentYear} WhatsApp Link Generator. Built with care.
            </p>
            <p className="text-xs text-gray-600 mt-3 font-light">
              Not affiliated with WhatsApp or Meta Platforms, Inc.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
