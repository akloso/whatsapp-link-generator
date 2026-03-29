import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: 'What is a WhatsApp link generator?',
      answer: 'A WhatsApp link generator creates a clickable link that opens WhatsApp with a phone number and optional pre-filled message.',
    },
    {
      question: 'How do wa.me links work?',
      answer: 'wa.me is WhatsApp’s official URL format. Clicking the link opens WhatsApp with the selected number ready for chat.',
    },
    {
      question: 'Is this tool free to use?',
      answer: 'Yes. You can generate as many links as you need for personal or business use.',
    },
    {
      question: 'Do I need a WhatsApp Business account?',
      answer: 'No. The links work with both personal and WhatsApp Business numbers.',
    },
    {
      question: 'Can I use the QR code for print?',
      answer: 'Yes. Download and place it on cards, flyers, packaging, or posters for faster scanning.',
    },
    {
      question: 'Are generated links permanent?',
      answer: 'Yes. They remain usable as long as the destination number stays active on WhatsApp.',
    },
  ];

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="relative overflow-hidden bg-white py-16 sm:py-20 lg:py-24">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute right-1/4 top-0 h-96 w-96 rounded-full bg-green-100 blur-3xl"></div>
      </div>

      <div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center sm:mb-16">
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-gray-950 sm:text-5xl">Frequently Asked Questions</h2>
          <p className="text-base text-gray-600 sm:text-lg">Everything important before you generate and share your link.</p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const panelId = `faq-panel-${index}`;
            const buttonId = `faq-button-${index}`;

            return (
              <div key={faq.question} className="group overflow-hidden rounded-2xl border border-gray-200 bg-white transition-all duration-300 hover:border-green-300 hover:shadow-lg">
                <button
                  id={buttonId}
                  onClick={() => toggleFAQ(index)}
                  className="flex w-full items-center justify-between px-5 py-5 text-left transition-colors duration-300 hover:bg-green-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-500/20 sm:px-8 sm:py-6"
                  aria-expanded={openIndex === index}
                  aria-controls={panelId}
                >
                  <span className="pr-4 text-base font-semibold text-gray-950 sm:text-lg">{faq.question}</span>
                  <ChevronDown className={`h-6 w-6 flex-shrink-0 text-green-600 transition-transform duration-300 ${openIndex === index ? 'rotate-180' : ''}`} />
                </button>
                {openIndex === index && (
                  <div id={panelId} role="region" aria-labelledby={buttonId} className="border-t border-gray-200 bg-gradient-to-br from-green-50 to-transparent px-5 pb-5 sm:px-8 sm:pb-6">
                    <p className="text-base leading-relaxed text-gray-600">{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
