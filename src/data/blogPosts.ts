export type BlogInternalLink = {
  href: '/' | '/qr-code-editor' | `/blog/${string}`;
  label: string;
};

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  category: 'WhatsApp Links' | 'QR Codes';
  content: Array<{ heading: string; paragraphs: string[] }>;
  internalLinks: BlogInternalLink[];
  showQrCta?: boolean;
};

export const blogPosts: BlogPost[] = [
  {
    slug: 'how-to-create-whatsapp-link',
    title: 'How to Create a WhatsApp Link in 2026',
    excerpt:
      'Step-by-step tutorial to build, test, and share a WhatsApp chat link with an optional prefilled message.',
    date: 'May 17, 2026',
    readTime: '4 min read',
    category: 'WhatsApp Links',
    internalLinks: [
      { href: '/', label: 'create your WhatsApp link with Zapora' },
      { href: '/qr-code-editor', label: 'customize your WhatsApp QR code' },
      { href: '/blog/whatsapp-link-generator-guide', label: 'read how a WhatsApp link generator works' },
    ],
    content: [
      {
        heading: 'Quick intro',
        paragraphs: [
          'If you want customers to message you in one tap, a WhatsApp chat link is the simplest setup. You can generate it in minutes and use it across social profiles, websites, and print material.',
        ],
      },
      {
        heading: 'What this means',
        paragraphs: [
          'A WhatsApp link is a direct URL that opens chat with your number. Basic format example: https://wa.me/919876543210',
          'You can also include a prefilled message. Example: https://wa.me/919876543210?text=Hi%2C%20I%20want%20to%20know%20more',
        ],
      },
      {
        heading: 'Why it matters',
        paragraphs: [
          'Every extra step can reduce replies. A ready click to chat link removes friction because users do not need to save your number before sending a message.',
        ],
      },
      {
        heading: 'Step-by-step guide',
        paragraphs: [
          '1) Choose the correct country code.',
          '2) Enter your phone number without spaces.',
          '3) Add an optional starter message that sounds natural.',
          '4) Generate your link.',
          '5) Test the link on mobile and desktop.',
          '6) Share it on your website, social bio, and support pages.',
        ],
      },
      {
        heading: 'Practical example',
        paragraphs: [
          'A salon can use one link in Instagram bio with message text like: “Hi, I want to book a haircut this week.” This gives the team context before replying.',
        ],
      },
      {
        heading: 'Common mistakes to avoid',
        paragraphs: [
          'Adding a + sign incorrectly, keeping spaces in the number, selecting the wrong country code, writing an overly long message, or skipping link testing can all break user flow.',
        ],
      },
      {
        heading: 'Best use cases',
        paragraphs: [
          'Great for appointment bookings, product questions, support requests, and lead qualification from landing pages.',
        ],
      },
      {
        heading: 'Short FAQ',
        paragraphs: [
          'Do users need to save my number? No, the chat opens directly.',
          'Should I always add a prefilled message? Optional, but helpful for support and sales context.',
          'Can I turn this into a QR? Yes, generate the link first and then create a QR from it.',
        ],
      },
    ],
    showQrCta: true,
  },
  {
    slug: 'whatsapp-link-generator-guide',
    title: 'WhatsApp Link Generator: What It Is and How It Works',
    excerpt:
      'Clear explainer on what a WhatsApp link generator does, when to use it, and how to avoid common setup errors.',
    date: 'May 17, 2026',
    readTime: '4 min read',
    category: 'WhatsApp Links',
    internalLinks: [
      { href: '/', label: 'generate a WhatsApp chat link' },
      { href: '/qr-code-editor', label: 'open the QR Code Editor' },
      { href: '/blog/create-whatsapp-qr-code-for-business', label: 'read the WhatsApp QR code business guide' },
    ],
    content: [
      {
        heading: 'Quick intro',
        paragraphs: [
          'A WhatsApp link generator helps you build correct chat links quickly. Instead of manual formatting, you enter a number and optional message, then copy a ready URL.',
        ],
      },
      {
        heading: 'What a generator does',
        paragraphs: [
          'It combines country code + phone number and creates a valid link format. If you add text, it safely encodes spaces and symbols so the message opens correctly.',
        ],
      },
      {
        heading: 'Why it matters for real teams',
        paragraphs: [
          'Small businesses can speed up inquiries, freelancers can simplify lead intake, creators can route DMs into WhatsApp, and support teams can reduce back-and-forth setup issues.',
        ],
      },
      {
        heading: 'How prefilled messages work',
        paragraphs: [
          'A prefilled message appears in the user chat box before sending. Example: “Hi, I need pricing details for your service.” The user can edit it before tapping send.',
        ],
      },
      {
        heading: 'Why testing matters',
        paragraphs: [
          'Always test from a phone and one desktop browser. This catches formatting mistakes, wrong number issues, and broken campaign links before users see them.',
        ],
      },
      {
        heading: 'Privacy and safety note',
        paragraphs: [
          'Do not place sensitive personal data in prefilled messages. Keep text generic and let users add private details after chat opens.',
        ],
      },
      {
        heading: 'When to use link vs QR',
        paragraphs: [
          'Use a direct link for websites, social bios, and emails. Use a QR code for posters, counters, packaging, menus, and event banners where scanning is faster than typing.',
        ],
      },
      {
        heading: 'Short FAQ',
        paragraphs: [
          'Is a generator better than manual links? Yes, it reduces avoidable format errors.',
          'Can I track source context? Yes, use different starter messages per channel.',
        ],
      },
    ],
  },
  {
    slug: 'create-whatsapp-qr-code-for-business',
    title: 'How to Create a WhatsApp QR Code for Your Business',
    excerpt:
      'Practical business guide to create, style, and test a WhatsApp QR code that customers can scan instantly.',
    date: 'May 17, 2026',
    readTime: '5 min read',
    category: 'QR Codes',
    showQrCta: true,
    internalLinks: [
      { href: '/', label: 'create your WhatsApp link with Zapora' },
      { href: '/qr-code-editor', label: 'open the QR Code Editor' },
      { href: '/blog/best-places-to-use-whatsapp-qr-code', label: 'see the best places to use a WhatsApp QR code' },
    ],
    content: [
      {
        heading: 'Quick intro',
        paragraphs: [
          'A WhatsApp QR code turns your chat link into a scan-and-message experience. It is ideal when customers are offline or in-store and want instant contact.',
        ],
      },
      {
        heading: 'Why businesses use it',
        paragraphs: [
          'It shortens the path to conversation. Instead of typing a number, users scan and chat immediately, which helps increase real inquiries.',
        ],
      },
      {
        heading: 'Step-by-step setup',
        paragraphs: [
          '1) Create your WhatsApp link first.',
          '2) Open the QR editor.',
          '3) Add a clear title/subtitle like “Scan to chat on WhatsApp.”',
          '4) Choose brand colors with good contrast.',
          '5) Download the QR in high quality.',
          '6) Test scan from different phones before publishing.',
        ],
      },
      {
        heading: 'Practical example',
        paragraphs: [
          'A local shop can place a code at the counter, a restaurant can add it on table cards, a service provider can include it in brochures, and an event team can use it at help desks.',
        ],
      },
      {
        heading: 'Design tips that prevent scan issues',
        paragraphs: [
          'Keep enough white space around the code, avoid low-contrast colors, test final output before printing bulk copies, and avoid covering too much of the center area with logos or stickers.',
        ],
      },
      {
        heading: 'Common mistakes',
        paragraphs: [
          'Skipping tests, using tiny print sizes, or placing the code on reflective backgrounds can reduce scan success.',
        ],
      },
      {
        heading: 'Short FAQ',
        paragraphs: [
          'Should I use a dynamic design? Only if the code remains readable across devices.',
          'Is one QR enough for every campaign? Usually no. Use separate links/messages by campaign when possible.',
        ],
      },
    ],
  },
  {
    slug: 'best-places-to-use-whatsapp-qr-code',
    title: 'Best Places to Use a WhatsApp QR Code',
    excerpt:
      'Use-case guide for choosing high-impact online and offline placements for your WhatsApp QR code.',
    date: 'May 17, 2026',
    readTime: '4 min read',
    category: 'QR Codes',
    showQrCta: true,
    internalLinks: [
      { href: '/', label: 'generate a WhatsApp chat link' },
      { href: '/qr-code-editor', label: 'customize your WhatsApp QR code' },
      { href: '/blog/create-whatsapp-qr-code-for-business', label: 'follow the full business QR setup guide' },
    ],
    content: [
      {
        heading: 'Quick intro',
        paragraphs: [
          'Placement matters more than design trends. A good QR location meets people where they already need help or information.',
        ],
      },
      {
        heading: 'Online placements that work',
        paragraphs: [
          'Website and landing pages: useful when users want instant pre-sales or support answers.',
          'Instagram profile and stories: helpful for creators and small businesses turning profile visits into chats.',
          'Email signature: good for consultants and support agents who want quick follow-ups.',
          'Digital catalogs and PDFs: helps users scan from a second device without copying numbers.',
        ],
      },
      {
        heading: 'Offline placements that work',
        paragraphs: [
          'Shop counters: ideal for immediate product questions.',
          'Product packaging: useful for post-purchase support.',
          'Flyers and posters: good for local promotions.',
          'Business cards and event banners: helps networking contacts message you later.',
        ],
      },
      {
        heading: 'Simple placement table',
        paragraphs: [
          'Placement | Best for | Tip',
          'Shop counter | Walk-in inquiries | Add “Scan to chat now” near the code',
          'Product packaging | After-sales support | Keep code away from folds and edges',
          'Instagram profile | Direct lead capture | Pair with a short value message',
          'Email signature | Service follow-up | Use a consistent starter message',
          'Event banner | High-volume questions | Print large enough for distance scans',
        ],
      },
      {
        heading: 'Common mistakes to avoid',
        paragraphs: [
          'Using a very small code, low-contrast colors, skipping printed scan tests, or linking to unclear starter messages can lower response quality.',
        ],
      },
      {
        heading: 'Best use cases',
        paragraphs: [
          'Great for customer support, booking requests, quote requests, event coordination, and product follow-up conversations.',
        ],
      },
      {
        heading: 'Short FAQ',
        paragraphs: [
          'Should every placement use the same message? Better to tailor it by context.',
          'Do I still need a normal link? Yes, provide both click and scan options for accessibility.',
        ],
      },
    ],
  },
];

export const blogPostsBySlug = new Map(blogPosts.map((post) => [post.slug, post]));
