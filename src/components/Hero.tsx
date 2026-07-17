import { ArrowRight, Check, MessageCircle, QrCode, Sparkles } from 'lucide-react';
import { Button } from './ui';

interface HeroProps {
  onGetStarted: () => void;
}

export default function Hero({ onGetStarted }: HeroProps) {
  return (
    <section className="relative isolate overflow-hidden border-b border-emerald-100/70 bg-[#fbfefc] py-10 sm:py-14 lg:py-20">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-28 top-0 h-80 w-80 rounded-full bg-emerald-200/50 blur-3xl" />
        <div className="absolute right-[-6rem] top-[-5rem] h-96 w-96 rounded-full bg-cyan-100/70 blur-3xl" />
        <div className="absolute bottom-[-12rem] left-[35%] h-80 w-80 rounded-full bg-violet-100/45 blur-3xl" />
      </div>
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_0.88fr] lg:gap-16 lg:px-8">
        <div className="max-w-2xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-white/80 px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm">
            <img src="/logo-icon.svg" alt="" className="h-4 w-4" />
            Zapora — share a chat in seconds
          </div>
          <h1 className="text-4xl font-bold tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-6xl">
            Make every hello <span className="text-emerald-600">one tap away.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
            Turn a WhatsApp number into a polished chat link and scannable QR code — ready for your bio, website, or next print run.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button onClick={onGetStarted} variant="primary" className="w-full !rounded-2xl px-5 sm:w-auto" icon={<ArrowRight className="h-4 w-4" />}>
              Create my link
            </Button>
            <a href="#how" className="inline-flex min-h-11 items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20">
              See the simple flow
            </a>
          </div>
          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-slate-600 sm:text-sm">
            {['No account needed', 'QR included', 'Works on mobile'].map((item) => <span key={item} className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-emerald-600" />{item}</span>)}
          </div>
        </div>

        <div className="mx-auto w-full max-w-md lg:max-w-none">
          <div className="hero-float relative rounded-[2rem] border border-white/90 bg-white/85 p-3 shadow-[0_28px_70px_-34px_rgba(15,80,55,0.38)] backdrop-blur-sm sm:p-4">
            <div className="rounded-[1.45rem] border border-slate-100 bg-slate-50 p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /></div>
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Your share link</span>
              </div>
              <div className="mt-5 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
                <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><MessageCircle className="h-5 w-5" /></div><div><p className="text-sm font-semibold text-slate-900">Start a WhatsApp chat</p><p className="text-xs text-slate-500">A friendly first message, ready to go</p></div></div>
                <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 font-mono text-[11px] text-emerald-800">wa.me/919876543210</div>
              </div>
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-3">
                <div className="rounded-2xl bg-slate-900 p-4 text-white"><Sparkles className="h-4 w-4 text-amber-300" /><p className="mt-4 text-sm font-semibold">Link, message &amp; QR.<br />One clean flow.</p><div className="mt-3 h-1.5 w-20 rounded-full bg-emerald-400" /></div>
                <div className="grid w-28 place-items-center rounded-2xl border border-emerald-100 bg-white p-3"><QrCode className="h-16 w-16 text-slate-900" /><span className="mt-1 text-[10px] font-semibold text-emerald-700">SCAN TO CHAT</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
