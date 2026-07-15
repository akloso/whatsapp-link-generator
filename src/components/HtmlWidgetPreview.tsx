import { Check, Copy, Play, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, Surface, Textarea, TextInput } from './ui';

type PreviewMode = 'safe' | 'interactive';
type PreviewDevice = 'desktop' | 'tablet' | 'mobile';
type StatusTone = 'neutral' | 'success' | 'error';

type StatusMessage = { tone: StatusTone; text: string } | null;

const DEFAULT_HEIGHT = 640;
const MIN_HEIGHT = 240;
const MAX_HEIGHT = 1600;

const previewModes: Array<{ value: PreviewMode; label: string; description: string }> = [
  { value: 'safe', label: 'Safe HTML', description: 'HTML and CSS render while JavaScript is blocked.' },
  { value: 'interactive', label: 'Interactive Widget', description: 'Scripts, forms, popups, and modals can run inside the sandbox.' },
];

const previewDevices: Array<{ value: PreviewDevice; label: string; widthLabel: string }> = [
  { value: 'desktop', label: 'Desktop', widthLabel: '100%' },
  { value: 'tablet', label: 'Tablet', widthLabel: '768px' },
  { value: 'mobile', label: 'Mobile', widthLabel: '390px' },
];

const placeholderCode = `<div style="padding: 24px; font-family: sans-serif;">
  <h2>Hello from Zapora</h2>
  <button onclick="alert('Widget works')">Test button</button>
</div>`;

const buildPreviewDocument = (userCode: string) => `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    html {
      box-sizing: border-box;
    }

    *,
    *::before,
    *::after {
      box-sizing: inherit;
    }

    body {
      margin: 0;
      min-height: 100vh;
      overflow-wrap: anywhere;
    }
  </style>
</head>
<body>
${userCode}
</body>
</html>`;

const clampHeight = (value: number) => Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, value));

