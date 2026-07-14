import { type ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';

export const pageShell = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8';
export const articleShell = 'mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8';
export const toolPanel = 'min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-emerald-950/[0.03] sm:p-5';
export const previewPanel = 'min-w-0 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm shadow-emerald-950/[0.04] sm:p-5';
export const inputClass = 'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950 shadow-sm transition placeholder:text-slate-400 hover:border-slate-400 focus-visible:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';
export const textareaClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 shadow-sm transition placeholder:text-slate-400 hover:border-slate-400 focus-visible:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/20';
export const primaryButton = 'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:bg-slate-300';
export const secondaryButton = 'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25';
export const selectedSegment = 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500/20';
export const unselectedSegment = 'border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/40';

export function ToolPageIntro({ eyebrow, title, description, icon: Icon, meta }: { eyebrow?: string; title: string; description: string; icon?: LucideIcon; meta?: string }) {
  return (
    <header className="mb-5 max-w-3xl sm:mb-7">
      {eyebrow || Icon ? <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">{Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}{eyebrow}</p> : null}
      <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">{description}</p>
      {meta ? <p className="mt-2 text-xs font-medium text-slate-500">{meta}</p> : null}
    </header>
  );
}

export function EmptyState({ icon: Icon, title, description, children }: { icon?: LucideIcon; title: string; description: string; children?: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/35 p-5 text-center">{Icon ? <Icon className="mx-auto h-8 w-8 text-emerald-600" aria-hidden="true" /> : null}<h3 className="mt-2 text-sm font-bold text-slate-950">{title}</h3><p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-600">{description}</p>{children}</div>;
}
