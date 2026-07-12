export function ChartErrorState({message}:{message:string}){ return <div className="icr-dashboard__chart-state" role="status"><strong>Chart unavailable</strong><p>{message}</p></div>; }
