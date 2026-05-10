import { Phone, MessageSquare, Share2 } from 'lucide-react';

export default function HowItWorks() {
  const steps = [
    {
      icon: Phone,
      title: 'Enter Phone Number',
      description: 'Select a country code and enter the WhatsApp number you want people to reach.',
    },
    {
      icon: MessageSquare,
      title: 'Add Optional Message',
      description: 'Add a short pre-filled message so chats start with clear context.',
    },
    {
      icon: Share2,
      title: 'Generate and Share',
      description: 'Create your link, copy it, and use the QR code anywhere online or offline.',
    },
  ];

  return (
    <section id="how" className="relative overflow-hidden bg-white py-10 sm:py-12 lg:py-14">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute left-0 top-1/2 h-96 w-96 rounded-full bg-green-100 blur-3xl"></div>
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-emerald-50 blur-3xl"></div>
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center sm:mb-10">
          <h2 className="mb-3 text-2xl font-bold tracking-tight text-gray-950 sm:text-4xl">How It Works</h2>
          <p className="mx-auto max-w-2xl text-sm text-gray-600 sm:text-base">Get your WhatsApp link ready in three simple steps.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-5">
          {steps.map((step, index) => (
            <div key={index} className="group relative">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-green-600 to-emerald-600 opacity-0 transition-all duration-300 group-hover:opacity-5"></div>
              <div className="relative h-full rounded-2xl border border-gray-200 bg-white p-5 shadow-md transition-all duration-300 group-hover:border-green-200 group-hover:shadow-lg sm:p-6">
                <div className="flex h-full flex-col items-center text-center">
                  <div className="relative mb-4">
                    <div className="absolute inset-0 rounded-2xl bg-green-500 opacity-20 blur-lg"></div>
                    <div className="relative rounded-2xl bg-gradient-to-br from-green-100 to-emerald-100 p-4">
                      <step.icon className="h-7 w-7 text-green-600" strokeWidth={1.5} />
                    </div>
                  </div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-green-600">Step {index + 1}</div>
                  <h3 className="mb-3 text-xl font-bold text-gray-950">{step.title}</h3>
                  <p className="flex-1 text-sm leading-relaxed text-gray-600 sm:text-[15px]">{step.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
