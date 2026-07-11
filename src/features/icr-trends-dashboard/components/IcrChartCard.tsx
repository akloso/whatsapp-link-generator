import { useEffect, useRef, useState } from 'react';
import type { ChartDefinition } from '../types';

type ChartModule = typeof import('chart.js');
let chartPromise: Promise<ChartModule> | null = null;
let registered = false;

const loadChart = async () => {
  chartPromise ??= import('chart.js');
  const mod = await chartPromise;
  if (!registered) {
    mod.Chart.register(mod.BarController, mod.LineController, mod.DoughnutController, mod.BarElement, mod.LineElement, mod.PointElement, mod.ArcElement, mod.CategoryScale, mod.LinearScale, mod.Tooltip, mod.Legend);
    registered = true;
  }
  return mod;
};

export function IcrChartCard({ chart }: { chart: ChartDefinition }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<import('chart.js').Chart | null>(null);
  const [failed, setFailed] = useState(false);
  const empty = chart.labels.length === 0 || chart.datasets.every((dataset) => dataset.data.every((value) => value === 0));

  useEffect(() => {
    let cancelled = false;
    chartRef.current?.destroy();
    chartRef.current = null;
    setFailed(false);
    if (empty || !canvasRef.current) return undefined;
    loadChart().then(({ Chart }) => {
      if (cancelled || !canvasRef.current) return;
      chartRef.current?.destroy();
      chartRef.current = new Chart(canvasRef.current, {
        type: chart.type,
        data: { labels: chart.labels, datasets: chart.datasets },
        options: { indexAxis: chart.horizontal ? 'y' : 'x', responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { enabled: true } }, scales: chart.type === 'doughnut' ? undefined : { x: { stacked: chart.stacked ?? false, beginAtZero: true }, y: { stacked: chart.stacked ?? false, beginAtZero: true } } },
      });
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; chartRef.current?.destroy(); chartRef.current = null; };
  }, [chart, empty]);

  return <article className="icr-chart-card" aria-labelledby={`${chart.id}-title`}>
    <div className="icr-chart-card__header"><h3 id={`${chart.id}-title`}>{chart.title}</h3></div>
    {empty ? <p className="icr-chart-empty">Not available for the selected rows.</p> : failed ? <p className="icr-chart-empty">Chart could not be loaded. Text summary remains available.</p> : <div className="icr-chart-canvas"><canvas ref={canvasRef} aria-hidden="true" /></div>}
    <p className="icr-chart-summary">{chart.summary || 'No chart values available.'}</p>
  </article>;
}
