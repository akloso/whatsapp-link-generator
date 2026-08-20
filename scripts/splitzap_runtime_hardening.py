from pathlib import Path
import re

ROOT = Path('.')


def must_replace(text: str, old: str, new: str, label: str, count: int = 1) -> str:
    found = text.count(old)
    if found < count:
        raise RuntimeError(f'{label}: expected at least {count} occurrence(s), found {found}')
    return text.replace(old, new, count)


def must_regex(text: str, pattern: str, repl: str, label: str, count: int = 1) -> str:
    next_text, found = re.subn(pattern, repl, text, count=count, flags=re.S)
    if found != count:
        raise RuntimeError(f'{label}: expected {count} replacement(s), found {found}')
    return next_text


app_path = ROOT / 'src/features/splitzap/SplitzapAppV4.tsx'
cloud_path = ROOT / 'src/features/splitzap/SplitzapCloudApp.tsx'
css_path = ROOT / 'src/features/splitzap/splitzap.css'
readiness_path = ROOT / '.github/workflows/splitzap-readiness.yml'

app = app_path.read_text()
cloud = cloud_path.read_text()
css = css_path.read_text()
readiness = readiness_path.read_text()

# ---------- SplitzapAppV4: app-shell, install capability, drafts, settlement shortcut ----------
app = must_replace(app, '  Home,\n  Filter,', '  Home,\n  Info,\n  Filter,', 'Info icon import')

install_and_draft_helpers = r'''
let splitzapInstallPrompt: BeforeInstallPromptEvent | null = null;
let splitzapInstallListeners: Array<() => void> = [];
const notifySplitzapInstall = () => splitzapInstallListeners.forEach((listener) => listener());
const isStandaloneSplitzap = () => typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone));

export function useSplitzapInstall() {
  const [, refresh] = useState(0);
  useEffect(() => {
    const listener = () => refresh((value) => value + 1);
    splitzapInstallListeners.push(listener);
    return () => { splitzapInstallListeners = splitzapInstallListeners.filter((item) => item !== listener); };
  }, []);
  const installed = isStandaloneSplitzap();
  const ios = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/i.test(navigator.userAgent);
  const install = async () => {
    if (installed) return { outcome: 'installed' as const };
    const prompt = splitzapInstallPrompt;
    if (!prompt) return { outcome: 'manual' as const };
    await prompt.prompt();
    const choice = await prompt.userChoice;
    splitzapInstallPrompt = null;
    notifySplitzapInstall();
    return { outcome: choice.outcome };
  };
  return { installed, canPrompt: Boolean(splitzapInstallPrompt) && !installed, ios, install };
}

type ExpenseDraftSnapshot = {
  savedAt: string;
  groupId: string;
  description: string;
  amount: string;
  category: string;
  categoryTouched: boolean;
  expenseDate: string;
  paidBy: string;
  multiPayer: boolean;
  payments: Record<string, number>;
  mode: SplitMode;
  split: Record<string, number>;
  splitLabels: Record<string, string>;
  personalItems: PersonalItem[];
  selectiveItems: SelectiveItem[];
  charges: AdditionalCharge[];
  receiptItems: ReceiptItem[];
};

const EXPENSE_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const expenseDraftKey = (userId: string) => `splitzap.expenseDraft.${userId}`;

function readSplitzapExpenseDraft(userId: string): ExpenseDraftSnapshot | null {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(expenseDraftKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExpenseDraftSnapshot;
    const savedAt = +new Date(parsed.savedAt);
    if (!parsed.groupId || !Number.isFinite(savedAt) || Date.now() - savedAt > EXPENSE_DRAFT_MAX_AGE_MS) {
      window.localStorage.removeItem(expenseDraftKey(userId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearSplitzapExpenseDraft(userId: string) {
  if (!userId || typeof window === 'undefined') return;
  try { window.localStorage.removeItem(expenseDraftKey(userId)); } catch { /* best effort */ }
}

function recoverableExpenseDraft(data: SplitData) {
  const draft = readSplitzapExpenseDraft(data.me);
  if (!draft) return null;
  const group = data.groups.find((item) => item.id === draft.groupId && (item.status ?? item.sharedStatus ?? 'active') !== 'archived');
  if (!group) { clearSplitzapExpenseDraft(data.me); return null; }
  return draft;
}
'''
app = must_replace(
    app,
    "type BeforeInstallPromptEvent = Event & {\n  prompt: () => Promise<void>;\n  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;\n};\n",
    "type BeforeInstallPromptEvent = Event & {\n  prompt: () => Promise<void>;\n  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;\n};\n" + install_and_draft_helpers,
    'install/draft helpers',
)

