const ICR_DASHBOARD_SRC = '/icr-intelligence-dashboard.html';

export function IcrTrendsDashboardRoute() {
  return (
    <iframe
      src={ICR_DASHBOARD_SRC}
      title="ICR Intelligence Dashboard"
      style={{
        width: '100%',
        height: '100dvh',
        minHeight: '100vh',
        border: 0,
        display: 'block',
      }}
    >
      Your browser does not support iframes. Open the ICR Intelligence Dashboard directly at{' '}
      <a href={ICR_DASHBOARD_SRC}>/icr-intelligence-dashboard.html</a>.
    </iframe>
  );
}
