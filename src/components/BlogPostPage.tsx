import type { BlogPost } from '../data/blogPosts';

type Props = {
  post: BlogPost | null;
  onNavigateHome: () => void;
  onNavigateBlog: () => void;
  onNavigateQrEditor: () => void;
};

export default function BlogPostPage({ post, onNavigateHome, onNavigateBlog, onNavigateQrEditor }: Props) {
  if (!post) {
    return (
      <main className="bg-gradient-to-b from-white via-green-50/40 to-white py-16">
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

  return (
    <main className="bg-gradient-to-b from-white via-green-50/40 to-white py-12 sm:py-16">
      <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <a href="/blog" onClick={(e) => { e.preventDefault(); onNavigateBlog(); }} className="text-sm font-medium text-emerald-700 hover:text-emerald-800">← Back to Blog</a>
        <header className="mt-4 border-b border-gray-200 pb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{post.category}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">{post.title}</h1>
          <p className="mt-3 text-lg text-gray-600">{post.excerpt}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-gray-500">
            <span>{post.date}</span><span>•</span><span>{post.readTime}</span>
          </div>
        </header>

        <div className="mt-8 space-y-8">
          {post.content.map((section) => (
            <section key={section.heading} className="space-y-3">
              <h2 className="text-2xl font-semibold text-gray-900">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="leading-relaxed text-gray-700">{paragraph}</p>
              ))}
            </section>
          ))}

          <section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
            <p className="text-base font-semibold text-emerald-900">Create your WhatsApp link with Zapora</p>
            <a href="/" onClick={(e) => { e.preventDefault(); onNavigateHome(); }} className="mt-2 inline-block text-sm font-semibold text-emerald-800 underline underline-offset-2">Go to homepage</a>
          </section>

          {post.showQrCta ? (
            <section className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-base font-semibold text-gray-900">Customize your QR code</p>
              <button onClick={onNavigateQrEditor} className="mt-2 text-sm font-semibold text-emerald-700 underline underline-offset-2">
                Open QR Code Editor
              </button>
            </section>
          ) : null}
        </div>
      </article>
    </main>
  );
}
