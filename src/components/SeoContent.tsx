export default function SeoContent() {
  return (
    <section className="bg-gradient-to-b from-white to-emerald-50/40 py-12 sm:py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-7 text-center sm:mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">
            Everything you need to create WhatsApp links and QR codes
          </h2>
          <p className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed text-gray-600 sm:text-base">
            Zapora helps you turn a phone number into a ready-to-share WhatsApp chat link, with optional messages and QR
            codes for posters, websites, social bios, and campaigns.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">What is a WhatsApp link generator?</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              A WhatsApp link generator creates a direct chat link for your number, so people can message you without
              saving your contact first. Add your country code, phone number, and optional message, and Zapora creates
              a ready-to-share link instantly.
            </p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">How to create a WhatsApp link?</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Enter your phone number, choose the correct country code, add an optional pre-filled message, and click
              Generate. You can then copy the link, open it in WhatsApp, or download a QR code for sharing.
            </p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">Why use a WhatsApp QR code?</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              A WhatsApp QR code makes it easier for people to start a chat from offline or visual places like flyers,
              posters, packaging, store counters, business cards, and event banners. Users simply scan the code and
              open your WhatsApp chat.
            </p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">Can I customize my QR code?</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Yes. Use Zapora’s QR Code Editor to add brand colors, a title, subtitle, center emoji or logo, and
              export sizes like Square Post, Story, and Poster while keeping the QR code scannable.
            </p>
            <a
              href="/qr-code-editor"
              className="mt-3 inline-flex items-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
            >
              Customize your QR code
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}
