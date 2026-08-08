export default function SplitzapPage() {
  return (
    <main className="fixed inset-0 z-[100] h-[100dvh] w-screen overflow-hidden bg-[#f8fafc] md:static md:z-auto md:h-auto md:w-auto md:overflow-visible md:bg-[#f6fbfc]">
      <iframe
        src="/splitzap-app.html"
        title="Splitzap expense calculator"
        className="block h-[100dvh] w-full border-0 bg-[#f8fafc] md:h-[calc(100vh-var(--zapora-header-height))] md:min-h-[920px] md:bg-[#f6fbfc]"
      />
    </main>
  );
}
