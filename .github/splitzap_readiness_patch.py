from pathlib import Path
import json


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if text.count(old) != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {text.count(old)}')
    return text.replace(old, new, 1)

# ---- splitStoreV4: resilient persistence + backup/restore ----
store_path = Path('src/features/splitzap/splitStoreV4.ts')
store = store_path.read_text()
store = replace_once(
    store,
    "const KEY = 'splitzap.v2';\nconst LEGACY_KEY = 'splitzap.v1';",
    "const KEY = 'splitzap.v2';\nconst LEGACY_KEY = 'splitzap.v1';\nconst RECOVERY_KEY = 'splitzap.v2.recovery';",
    'storage keys',
)

marker = "export type SplitData = {\n  me: string;\n  myName?: string;\n  groups: Group[];\n  expenses: Expense[];\n  settlements: Settlement[];\n  history?: ExpenseHistoryEntry[];\n};"
store = replace_once(
    store,
    marker,
    marker + "\n\nexport type SplitzapBackup = {\n  app: 'Splitzap';\n  version: 2;\n  exportedAt: string;\n  data: SplitData;\n};",
    'backup type',
)

start = store.index('let listeners: Array<() => void> = [];')
end = store.index('export function additionalChargesTotal')
new_persistence = r'''let listeners: Array<() => void> = [];
let storageListeners: Array<() => void> = [];
let cache: SplitData | null = null;
let storageError: string | null = null;

function setStorageError(message: string | null) {
  storageError = message;
  storageListeners.forEach((listener) => listener());
}

export function useSplitStorageStatus() {
  const [error, setError] = useState<string | null>(storageError);
  useEffect(() => {
    const listener = () => setError(storageError);
    storageListeners.push(listener);
    return () => { storageListeners = storageListeners.filter((item) => item !== listener); };
  }, []);
  return { storageError: error, clearStorageError: () => setStorageError(null) };
}

function parsedData(raw: string): SplitData {
  return normalize(JSON.parse(raw) as SplitData);
}

function read(): SplitData {
  if (cache) return cache;
  if (typeof window === 'undefined') return EMPTY;

  let current: string | null = null;
  try {
    current = window.localStorage.getItem(KEY);
  } catch {
    setStorageError('Browser storage is unavailable. Changes can work for this session but may not survive a refresh.');
    cache = emptyData();
    return cache;
  }

  if (current) {
    try {
      cache = parsedData(current);
      return cache;
    } catch {
      try {
        const recovery = window.localStorage.getItem(RECOVERY_KEY);
        if (recovery) {
          cache = parsedData(recovery);
          try { window.localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* keep recovered data in memory */ }
          setStorageError('Splitzap recovered your data from its local safety copy. Export a backup before continuing.');
          return cache;
        }
      } catch { /* recovery unavailable */ }
      setStorageError('Stored Splitzap data could not be read. Restore a backup before adding new expenses.');
      cache = emptyData();
      return cache;
    }
  }

  try {
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      cache = stripLegacyDemo(parsedData(legacy));
      try { window.localStorage.setItem(KEY, JSON.stringify(cache)); } catch {
        setStorageError('Your old Splitzap data was loaded, but the upgraded copy could not be saved. Export a backup now.');
      }
      return cache;
    }
  } catch {
    setStorageError('Browser storage is unavailable. Changes can work for this session but may not survive a refresh.');
  }

  cache = emptyData();
  return cache;
}

function write(next: SplitData): boolean {
  cache = normalize(next);
  let saved = true;
  if (typeof window !== 'undefined') {
    try {
      const previous = window.localStorage.getItem(KEY);
      if (previous) {
        try { window.localStorage.setItem(RECOVERY_KEY, previous); } catch { /* recovery copy is best-effort */ }
      }
      window.localStorage.setItem(KEY, JSON.stringify(cache));
      setStorageError(null);
    } catch {
      saved = false;
      setStorageError('Splitzap could not save this change to your device. Storage may be full or blocked. Export a backup before closing the app.');
    }
  }
  listeners.forEach((listener) => listener());
  return saved;
}

function validateBackupCandidate(value: unknown): value is SplitData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SplitData>;
  if (typeof candidate.me !== 'string' || !Array.isArray(candidate.groups) || !Array.isArray(candidate.expenses) || !Array.isArray(candidate.settlements)) return false;
  return candidate.groups.every((group) => Boolean(group)
    && typeof group.id === 'string'
    && typeof group.name === 'string'
    && typeof group.emoji === 'string'
    && typeof group.currency === 'string'
    && Array.isArray(group.members)
    && group.members.every((member) => Boolean(member) && typeof member.id === 'string' && typeof member.name === 'string'));
}

export function createSplitBackup(): string {
  const payload: SplitzapBackup = {
    app: 'Splitzap',
    version: 2,
    exportedAt: new Date().toISOString(),
    data: read(),
  };
  return JSON.stringify(payload, null, 2);
}

export function restoreSplitBackup(raw: string): SplitData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('This is not a valid Splitzap backup file.');
  }
  const envelope = parsed && typeof parsed === 'object' ? parsed as Partial<SplitzapBackup> : null;
  const candidate = envelope?.app === 'Splitzap' && envelope.data ? envelope.data : parsed;
  if (!validateBackupCandidate(candidate)) throw new Error('This backup does not contain valid Splitzap data.');
  const next = normalize(candidate);
  if (!write(next)) throw new Error('The backup was read, but your browser could not save the restored data.');
  return next;
}

export function useSplitData() {
  const [hydrated, setHydrated] = useState(false);
  const [data, setData] = useState<SplitData>(EMPTY);
  useEffect(() => {
    const initial = read();
    try {
      if (!window.localStorage.getItem(KEY) && !storageError) write(initial);
    } catch { /* read() already exposes the storage problem */ }
    setData(initial);
    setHydrated(true);
    const listener = () => setData({ ...read() });
    listeners.push(listener);
    return () => { listeners = listeners.filter((item) => item !== listener); };
  }, []);
  const update = useCallback((fn: (data: SplitData) => SplitData) => write(fn({ ...read() })), []);
  return { data, update, hydrated };
}

'''
store = store[:start] + new_persistence + store[end:]
store_path.write_text(store)