new_pwa = r'''function useSplitzapPwa() {
  useEffect(() => {
    const manifest = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    const previousManifest = manifest?.getAttribute('href') ?? '/site.webmanifest';
    if (manifest) manifest.setAttribute('href', '/splitzap.webmanifest');

    const theme = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    const previousTheme = theme?.content ?? '#25D366';
    if (theme) theme.content = '#256f66';

    const apple = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
    const previousApple = apple?.getAttribute('href') ?? '/apple-touch-icon.png';
    if (apple) apple.setAttribute('href', '/splitzap-icon-192.png');

    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      splitzapInstallPrompt = event as BeforeInstallPromptEvent;
      notifySplitzapInstall();
    };
    const onInstalled = () => { splitzapInstallPrompt = null; notifySplitzapInstall(); };
    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/splitzap-sw.js', { scope: '/splitzap' }).catch(() => undefined);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      if (manifest) manifest.setAttribute('href', previousManifest);
      if (theme) theme.content = previousTheme;
      if (apple) apple.setAttribute('href', previousApple);
    };
  }, []);
}'''
app = must_regex(app, r'function useSplitzapPwa\(\) \{.*?\n\}', new_pwa, 'central PWA install capture')

app = must_replace(app, '    window.scrollTo({ top: 0, behavior: \'auto\' });', "    window.requestAnimationFrame(() => document.querySelector<HTMLElement>('.splitzap-main-scroll')?.scrollTo({ top: 0, behavior: 'auto' }));", 'scroll container navigation')
app = must_replace(app, '<div className="splitzap-root min-h-[100dvh] bg-background text-foreground">', '<div className="splitzap-root h-[100dvh] overflow-hidden bg-background text-foreground">', 'root fixed viewport')

old_shell = r'''function AppShell({ children, onAdd, view, navigate }: { children: ReactNode; onAdd?: () => void; view: View; navigate: (view: View) => void }) {
  return (
    <div className="splitzap-shell screen-enter mx-auto min-h-[100dvh] w-full max-w-[520px] bg-background pb-28">
      {children}
      <nav className="splitzap-bottom-nav fixed bottom-0 left-1/2 z-30 w-full max-w-[520px] -translate-x-1/2 border-t border-border bg-surface/95 backdrop-blur">
        <div className="grid grid-cols-3 items-center px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
          <NavItem label="Groups" active={view.name === 'home'} icon={<Home size={20} />} onClick={() => navigate({ name: 'home' })} />
          <div className="flex justify-center"><button type="button" onClick={onAdd} disabled={!onAdd} aria-label="Add expense" className="splitzap-fab press -mt-8 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40" style={{ boxShadow: 'var(--shadow-float)' }}><Plus size={26} /></button></div>
          <NavItem label="Activity" active={view.name === 'activity'} icon={<Receipt size={20} />} onClick={() => navigate({ name: 'activity' })} />
        </div>
      </nav>
    </div>
  );
}'''
new_shell = r'''function AppShell({ children, onAdd, view, navigate }: { children: ReactNode; onAdd?: () => void; view: View; navigate: (view: View) => void }) {
  return (
    <div className="splitzap-shell relative mx-auto h-full w-full max-w-[520px] overflow-hidden bg-background">
      <div className="splitzap-main-scroll h-full overflow-y-auto overscroll-contain pb-28">{children}</div>
      <nav className="splitzap-bottom-nav absolute bottom-0 left-0 z-30 w-full border-t border-border bg-surface/95 backdrop-blur">
        <div className="grid grid-cols-3 items-center px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
          <NavItem label="Groups" active={view.name === 'home'} icon={<Home size={20} />} onClick={() => navigate({ name: 'home' })} />
          <div className="flex justify-center"><button type="button" onClick={onAdd} disabled={!onAdd} aria-label="Add expense" className="splitzap-fab press -mt-8 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40" style={{ boxShadow: 'var(--shadow-float)' }}><Plus size={26} /></button></div>
          <NavItem label="Activity" active={view.name === 'activity'} icon={<Receipt size={20} />} onClick={() => navigate({ name: 'activity' })} />
        </div>
      </nav>
    </div>
  );
}'''
app = must_replace(app, old_shell, new_shell, 'fixed app shell')

