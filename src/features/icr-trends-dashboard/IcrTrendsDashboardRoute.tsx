const ICR_DASHBOARD_SRC = '/icr-intelligence-dashboard.html';

export function IcrTrendsDashboardRoute() {
  return (
    <main className="relative z-0 bg-white" aria-label="ICR Trends Dashboard">
      <section className="min-h-[calc(100dvh-var(--zapora-header-height,4rem))]" aria-label="Embedded ICR Intelligence Dashboard">
        <iframe
          src={ICR_DASHBOARD_SRC}
          title="ICR Intelligence Dashboard"
          style={{
            width: '100%',
            minHeight: 'calc(100dvh - var(--zapora-header-height, 4rem))',
            height: 'calc(100dvh - var(--zapora-header-height, 4rem))',
            border: 0,
            display: 'block',
          }}
        >
          Your browser does not support iframes. Open the ICR Intelligence Dashboard directly at{' '}
          <a href={ICR_DASHBOARD_SRC}>/icr-intelligence-dashboard.html</a>.
        </iframe>
      </section>
    </main>
  );
}