# ---- Splitzap UI: accessible dialogs + backup/restore ----
app_path = Path('src/features/splitzap/SplitzapAppV4.tsx')
app = app_path.read_text()
app = replace_once(app, "  ArrowLeft,\n", "  AlertTriangle,\n  ArrowLeft,\n", 'alert icon')
app = replace_once(app, "  Copy,\n", "  Copy,\n  Download,\n  HardDrive,\n", 'backup icons')
app = replace_once(app, "  Trash2,\n", "  Trash2,\n  Upload,\n", 'upload icon')
app = replace_once(
    app,
    "import { type ReactNode, useEffect, useMemo, useState } from 'react';",
    "import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';",
    'react hooks',
)
app = replace_once(app, "  categoryOf,\n", "  categoryOf,\n  createSplitBackup,\n", 'backup export import')
app = replace_once(app, "  uid,\n  useSplitData,\n", "  restoreSplitBackup,\n  uid,\n  useSplitData,\n  useSplitStorageStatus,\n", 'restore/status imports')

root_start = app.index('export default function SplitzapAppV4() {')
root_end = app.index('function AnimatedMoney')
new_root = r'''export default function SplitzapAppV4() {
  useSplitzapPwa();
  const [view, setView] = useState<View>(() => parseView());
  const [dataToolsOpen, setDataToolsOpen] = useState(false);
  const { storageError, clearStorageError } = useSplitStorageStatus();

  useEffect(() => {
    const onPop = () => setView(parseView());
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('button')) {
        try { navigator.vibrate?.(8); } catch { /* optional */ }
      }
    };
    window.addEventListener('popstate', onPop);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  const navigate = (next: View) => {
    const url = next.name === 'home' ? '/splitzap' : next.name === 'activity' ? '/splitzap#activity' : `/splitzap#group=${encodeURIComponent(next.groupId)}`;
    window.history.pushState({}, '', url);
    setView(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const afterRestore = () => {
    window.history.replaceState({}, '', '/splitzap');
    setView({ name: 'home' });
    clearStorageError();
  };

  return (
    <div className="splitzap-root min-h-[100dvh] bg-background text-foreground">
      <div className="splitzap-ambient" aria-hidden="true" />
      {view.name === 'home'
        ? <HomeScreen navigate={navigate} onDataBackup={() => setDataToolsOpen(true)} />
        : view.name === 'activity'
          ? <ActivityScreen navigate={navigate} />
          : <GroupScreen groupId={view.groupId} navigate={navigate} />}
      {storageError ? <div role="alert" className="fixed left-1/2 top-[max(0.75rem,env(safe-area-inset-top))] z-[110] flex w-[calc(100%-1.5rem)] max-w-[496px] -translate-x-1/2 items-start gap-2 rounded-2xl border border-negative/20 bg-surface px-3 py-3 shadow-xl"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-negative" /><p className="min-w-0 flex-1 text-[11px] font-semibold leading-4 text-foreground">{storageError}</p><button type="button" onClick={() => setDataToolsOpen(true)} className="press shrink-0 rounded-lg bg-secondary px-2.5 py-2 text-[11px] font-bold text-primary">Backup</button><button type="button" aria-label="Dismiss storage warning" onClick={clearStorageError} className="press grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-muted-foreground"><X size={14} /></button></div> : null}
      <DataBackupDialog open={dataToolsOpen} onClose={() => setDataToolsOpen(false)} onRestored={afterRestore} />
    </div>
  );
}

'''
app = app[:root_start] + new_root + app[root_end:]