old_header = "  return <header className=\"grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 pb-3 pt-[max(1.5rem,env(safe-area-inset-top))]\"><div className=\"flex min-w-0 items-center gap-2\">{back}{onTitleClick ? <button type=\"button\" onClick={onTitleClick} className=\"press min-w-0 text-left\">{titleBlock}</button> : titleBlock}</div>{right}</header>;"
new_header = "  return <header className=\"splitzap-app-header sticky top-0 z-20 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background px-5 pb-3 pt-[max(1.5rem,env(safe-area-inset-top))]\"><div className=\"flex min-w-0 items-center gap-2\">{back}{onTitleClick ? <button type=\"button\" onClick={onTitleClick} className=\"press min-w-0 text-left\">{titleBlock}</button> : titleBlock}</div>{right}</header>;"
app = must_replace(app, old_header, new_header, 'sticky app header')

# Home install state is shared with Profile now.
app = must_replace(app, "  const [paymentGroupId, setPaymentGroupId] = useState<string | null>(null);\n  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);\n\n  useEffect(() => {\n    const handler = (event: Event) => { event.preventDefault(); setInstallPrompt(event as BeforeInstallPromptEvent); };\n    window.addEventListener('beforeinstallprompt', handler);\n    return () => window.removeEventListener('beforeinstallprompt', handler);\n  }, []);\n\n  const install = async () => {\n    if (!installPrompt) return;\n    await installPrompt.prompt();\n    await installPrompt.userChoice;\n    setInstallPrompt(null);\n  };",
"  const [paymentGroupId, setPaymentGroupId] = useState<string | null>(null);\n  const draftResumeChecked = useRef(false);\n  const installState = useSplitzapInstall();\n\n  const install = async () => {\n    const result = await installState.install();\n    if (result.outcome === 'manual') window.alert(installState.ios ? 'To install Splitzap on iPhone, open the browser Share menu and choose Add to Home Screen.' : 'Open your browser menu and choose Install app or Add to Home screen.');\n  };",
'home install state')
app = must_replace(app, 'onInstall={installPrompt ? install : undefined}', 'onInstall={!installState.installed ? install : undefined}', 'home install action')

home_active_marker = "  const activeGroups = activeSummaries.map((item) => item.group);\n"
home_resume = "  const activeGroups = activeSummaries.map((item) => item.group);\n\n  useEffect(() => {\n    if (!hydrated || draftResumeChecked.current) return;\n    draftResumeChecked.current = true;\n    if (recoverableExpenseDraft(data)) setAddOpen(true);\n  }, [hydrated, data.me, data.groups]);\n"
app = must_replace(app, home_active_marker, home_resume, 'home expense draft resume')

# Group-screen draft recovery after a true tab reload / process eviction.
app = must_replace(app, "  const undoTimer = useRef<number | null>(null);\n\n  useEffect(() => () => { if (undoTimer.current) window.clearTimeout(undoTimer.current); }, []);",
"  const undoTimer = useRef<number | null>(null);\n  const draftResumeChecked = useRef(false);\n\n  useEffect(() => () => { if (undoTimer.current) window.clearTimeout(undoTimer.current); }, []);\n  useEffect(() => {\n    if (!hydrated || draftResumeChecked.current) return;\n    draftResumeChecked.current = true;\n    const draft = recoverableExpenseDraft(data);\n    if (draft?.groupId === groupId) setAddOpen(true);\n  }, [hydrated, data.me, data.groups, groupId]);",
'group expense draft resume')

