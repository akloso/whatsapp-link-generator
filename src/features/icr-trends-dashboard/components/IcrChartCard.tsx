import { useEffect, useRef, useState } from 'react';
import type { Chart, ChartConfiguration } from 'chart.js';

type IcrChartCardProps = {
  title: string;
  description: string;
  config: ChartConfiguration;
  empty?: boolean;
};

export function IcrChartCard({ title, description, config, empty = false }: IcrChartCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const renderChart = async () => {
      chartRef.current?.destroy();
      chartRef.current = null;
      if (!canvasRef.current || empty) return;
      try {
        const module = await import('chart.js/auto');
        if (cancelled || !canvasRef.current) return;
        chartRef.current = new module.default(canvasRef.current, config);
        setError('');
      } catch {
        if (!cancelled) setError('Chart renderer could not be loaded. Refresh and try again.');
      }
    };
    void renderChart();
    return () => {
      cancelled = true;
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [config, empty]);

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-950">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      <div className="relative h-72 min-w-0">
        {empty ? <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-500">No data in the selected range.</div> : null}
        {!empty ? <canvas ref={canvasRef} role="img" aria-label={title} /> : null}
        {error ? <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-red-50 p-4 text-center text-sm text-red-800">{error}</div> : null}
      </div>
    </article>
  );
}