app = replace_once(
    app,
    "function Field({ label, children, compact = false }: { label: string; children: ReactNode; compact?: boolean }) {\n  return <div className={compact ? 'mb-2' : 'mb-4'}><div className=\"mb-1.5 text-[12px] font-semibold text-muted-foreground\">{label}</div>{children}</div>;\n}",
    "function Field({ label, children, compact = false }: { label: string; children: ReactNode; compact?: boolean }) {\n  return <fieldset className={`${compact ? 'mb-2' : 'mb-4'} m-0 min-w-0 border-0 p-0`}><legend className=\"mb-1.5 block p-0 text-[12px] font-semibold text-muted-foreground\">{label}</legend>{children}</fieldset>;\n}",
    'semantic field',
)

modal_start = app.index('function SheetModal(')
modal_end = app.index('function IntroPanel(')
new_modals = r'''function useDialogAccessibility(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
    const focusFirst = window.setTimeout(() => {
      const first = panel?.querySelector<HTMLElement>(focusableSelector);
      (first ?? panel)?.focus();
    }, 0);
    const onKey = (event: KeyboardEvent) => {
      if (!panel || !panel.contains(document.activeElement)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...panel.querySelectorAll<HTMLElement>(focusableSelector)].filter((item) => !item.hasAttribute('hidden'));
      if (!focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(focusFirst);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      previousFocus?.focus();
    };
  }, [open]);

  return panelRef;
}

function SheetModal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const titleId = useId();
  const panelRef = useDialogAccessibility(open, onClose);
  if (!open) return null;
  return <div className="sheet-wrap fixed inset-0 z-50 flex items-end justify-center"><button type="button" aria-label="Close dialog" onClick={onClose} className="sheet-backdrop absolute inset-0 bg-foreground/40 backdrop-blur-[2px]" /><div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="sheet-panel relative flex max-h-[94dvh] w-full max-w-[520px] flex-col rounded-t-[28px] bg-surface outline-none"><div className="sheet-handle mx-auto mt-2 h-1 w-10 rounded-full bg-border" /><div className="flex items-center justify-between px-5 pb-2 pt-3"><h2 id={titleId} className="text-lg font-extrabold">{title}</h2><button type="button" onClick={onClose} aria-label="Close" className="press grid size-10 place-items-center rounded-full bg-muted text-muted-foreground"><X size={16} /></button></div><div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>{footer ? <div className="sheet-footer border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div> : null}</div></div>;
}

function CompactDialog({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const titleId = useId();
  const panelRef = useDialogAccessibility(open, onClose);
  if (!open) return null;
  return <div className="fixed inset-0 z-[90] grid place-items-center px-5"><button type="button" aria-label="Close dialog" onClick={onClose} className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]" /><div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="relative w-full max-w-[400px] rounded-3xl bg-surface p-4 shadow-2xl outline-none"><div className="mb-3 flex items-center justify-between"><h2 id={titleId} className="text-base font-extrabold">{title}</h2><button type="button" aria-label="Close" onClick={onClose} className="press grid size-10 place-items-center rounded-full bg-surface-2 text-muted-foreground"><X size={14} /></button></div>{children}{footer ? <div className="mt-4">{footer}</div> : null}</div></div>;
}

function DataBackupDialog({ open, onClose, onRestored }: { open: boolean; onClose: () => void; onRestored: () => void }) {
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  useEffect(() => { if (open) setFeedback(null); }, [open]);

  const downloadBackup = () => {
    try {
      const blob = new Blob([createSplitBackup()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `splitzap-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setFeedback({ kind: 'success', text: 'Backup downloaded. Keep the file somewhere safe.' });
    } catch {
      setFeedback({ kind: 'error', text: 'Could not create the backup file on this device.' });
    }
  };

  const restoreFile = async (file: File | null) => {
    if (!file) return;
    if (!window.confirm('Restore this backup? Current Splitzap groups, expenses and payments on this device will be replaced.')) return;
    try {
      const restored = restoreSplitBackup(await file.text());
      setFeedback({ kind: 'success', text: `Restored ${restored.groups.length} ${restored.groups.length === 1 ? 'group' : 'groups'} successfully.` });
      onRestored();
    } catch (cause) {
      setFeedback({ kind: 'error', text: cause instanceof Error ? cause.message : 'Could not restore this backup.' });
    }
  };

  return <CompactDialog open={open} onClose={onClose} title="Backup & restore"><div className="space-y-3"><div className="rounded-2xl bg-secondary p-3"><div className="flex items-start gap-2"><HardDrive size={18} className="mt-0.5 shrink-0 text-primary" /><div><p className="text-sm font-extrabold">Your Splitzap data lives on this device</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">Export a backup before clearing browser data, changing phones or reinstalling the app.</p></div></div></div><button type="button" onClick={downloadBackup} className="press flex min-h-12 w-full items-center gap-3 rounded-xl border border-border bg-surface-2 px-3 text-left"><span className="grid size-9 place-items-center rounded-xl bg-surface text-primary"><Download size={17} /></span><span className="min-w-0 flex-1"><b className="block text-sm">Export backup</b><span className="text-[11px] text-muted-foreground">Download all groups, expenses and payments</span></span></button><label className="press flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface-2 px-3 text-left"><span className="grid size-9 place-items-center rounded-xl bg-surface text-primary"><Upload size={17} /></span><span className="min-w-0 flex-1"><b className="block text-sm">Restore backup</b><span className="text-[11px] text-muted-foreground">Replace this device's data from a Splitzap JSON backup</span></span><input type="file" accept="application/json,.json" className="hidden" onChange={(event) => { void restoreFile(event.target.files?.[0] ?? null); event.currentTarget.value = ''; }} /></label>{feedback ? <p role="status" className={`rounded-xl px-3 py-2.5 text-[11px] font-bold ${feedback.kind === 'success' ? 'bg-secondary text-primary' : 'bg-negative/5 text-negative'}`}>{feedback.text}</p> : null}</div></CompactDialog>;
}

'''
app = app[:modal_start] + new_modals + app[modal_end:]