# Expense-details gets one single settlement shortcut; the expense list remains clean.
app = must_replace(app,
"function ExpenseResultSheet({ open, onClose, expense, group, data, onEdit, onDelete }: { open: boolean; onClose: () => void; expense: Expense | null; group: Group; data: SplitData; onEdit?: () => void; onDelete?: () => void }) {",
"function ExpenseResultSheet({ open, onClose, expense, group, data, onEdit, onDelete, onSettle }: { open: boolean; onClose: () => void; expense: Expense | null; group: Group; data: SplitData; onEdit?: () => void; onDelete?: () => void; onSettle?: () => void }) {",
'expense result settle prop')
app = must_replace(app,
'<ExpenseBreakdown expense={expense} group={group} data={data} onHistory={() => setHistoryOpen(true)} />{onDelete ?',
'<ExpenseBreakdown expense={expense} group={group} data={data} onHistory={() => setHistoryOpen(true)} />{onSettle ? <button type="button" onClick={onSettle} title="Uses the current simplified group balance" className="press mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-secondary py-3 text-xs font-bold text-primary">Settle related balance <Info size={11} /></button> : null}{onDelete ?',
'expense detail single settle action')
app = must_replace(app,
'<ExpenseResultSheet open={Boolean(selectedExpense)} onClose={() => setSelectedExpense(null)} expense={selectedExpense} group={group} data={data} onEdit={isArchived ? undefined : () => { if (!selectedExpense) return; setEditingExpense(selectedExpense); setSelectedExpense(null); setAddOpen(true); }} onDelete={!isArchived && selectedExpense ? () => removeExpense(selectedExpense) : undefined} />',
'<ExpenseResultSheet open={Boolean(selectedExpense)} onClose={() => setSelectedExpense(null)} expense={selectedExpense} group={group} data={data} onEdit={isArchived ? undefined : () => { if (!selectedExpense) return; setEditingExpense(selectedExpense); setSelectedExpense(null); setAddOpen(true); }} onDelete={!isArchived && selectedExpense ? () => removeExpense(selectedExpense) : undefined} onSettle={!isArchived && simplify(balances).length ? () => { setSelectedExpense(null); setSettleOpen(true); } : undefined} />',
'group expense settle wiring')

# Tiny explanatory note appears only in the payment flow, not on every expense.
app = must_replace(app,
'</div><div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1"><button type="button" onClick={() => setPaymentMode(\'full\')}',
'</div><div className="mt-2 flex items-start gap-1.5 rounded-xl bg-surface-2 px-2.5 py-2 text-[10px] leading-4 text-muted-foreground"><Info size={11} className="mt-0.5 shrink-0" /> This records the current simplified transfer as paid. Original expense details stay unchanged.</div><div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1"><button type="button" onClick={() => setPaymentMode(\'full\')}',
'payment info note')

