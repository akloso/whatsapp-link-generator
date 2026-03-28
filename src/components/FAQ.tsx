import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: 'What is a WhatsApp link generator?',
      answer: 'A WhatsApp link generator creates clickable links that open WhatsApp with a specific phone number and optional pre-filled message. It\'s perfect for businesses and individuals who want to make it easy for people to contact them.',
    },
    {
      question: 'How do wa.me links work?',
      answer: 'wa.me is WhatsApp\'s official URL format. When someone clicks a wa.me link, it opens WhatsApp on their device with the specified number ready to chat. If you include a message parameter, that text will be pre-filled in the chat box.',
    },
    {
      question: 'Is this tool free to use?',
      answer: 'Yes, our WhatsApp link generator is completely free to use with no limitations. Generate as many links as you need for personal or business use.',
    },
    {
      question: 'Do I need a WhatsApp Business account?',
      answer: 'No, these links work with both regular WhatsApp and WhatsApp Business accounts. You can use any valid WhatsApp number.',
    },
    {
      question: 'Can I use the QR code for print materials?',
      answer: 'Absolutely! The generated QR code can be downloaded and used in business cards, flyers, posters, or any print material. Anyone who scans it will be directed to WhatsApp.',
    },
    {
      question: 'Are the generated links permanent?',
      answer: 'Yes, the links are permanent and will work as long as the phone number remains active on WhatsApp. You can use them indefinitely in your marketing materials.',
    },
  ];

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-24 bg-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-green-100 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-950 mb-4 tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-gray-600 font-light">
            Everything you need to know about creating WhatsApp links
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:border-green-300 hover:shadow-lg transition-all duration-300"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full px-8 py-6 flex items-center justify-between text-left hover:bg-green-50 transition-colors duration-300"
              >
                <span className="font-semibold text-gray-950 pr-4 text-lg">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`w-6 h-6 text-green-600 transition-transform flex-shrink-0 duration-300 ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {openIndex === index && (
                <div className="px-8 pb-6 bg-gradient-to-br from-green-50 to-transparent border-t border-gray-200">
                  <p className="text-gray-600 leading-relaxed font-light text-base">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
