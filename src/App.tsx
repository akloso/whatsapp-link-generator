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
import { IcrTrendsDashboardRoute } from './features/icr-trends-dashboard/IcrTrendsDashboardRoute';

type PageKey = 'home' | 'privacy' | 'terms' | 'contact' | 'qrCodeEditor' | 'blog' | 'blogPost' | 'whatsappButtonMaker' | 'bulkWhatsappGenerator' | 'icrTrendsDashboard';

const routeToPage = (pathname: string): { page: PageKey; slug?: string } => {
  if (pathname === '/privacy') return { page: 'privacy' };
  if (pathname === '/terms') return { page: 'terms' };
  if (pathname === '/contact') return { page: 'contact' };
  if (pathname === '/qr-code-editor') return { page: 'qrCodeEditor' };
  if (pathname === '/blog') return { page: 'blog' };
  if (pathname === '/whatsapp-button-maker') return { page: 'whatsappButtonMaker' };
  if (pathname === '/bulk-whatsapp-link-generator') return { page: 'bulkWhatsappGenerator' };
  if (pathname === '/icr-trends-dashboard') return { page: 'icrTrendsDashboard' };
  if (pathname.startsWith('/blog/')) return { page: 'blogPost', slug: pathname.replace('/blog/', '') };
  return { page: 'home' };
};

