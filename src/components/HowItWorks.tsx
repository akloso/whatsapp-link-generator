import { MessageSquare, Phone, Share2 } from 'lucide-react';

export default function HowItWorks() {
  const steps = [
    { icon: Phone, title: 'Add the number', description: 'Choose the right country code and enter the WhatsApp number.', accent: 'bg-emerald-100 text-emerald-700' },
    { icon: MessageSquare, title: 'Set the context', description: 'Optionally give every chat a helpful first message.', accent: 'bg-cyan-100 text-cyan-700' },
    { icon: Share2, title: 'Share anywhere', description: 'Copy the link or put the QR on the places people see.', accent: 'bg-violet-100 text-violet-700' },
  ];
  return <section id="how" className="bg-white py-14 sm:py-20"><div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"><div className="mx-auto max-w-2xl text-center"><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-700">A clear path to conversation</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Three small steps. No setup friction.</h2></div><div className="relative mt-10 grid gap-4 md:grid-cols-3 md:gap-6"><div aria-hidden="true" className="absolute left-[17%] right-[17%] top-9 hidden h-px bg-gradient-to-r from-emerald-200 via-cyan-200 to-violet-200 md:block" />{steps.map((step, index) => <article key={step.title} className="group relative rounded-2xl border border-slate-100 bg-white p-5 transition duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_18px_36px_-28px_rgba(15,80,55,.45)] sm:p-6"><div className={`relative grid h-[72px] w-[72px] place-items-center rounded-2xl ${step.accent}`}><step.icon className="h-7 w-7" /><span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-slate-900 text-[10px] font-bold text-white">{index + 1}</span></div><h3 className="mt-5 text-lg font-bold text-slate-950">{step.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p></article>)}</div></div></section>;
}
