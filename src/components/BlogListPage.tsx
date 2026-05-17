import { blogPosts } from '../data/blogPosts';

type Props = {
  onOpenPost: (slug: string) => void;
};

export default function BlogListPage({ onOpenPost }: Props) {
  return (
    <main className="bg-gradient-to-b from-white via-green-50/40 to-white py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="mb-10 text-center sm:mb-12">
          <h1 className="text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">Zapora Blog</h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-gray-600 sm:text-lg">
            Simple guides to help you create WhatsApp links, QR codes, and better chat flows.
          </p>
        </header>

        <section className="grid gap-5 sm:grid-cols-2">
          {blogPosts.map((post) => (
            <article key={post.slug} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{post.category}</p>
              <h2 className="mt-2 text-xl font-semibold text-gray-950">{post.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">{post.excerpt}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span>{post.date}</span>
                <span>•</span>
                <span>{post.readTime}</span>
              </div>
              <a
                href={`/blog/${post.slug}`}
                onClick={(event) => {
                  event.preventDefault();
                  onOpenPost(post.slug);
                }}
                className="mt-5 inline-flex rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
              >
                Read article
              </a>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