app = replace_once(
    app,
    "function HomeScreen({ navigate }: { navigate: (view: View) => void }) {",
    "function HomeScreen({ navigate, onDataBackup }: { navigate: (view: View) => void; onDataBackup: () => void }) {",
    'home props',
)
app = replace_once(
    app,
    "</div></section></>}{data.groups.length ? <AddExpenseSheet",
    "</div></section><section className=\"px-5 pt-4\"><button type=\"button\" onClick={onDataBackup} className=\"press flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-left text-muted-foreground\"><HardDrive size={16} className=\"shrink-0\" /><span className=\"min-w-0 flex-1 text-[11px] font-semibold\">Backup & restore</span><ChevronRight size={14} /></button></section></>}{data.groups.length ? <AddExpenseSheet",
    'home backup entry',
)
app_path.write_text(app)

# ---- App route code split for Splitzap ----
root_app_path = Path('src/App.tsx')
root_app = root_app_path.read_text()
root_app = replace_once(
    root_app,
    "import { type ReactNode, useEffect, useState } from 'react';",
    "import { lazy, Suspense, type ReactNode, useEffect, useState } from 'react';",
    'App react lazy import',
)
root_app = replace_once(root_app, "import SplitzapPage from './components/SplitzapPage';\n", "", 'remove eager Splitzap import')
insert_after = "import { IcrTrendsDashboardRoute } from './features/icr-trends-dashboard/IcrTrendsDashboardRoute';\n"
root_app = replace_once(root_app, insert_after, insert_after + "\nconst SplitzapPage = lazy(() => import('./components/SplitzapPage'));\n", 'lazy Splitzap declaration')
root_app = replace_once(
    root_app,
    "  } else if (currentPage === 'splitzap') {\n    pageContent = <SplitzapPage />;",
    "  } else if (currentPage === 'splitzap') {\n    pageContent = <Suspense fallback={<main className=\"fixed inset-0 z-[100] grid place-items-center bg-[#faf9f5]\"><div className=\"h-8 w-8 animate-spin rounded-full border-4 border-[#dbe8e3] border-t-[#256f66]\" aria-label=\"Loading Splitzap\" /></main>}><SplitzapPage /></Suspense>;",
    'Splitzap suspense route',
)
root_app_path.write_text(root_app)

