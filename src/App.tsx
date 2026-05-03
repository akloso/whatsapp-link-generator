import { type ReactNode, useEffect, useState } from 'react';
import { Mail, MessageCircle, Scale, ShieldCheck } from 'lucide-react';
import Hero from './components/Hero';
import Generator from './components/Generator';
import HowItWorks from './components/HowItWorks';
import Features from './components/Features';
import FAQ from './components/FAQ';
import Footer from './components/Footer';
import Header from './components/Header';

type PageKey = 'home' | 'privacy' | 'terms' | 'contact';

const routeToPage = (pathname: string): PageKey => {
  if (pathname === '/privacy') return 'privacy';
  if (pathname === '/terms') return 'terms';
  if (pathname === '/contact') return 'contact';
  return 'home';
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
      'Read how Zapora handles your data. We keep processing in your browser and do not store generated numbers or messages.',
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
};

function App() {
  const [currentPage, setCurrentPage] = useState<PageKey>(() => routeToPage(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setCurrentPage(routeToPage(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const metadata = pageMetadata[currentPage];
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

    const canonicalPath = currentPage === 'home' ? '/' : `/${currentPage}`;
    const absoluteUrl = `https://www.zapora.in${canonicalPath}`;

    let canonicalTag = document.head.querySelector<HTMLLinkElement>('link[rel=\"canonical\"]');
    if (!canonicalTag) {
      canonicalTag = document.createElement('link');
      canonicalTag.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalTag);
    }
    canonicalTag.setAttribute('href', absoluteUrl);

    setMeta('og:url', absoluteUrl, 'property');
  }, [currentPage]);

  const navigateTo = (page: PageKey) => {
    const targetPath = page === 'home' ? '/' : `/${page}`;
    window.history.pushState({}, '', targetPath);
    setCurrentPage(page);
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
              'WhatsApp Link Generator helps you create a wa.me link and QR code in your browser. The information you type is used to build your link. After you generate a link, entered details may also be stored for analytics, product improvement, and service functionality.',
          },
          {
            heading: 'Data we process',
            content:
              'We process your selected country code, phone number, and optional message locally in your browser session to generate your link. We do not require account registration.',
          },
          {
            heading: 'Cookies and analytics',
            content:
              'We may use basic analytics to understand site performance and reliability. We do not sell personal data. If analytics are used, they are intended for product improvement only.',
          },
          {
            heading: 'Third-party services',
            content:
              'QR images are generated through a third-party QR service endpoint when you create a code. Please avoid including sensitive personal data in pre-filled messages.',
          },
          {
            heading: 'Contact',
            content:
              'For privacy questions or requests, email hizapora@gmail.com. We aim to respond within two business days.',
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
              'This tool is provided to generate WhatsApp links and QR codes. You are responsible for the phone numbers, messages, and campaigns you create.',
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
            heading: 'Warranty and liability',
            content:
              'The service is provided “as is” without warranties. We are not liable for direct or indirect losses resulting from use, interruption, or external third-party platform changes.',
          },
          {
            heading: 'Changes to terms',
            content:
              'We may update these terms to reflect product or legal changes. Updated terms are effective once published on this page.',
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
  } else {
    pageContent = (
      <>
        <Hero onGetStarted={scrollToGenerator} />
        <Generator />
        <HowItWorks />
        <Features />
        <FAQ />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header onHomeClick={() => navigateTo('home')} />
      {pageContent}
      <Footer currentPage={currentPage} onNavigate={navigateTo} onGetStarted={scrollToGenerator} />
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
