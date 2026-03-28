import { Phone, MessageSquare, Share2 } from 'lucide-react';

export default function HowItWorks() {
  const steps = [
    {
      icon: Phone,
      title: 'Enter Phone Number',
      description: 'Select the country code and enter the WhatsApp number you want to contact.',
    },
    {
      icon: MessageSquare,
      title: 'Add Your Message',
      description: 'Type the message you want to pre-fill. This step is optional but recommended.',
    },
    {
      icon: Share2,
      title: 'Generate & Share',
      description: 'Click generate to create your link. Copy it or share the QR code anywhere.',
    },
  ];

  return (
    <section id="how" className="py-24 bg-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/2 left-0 w-96 h-96 bg-green-100 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-50 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-950 mb-4 tracking-tight">
            How It Works
          </h2>
          <p className="text-lg text-gray-600 font-light max-w-2xl mx-auto">
            Get started in three simple steps
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10">
          {steps.map((step, index) => (
            <div key={index} className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-green-600 to-emerald-600 rounded-3xl opacity-0 group-hover:opacity-5 transition-all duration-300"></div>
              <div className="relative bg-white rounded-3xl p-10 shadow-lg border border-gray-200 group-hover:shadow-2xl group-hover:border-green-200 h-full transition-all duration-300">
                <div className="flex flex-col items-center text-center h-full">
                  <div className="relative mb-8">
                    <div className="absolute inset-0 bg-green-500 rounded-2xl blur-lg opacity-20"></div>
                    <div className="relative bg-gradient-to-br from-green-100 to-emerald-100 p-5 rounded-2xl">
                      <step.icon className="w-8 h-8 text-green-600" strokeWidth={1.5} />
                    </div>
                  </div>
                  <div className="text-xs font-bold text-green-600 mb-3 uppercase tracking-widest">
                    Step {index + 1}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-950 mb-4">
                    {step.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed flex-1 font-light">
                    {step.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