# New-expense draft persistence. Explicit cancel/save clears it; backgrounding does not.
app = must_replace(app,
"  const [receiptItems] = useState<ReceiptItem[]>(editing?.receiptItems ?? seed?.receiptItems ?? []);",
"  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>(editing?.receiptItems ?? seed?.receiptItems ?? []);",
'receipt draft setter')
app = must_replace(app,
"  const [saveError, setSaveError] = useState('');\n  const group = groups.find((item) => item.id === groupId);",
"  const [saveError, setSaveError] = useState('');\n  const [draftReady, setDraftReady] = useState(Boolean(editing || seed));\n\n  useEffect(() => {\n    if (!open || editing || draftReady) return;\n    if (seed) { setDraftReady(true); return; }\n    const draft = readSplitzapExpenseDraft(data.me);\n    if (draft && groups.some((item) => item.id === draft.groupId)) {\n      setGroupId(draft.groupId);\n      setDescription(draft.description ?? '');\n      setAmount(draft.amount ?? '');\n      setCategory(draft.category ?? 'general');\n      setCategoryTouched(Boolean(draft.categoryTouched));\n      setExpenseDate(draft.expenseDate || expenseDateInputValue());\n      setPaidBy(draft.paidBy || data.me);\n      setMultiPayer(Boolean(draft.multiPayer));\n      setPayments(draft.payments ?? {});\n      setMode(draft.mode ?? 'equal');\n      setSplitExpanded((draft.mode ?? 'equal') !== 'equal');\n      setSplit(draft.split ?? {});\n      setSplitLabels(draft.splitLabels ?? {});\n      setLabelDrafts(draft.splitLabels ?? {});\n      setPersonalItems(Array.isArray(draft.personalItems) ? draft.personalItems : []);\n      setSelectiveItems(Array.isArray(draft.selectiveItems) ? draft.selectiveItems : []);\n      setCharges(Array.isArray(draft.charges) ? draft.charges : []);\n      setReceiptItems(Array.isArray(draft.receiptItems) ? draft.receiptItems : []);\n    }\n    setDraftReady(true);\n  }, [open, editing, seed, draftReady, data.me, groups]);\n\n  useEffect(() => {\n    if (!open || editing || !draftReady || savedExpense) return;\n    const meaningful = description.trim() || amount || personalItems.length || selectiveItems.length || charges.length || receiptItems.length;\n    if (!meaningful) { clearSplitzapExpenseDraft(data.me); return; }\n    const timer = window.setTimeout(() => {\n      const draft: ExpenseDraftSnapshot = { savedAt: new Date().toISOString(), groupId, description, amount, category, categoryTouched, expenseDate, paidBy, multiPayer, payments, mode, split, splitLabels, personalItems, selectiveItems, charges, receiptItems };\n      try { window.localStorage.setItem(expenseDraftKey(data.me), JSON.stringify(draft)); } catch { /* best effort; normal store handles persistence warnings */ }\n    }, 120);\n    return () => window.clearTimeout(timer);\n  }, [open, editing, draftReady, savedExpense, data.me, groupId, description, amount, category, categoryTouched, expenseDate, paidBy, multiPayer, payments, mode, split, splitLabels, personalItems, selectiveItems, charges, receiptItems]);\n\n  const discardAndClose = () => { if (!editing) clearSplitzapExpenseDraft(data.me); onClose(); };\n  const group = groups.find((item) => item.id === groupId);",
'expense draft effects')
app = must_replace(app,
"    if (!editing) { try { navigator.vibrate?.(15); } catch { /* optional */ } }\n    setSavedExpense(payload);",
"    if (!editing) { try { navigator.vibrate?.(15); } catch { /* optional */ } clearSplitzapExpenseDraft(data.me); }\n    setSavedExpense(payload);",
'clear saved draft')
app = must_replace(app,
"if (savedExpense && group) return <><SheetModal open={open} onClose={onClose} title={editing ? 'Expense updated' : 'Expense added'}",
"if (savedExpense && group) return <><SheetModal open={open} onClose={discardAndClose} title={editing ? 'Expense updated' : 'Expense added'}",
'success close clears draft')
app = must_replace(app, '<PrimaryButton onClick={onClose}>Done</PrimaryButton></div>}><div className="success-state', '<PrimaryButton onClick={discardAndClose}>Done</PrimaryButton></div>}><div className="success-state', 'success done clears draft')
app = must_replace(app,
"return <><SheetModal open={open} onClose={onClose} title={editing ? 'Edit expense' : 'Add an expense'}",
"return <><SheetModal open={open} onClose={discardAndClose} title={editing ? 'Edit expense' : 'Add an expense'}",
'form close clears draft')

# ---------- Cloud app: persistent same-user session UI and stale join intent ----------
cloud = must_replace(cloud, "import SplitzapAppV4 from './SplitzapAppV4';", "import SplitzapAppV4, { clearSplitzapExpenseDraft, useSplitzapInstall } from './SplitzapAppV4';", 'cloud named imports')

cloud = must_replace(cloud,
"function safeGet(key: string) {\n  try { return window.localStorage.getItem(key); } catch { return null; }\n}\n",
"function safeGet(key: string) {\n  try { return window.localStorage.getItem(key); } catch { return null; }\n}\n\nfunction clearPendingJoinIntent() {\n  try { window.localStorage.removeItem(PENDING_JOIN_KEY); } catch { /* best effort */ }\n  try {\n    const url = new URL(window.location.href);\n    if (!url.searchParams.has('join')) return;\n    url.searchParams.delete('join');\n    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);\n  } catch { /* best effort */ }\n}\n",
'join intent helper')

old_auth = r'''    const unsubscribe = onSplitzapAuthChange((next, event) => {
      if (!active) return;
      setSession(next);
      setAccountDataReady(false);
      initializedUser.current = null;
      sharedInitializedUser.current = null;
      sharedHashes.current.clear();
      setProfile(null);
      setSharedActivity([]); setPendingRequests([]); setMemberships([]);
      if (event === 'PASSWORD_RECOVERY') { setRecoveryMode(true); setAccountOpen(true); }
      if (!next) { setStatus('local'); setStatusMessage('Signed out'); setProfileOpen(false); setAccountOpen(false); }
    });'''
