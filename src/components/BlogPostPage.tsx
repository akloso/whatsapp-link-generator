import { blogPosts, type BlogPost } from '../data/blogPosts';

type Props = {
  post: BlogPost | null;
  onNavigateHome: () => void;
  onNavigateBlog: () => void;
  onNavigateQrEditor: () => void;
  onOpenPost: (slug: string) => void;
};

export default function BlogPostPage({ post, onNavigateHome, onNavigateBlog, onNavigateQrEditor, onOpenPost }: Props) {
  if (!post) {
    return (
      <main className="zapora-warm-bg py-10 sm:py-12">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Blog</p>
          <h1 className="mt-3 text-3xl font-bold text-gray-950 sm:text-4xl">Post not found</h1>
          <p className="mt-4 text-gray-600">The article you are looking for does not exist or may have moved.</p>
          <button onClick={onNavigateBlog} className="mt-6 rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700">
            Back to Blog
          </button>
        </div>
      </main>
    );
  }

  const relatedPosts = blogPosts
    .filter((candidate) => candidate.slug !== post.slug)
    .sort((a, b) => Number(b.category === post.category) - Number(a.category === post.category))
    .slice(0, 2);

  const handleInternalNavigation = (href: string) => {
    if (href === '/') {
      onNavigateHome();
      return;
    }
    if (href === '/qr-code-editor') {
      onNavigateQrEditor();
      return;
    }
    if (href.startsWith('/blog/')) {
      onOpenPost(href.replace('/blog/', ''));
    }
  };

  return (
    <main className="zapora-warm-bg py-8 sm:py-10">
      <article className="mx-auto max-w-[740px] px-4 sm:px-6 lg:px-8">
        <a href="/blog" onClick={(e) => { e.preventDefault(); onNavigateBlog(); }} className="text-sm font-medium text-emerald-700 hover:text-emerald-800">← Back to Blog</a>
        <header className="mt-4 border-b border-gray-200 pb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{post.category}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-950 sm:text-4xl">{post.title}</h1>
          <p className="mt-3 text-base leading-7 text-gray-600">{post.excerpt}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-gray-500">
            <span>{post.date}</span><span>•</span><span>{post.readTime}</span>
          </div>
        </header>

        <div className="mt-7 space-y-7">
          {post.content.map((section) => (
            <section key={section.heading} className="space-y-3">
              <h2 className="text-xl font-semibold text-gray-900 sm:text-2xl">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-base leading-7 text-gray-700">{paragraph}</p>
              ))}
            </section>
          ))}

          <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
            <h3 className="text-base font-semibold text-gray-900">Helpful next steps</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-700">
              {post.internalLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={(event) => {
                      event.preventDefault();
                      handleInternalNavigation(link.href);
                    }}
                    className="font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-green-100 bg-green-50 p-4 sm:p-5">
            <p className="text-base font-semibold text-emerald-900">Create your WhatsApp link with Zapora</p>
            <a href="/" onClick={(e) => { e.preventDefault(); onNavigateHome(); }} className="mt-2 inline-block text-sm font-semibold text-emerald-800 underline underline-offset-2">Go to homepage generator</a>
          </section>

          {post.showQrCta ? (
            <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
              <p className="text-base font-semibold text-gray-900">Customize your QR code</p>
              <button onClick={onNavigateQrEditor} className="mt-2 text-sm font-semibold text-emerald-700 underline underline-offset-2">
                Open QR Code Editor
              </button>
            </section>
          ) : null}

          <section>
            <h3 className="text-xl font-semibold text-gray-950">Related guides</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {relatedPosts.map((related) => (
                <a
                  key={related.slug}
                  href={`/blog/${related.slug}`}
                  onClick={(event) => {
                    event.preventDefault();
                    onOpenPost(related.slug);
                  }}
                  className="rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-green-200 hover:bg-green-50/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-500/20"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{related.category}</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">{related.title}</p>
                  <p className="mt-2 text-xs leading-relaxed text-gray-600">{related.excerpt}</p>
                </a>
              ))}
            </div>
          </section>
        </div>
      </article>
    </main>
  );
}
