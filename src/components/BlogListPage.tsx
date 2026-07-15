import { blogPosts } from '../data/blogPosts';

type Props = {
  onOpenPost: (slug: string) => void;
};

export default function BlogListPage({ onOpenPost }: Props) {
  return (
    <main className="bg-white py-6 sm:py-8 lg:py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="mb-6 max-w-3xl sm:mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">Zapora Blog</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 sm:text-base">
            Simple guides to help you create WhatsApp links, QR codes, and better chat flows.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          {blogPosts.map((post) => (
            <a
              key={post.slug}
              href={`/blog/${post.slug}`}
              onClick={(event) => {
                event.preventDefault();
                onOpenPost(post.slug);
              }}
              className="group block rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_16px_48px_-32px_rgba(15,23,42,0.35)] transition hover:border-green-200 hover:bg-green-50/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-500/20 sm:p-5"
              aria-label={`Read: ${post.title}`}
            >
              <article>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{post.category}</p>
                <h2 className="mt-2 text-lg font-semibold leading-snug text-gray-950">{post.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{post.excerpt}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span>{post.date}</span>
                  <span>•</span>
                  <span>{post.readTime}</span>
                </div>
                <span className="mt-4 inline-flex rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800 transition group-hover:bg-green-100">
                  Read article
                </span>
              </article>
            </a>
          ))}
        </section>
      </div>
    </main>
  );
}
