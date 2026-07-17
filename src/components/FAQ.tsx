import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

const faqs = [
  ['What is a WhatsApp link generator?', 'A WhatsApp link generator creates a clickable link that opens WhatsApp with a phone number and optional pre-filled message.'],
  ['How do wa.me links work?', 'wa.me is WhatsApp’s official URL format. Clicking the link opens WhatsApp with the selected number ready for chat.'],
  ['Is this tool free to use?', 'Yes. You can generate as many links as you need for personal or business use.'],
  ['Do I need a WhatsApp Business account?', 'No. The links work with both personal and WhatsApp Business numbers.'],
  ['Can I use the QR code for print?', 'Yes. Download and place it on cards, flyers, packaging, or posters for faster scanning.'],
  ['Are generated links permanent?', 'Yes. They remain usable as long as the destination number stays active on WhatsApp.'],
];
export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  return <section className="relative overflow-hidden bg-white py-14 sm:py-20"><div aria-hidden="true" className="absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-emerald-100/50 blur-3xl" /><div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8"><div className="text-center"><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-700">Helpful answers</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Questions, answered simply.</h2><p className="mt-3 text-sm text-slate-600 sm:text-base">Everything important before you generate and share your link.</p></div><div className="mt-8 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-4 shadow-[0_22px_50px_-42px_rgba(15,23,42,.35)] sm:px-6">{faqs.map(([question, answer], index) => { const panelId = `faq-panel-${index}`; const buttonId = `faq-button-${index}`; const isOpen = openIndex === index; return <div key={question}><button id={buttonId} onClick={() => setOpenIndex(isOpen ? null : index)} className="flex min-h-[68px] w-full items-center justify-between gap-5 py-4 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20" aria-expanded={isOpen} aria-controls={panelId}><span className="text-sm font-bold text-slate-900 sm:text-base">{question}</span><ChevronDown className={`h-5 w-5 flex-none text-emerald-700 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} /></button><div className="zapora-accordion-grid grid" data-open={isOpen}><div className="overflow-hidden"><div id={panelId} role="region" aria-labelledby={buttonId} className="pb-5 pr-8 text-sm leading-6 text-slate-600">{answer}</div></div></div></div>; })}</div></div></section>;
}
