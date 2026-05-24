import { type ReactNode, useEffect, useState } from 'react';
import { Mail, MessageCircle, Scale, ShieldCheck } from 'lucide-react';
import Hero from './components/Hero';
import Generator from './components/Generator';
import HowItWorks from './components/HowItWorks';
import BulkLinkGenerator from './components/BulkLinkGenerator';
import Features from './components/Features';
import FAQ from './components/FAQ';
import Footer from './components/Footer';
import Header from './components/Header';
import QrCodeEditorPage from './components/QrCodeEditorPage';
import SeoContent from './components/SeoContent';
import BlogListPage from './components/BlogListPage';
import BlogPostPage from './components/BlogPostPage';
import WhatsAppButtonMaker from './components/WhatsAppButtonMaker';
import { QR_EDITOR_STORAGE_KEY } from './components/qrEditorConstants';
import { blogPostsBySlug } from './data/blogPosts';

type PageKey = 'home' | 'privacy' | 'terms' | 'contact' | 'qrCodeEditor' | 'blog' | 'blogPost' | 'whatsappButtonMaker' | 'bulkWhatsappGenerator';

const routeToPage = (pathname: string): { page: PageKey; slug?: string } => {
  if (pathname === '/privacy') return { page: 'privacy' };
  if (pathname === '/terms') return { page: 'terms' };
  if (pathname === '/contact') return { page: 'contact' };
  if (pathname === '/qr-code-editor') return { page: 'qrCodeEditor' };
  if (pathname === '/blog') return { page: 'blog' };
  if (pathname === '/whatsapp-button-maker') return { page: 'whatsappButtonMaker' };
  if (pathname === '/bulk-whatsapp-link-generator') return { page: 'bulkWhatsappGenerator' };
  if (pathname.startsWith('/blog/')) return { page: 'blogPost', slug: pathname.replace('/blog/', '') };
  return { page: 'home' };
};

const pageMetadata: Record<PageKey, { title: string; description: string }> = {
  home: {
    title: 'Zapora - Free WhatsApp Link Generator',
    description:
      'Create WhatsApp chat links instantly with phone number, country code, and optional message.',
  },
  privacy: {
    title: 'Privacy Policy | Zapora',
    description:
      'Read how Zapora handles your data when you generate links and QR codes.',
  },
  terms: {
    title: 'Terms of Use | Zapora',
    description:
      'Review the Terms of Use for Zapora, including acceptable use, service availability, and limitations.',
  },
  contact: {
    title: 'Contact | Zapora',
    description: 'Contact Zapora for support, feedback, or business questions.',
  },
  blog: {
    title: 'Zapora Blog | WhatsApp Guides',
    description: 'Simple guides to help you create WhatsApp links, QR codes, and better chat flows.',
  },
  blogPost: {
    title: 'Blog | Zapora',
    description: 'Helpful WhatsApp link and QR code guides from Zapora.',
  },
  qrCodeEditor: {
    title: 'QR Code Editor | Zapora',
    description: 'Advanced QR design page to customize and preview QR codes for WhatsApp links and URLs.',
  },
  whatsappButtonMaker: {
    title: 'WhatsApp Click-to-Chat Button Maker | Zapora',
    description: 'Create and customize a WhatsApp website chat button and copy a ready-to-use HTML snippet.',
  },
  bulkWhatsappGenerator: {
    title: 'Bulk WhatsApp Link Generator | Zapora',
    description: 'Generate WhatsApp links in bulk using manual input or CSV upload in Zapora.',
  },
};

