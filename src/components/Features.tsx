import { Zap, Shield, Smartphone, Link, QrCode, Globe } from 'lucide-react';

export default function Features() {
  const features = [
    {
      icon: Zap,
      title: 'Lightning Fast',
      description: 'Create your WhatsApp link instantly with a smooth, simple flow.',
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description: 'Generation happens in your browser. Your input is not stored by us.',
    },
    {
      icon: Smartphone,
      title: 'Mobile Friendly',
      description: 'Built for phone-first usage with responsive controls and layout.',
    },
    {
      icon: Link,
      title: 'Clean Links',
      description: 'Generate professional wa.me links you can use across channels.',
    },
    {
      icon: QrCode,
      title: 'QR Code Ready',
      description: 'Get a QR instantly so anyone can scan and open your chat quickly.',
    },
    {
      icon: Globe,
      title: 'Global Support',
      description: 'Supports international numbers and country calling codes.',
    },
  ];

  return (
    <section className="bg-gradient-to-b from-gray-50 to-white py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center sm:mb-16">
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-gray-950 sm:text-5xl">Why Choose This Tool</h2>
          <p className="mx-auto max-w-2xl text-base text-gray-600 sm:text-lg">Reliable link generation designed for speed, clarity, and sharing.</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-8 transition-all duration-300 hover:border-green-300 hover:shadow-2xl sm:p-9"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
              <div className="relative">
                <div className="relative mb-5 inline-block">
                  <div className="absolute inset-0 rounded-xl bg-green-500 opacity-20 blur-lg transition-all group-hover:opacity-30"></div>
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 transition-transform duration-300 group-hover:scale-110">
                    <feature.icon className="h-8 w-8 text-green-600" strokeWidth={1.5} />
                  </div>
                </div>
                <h3 className="mb-3 text-xl font-bold text-gray-950">{feature.title}</h3>
                <p className="leading-relaxed text-gray-600">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