export default function HtmlWidgetPreview() {
  const [editorCode, setEditorCode] = useState('');
  const [renderedDocument, setRenderedDocument] = useState('');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('safe');
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('desktop');
  const [customHeight, setCustomHeight] = useState(DEFAULT_HEIGHT);
  const [fullWidth, setFullWidth] = useState(true);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [status, setStatus] = useState<StatusMessage>(null);

  const sandboxValue = previewMode === 'safe' ? '' : 'allow-scripts allow-forms allow-popups allow-modals';
  const previewWidth = useMemo(() => {
    if (fullWidth || previewDevice === 'desktop') return '100%';
    return previewDevice === 'tablet' ? '768px' : '390px';
  }, [fullWidth, previewDevice]);

  const runPreview = () => {
    const trimmedCode = editorCode.trim();
    if (!trimmedCode) {
      setRenderedDocument('');
      setPreviewVersion((version) => version + 1);
      setStatus({ tone: 'neutral', text: 'Paste widget or HTML code, then choose Run Preview to render it here.' });
      return;
    }

    setRenderedDocument(buildPreviewDocument(editorCode));
    setPreviewVersion((version) => version + 1);
    setStatus({ tone: 'success', text: `Preview rendered in ${previewMode === 'safe' ? 'Safe HTML' : 'Interactive Widget'} mode.` });
  };

  const reloadPreview = () => {
    if (!renderedDocument) {
      setStatus({ tone: 'neutral', text: 'There is no rendered preview to reload yet.' });
      return;
    }
    setPreviewVersion((version) => version + 1);
    setStatus({ tone: 'success', text: 'Preview reloaded without reading from the editor.' });
  };

  const clearCode = () => {
    setEditorCode('');
    setStatus({ tone: 'neutral', text: 'Code cleared. The current preview stays visible until you run or reset the preview.' });
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(editorCode);
      setStatus({ tone: 'success', text: 'Code copied from the editor.' });
    } catch {
      setStatus({ tone: 'error', text: 'Could not copy code. Please select and copy it manually.' });
    }
  };

  const resetPreview = () => {
    setEditorCode('');
    setRenderedDocument('');
    setPreviewMode('safe');
    setPreviewDevice('desktop');
    setCustomHeight(DEFAULT_HEIGHT);
    setFullWidth(true);
    setPreviewVersion((version) => version + 1);
    setStatus(null);
  };

  const updateMode = (mode: PreviewMode) => {
    setPreviewMode(mode);
    if (renderedDocument) {
      setPreviewVersion((version) => version + 1);
      setStatus({ tone: 'neutral', text: `Mode changed to ${mode === 'safe' ? 'Safe HTML' : 'Interactive Widget'}. The iframe was recreated with the new sandbox setting.` });
    }
  };

  const updateHeight = (value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      setStatus({ tone: 'error', text: `Enter a numeric height between ${MIN_HEIGHT} and ${MAX_HEIGHT}px.` });
      return;
    }
    const clamped = clampHeight(Math.round(parsed));
    setCustomHeight(clamped);
    if (clamped !== parsed) {
      setStatus({ tone: 'neutral', text: `Preview height was limited to ${clamped}px.` });
    }
  };

  return (
    <main className="bg-[linear-gradient(180deg,#ffffff_0%,#f7fdf9_100%)] py-8 sm:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-6 max-w-3xl sm:mb-8">
          <p className="mb-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Other Tool</p>
          <h1 className="text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">HTML &amp; Widget Preview</h1>
          <p className="mt-3 text-base leading-7 text-gray-600">Paste HTML, iframe, form, or JavaScript widget code and test it safely before adding it to your website.</p>
          <p className="mt-2 text-sm font-medium text-gray-600">This page is not a complete coding IDE and does not support React npm components, backend code, or package installation.</p>
        </header>

        <section className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900" aria-label="Security warning">
          <p className="font-bold">Do not paste passwords, API keys, private tokens, customer data, or confidential code.</p>
          <p className="mt-1">Interactive widgets may contact external third-party servers because scripts, forms, images, iframes, and network requests run inside the preview iframe.</p>
        </section>

        <section className="mb-6 grid gap-3 rounded-2xl border border-emerald-100 bg-white p-4 text-sm text-gray-700 shadow-sm md:grid-cols-2">
          <div><span className="font-semibold text-gray-950">Supported:</span> HTML, style tags, div snippets, iframe embeds, forms, buttons, external scripts, inline and popup browser widgets.</div>
          <div><span className="font-semibold text-gray-950">Not supported:</span> React/Vue npm components, Node.js, PHP, Python, database code, private secrets, backend APIs, or build environments.</div>
        </section>

        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Surface className="min-w-0 p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <label htmlFor="html-widget-code" className="block text-sm font-semibold text-gray-900">Widget or HTML code</label>
                <p className="mt-1 text-sm text-gray-600">Typing only updates the editor. Use Run Preview to refresh the iframe.</p>
              </div>
            </div>
            <Textarea id="html-widget-code" value={editorCode} onChange={(event) => setEditorCode(event.target.value)} placeholder={placeholderCode} spellCheck={false} className="min-h-[360px] resize-y font-mono text-xs leading-5 sm:text-sm" />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" onClick={runPreview} icon={<Play className="h-4 w-4" />}>Run Preview</Button>
              <Button onClick={reloadPreview} icon={<RefreshCw className="h-4 w-4" />}>Reload Preview</Button>
              <Button onClick={clearCode} icon={<Trash2 className="h-4 w-4" />}>Clear Code</Button>
              <Button onClick={copyCode} icon={<Copy className="h-4 w-4" />}>Copy Code</Button>
              <Button onClick={resetPreview} icon={<RotateCcw className="h-4 w-4" />}>Reset Preview</Button>
            </div>
            <div aria-live="polite" className={`mt-3 min-h-5 text-sm font-medium ${status?.tone === 'success' ? 'text-emerald-700' : status?.tone === 'error' ? 'text-rose-700' : 'text-gray-600'}`}>{status?.text}</div>
          </Surface>

          <Surface className="min-w-0 overflow-hidden p-4 sm:p-5">
            <div className="space-y-4">
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-gray-900">Preview mode</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {previewModes.map((mode) => {
                    const selected = previewMode === mode.value;
                    return <button key={mode.value} type="button" onClick={() => updateMode(mode.value)} aria-pressed={selected} className={`rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20 ${selected ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-gray-200 bg-white text-gray-700 hover:border-emerald-200'}`}><span className="flex items-center gap-2 text-sm font-bold">{selected ? <Check className="h-4 w-4" /> : null}{mode.label}</span><span className="mt-1 block text-xs leading-5 text-gray-600">{mode.description}</span></button>;
                  })}
                </div>
              </fieldset>

              <div className="grid gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-3 sm:grid-cols-[1fr_auto]">
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold text-gray-900">Preview size</legend>
                  <div className="flex flex-wrap gap-2">
                    {previewDevices.map((device) => <button key={device.value} type="button" onClick={() => setPreviewDevice(device.value)} aria-pressed={previewDevice === device.value} className={`rounded-xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 ${previewDevice === device.value ? 'border-emerald-500 bg-white text-emerald-800 shadow-sm' : 'border-gray-200 bg-white text-gray-700 hover:border-emerald-200'}`}>{device.label} <span className="font-normal text-gray-500">{device.widthLabel}</span></button>)}
                  </div>
                </fieldset>
                <div className="grid gap-3 sm:min-w-52">
                  <label className="text-sm font-semibold text-gray-900" htmlFor="preview-height">Custom preview height</label>
                  <TextInput id="preview-height" type="number" min={MIN_HEIGHT} max={MAX_HEIGHT} value={customHeight} onChange={(event) => updateHeight(event.target.value)} inputMode="numeric" />
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800"><input type="checkbox" checked={fullWidth} onChange={(event) => setFullWidth(event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" /> Full-width preview</label>
                </div>
              </div>

              <div className="overflow-auto rounded-2xl border border-gray-200 bg-slate-100 p-3">
                <div className="mx-auto max-w-full rounded-xl border border-gray-200 bg-white shadow-sm" style={{ width: previewWidth }}>
                  {renderedDocument ? (
                    <iframe key={`${previewMode}-${previewVersion}`} title="Widget Preview" srcDoc={renderedDocument} sandbox={sandboxValue} referrerPolicy="no-referrer" allow="" className="block w-full rounded-xl bg-white" style={{ height: customHeight }} />
                  ) : (
                    <div className="flex items-center justify-center rounded-xl bg-white p-6 text-center text-sm leading-6 text-gray-600" style={{ minHeight: customHeight }}>
                      <div><p className="font-semibold text-gray-900">Preview will appear after Run Preview.</p><p className="mt-2">No visible output appeared. The code may have no visible interface, may be blocked by the provider, or may require a different environment.</p></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Surface>
        </div>

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 text-sm leading-6 text-gray-700 sm:p-5">
          <h2 className="text-base font-bold text-gray-950">Compatibility notice</h2>
          <p className="mt-2">Some widgets may not work because providers can require domain whitelisting, block iframe execution, require third-party cookies, restrict CORS requests, check the current hostname, block sandboxed environments, require backend tokens, block mixed-content HTTP resources, enforce browser security policies, or use fixed heights that cause layout issues. The preview uses <code className="rounded bg-gray-100 px-1 py-0.5">referrerPolicy=&quot;no-referrer&quot;</code>, which can intentionally break widgets that require referrer information. Zapora does not weaken this privacy setting for compatibility.</p>
        </section>
      </div>
    </main>
  );
}