new_auth = r'''    const unsubscribe = onSplitzapAuthChange((next, event) => {
      if (!active) return;
      setSession(next);
      if (next && initializedUser.current === next.user.id && event !== 'PASSWORD_RECOVERY') {
        // Token refresh / same-account auth events must never remount the app or destroy an open draft.
        return;
      }
      setAccountDataReady(false);
      initializedUser.current = null;
      sharedInitializedUser.current = null;
      sharedHashes.current.clear();
      setProfile(null);
      setSharedActivity([]); setPendingRequests([]); setMemberships([]);
      if (event === 'PASSWORD_RECOVERY') { setRecoveryMode(true); setAccountOpen(true); }
      if (!next) { setStatus('local'); setStatusMessage('Signed out'); setProfileOpen(false); setAccountOpen(false); }
    });'''
cloud = must_replace(cloud, old_auth, new_auth, 'same-user auth refresh preservation')

old_join_effect = r'''  useEffect(() => {
    if (!authReady) return;
    const urlCode = new URLSearchParams(window.location.search).get('join')?.trim().toUpperCase() || '';
    const pending = urlCode || safeGet(PENDING_JOIN_KEY) || '';
    if (!pending) return;
    setJoinCode(pending);
    try { window.localStorage.setItem(PENDING_JOIN_KEY, pending); } catch { /* best effort */ }
    if (session) { setAccountOpen(false); setProfileOpen(false); setJoinOpen(true); } else setAccountOpen(true);
  }, [authReady, session]);'''
new_join_effect = r'''  useEffect(() => {
    if (!authReady) return;
    const urlCode = new URLSearchParams(window.location.search).get('join')?.trim().toUpperCase() || '';
    const pending = urlCode || safeGet(PENDING_JOIN_KEY) || '';
    if (!pending) return;
    if (!session) {
      setJoinCode(pending);
      try { window.localStorage.setItem(PENDING_JOIN_KEY, pending); } catch { /* best effort */ }
      setAccountOpen(true);
      return;
    }
    let active = true;
    void previewSharedInviteV2(pending).then((preview) => {
      if (!active) return;
      if (preview.already_joined) {
        clearPendingJoinIntent();
        setJoinOpen(false);
        setJoinCode('');
        const existing = latestData.current.groups.find((group) => group.sharedId === preview.shared_id);
        if (existing) {
          window.history.replaceState({}, '', `/splitzap#group=${encodeURIComponent(existing.id)}`);
          window.dispatchEvent(new Event('popstate'));
        }
        return;
      }
      setJoinCode(pending);
      try { window.localStorage.setItem(PENDING_JOIN_KEY, pending); } catch { /* best effort */ }
      setAccountOpen(false);
      setProfileOpen(false);
      setJoinOpen(true);
    }).catch(() => {
      if (!active) return;
      if (!urlCode) { clearPendingJoinIntent(); return; }
      setJoinCode(pending);
      setAccountOpen(false);
      setProfileOpen(false);
      setJoinOpen(true);
    });
    return () => { active = false; };
  }, [authReady, session]);'''
cloud = must_replace(cloud, old_join_effect, new_join_effect, 'stale join popup prevention')

cloud = must_replace(cloud,
"    try { window.localStorage.removeItem(PENDING_JOIN_KEY); } catch { /* best effort */ }\n    setJoinOpen(false); setJoinRequested(false); setJoinCode(''); setProductionTick((value) => value + 1);",
"    clearPendingJoinIntent();\n    setJoinOpen(false); setJoinRequested(false); setJoinCode(''); setProductionTick((value) => value + 1);",
'complete join clears intent')
cloud = must_replace(cloud,
"      if (result.result_status === 'pending') {\n        setPending(true);\n        onPending();\n        return;\n      }",
"      if (result.result_status === 'pending') {\n        clearPendingJoinIntent();\n        setPending(true);\n        onPending();\n        return;\n      }",
'pending join clears intent')

