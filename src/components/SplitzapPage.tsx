export default function SplitzapPage() {
  return (
    <main className="bg-[#f6fbfc]">
      <iframe
        src="/splitzap-app.html"
        title="Splitzap expense calculator"
        className="block h-[calc(100vh-var(--zapora-header-height))] min-h-[920px] w-full border-0 bg-[#f6fbfc]"
      />
    </main>
  );
}
