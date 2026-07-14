import { type MouseEvent } from 'react';
import { ArrowRight, BookOpen } from 'lucide-react';
import { blogPosts } from '../data/blogPosts';
import { pageShell, ToolPageIntro } from './uiSystem';

type Props = { onOpenPost: (slug: string) => void };

export default function BlogListPage({ onOpenPost }: Props) {
  const [featured, ...posts] = blogPosts;
  const openPost = (slug: string) => (event: MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); onOpenPost(slug); };

  return (
    <main className="bg-gradient-to-b from-white via-green-50/35 to-white py-8 sm:py-12">
      <div className={pageShell}>
        <ToolPageIntro icon={BookOpen} eyebrow="Zapora guides" title="Zapora Blog" description="Simple guides to help you create WhatsApp links, QR codes, and better chat flows." />

        {featured ? (
          <a href={`/blog/${featured.slug}`} onClick={openPost(featured.slug)} className="group mb-6 grid gap-5 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm shadow-emerald-950/[0.04] transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25 sm:p-6 lg:grid-cols-[1.2fr_0.8fr]" aria-label={`Read: ${featured.title}`}>
            <article className="min-w-0">
              <p className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700">{featured.category}</p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{featured.title}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">{featured.excerpt}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500"><span>{featured.date}</span><span>•</span><span>{featured.readTime}</span></div>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-emerald-700">Read featured article <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
            </article>
            <div className="flex min-h-40 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-white p-5 ring-1 ring-emerald-100"><div className="grid h-24 w-24 place-items-center rounded-3xl bg-white shadow-sm ring-1 ring-emerald-100"><BookOpen className="h-10 w-10 text-emerald-600" /></div></div>
          </a>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <a key={post.slug} href={`/blog/${post.slug}`} onClick={openPost(post.slug)} className="group block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25" aria-label={`Read: ${post.title}`}>
              <article className="min-w-0">
                <p className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700">{post.category}</p>
                <h2 className="mt-2 text-lg font-bold leading-snug text-slate-950">{post.title}</h2>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{post.excerpt}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500"><span>{post.date}</span><span>•</span><span>{post.readTime}</span></div>
              </article>
            </a>
          ))}
        </section>
      </div>
    </main>
  );
}