# Profile install control and explicit sign-out draft cleanup.
cloud = must_replace(cloud,
"  const [deleteConfirm, setDeleteConfirm] = useState('');\n",
"  const [deleteConfirm, setDeleteConfirm] = useState('');\n  const installState = useSplitzapInstall();\n",
'profile install hook')
cloud = must_replace(cloud,
"      await deleteSplitzapAccount();\n      try { await signOutSplitzap(); } catch { /* account may already be removed */ }",
"      await deleteSplitzapAccount();\n      clearSplitzapExpenseDraft(session.user.id);\n      try { await signOutSplitzap(); } catch { /* account may already be removed */ }",
'delete account clears draft')
cloud = must_replace(cloud,
'<ProfileSection title="Help & About"><details',
'<ProfileSection title="Help & About">{!installState.installed ? <button type="button" onClick={() => { void installState.install().then((result) => { if (result.outcome === \'manual\') setFeedback(installState.ios ? \'To install Splitzap on iPhone, open the browser Share menu and choose Add to Home Screen.\' : \'Open your browser menu and choose Install app or Add to Home screen.\'); else if (result.outcome === \'accepted\') setFeedback(\'Splitzap installation started.\'); }); }} className="mb-2 flex w-full items-center gap-3 rounded-xl bg-[#eef6f3] px-3 py-3 text-left text-xs font-bold text-[#256f66]"><Download size={15} /> Install Splitzap</button> : null}<details',
'profile install option')
cloud = must_replace(cloud,
'<button type="button" onClick={() => void signOutSplitzap()} className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-700">Sign out</button>',
'<button type="button" onClick={() => { clearSplitzapExpenseDraft(session.user.id); void signOutSplitzap(); }} className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-700">Sign out</button>',
'profile signout draft cleanup')
cloud = must_replace(cloud,
'<button type="button" onClick={() => void signOutSplitzap().then(onClose)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700"><LogOut size={16} /> Sign out</button>',
'<button type="button" onClick={() => { if (session) clearSplitzapExpenseDraft(session.user.id); void signOutSplitzap().then(onClose); }} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700"><LogOut size={16} /> Sign out</button>',
'account sheet signout draft cleanup')

# ---------- CSS: true app viewport and stronger iOS touch targets ----------
css_marker = '/* Splitzap fixed-shell and mobile touch hardening */'
if css_marker not in css:
    css += r'''

/* Splitzap fixed-shell and mobile touch hardening */
.splitzap-root {
  height: 100dvh;
  min-height: 100dvh;
  overflow: hidden;
}

.splitzap-shell {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.splitzap-main-scroll {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  scroll-padding-top: max(5.25rem, env(safe-area-inset-top));
}

.splitzap-app-header {
  position: sticky;
  top: 0;
  isolation: isolate;
  box-shadow: 0 1px 0 oklch(var(--border) / 0.78);
}

.splitzap-bottom-nav {
  position: absolute;
  bottom: 0;
  left: 0;
}

.splitzap-root button.size-9 {
  min-width: 44px;
  min-height: 44px;
}

.splitzap-root .splitzap-nav-item {
  min-height: 44px;
  touch-action: manipulation;
}

@supports (-webkit-touch-callout: none) {
  .splitzap-app-header,
  .splitzap-bottom-nav {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }

  .splitzap-root .press:active {
    transform: scale(0.98);
  }
}
'''

# ---------- Permanent readiness checks ----------
readiness = must_replace(readiness,
"          grep -q \"expense-confetti\" src/features/splitzap/splitzap.css",
"          grep -q \"expense-confetti\" src/features/splitzap/splitzap.css\n          grep -q \"clearPendingJoinIntent\" src/features/splitzap/SplitzapCloudApp.tsx\n          grep -q \"preview.already_joined\" src/features/splitzap/SplitzapCloudApp.tsx\n          grep -q \"Token refresh / same-account auth events\" src/features/splitzap/SplitzapCloudApp.tsx\n          grep -q \"Install Splitzap\" src/features/splitzap/SplitzapCloudApp.tsx\n          grep -q \"Settle related balance\" src/features/splitzap/SplitzapAppV4.tsx\n          grep -q \"current simplified transfer as paid\" src/features/splitzap/SplitzapAppV4.tsx\n          grep -q \"splitzap-main-scroll\" src/features/splitzap/SplitzapAppV4.tsx\n          grep -q \"splitzap.expenseDraft\" src/features/splitzap/SplitzapAppV4.tsx\n          grep -q \"fixed-shell and mobile touch hardening\" src/features/splitzap/splitzap.css\n          grep -q \"persistSession: true\" src/features/splitzap/splitzapCloud.ts\n          grep -q \"autoRefreshToken: true\" src/features/splitzap/splitzapCloud.ts",
'permanent runtime readiness assertions')

app_path.write_text(app)
cloud_path.write_text(cloud)
css_path.write_text(css)
readiness_path.write_text(readiness)
print('Splitzap runtime hardening patch applied.')