# ---- Service worker hardening ----
sw_path = Path('public/splitzap-sw.js')
sw_path.write_text(r'''const CACHE_PREFIX = 'splitzap-';
const CACHE = 'splitzap-v2';
const CORE = ['/splitzap', '/splitzap.webmanifest', '/splitzap-icon-192.png', '/splitzap-icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

async function networkFirst(request, fallbackPath) {
  try {
    const response = await fetch(request);
    if (response?.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  } catch {
    return (await caches.match(request)) || (fallbackPath ? await caches.match(fallbackPath) : undefined) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const network = fetch(request).then(async (response) => {
    if (response?.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  }).catch(() => undefined);
  return cached || await network || Response.error();
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, '/splitzap'));
    return;
  }

  if (url.pathname.startsWith('/assets/') || CORE.includes(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
''')

# ---- Manifest stability ----
manifest_path = Path('public/splitzap.webmanifest')
manifest = json.loads(manifest_path.read_text())
manifest['id'] = '/splitzap'
manifest['categories'] = ['finance', 'utilities']
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')

# ---- Permanent calculation regression tests ----
test_path = Path('src/features/splitzap/splitStoreV4.test.ts')
test_path.write_text(r'''import { describe, expect, it } from 'vitest';
import {
  groupBalances,
  shareOf,
  simplify,
  type Expense,
  type Group,
  type Settlement,
} from './splitStoreV4';

const group: Group = {
  id: 'g1',
  name: 'Test group',
  emoji: '👥',
  currency: '₹',
  createdAt: '2026-08-16T00:00:00.000Z',
  members: [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
    { id: 'c', name: 'C' },
    { id: 'd', name: 'D' },
  ],
};

const expense = (overrides: Partial<Expense> = {}): Expense => ({
  id: 'e1',
  groupId: group.id,
  description: 'Test',
  amount: 500,
  baseAmount: 500,
  paidBy: 'a',
  payments: { a: 500 },
  split: { a: 1, b: 1, c: 1, d: 1 },
  splitLabels: {},
  mode: 'equal',
  category: 'general',
  date: '2026-08-16T00:00:00.000Z',
  personalItems: [],
  selectiveItems: [],
  additionalCharges: [],
  receiptItems: [],
  ...overrides,
});

const shares = (item: Expense) => group.members.map((member) => shareOf(item, member.id, group.members.map((entry) => entry.id)));
const expectMoney = (actual: number, expected: number) => expect(actual).toBeCloseTo(expected, 8);

describe('Splitzap calculation regression suite', () => {
  it('splits an equal expense across all participants', () => {
    shares(expense()).forEach((value) => expectMoney(value, 125));
  });

  it('handles the ₹500 case with a ₹150 item shared by only three people', () => {
    const item = expense({
      selectiveItems: [{ id: 's1', description: 'Special item', amount: 150, memberIds: ['a', 'b', 'c'], mode: 'equal', split: { a: 1, b: 1, c: 1 } }],
    });
    const [a, b, c, d] = shares(item);
    expectMoney(a, 137.5); expectMoney(b, 137.5); expectMoney(c, 137.5); expectMoney(d, 87.5);
  });

  it('keeps personal items personal while splitting the remaining amount', () => {
    const [a, b, c, d] = shares(expense({ personalItems: [{ id: 'p1', memberId: 'a', description: 'Personal', amount: 100 }] }));
    expectMoney(a, 200); expectMoney(b, 100); expectMoney(c, 100); expectMoney(d, 100);
  });

  it('supports exact shared splits', () => {
    const [a, b, c, d] = shares(expense({ mode: 'exact', split: { a: 200, b: 150, c: 100, d: 50 } }));
    expectMoney(a, 200); expectMoney(b, 150); expectMoney(c, 100); expectMoney(d, 50);
  });

  it('supports percentage shared splits', () => {
    const [a, b, c, d] = shares(expense({ amount: 1000, baseAmount: 1000, payments: { a: 1000 }, mode: 'percentage', split: { a: 40, b: 30, c: 20, d: 10 } }));
    expectMoney(a, 400); expectMoney(b, 300); expectMoney(c, 200); expectMoney(d, 100);
  });

  it('supports exact selective-item allocation', () => {
    const [a, b, c, d] = shares(expense({ selectiveItems: [{ id: 's1', description: 'Drinks', amount: 150, memberIds: ['a', 'b'], mode: 'exact', split: { a: 100, b: 50 } }] }));
    expectMoney(a, 187.5); expectMoney(b, 137.5); expectMoney(c, 87.5); expectMoney(d, 87.5);
  });

  it('supports percentage selective-item allocation', () => {
    const [a, b, c, d] = shares(expense({ amount: 600, baseAmount: 600, payments: { a: 600 }, selectiveItems: [{ id: 's1', description: 'Upgrade', amount: 200, memberIds: ['a', 'b'], mode: 'percentage', split: { a: 75, b: 25 } }] }));
    expectMoney(a, 250); expectMoney(b, 150); expectMoney(c, 100); expectMoney(d, 100);
  });

  it('distributes additional charges equally among people with responsibility', () => {
    const [a, b, c, d] = shares(expense({ amount: 500, baseAmount: 400, payments: { a: 500 }, additionalCharges: [{ id: 'x', description: 'Service', amount: 100, distribution: 'equal' }] }));
    expectMoney(a, 125); expectMoney(b, 125); expectMoney(c, 125); expectMoney(d, 125);
  });

  it('distributes proportional charges according to base responsibility', () => {
    const [a, b, c, d] = shares(expense({ amount: 500, baseAmount: 400, payments: { a: 500 }, mode: 'exact', split: { a: 200, b: 100, c: 100 }, additionalCharges: [{ id: 'x', description: 'Tax', amount: 100, distribution: 'proportional' }] }));
    expectMoney(a, 250); expectMoney(b, 125); expectMoney(c, 125); expectMoney(d, 0);
  });

  it('credits multiple payers correctly', () => {
    const item = expense({ amount: 600, baseAmount: 600, payments: { a: 400, b: 200 }, split: { a: 1, b: 1, c: 1 } });
    const balances = groupBalances(group, [item], []);
    expectMoney(balances.a, 200); expectMoney(balances.b, 0); expectMoney(balances.c, -200); expectMoney(balances.d, 0);
    expect(simplify(balances)).toEqual([{ from: 'c', to: 'a', amount: 200 }]);
  });

  it('reduces balances after a partial settlement without changing the expense', () => {
    const item = expense({ amount: 600, baseAmount: 600, payments: { a: 400, b: 200 }, split: { a: 1, b: 1, c: 1 } });
    const settlements: Settlement[] = [{ id: 'pay1', groupId: group.id, from: 'c', to: 'a', amount: 50, date: '2026-08-16T01:00:00.000Z' }];
    const balances = groupBalances(group, [item], settlements);
    expectMoney(balances.a, 150); expectMoney(balances.c, -150);
    expect(simplify(balances)).toEqual([{ from: 'c', to: 'a', amount: 150 }]);
  });

  it('preserves the total for a complex expense to rounding tolerance', () => {
    const item = expense({
      amount: 1099.99,
      baseAmount: 999.99,
      payments: { a: 700, b: 399.99 },
      personalItems: [{ id: 'p1', memberId: 'd', description: 'Dessert', amount: 99.99 }],
      selectiveItems: [{ id: 's1', description: 'Drinks', amount: 300, memberIds: ['a', 'b', 'c'], mode: 'percentage', split: { a: 50, b: 30, c: 20 } }],
      additionalCharges: [{ id: 'x', description: 'Tax', amount: 100, distribution: 'proportional' }],
    });
    expectMoney(shares(item).reduce((sum, value) => sum + value, 0), 1099.99);
  });
});
''')