function App() {
  const initialRoute = routeToPage(window.location.pathname);
  const [currentPage, setCurrentPage] = useState<PageKey>(initialRoute.page);
  const [currentBlogSlug, setCurrentBlogSlug] = useState<string | undefined>(initialRoute.slug);

  useEffect(() => {
    const onPopState = () => {
      const route = routeToPage(window.location.pathname);
      setCurrentPage(route.page);
      setCurrentBlogSlug(route.slug);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const blogPost = currentPage === 'blogPost' && currentBlogSlug ? blogPostsBySlug.get(currentBlogSlug) : null;
    const metadata = currentPage === 'blogPost' && blogPost
      ? { title: `${blogPost.title} | Zapora Blog`, description: blogPost.excerpt }
      : pageMetadata[currentPage];
    document.title = metadata.title;

    const setMeta = (selector: string, content: string, attr: 'name' | 'property') => {
      let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${selector}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attr, selector);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    setMeta('description', metadata.description, 'name');
    setMeta('og:title', metadata.title, 'property');
    setMeta('og:description', metadata.description, 'property');
    setMeta('og:type', currentPage === 'home' ? 'website' : 'article', 'property');
    setMeta('twitter:title', metadata.title, 'name');
    setMeta('twitter:description', metadata.description, 'name');

    const canonicalPath = currentPage === 'home' ? '/'
      : currentPage === 'qrCodeEditor' ? '/qr-code-editor'
      : currentPage === 'blog' ? '/blog'
      : currentPage === 'whatsappButtonMaker' ? '/whatsapp-button-maker'
      : currentPage === 'bulkWhatsappGenerator' ? '/bulk-whatsapp-link-generator'
      : currentPage === 'blogPost' ? `/blog/${currentBlogSlug ?? ''}`
      : `/${currentPage}`;
    const absoluteUrl = `https://www.zapora.in${canonicalPath}`;

    let canonicalTag = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalTag) {
      canonicalTag = document.createElement('link');
      canonicalTag.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalTag);
    }
    canonicalTag.setAttribute('href', absoluteUrl);

    setMeta('og:url', absoluteUrl, 'property');
  }, [currentBlogSlug, currentPage]);

  const navigateTo = (page: Exclude<PageKey, 'blogPost'>, blogSlug?: string) => {
    const targetPath = page === 'home' ? '/' : page === 'qrCodeEditor' ? '/qr-code-editor' : page === 'whatsappButtonMaker' ? '/whatsapp-button-maker' : page === 'bulkWhatsappGenerator' ? '/bulk-whatsapp-link-generator' : page === 'blog' && blogSlug ? `/blog/${blogSlug}` : `/${page}`;
    window.history.pushState({}, '', targetPath);
    setCurrentPage(page === 'blog' && blogSlug ? 'blogPost' : page);
    setCurrentBlogSlug(blogSlug);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToGenerator = () => {
    if (currentPage !== 'home') {
      navigateTo('home');
      window.setTimeout(() => {
        document.getElementById('generator')?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
      return;
    }

    document.getElementById('generator')?.scrollIntoView({ behavior: 'smooth' });
  };

  let pageContent: ReactNode;

  if (currentPage === 'privacy') {
    pageContent = (
      <InfoPage
        icon={ShieldCheck}
        title="Privacy Policy"
        subtitle="Last updated: March 29, 2026"
        sections={[
          {
            heading: 'What this tool does',
            content:
              'WhatsApp Link Generator helps you create a wa.me link and QR code in your browser. The information you type is used only to build your link and is not sent to our server for storage.',
          },
          {
            heading: 'Data we process',
            content:
              'When you click Generate, the phone number, country code, optional message, and generated link may be stored for a limited time for service improvement, analytics, and training/improvement purposes. We do not sell or share this data with third parties.',
          },
          {
            heading: 'Why data is used',
            content:
              'We use this data only to run the tool, improve reliability, and measure basic product usage. We do not sell your personal data.',
          },
          {
            heading: 'Third-party services',
            content:
              'QR codes are generated to support your link workflow. Please avoid including sensitive personal data in pre-filled messages.',
          },
          {
            heading: 'Contact',
            content:
              'For privacy questions, email hizapora@gmail.com. We aim to respond within two business days.',
          },
        ]}
      />
    );
  } else if (currentPage === 'terms') {
    pageContent = (
      <InfoPage
        icon={Scale}
        title="Terms of Use"
        subtitle="Last updated: March 29, 2026"
        sections={[
          {
            heading: 'Acceptance of terms',
            content:
              'By using this website, you agree to these terms. If you do not agree, please stop using the service.',
          },
          {
            heading: 'Service scope',
            content:
              'This tool helps you generate WhatsApp links and QR codes. You are responsible for the numbers and messages you enter.',
          },
          {
            heading: 'Acceptable use',
            content:
              'You must not use this service for spam, harassment, fraud, or illegal activity. We reserve the right to limit misuse that harms users or platform integrity.',
          },
          {
            heading: 'No affiliation',
            content:
              'This project is an independent utility and is not affiliated with, endorsed by, or sponsored by WhatsApp or Meta Platforms, Inc.',
          },
          {
            heading: 'Use at your discretion',
            content:
              'Please use this tool at your own discretion. The service is provided as-is and may depend on third-party platform behavior.',
          },
          {
            heading: 'Contact',
            content:
              'For terms questions, contact hizapora@gmail.com.',
          },
        ]}
      />
    );
  } else if (currentPage === 'contact') {
    pageContent = (
      <InfoPage
        icon={Mail}
        title="Contact"
        subtitle="We are happy to help with support and business questions"
        sections={[
          {
            heading: 'General support',
            content:
              'For troubleshooting, feature requests, or feedback, email hizapora@gmail.com and include as much context as possible.',
          },
          {
            heading: 'Founder contact',
            content: 'For partnerships or founder-level inquiries, contact hizapora@gmail.com.',
          },
          {
            heading: 'Response time',
            content:
              'Our typical response window is one to two business days. For urgent issues, include “Urgent” in your subject line.',
          },
        ]}
        extra={
          <a
            href="mailto:hizapora@gmail.com"
            className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg transition hover:from-green-700 hover:to-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-500/30"
          >
            Email Support
          </a>
        }
      />
    );
  } else if (currentPage === 'qrCodeEditor') {
    pageContent = <QrCodeEditorPage />;
  } else if (currentPage === 'whatsappButtonMaker') {
    pageContent = <WhatsAppButtonMaker />;
  } else if (currentPage === 'bulkWhatsappGenerator') {
    pageContent = <BulkLinkGenerator />;
  } else if (currentPage === 'blog') {
    pageContent = <BlogListPage onOpenPost={(slug) => navigateTo('blog', slug)} />;
  } else if (currentPage === 'blogPost') {
    pageContent = (
      <BlogPostPage
        post={currentBlogSlug ? blogPostsBySlug.get(currentBlogSlug) ?? null : null}
        onNavigateHome={() => navigateTo('home')}
        onNavigateBlog={() => navigateTo('blog')}
        onNavigateQrEditor={() => navigateTo('qrCodeEditor')}
        onOpenPost={(slug) => navigateTo('blog', slug)}
      />
    );
  } else {
    pageContent = (
      <>
        <Hero onGetStarted={scrollToGenerator} />
        <Generator
          onCustomizeQrCode={(link) => {
            localStorage.setItem(QR_EDITOR_STORAGE_KEY, link);
            navigateTo('qrCodeEditor');
          }}
        />
        <HowItWorks />
        <SeoContent />
        <Features />
        <FAQ />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header currentPage={currentPage === 'blogPost' ? 'blog' : currentPage} onNavigate={(page) => navigateTo(page)} />
      {pageContent}
      <Footer currentPage={currentPage === 'blogPost' ? 'blog' : currentPage} onNavigate={(page) => navigateTo(page)} onGetStarted={scrollToGenerator} />
    </div>
  );
}

type InfoPageProps = {
  icon: typeof MessageCircle;
  title: string;
  subtitle: string;
  sections: Array<{ heading: string; content: string }>;
  extra?: ReactNode;
};

function InfoPage({ icon: Icon, title, subtitle, sections, extra }: InfoPageProps) {
  return (
    <main className="relative overflow-hidden bg-gradient-to-b from-white via-green-50/50 to-white py-16 sm:py-20">
      <div className="absolute inset-0 opacity-40">
        <div className="absolute right-10 top-12 h-72 w-72 rounded-full bg-green-100 blur-3xl"></div>
      </div>
      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <article className="rounded-[32px] border border-gray-200 bg-white p-6 shadow-[0_20px_70px_-30px_rgba(0,0,0,0.25)] sm:p-8 lg:p-10">
          <header className="mb-8 border-b border-gray-200 pb-6">
            <div className="mb-4 inline-flex rounded-2xl bg-green-100 p-3 text-green-700">
              <Icon className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">{title}</h1>
            <p className="mt-3 text-base text-gray-600">{subtitle}</p>
          </header>
          <div className="space-y-6">
            {sections.map((section) => (
              <section key={section.heading} className="space-y-2">
                <h2 className="text-xl font-semibold text-gray-900">{section.heading}</h2>
                <p className="leading-relaxed text-gray-600">{section.content}</p>
              </section>
            ))}
          </div>
          {extra ? <div className="mt-8 border-t border-gray-200 pt-6">{extra}</div> : null}
        </article>
      </div>
    </main>
  );
}

export default App;
