import { Zap, Shield, Smartphone, Link, QrCode, Globe } from 'lucide-react';

export default function Features() {
  const features = [
    {
      icon: Zap,
      title: 'Lightning Fast',
      description: 'Generate WhatsApp links instantly without any delays or complicated processes.',
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description: 'All processing happens in your browser. No data is stored or shared.',
    },
    {
      icon: Smartphone,
      title: 'Mobile Friendly',
      description: 'Works perfectly on all devices - desktop, tablet, and mobile.',
    },
    {
      icon: Link,
      title: 'Clean Links',
      description: 'Generate clean, professional wa.me links that work everywhere.',
    },
    {
      icon: QrCode,
      title: 'QR Code Ready',
      description: 'Instantly generate QR codes for your links to share offline.',
    },
    {
      icon: Globe,
      title: 'Global Support',
      description: 'Supports all country codes and international phone numbers.',
    },
  ];

  return (
    <section className="py-24 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-950 mb-4 tracking-tight">
            Why Choose Us
          </h2>
          <p className="text-lg text-gray-600 font-light max-w-2xl mx-auto">
            The fastest, most reliable WhatsApp link generator available
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative bg-white rounded-3xl p-10 border border-gray-200 hover:border-green-300 hover:shadow-2xl transition-all duration-300 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative">
                <div className="relative mb-6 inline-block">
                  <div className="absolute inset-0 bg-green-500 rounded-xl blur-lg opacity-20 group-hover:opacity-30 transition-all"></div>
                  <div className="relative bg-gradient-to-br from-green-100 to-emerald-100 w-16 h-16 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <feature.icon className="w-8 h-8 text-green-600" strokeWidth={1.5} />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-950 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed font-light">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