const SITE_URL = 'https://www.zapora.in';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.jpg`;

type SeoMetadata = {
  title: string;
  description: string;
  canonicalPath: string;
  ogType?: 'website' | 'article';
  robots?: 'index, follow' | 'noindex, nofollow' | 'noindex, nofollow, noarchive, nosnippet';
};

const pageMetadata: Record<Exclude<PageKey, 'blogPost'>, SeoMetadata> = {
  home: {
    title: 'Zapora — WhatsApp Links & QR Codes Made Simple',
    description:
      'Create clean WhatsApp chat links, QR codes, bulk links, and click-to-chat buttons in seconds. Free, fast, and easy to use.',
    canonicalPath: '/',
    ogType: 'website',
  },
  privacy: {
    title: 'Privacy Policy | Zapora',
    description:
      'Read Zapora’s privacy policy to understand what information may be collected, how it is used, and how to contact us.',
    canonicalPath: '/privacy',
  },
  terms: {
    title: 'Terms of Use | Zapora',
    description:
      'Read the terms of use for Zapora’s WhatsApp link generator, QR code editor, and related free tools.',
    canonicalPath: '/terms',
  },
  contact: {
    title: 'Contact Zapora',
    description: 'Contact Zapora for questions, feedback, or support related to WhatsApp links, QR codes, and click-to-chat tools.',
    canonicalPath: '/contact',
  },
  qrCodeEditor: {
    title: 'QR Code Editor — Customize WhatsApp QR Codes | Zapora',
    description:
      'Design and download custom WhatsApp QR codes with colors, banners, center icons, and export options for PNG, JPG, and SVG.',
    canonicalPath: '/qr-code-editor',
  },
  blog: {
    title: 'Zapora Blog — WhatsApp Links, QR Codes & Chat Tools',
    description:
      'Read practical guides on WhatsApp links, QR codes, click-to-chat buttons, and simple ways to help customers start conversations faster.',
    canonicalPath: '/blog',
  },
  whatsappButtonMaker: {
    title: 'WhatsApp Button Maker — Create Click-to-Chat Buttons | Zapora',
    description:
      'Create clean WhatsApp click-to-chat buttons for your website with custom labels, colors, icons, and placement options.',
    canonicalPath: '/whatsapp-button-maker',
  },
  bulkWhatsappGenerator: {
    title: 'Bulk WhatsApp Link Generator — Create Multiple Links | Zapora',
    description:
      'Generate multiple WhatsApp chat links at once using manual input or CSV upload. Fast, simple, private, and free to use.',
    canonicalPath: '/bulk-whatsapp-link-generator',
  },
  icrTrendsDashboard: {
    title: 'ICR Trends Dashboard | Zapora',
    description:
      'Review ICR workbook structure, client intelligence, and data quality in a private browser-based workspace.',
    canonicalPath: '/icr-trends-dashboard',
    robots: 'noindex, nofollow, noarchive, nosnippet',
  },
};

const blogSeoBySlug: Record<string, SeoMetadata> = {
  'how-to-create-whatsapp-link': {
    title: 'How to Create a WhatsApp Link — Step-by-Step Guide | Zapora',
    description:
      'Learn how to create a WhatsApp chat link with a phone number and pre-filled message, then share it across your website, social bio, ads, and campaigns.',
    canonicalPath: '/blog/how-to-create-whatsapp-link',
  },
  'whatsapp-link-generator-guide': {
    title: 'WhatsApp Link Generator Guide for Businesses | Zapora',
    description:
      'Understand how WhatsApp link generators work, when to use them, and how businesses can create cleaner customer conversation entry points.',
    canonicalPath: '/blog/whatsapp-link-generator-guide',
  },
  'create-whatsapp-qr-code-for-business': {
    title: 'Create a WhatsApp QR Code for Your Business | Zapora',
    description:
      'Learn how to create WhatsApp QR codes for shops, flyers, posters, packaging, events, and customer support touchpoints.',
    canonicalPath: '/blog/create-whatsapp-qr-code-for-business',
  },
  'best-places-to-use-whatsapp-qr-code': {
    title: 'Best Places to Use WhatsApp QR Codes | Zapora',
    description:
      'Explore practical places to use WhatsApp QR codes, including storefronts, posters, business cards, packaging, social media, and customer support.',
    canonicalPath: '/blog/best-places-to-use-whatsapp-qr-code',
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
    const defaultHomeMetadata = pageMetadata.home;
    const blogPost = currentPage === 'blogPost' && currentBlogSlug ? blogPostsBySlug.get(currentBlogSlug) : null;
    const metadata = currentPage === 'blogPost'
      ? (currentBlogSlug ? blogSeoBySlug[currentBlogSlug] : undefined) ?? {
        title: blogPost ? `${blogPost.title} | Zapora` : defaultHomeMetadata.title,
        description: blogPost?.excerpt ?? defaultHomeMetadata.description,
        canonicalPath: blogPost ? `/blog/${blogPost.slug}` : '/',
        ogType: 'article' as const,
      }
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

    const absoluteUrl = `${SITE_URL}${metadata.canonicalPath}`;

    setMeta('description', metadata.description, 'name');
    setMeta('robots', metadata.robots ?? 'index, follow', 'name');
    setMeta('og:title', metadata.title, 'property');
    setMeta('og:description', metadata.description, 'property');
    setMeta('og:type', metadata.ogType ?? (currentPage === 'home' ? 'website' : 'article'), 'property');
    setMeta('og:url', absoluteUrl, 'property');
    setMeta('og:image', DEFAULT_OG_IMAGE, 'property');
    setMeta('twitter:card', 'summary_large_image', 'name');
    setMeta('twitter:title', metadata.title, 'name');
    setMeta('twitter:description', metadata.description, 'name');
    setMeta('twitter:image', DEFAULT_OG_IMAGE, 'name');

    let canonicalTag = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalTag) {
      canonicalTag = document.createElement('link');
      canonicalTag.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalTag);
    }
    canonicalTag.setAttribute('href', absoluteUrl);
  }, [currentBlogSlug, currentPage]);

  const navigateTo = (page: Exclude<PageKey, 'blogPost'>, blogSlug?: string) => {
    const targetPath = page === 'home' ? '/' : page === 'qrCodeEditor' ? '/qr-code-editor' : page === 'whatsappButtonMaker' ? '/whatsapp-button-maker' : page === 'bulkWhatsappGenerator' ? '/bulk-whatsapp-link-generator' : page === 'icrTrendsDashboard' ? '/icr-trends-dashboard' : page === 'blog' && blogSlug ? `/blog/${blogSlug}` : `/${page}`;
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
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-500/30"
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
  } else if (currentPage === 'icrTrendsDashboard') {
    pageContent = <IcrTrendsDashboardRoute />;
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
    <div className="min-h-screen bg-white [--zapora-header-height:4rem]">
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
    <main className="bg-white py-8 sm:py-10">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_16px_48px_-32px_rgba(15,23,42,0.35)] sm:p-6">
          <header className="mb-6 border-b border-gray-200 pb-5">
            <div className="mb-3 inline-flex rounded-xl bg-green-50 p-2.5 text-green-700">
              <Icon className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-gray-600 sm:text-base">{subtitle}</p>
          </header>
          <div className="space-y-5">
            {sections.map((section) => (
              <section key={section.heading} className="space-y-2">
                <h2 className="text-lg font-semibold text-gray-900">{section.heading}</h2>
                <p className="text-sm leading-6 text-gray-600 sm:text-base">{section.content}</p>
              </section>
            ))}
          </div>
          {extra ? <div className="mt-6 border-t border-gray-200 pt-5">{extra}</div> : null}
        </article>
      </div>
    </main>
  );
}

export default App;