# ---- package scripts; vitest dependency is installed by workflow ----
package_path = Path('package.json')
package = json.loads(package_path.read_text())
package.setdefault('scripts', {})['test:splitzap'] = 'vitest run src/features/splitzap/splitStoreV4.test.ts'
package_path.write_text(json.dumps(package, indent=2) + '\n')

# ---- Permanent CI gate ----
ci_path = Path('.github/workflows/splitzap-readiness.yml')
ci_path.write_text(r'''name: Splitzap Readiness

on:
  push:
    branches: [testing]
    paths:
      - 'src/features/splitzap/**'
      - 'src/components/SplitzapPage.tsx'
      - 'src/App.tsx'
      - 'public/splitzap*'
      - 'package.json'
      - 'package-lock.json'
      - '.github/workflows/splitzap-readiness.yml'
  pull_request:
    paths:
      - 'src/features/splitzap/**'
      - 'src/components/SplitzapPage.tsx'
      - 'src/App.tsx'
      - 'public/splitzap*'
      - 'package.json'
      - 'package-lock.json'

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - name: TypeScript
        run: npm run typecheck
      - name: Splitzap calculation tests
        run: npm run test:splitzap
      - name: Production build
        run: npm run build
      - name: Production dependency security gate
        run: npm audit --omit=dev --audit-level=high
      - name: PWA asset assertions
        shell: bash
        run: |
          grep -q '"id": "/splitzap"' public/splitzap.webmanifest
          grep -q "splitzap-v2" public/splitzap-sw.js
          test -f public/splitzap-icon-192.png
          test -f public/splitzap-icon-512.png
''')

print('READINESS_PATCH_OK')
