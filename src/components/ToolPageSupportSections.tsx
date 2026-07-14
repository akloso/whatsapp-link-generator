import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

type Step = {
  title: string;
  description: string;
};

type FaqItem = {
  question: string;
  answer: string;
};

export function ToolHowItWorksSection({ heading, intro, steps }: { heading: string; intro: string; steps: Step[] }) {
  return (
    <section className="mt-7 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm shadow-emerald-950/[0.03] sm:mt-9 sm:p-5">
      <h2 className="text-xl font-bold tracking-tight text-gray-950 sm:text-2xl">{heading}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600 sm:text-base">{intro}</p>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {steps.map((step, idx) => (
          <article key={step.title} className="rounded-xl bg-emerald-50/50 p-3.5 ring-1 ring-emerald-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Step {idx + 1}</p>
            <h3 className="mt-1 text-sm font-semibold text-gray-900 sm:text-base">{step.title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-gray-600 sm:text-sm">{step.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ToolFaqSection({ heading, items }: { heading: string; items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-emerald-950/[0.03] sm:mt-7 sm:p-5">
      <h2 className="text-xl font-bold tracking-tight text-gray-950 sm:text-2xl">{heading}</h2>

      <div className="mt-4 space-y-2.5 sm:mt-5">
        {items.map((faq, index) => {
          const panelId = `${heading.toLowerCase().replace(/\s+/g, '-')}-panel-${index}`;
          const buttonId = `${heading.toLowerCase().replace(/\s+/g, '-')}-button-${index}`;
          const isOpen = openIndex === index;

          return (
            <article key={faq.question} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <button
                id={buttonId}
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left text-sm font-semibold text-gray-900 transition hover:bg-emerald-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 sm:px-4"
                aria-expanded={isOpen}
                aria-controls={panelId}
              >
                <span>{faq.question}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-emerald-700 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen ? (
                <div id={panelId} role="region" aria-labelledby={buttonId} className="border-t border-gray-100 px-3.5 pb-3.5 pt-2 sm:px-4 sm:pb-4">
                  <p className="text-sm leading-relaxed text-gray-600">{faq.answer}</p>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
