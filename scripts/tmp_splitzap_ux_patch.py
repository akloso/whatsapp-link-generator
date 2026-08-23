from pathlib import Path
import re

ROOT = Path('.')


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly 1 match, found {count}')
    return text.replace(old, new, 1)


def sub_once(text: str, pattern: str, replacement: str, label: str, flags: int = re.S) -> str:
    next_text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly 1 match, found {count}')
    return next_text


app_path = 'src/features/splitzap/SplitzapAppV4.tsx'
cloud_path = 'src/features/splitzap/SplitzapCloudApp.tsx'
store_path = 'src/features/splitzap/splitStoreV4.ts'
css_path = 'src/features/splitzap/splitzap.css'
root_app_path = 'src/App.tsx'
test_path = 'src/features/splitzap/splitzapSyncSafety.test.ts'
helper_path = 'src/features/splitzap/splitzapPaymentSafety.ts'

app = read(app_path)
receipt_start = app.index('function ReceiptScanner(')
receipt_end = app.index('function PersonalItemsDialog', receipt_start)
receipt_before = app[receipt_start:receipt_end]

# Add additive payment helpers and Settlement type.
app = replace_once(
    app,
    "  type SelectiveItem,\n  type SplitData,\n",
    "  type SelectiveItem,\n  type Settlement,\n  type SplitData,\n",
    'Settlement import',
)
app = replace_once(
    app,
    "import type { SplitzapReceiptIntelligence } from './splitzapProduction';\n",
    "import type { SplitzapReceiptIntelligence } from './splitzapProduction';\nimport { isValidUpiId, normalizeUpiId, settlementAuthority, upiIdFromQrValue } from './splitzapPaymentSafety';\n",
    'payment safety import',
)

pending_helpers = r'''
type PendingUpiAttempt = {
  groupId: string;
  from: string;
  to: string;
  amount: number;
  paymentMode: 'full' | 'partial';
  partialAmount: string;
  note: string;
  createdAt: string;
};

const PENDING_UPI_MAX_AGE_MS = 30 * 60 * 1000;
const pendingUpiKey = (userId: string) => `splitzap.upiPending.${userId}`;

function readPendingUpiAttempt(userId: string): PendingUpiAttempt | null {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(pendingUpiKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingUpiAttempt;
    const created = +new Date(parsed.createdAt);
    if (!parsed.groupId || !parsed.from || !parsed.to || !(parsed.amount > 0) || !Number.isFinite(created) || Date.now() - created > PENDING_UPI_MAX_AGE_MS) {
      window.localStorage.removeItem(pendingUpiKey(userId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function savePendingUpiAttempt(userId: string, attempt: PendingUpiAttempt) {
  if (!userId || typeof window === 'undefined') return;
  try { window.localStorage.setItem(pendingUpiKey(userId), JSON.stringify(attempt)); } catch { /* best effort */ }
}

function clearPendingUpiAttempt(userId: string) {
  if (!userId || typeof window === 'undefined') return;
  try { window.localStorage.removeItem(pendingUpiKey(userId)); } catch { /* best effort */ }
}
'''
app = replace_once(
    app,
    "const expenseSettlement = (expense: Expense, group: Group) => simplify(expenseBalances(expense, group));\n\n",
    "const expenseSettlement = (expense: Expense, group: Group) => simplify(expenseBalances(expense, group));\n\n" + pending_helpers + "\n",
    'pending UPI helpers',
)

# Splitzap-specific PWA metadata for iOS and installed-app surfaces.
new_pwa = r'''function useSplitzapPwa() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Splitzap — Split bills, not bonds';

    const setMeta = (name: string, content: string) => {
      let tag = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      const created = !tag;
      const previous = tag?.content ?? '';
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('name', name);
        document.head.appendChild(tag);
      }
      tag.content = content;
      return () => {
        if (created) tag?.remove();
        else if (tag) tag.content = previous;
      };
    };

    const restoreMeta = [
      setMeta('apple-mobile-web-app-title', 'Splitzap'),
      setMeta('apple-mobile-web-app-capable', 'yes'),
      setMeta('mobile-web-app-capable', 'yes'),
      setMeta('apple-mobile-web-app-status-bar-style', 'default'),
    ];

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
      document.title = previousTitle;
      restoreMeta.forEach((restore) => restore());
      window.removeEventListener('beforeinstallprompt', onInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      if (manifest) manifest.setAttribute('href', previousManifest);
      if (theme) theme.content = previousTheme;
      if (apple) apple.setAttribute('href', previousApple);
    };
  }, []);
}
'''
app = sub_once(
    app,
    r"function useSplitzapPwa\(\) \{.*?\n\}\n\nexport default function SplitzapAppV4",
    new_pwa + "\nexport default function SplitzapAppV4",
    'PWA metadata function',
)

# Resume interrupted UPI confirmation after iOS/browser process recreation.
app = replace_once(
    app,
    "export default function SplitzapAppV4({ accountAction, collaboration }: { accountAction?: ReactNode; collaboration?: SplitzapCollaboration } = {}) {\n  useSplitzapPwa();\n  const [view, setView] = useState<View>(() => parseView());\n",
    "export default function SplitzapAppV4({ accountAction, collaboration }: { accountAction?: ReactNode; collaboration?: SplitzapCollaboration } = {}) {\n  useSplitzapPwa();\n  const { data: rootData } = useSplitData();\n  const [view, setView] = useState<View>(() => parseView());\n  const [resumeSettlementGroupId, setResumeSettlementGroupId] = useState<string | null>(null);\n  const pendingResumeChecked = useRef<string | null>(null);\n",
    'root resume state',
)
app = replace_once(
    app,
    "  useEffect(() => {\n    const onPop = () => setView(parseView());\n",
    "  useEffect(() => {\n    if (!rootData.me || pendingResumeChecked.current === rootData.me) return;\n    const pending = readPendingUpiAttempt(rootData.me);\n    if (!pending) { pendingResumeChecked.current = rootData.me; return; }\n    const group = rootData.groups.find((item) => item.id === pending.groupId);\n    if (!group) return;\n    pendingResumeChecked.current = rootData.me;\n    setResumeSettlementGroupId(group.id);\n    const next: View = { name: 'group', groupId: group.id };\n    window.history.replaceState({}, '', `/splitzap#group=${encodeURIComponent(group.id)}`);\n    setView(next);\n  }, [rootData.me, rootData.groups]);\n\n  useEffect(() => {\n    const onPop = () => setView(parseView());\n",
    'root resume effect',
)
app = replace_once(
    app,
    "          : <GroupScreen groupId={view.groupId} navigate={navigate} collaboration={collaboration} />}\n",
    "          : <GroupScreen groupId={view.groupId} navigate={navigate} collaboration={collaboration} resumeSettlement={resumeSettlementGroupId === view.groupId} onSettlementResumeConsumed={() => setResumeSettlementGroupId(null)} />}\n",
    'GroupScreen resume props',
)

# Make the home totals inspectable, then let the user open the relevant settlement sheet.
app = replace_once(
    app,
    "  const [paymentPickerOpen, setPaymentPickerOpen] = useState(false);\n  const [paymentGroupId, setPaymentGroupId] = useState<string | null>(null);\n",
    "  const [paymentPickerOpen, setPaymentPickerOpen] = useState(false);\n  const [paymentGroupId, setPaymentGroupId] = useState<string | null>(null);\n  const [balanceDetailMode, setBalanceDetailMode] = useState<'get' | 'owe' | null>(null);\n",
    'home balance detail state',
)
app = sub_once(
    app,
    r'<section className="px-5"><div className="balance-strip grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-surface"><div className="p-4"><p className="text-\[10px\] font-bold uppercase tracking-wide text-muted-foreground">You get</p><p className="tabular mt-1 text-xl font-extrabold text-positive">\{money\(totalOwed\)\}</p></div><div className="border-l border-border p-4"><p className="text-\[10px\] font-bold uppercase tracking-wide text-muted-foreground">You owe</p><p className="tabular mt-1 text-xl font-extrabold text-negative">\{money\(totalOwe\)\}</p></div></div></section>',
    '<section className="px-5"><div className="balance-strip grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-surface"><button type="button" onClick={() => setBalanceDetailMode(\'get\')} className="press p-4 text-left"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">You get</p><p className="tabular mt-1 text-xl font-extrabold text-positive">{money(totalOwed)}</p><p className="mt-1 text-[9px] font-bold text-primary">View details</p></button><button type="button" onClick={() => setBalanceDetailMode(\'owe\')} className="press border-l border-border p-4 text-left"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">You owe</p><p className="tabular mt-1 text-xl font-extrabold text-negative">{money(totalOwe)}</p><p className="mt-1 text-[9px] font-bold text-primary">View details</p></button></div></section>',
    'clickable home balances',
)
app = replace_once(
    app,
    "    <QuickActionsSheet open={quickOpen}",
    "    <HomeBalanceSheet open={Boolean(balanceDetailMode)} mode={balanceDetailMode ?? 'owe'} groups={activeGroups} data={data} onClose={() => setBalanceDetailMode(null)} onSettle={(groupId) => { setBalanceDetailMode(null); setPaymentGroupId(groupId); }} />\n    <QuickActionsSheet open={quickOpen}",
    'home balance sheet render',
)
app = replace_once(
    app,
    "    {paymentGroup ? <SettleSheet open={Boolean(paymentGroup)} onClose={() => setPaymentGroupId(null)} group={paymentGroup} balances={paymentBalances} data={data} update={update} getMemberUpi={collaboration?.onGetMemberUpi} /> : null}\n",
    "    {paymentGroup ? <SettleSheet open={Boolean(paymentGroup)} onClose={() => setPaymentGroupId(null)} group={paymentGroup} balances={paymentBalances} data={data} update={update} getMemberUpi={collaboration?.onGetMemberUpi} memberships={collaboration?.memberships} /> : null}\n",
    'home settlement memberships',
)

home_balance_component = r'''function HomeBalanceSheet({ open, mode, groups, data, onClose, onSettle }: {
  open: boolean;
  mode: 'get' | 'owe';
  groups: Group[];
  data: SplitData;
  onClose: () => void;
  onSettle: (groupId: string) => void;
}) {
  const entries = groups.flatMap((group) => {
    const balances = groupBalances(group, data.expenses, data.settlements);
    const mine = memberIdFor(group, data);
    const buckets = personalSettlementBuckets(balances, mine);
    const debts = mode === 'owe' ? buckets.payable : buckets.receivable;
    return debts.map((debt) => ({ group, debt }));
  });
  const total = entries.reduce((sum, entry) => sum + entry.debt.amount, 0);
  return <SheetModal open={open} onClose={onClose} title={mode === 'owe' ? 'What you owe' : 'What you get'}>
    <div className="mb-3 rounded-2xl bg-secondary px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Total</p><p className={`tabular mt-1 text-2xl font-extrabold ${mode === 'owe' ? 'text-negative' : 'text-positive'}`}>{money(total)}</p></div>
    {entries.length ? <div className="space-y-2">{entries.map(({ group, debt }) => {
      const otherId = mode === 'owe' ? debt.to : debt.from;
      return <div key={`${group.id}-${debt.from}-${debt.to}`} className="rounded-2xl border border-border bg-surface p-3"><div className="flex items-center gap-3"><span className="group-emoji grid size-10 shrink-0 place-items-center rounded-xl text-lg">{group.emoji}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold">{group.name}</p><p className="truncate text-[10px] text-muted-foreground">{mode === 'owe' ? `You owe ${displayName(group, data, otherId)}` : `${displayName(group, data, otherId)} owes you`}</p></div><p className={`tabular text-sm font-extrabold ${mode === 'owe' ? 'text-negative' : 'text-positive'}`}>{money(debt.amount, group.currency)}</p></div><button type="button" onClick={() => onSettle(group.id)} className="press mt-2 w-full rounded-xl bg-secondary py-2.5 text-xs font-bold text-primary">Settle up</button></div>;
    })}</div> : <div className="rounded-2xl bg-surface-2 p-5 text-center"><p className="text-sm font-extrabold">Nothing here</p><p className="mt-1 text-xs text-muted-foreground">Your current groups have no matching unsettled balance.</p></div>}
  </SheetModal>;
}

'''
app = replace_once(app, "const groupAccentIndex = (id: string) =>", home_balance_component + "const groupAccentIndex = (id: string) =>", 'home balance component')

# Responsive center for the main welcome/empty-state body.
app = replace_once(
    app,
    'return <section className="px-5 pt-2"><div className="splitzap-welcome card-soft overflow-hidden p-6 text-center">',
    'return <section className="splitzap-home-center px-5 pt-2"><div className="splitzap-welcome card-soft w-full overflow-hidden p-6 text-center">',
    'responsive home center',
)

# iOS sheet scroll fix: tall sheets get a definite viewport height so WebKit can scroll the body.
new_sheet = r'''function SheetModal({ open, onClose, title, children, footer, tall = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; tall?: boolean }) {
  const titleId = useId();
  const panelRef = useDialogAccessibility(open, onClose);
  if (!open) return null;
  return <div className="sheet-wrap fixed inset-0 z-50 flex items-end justify-center"><button type="button" aria-label="Close dialog" onClick={onClose} className="sheet-backdrop absolute inset-0 bg-foreground/40 backdrop-blur-[2px]" /><div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`sheet-panel relative flex w-full max-w-[520px] flex-col rounded-t-[28px] bg-surface outline-none ${tall ? 'sheet-panel--tall' : ''}`}><div className="sheet-handle mx-auto mt-2 h-1 w-10 rounded-full bg-border" /><div className="flex items-center justify-between px-5 pb-2 pt-3"><h2 id={titleId} className="text-lg font-extrabold">{title}</h2><button type="button" onClick={onClose} aria-label="Close" className="press grid size-10 place-items-center rounded-full bg-muted text-muted-foreground"><X size={16} /></button></div><div className="sheet-scroll min-h-0 flex-1 px-5 pb-4">{children}</div>{footer ? <div className="sheet-footer border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div> : null}</div></div>;
}
'''
app = sub_once(app, r"function SheetModal\(\{ open, onClose, title, children, footer \}:.*?\n\}\n", new_sheet, 'SheetModal tall support')
app = replace_once(
    app,
    "return <><SheetModal open={open} onClose={discardAndClose} title={editing ? 'Edit expense' : 'Add an expense'} footer={<PrimaryButton onClick={save}>{editing ? 'Save changes' : 'Add expense'}</PrimaryButton>}>",
    "return <><SheetModal tall open={open} onClose={discardAndClose} title={editing ? 'Edit expense' : 'Add an expense'} footer={<PrimaryButton onClick={save}>{editing ? 'Save changes' : 'Add expense'}</PrimaryButton>}>",
    'Add Expense tall sheet',
)

# Group screen can be reopened automatically for interrupted UPI confirmation.
app = replace_once(
    app,
    "function GroupScreen({ groupId, navigate, collaboration }: { groupId: string; navigate: (view: View) => void; collaboration?: SplitzapCollaboration }) {",
    "function GroupScreen({ groupId, navigate, collaboration, resumeSettlement = false, onSettlementResumeConsumed }: { groupId: string; navigate: (view: View) => void; collaboration?: SplitzapCollaboration; resumeSettlement?: boolean; onSettlementResumeConsumed?: () => void }) {",
    'GroupScreen signature',
)
app = replace_once(
    app,
    "  const [settleOpen, setSettleOpen] = useState(false);\n",
    "  const [settleOpen, setSettleOpen] = useState(false);\n  useEffect(() => { if (resumeSettlement) { setSettleOpen(true); onSettlementResumeConsumed?.(); } }, [resumeSettlement, onSettlementResumeConsumed]);\n",
    'GroupScreen resume effect',
)
app = replace_once(
    app,
    "    <SettleSheet open={settleOpen} onClose={() => setSettleOpen(false)} group={group} balances={balances} data={data} update={update} getMemberUpi={collaboration?.onGetMemberUpi} />",
    "    <SettleSheet open={settleOpen} onClose={() => setSettleOpen(false)} group={group} balances={balances} data={data} update={update} getMemberUpi={collaboration?.onGetMemberUpi} memberships={collaboration?.memberships} />",
    'GroupScreen settlement memberships',
)

# Replace the settlement UI with undo, notes, departed-user fallback, manual/QR UPI and durable UPI return state.
new_settle = r'''function SettleSheet({ open, onClose, group, balances, data, update, getMemberUpi, memberships }: { open: boolean; onClose: () => void; group: Group; balances: Record<string, number>; data: SplitData; update: (fn: (data: SplitData) => SplitData) => void; getMemberUpi?: (group: Group, memberId: string) => Promise<string | null>; memberships?: SplitzapMembershipView[] }) {
  const currentMemberId = memberIdFor(group, data);
  const { payable: debts, receivable } = personalSettlementBuckets(balances, currentMemberId);
  const nameOf = (id: string) => displayName(group, data, id);
  const connectedMemberIds = useMemo(() => new Set((memberships ?? []).filter((item) => item.group_id === group.sharedId).map((item) => item.member_id)), [memberships, group.sharedId]);
  const authorityOf = (debt: Debt) => settlementAuthority(debt, currentMemberId, group.sharedId ? connectedMemberIds : undefined);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [paymentMode, setPaymentMode] = useState<'full' | 'partial'>('full');
  const [partialAmount, setPartialAmount] = useState('');
  const [note, setNote] = useState('');
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [upiId, setUpiId] = useState<string | null>(null);
  const [manualUpiId, setManualUpiId] = useState('');
  const [upiLoading, setUpiLoading] = useState(false);
  const [upiAttempted, setUpiAttempted] = useState(false);
  const [upiFeedback, setUpiFeedback] = useState('');
  const [undoSettlement, setUndoSettlement] = useState<Settlement | null>(null);
  const undoTimer = useRef<number | null>(null);

  useEffect(() => () => { if (undoTimer.current) window.clearTimeout(undoTimer.current); }, []);

  useEffect(() => {
    if (!open) return;
    const pending = readPendingUpiAttempt(data.me);
    if (!pending || pending.groupId !== group.id) return;
    const matching = [...debts, ...receivable].find((debt) => debt.from === pending.from && debt.to === pending.to);
    if (!matching) { clearPendingUpiAttempt(data.me); return; }
    setSelectedDebt(matching);
    setPaymentMode(pending.paymentMode);
    setPartialAmount(pending.partialAmount);
    setNote(pending.note);
    setUpiAttempted(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, group.id, data.me]);

  useEffect(() => {
    if (!selectedDebt) return;
    const pending = readPendingUpiAttempt(data.me);
    const restoring = pending && pending.groupId === group.id && pending.from === selectedDebt.from && pending.to === selectedDebt.to;
    if (restoring) return;
    setPaymentMode('full');
    setPartialAmount('');
    setNote('');
    setUpiAttempted(false);
    setManualUpiId('');
    setUpiFeedback('');
  }, [selectedDebt?.from, selectedDebt?.to, selectedDebt?.amount, data.me, group.id]);

  const partialValue = selectedDebt ? Math.min(selectedDebt.amount, Math.max(0, Number(partialAmount) || 0)) : 0;
  const paymentAmount = selectedDebt ? (paymentMode === 'full' ? selectedDebt.amount : partialValue) : 0;
  const selectedAuthority = selectedDebt ? authorityOf(selectedDebt) : null;
  const canUseUpi = Boolean(selectedDebt && group.currency === '₹' && selectedDebt.from === currentMemberId);

  useEffect(() => {
    let active = true;
    setUpiId(null);
    if (!selectedDebt || !canUseUpi || !group.sharedId || !getMemberUpi) { setUpiLoading(false); return () => { active = false; }; }
    setUpiLoading(true);
    void getMemberUpi(group, selectedDebt.to).then((value) => { if (active) setUpiId(value); }).catch(() => { if (active) setUpiId(null); }).finally(() => { if (active) setUpiLoading(false); });
    return () => { active = false; };
  }, [selectedDebt?.from, selectedDebt?.to, group.sharedId, group.currency, canUseUpi, getMemberUpi]);

  const rawDebts = data.expenses.filter((expense) => expense.groupId === group.id).flatMap((expense) => expenseSettlement(expense, group).filter((debt) => debt.from === currentMemberId || debt.to === currentMemberId).map((debt) => ({ ...debt, expense })));
  const recorded = data.settlements.filter((settlement) => settlement.groupId === group.id && (settlement.from === currentMemberId || settlement.to === currentMemberId)).sort((a, b) => +new Date(b.date) - +new Date(a.date));

  const recordPayment = () => {
    if (!selectedDebt || !selectedAuthority || paymentAmount <= 0) return;
    const cleanNote = note.trim();
    const settlement: Settlement = { id: uid(), groupId: group.id, from: selectedDebt.from, to: selectedDebt.to, amount: paymentAmount, date: new Date().toISOString(), note: cleanNote || undefined };
    update((current) => {
      const next = { ...current, settlements: [settlement, ...current.settlements] };
      return group.sharedId ? next : withLocalActivity(next, { groupId: group.id, actorName: current.myName?.trim() || nameOf(memberIdFor(group, current)), eventType: 'payment_recorded', entityType: 'payment', entityId: settlement.id, data: { after: settlement } });
    });
    clearPendingUpiAttempt(data.me);
    setSelectedDebt(null);
    setUpiAttempted(false);
    setNote('');
    setUndoSettlement(settlement);
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndoSettlement(null), 8000);
  };

  const undoPayment = () => {
    if (!undoSettlement) return;
    const settlement = undoSettlement;
    update((current) => {
      const next = { ...current, settlements: current.settlements.filter((item) => item.id !== settlement.id) };
      return group.sharedId ? next : withLocalActivity(next, { groupId: group.id, actorName: current.myName?.trim() || nameOf(memberIdFor(group, current)), eventType: 'payment_removed', entityType: 'payment', entityId: settlement.id, data: { before: settlement } });
    });
    setUndoSettlement(null);
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
  };

  const launchUpi = () => {
    if (!selectedDebt || paymentAmount <= 0) return;
    const target = normalizeUpiId(upiId || manualUpiId);
    if (!isValidUpiId(target)) { setUpiFeedback('Enter a valid UPI ID or scan a UPI QR code.'); return; }
    const params = new URLSearchParams({ pa: target, pn: nameOf(selectedDebt.to), am: paymentAmount.toFixed(2), cu: 'INR', tn: `Splitzap · ${group.name}` });
    savePendingUpiAttempt(data.me, { groupId: group.id, from: selectedDebt.from, to: selectedDebt.to, amount: paymentAmount, paymentMode, partialAmount, note, createdAt: new Date().toISOString() });
    setUpiAttempted(true);
    window.location.href = `upi://pay?${params.toString()}`;
  };

  const scanUpiQr = async (file: File | null) => {
    if (!file) return;
    setUpiFeedback('');
    try {
      const Detector = (window as Window & { BarcodeDetector?: new (options?: { formats?: string[] }) => { detect: (source: ImageBitmap) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
      if (!Detector) { setUpiFeedback('QR scanning is not supported by this browser yet. Enter the UPI ID manually.'); return; }
      const bitmap = await createImageBitmap(file);
      try {
        const detector = new Detector({ formats: ['qr_code'] });
        const results = await detector.detect(bitmap);
        const parsed = results.map((result) => upiIdFromQrValue(result.rawValue ?? '')).find(Boolean) ?? null;
        if (!parsed) { setUpiFeedback('This QR code does not contain a readable UPI payment ID.'); return; }
        setManualUpiId(parsed);
        setUpiFeedback(`UPI ID detected: ${parsed}`);
      } finally { bitmap.close(); }
    } catch { setUpiFeedback('Could not read that QR code. Enter the UPI ID manually.'); }
  };

  return <>
    <SheetModal open={open} onClose={onClose} title="Settle up" footer={<PrimaryButton onClick={onClose}>Done</PrimaryButton>}>
      {debts.length === 0 && receivable.length === 0 ? <div className="celebration relative overflow-hidden rounded-3xl bg-secondary p-7 text-center"><ExpenseConfetti strong /><div className="success-check mx-auto grid size-16 place-items-center rounded-full bg-primary text-primary-foreground"><Check size={30} strokeWidth={3} /></div><p className="mt-3 text-xl font-extrabold">All settled up</p><p className="mt-1 text-xs text-muted-foreground">Nothing is owed right now.</p></div> : <>
        <div className="rounded-2xl bg-secondary px-3.5 py-3"><div className="flex items-start gap-2"><span className="mt-0.5 text-sm">↔</span><p className="text-[11px] leading-5 text-secondary-foreground"><b>Simplified settlement.</b> Splitzap nets debts across the whole group to reduce the number of payments. You may be asked to pay someone different from the person who originally covered a specific expense.</p></div></div>
        {!debts.length ? <div className="mt-3 rounded-2xl bg-surface-2 px-3 py-3 text-xs font-semibold text-muted-foreground">You do not owe anything right now.</div> : null}
        <div className="mt-3 space-y-2">{debts.map((debt) => <div key={`${debt.from}-${debt.to}`} className="settle-row flex items-center gap-3 rounded-2xl border border-border bg-surface p-3"><Avatar name={nameOf(debt.from)} size={32} /><ArrowRight size={16} className="text-muted-foreground" /><Avatar name={nameOf(debt.to)} size={32} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{nameOf(debt.from)} → {nameOf(debt.to)}</p><p className="tabular text-sm font-bold text-primary">{money(debt.amount, group.currency)}</p></div><button type="button" onClick={() => setSelectedDebt(debt)} className="press rounded-full bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Mark paid</button></div>)}</div>
        {receivable.length ? <div className="mt-3 rounded-2xl border border-positive/20 bg-positive/5 p-3"><p className="text-[10px] font-extrabold uppercase tracking-wide text-positive">You are owed</p><div className="mt-2 space-y-2">{receivable.map((debt) => { const authority = authorityOf(debt); const disconnected = authority === 'receiver-fallback'; return <div key={`owed-${debt.from}-${debt.to}`} className="flex items-center gap-3 rounded-xl bg-surface px-3 py-3"><Avatar name={nameOf(debt.from)} size={30} /><ArrowRight size={14} className="text-muted-foreground" /><Avatar name={nameOf(debt.to)} size={30} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{nameOf(debt.from)} owes you</p><p className="tabular text-sm font-extrabold text-positive">{money(debt.amount, group.currency)}</p>{disconnected ? <p className="mt-0.5 text-[9px] font-bold text-amber-700">Not currently connected to this Splitzap group · balance kept visible</p> : null}</div>{disconnected ? <button type="button" onClick={() => setSelectedDebt(debt)} className="press rounded-full bg-secondary px-2.5 py-2 text-[9px] font-bold text-primary">Mark received</button> : <span className="rounded-full bg-surface-2 px-2 py-1 text-[9px] font-bold text-muted-foreground">View only</span>}</div>; })}</div></div> : null}
        <button type="button" onClick={() => setBreakdownOpen((value) => !value)} className="press mt-3 flex w-full items-center gap-2 rounded-xl bg-surface-2 px-3 py-3 text-left"><span className="min-w-0 flex-1"><b className="block text-xs">Original breakdown</b><span className="mt-0.5 block text-[10px] text-muted-foreground">See who originally owed whom before simplification</span></span><ChevronDown size={16} className={`transition-transform ${breakdownOpen ? 'rotate-180' : ''}`} /></button>
        {breakdownOpen ? <div className="mt-2 overflow-hidden rounded-2xl border border-border bg-surface"><div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Expense obligations</div>{rawDebts.length ? rawDebts.map(({ expense, ...debt }, index) => <div key={`${expense.id}-${debt.from}-${debt.to}-${index}`} className="flex items-center gap-2 border-t border-border px-3 py-3"><span className="min-w-0 flex-1"><b className="block truncate text-xs">{nameOf(debt.from)} → {nameOf(debt.to)}</b><span className="block truncate text-[10px] text-muted-foreground">{expense.description}</span></span><span className="tabular shrink-0 text-xs font-extrabold">{money(debt.amount, group.currency)}</span></div>) : <div className="border-t border-border px-3 py-3 text-xs text-muted-foreground">No original obligations.</div>}{recorded.length ? <><div className="border-t border-border px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Payments already recorded</div>{recorded.map((payment) => <div key={payment.id} className="flex items-start gap-2 border-t border-border px-3 py-3"><span className="min-w-0 flex-1"><span className="block text-xs font-semibold">{nameOf(payment.from)} → {nameOf(payment.to)}</span>{payment.note ? <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{payment.note}</span> : null}</span><span className="tabular text-xs font-extrabold">{money(payment.amount, group.currency)}</span></div>)}</> : null}</div> : null}
      </>}
    </SheetModal>

    <CompactDialog open={!!selectedDebt} onClose={() => { setSelectedDebt(null); setUpiFeedback(''); }} title={selectedAuthority === 'receiver-fallback' ? 'Record money received' : 'Record payment'} footer={<PrimaryButton onClick={recordPayment} disabled={!selectedDebt || !selectedAuthority || (paymentMode === 'partial' && partialValue <= 0)}>{selectedAuthority === 'receiver-fallback' ? 'Mark received' : 'Mark as paid'}</PrimaryButton>}>
      {selectedDebt ? <>
        <div className="rounded-2xl bg-surface-2 p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Amount due</p><p className="mt-1 text-2xl font-extrabold">{money(selectedDebt.amount, group.currency)}</p><p className="mt-1 text-xs text-muted-foreground">{nameOf(selectedDebt.from)} → {nameOf(selectedDebt.to)}</p></div>
        <div className="mt-2 flex items-start gap-1.5 rounded-xl bg-surface-2 px-2.5 py-2 text-[10px] leading-4 text-muted-foreground"><Info size={11} className="mt-0.5 shrink-0" /> {selectedAuthority === 'receiver-fallback' ? 'The payer is not currently connected to this group, so you can confirm money you received. The original expense stays unchanged.' : 'This records the current simplified transfer as paid. Original expense details stay unchanged.'}</div>
        <Field label="Note (optional)" compact><input value={note} onChange={(event) => setNote(event.target.value)} maxLength={160} placeholder="Cash, dinner settlement, reference…" className={inputClass} /></Field>
        {canUseUpi ? <div className="mt-3 rounded-2xl border border-primary/15 bg-secondary p-3"><div className="flex items-center justify-between gap-2"><div><p className="text-xs font-extrabold text-primary">Pay with UPI</p><p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">Splitzap opens your payment app with the recipient and amount filled in.</p></div><span className="rounded-full bg-surface px-2 py-1 text-[9px] font-bold text-primary">UPI</span></div>
          {upiLoading ? <p className="mt-2 text-[10px] font-semibold text-muted-foreground">Checking payment details…</p> : upiId ? <><p className="mt-2 rounded-xl bg-surface px-2.5 py-2 text-[10px] font-semibold text-muted-foreground">Using {nameOf(selectedDebt.to)}'s saved UPI ID.</p><button type="button" disabled={paymentAmount <= 0} onClick={launchUpi} className="press mt-2 w-full rounded-xl bg-primary py-3 text-xs font-bold text-primary-foreground disabled:opacity-40">Pay {money(paymentAmount, group.currency)} via UPI</button></> : <div className="mt-2"><p className="rounded-xl bg-surface px-2.5 py-2 text-[10px] leading-4 text-muted-foreground">{nameOf(selectedDebt.to)} has not shared a UPI ID. You can still enter one for this payment or scan their UPI QR.</p><input value={manualUpiId} onChange={(event) => setManualUpiId(normalizeUpiId(event.target.value))} autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="email" placeholder="name@bank" className={`${inputClass} mt-2`} /><div className="mt-2 grid grid-cols-2 gap-2"><label className="press flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-surface py-2.5 text-[10px] font-bold text-primary"><Camera size={13} /> Scan UPI QR<input type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { void scanUpiQr(event.target.files?.[0] ?? null); event.currentTarget.value = ''; }} /></label><button type="button" disabled={!isValidUpiId(manualUpiId) || paymentAmount <= 0} onClick={launchUpi} className="press rounded-xl bg-primary py-2.5 text-[10px] font-bold text-primary-foreground disabled:opacity-40">Pay via UPI</button></div></div>}
          {upiFeedback ? <p role="status" className="mt-2 rounded-xl bg-surface px-2.5 py-2 text-[10px] font-semibold leading-4 text-muted-foreground">{upiFeedback}</p> : null}
          {upiAttempted ? <div className="mt-2 rounded-xl bg-surface p-2.5"><p className="text-[11px] font-extrabold">Did you complete the payment?</p><p className="mt-0.5 text-[10px] text-muted-foreground">{money(paymentAmount, group.currency)} to {nameOf(selectedDebt.to)}</p><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => { clearPendingUpiAttempt(data.me); setUpiAttempted(false); }} className="press rounded-lg bg-surface-2 py-2 text-[10px] font-bold">Not yet</button><button type="button" onClick={recordPayment} className="press rounded-lg bg-primary py-2 text-[10px] font-bold text-primary-foreground">Yes, mark paid</button></div></div> : null}
          <p className="mt-1.5 text-[9px] leading-4 text-muted-foreground">Opening a UPI app never marks a payment completed automatically.</p>
        </div> : null}
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1"><button type="button" onClick={() => setPaymentMode('full')} className={`press rounded-xl py-2.5 text-xs font-bold ${paymentMode === 'full' ? 'bg-surface text-primary shadow-sm' : 'text-muted-foreground'}`}>Full payment</button><button type="button" onClick={() => setPaymentMode('partial')} className={`press rounded-xl py-2.5 text-xs font-bold ${paymentMode === 'partial' ? 'bg-surface text-primary shadow-sm' : 'text-muted-foreground'}`}>Partial payment</button></div>
        {paymentMode === 'partial' ? <div className="mt-3"><Field label={selectedAuthority === 'receiver-fallback' ? 'Amount received' : 'Amount paid'} compact><input value={partialAmount} onChange={(event) => { const raw = event.target.value.replace(/[^0-9.]/g, ''); const next = Math.min(selectedDebt.amount, Math.max(0, Number(raw) || 0)); setPartialAmount(raw === '' ? '' : String(next)); }} inputMode="decimal" placeholder="0" className={`${inputClass} tabular text-right font-bold`} /></Field><div className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2 text-xs"><span className="font-semibold text-muted-foreground">Remaining after payment</span><span className="font-extrabold text-primary">{money(Math.max(0, selectedDebt.amount - partialValue), group.currency)}</span></div></div> : <p className="mt-3 text-xs text-muted-foreground">This records the full outstanding amount.</p>}
      </> : null}
    </CompactDialog>

    {undoSettlement ? <div className="fixed bottom-[max(6rem,calc(env(safe-area-inset-bottom)+5rem))] left-1/2 z-[90] flex w-[calc(100%-2rem)] max-w-[488px] -translate-x-1/2 items-center gap-3 rounded-2xl bg-foreground px-4 py-3 text-primary-foreground shadow-xl"><span className="min-w-0 flex-1 truncate text-xs font-bold">Payment recorded · {money(undoSettlement.amount, group.currency)}</span><button type="button" onClick={undoPayment} className="press rounded-lg bg-primary-foreground/12 px-3 py-2 text-xs font-extrabold">Undo</button></div> : null}
  </>;
}
'''
app = sub_once(
    app,
    r"function SettleSheet\(.*?\n\}\n\nfunction buildExpenseShareMessage",
    new_settle + "\n\nfunction buildExpenseShareMessage",
    'SettleSheet replacement',
)

# Receipt scanner is explicitly frozen in this batch.
receipt_start_after = app.index('function ReceiptScanner(')
receipt_end_after = app.index('function PersonalItemsDialog', receipt_start_after)
if app[receipt_start_after:receipt_end_after] != receipt_before:
    raise RuntimeError('Receipt scanner changed unexpectedly; aborting patch')
write(app_path, app)

# Settlement notes are additive and backwards-compatible.
store = read(store_path)
store = replace_once(
    store,
    "export type Settlement = {\n  id: string;\n  groupId: string;\n  from: string;\n  to: string;\n  amount: number;\n  date: string;\n};",
    "export type Settlement = {\n  id: string;\n  groupId: string;\n  from: string;\n  to: string;\n  amount: number;\n  date: string;\n  note?: string;\n};",
    'Settlement note type',
)
store = replace_once(
    store,
    "    settlements: Array.isArray(data.settlements) ? data.settlements : [],",
    "    settlements: Array.isArray(data.settlements) ? data.settlements.map((settlement) => ({ ...settlement, note: typeof settlement?.note === 'string' && settlement.note.trim() ? settlement.note.trim() : undefined })) : [],",
    'Settlement note normalization',
)
write(store_path, store)

# Payment/UPI safety helpers with a narrow creditor exception only for disconnected debtors.
write(helper_path, r'''import type { Debt } from './splitStoreV4';

const UPI_RE = /^[a-z0-9][a-z0-9._-]{1,255}@[a-z0-9][a-z0-9._-]{1,63}$/i;

export function normalizeUpiId(value: string | null | undefined) {
  return String(value ?? '').trim().replace(/\s+/g, '').toLowerCase();
}

export function isValidUpiId(value: string | null | undefined) {
  return UPI_RE.test(normalizeUpiId(value));
}

export function upiIdFromQrValue(rawValue: string) {
  const raw = rawValue.trim();
  if (!raw) return null;
  if (isValidUpiId(raw)) return normalizeUpiId(raw);
  try {
    const url = new URL(raw);
    if (url.protocol.toLowerCase() !== 'upi:') return null;
    const id = normalizeUpiId(url.searchParams.get('pa'));
    return isValidUpiId(id) ? id : null;
  } catch {
    return null;
  }
}

export type SettlementAuthority = 'payer' | 'receiver-fallback' | null;

export function settlementAuthority(debt: Debt, currentMemberId: string, connectedMemberIds?: Set<string>): SettlementAuthority {
  if (debt.from === currentMemberId) return 'payer';
  if (debt.to === currentMemberId && connectedMemberIds && !connectedMemberIds.has(debt.from)) return 'receiver-fallback';
  return null;
}
''')

# Responsive and iOS sheet fixes.
css = read(css_path)
css += r'''

/* Splitzap mobile viewport hardening: center the welcome state without assuming one phone height. */
.splitzap-home-center {
  min-height: calc(100dvh - 9.5rem - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
}

.sheet-panel--tall {
  height: min(92dvh, calc(100dvh - max(0.5rem, env(safe-area-inset-top))));
  max-height: calc(100dvh - max(0.5rem, env(safe-area-inset-top)));
}

.sheet-panel--tall .sheet-scroll {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  padding-bottom: max(1.25rem, env(safe-area-inset-bottom));
}

@media (max-height: 700px) {
  .splitzap-home-center {
    min-height: auto;
    align-items: flex-start;
    padding-bottom: 1rem;
  }
}

@supports (-webkit-touch-callout: none) {
  .sheet-panel--tall {
    height: calc(100dvh - max(0.5rem, env(safe-area-inset-top)));
  }
  .sheet-panel--tall .sheet-scroll {
    overflow-y: scroll;
    -webkit-overflow-scrolling: touch;
  }
}
'''
write(css_path, css)

# Splitzap's route metadata should present Splitzap, not Zapora, to iOS install surfaces.
root_app = read(root_app_path)
root_app = replace_once(
    root_app,
    "    title: 'Splitzap - Split Expenses & Share on WhatsApp | Zapora',",
    "    title: 'Splitzap — Split bills, not bonds',",
    'Splitzap route title',
)
write(root_app_path, root_app)

# Surface existing profile feedback where the action happens instead of at the bottom of the page.
cloud = read(cloud_path)
cloud = replace_once(
    cloud,
    "      window.localStorage.removeItem('splitzap.cloud.lastUserId');\n      window.location.replace('/splitzap');",
    "      window.localStorage.removeItem('splitzap.cloud.lastUserId');\n      window.history.replaceState({}, '', '/splitzap');\n      window.location.reload();",
    'delete-account redirect',
)
cloud = replace_once(
    cloud,
    "  return <div className=\"fixed inset-0 z-[140] overflow-y-auto bg-[#fbfaf6] text-slate-900\"><div className=\"mx-auto min-h-[100dvh] w-full max-w-[520px] bg-[#fbfaf6] pb-[max(2rem,env(safe-area-inset-bottom))]\">",
    "  return <div className=\"fixed inset-0 z-[140] overflow-y-auto bg-[#fbfaf6] text-slate-900\">{feedback ? <div role=\"status\" aria-live=\"polite\" className=\"fixed left-1/2 top-[max(0.75rem,env(safe-area-inset-top))] z-[175] w-[calc(100%-1.5rem)] max-w-[488px] -translate-x-1/2 rounded-2xl border border-[#cfe6dd] bg-white px-4 py-3 text-xs font-bold leading-5 text-[#1f665d] shadow-xl\"><div className=\"flex items-start gap-2\"><span className=\"grid size-5 shrink-0 place-items-center rounded-full bg-[#e7f4ef] text-[11px]\">✓</span><span className=\"min-w-0 flex-1\">{feedback}</span><button type=\"button\" onClick={() => setFeedback('')} aria-label=\"Dismiss message\" className=\"grid size-7 shrink-0 place-items-center rounded-full bg-slate-50 text-slate-500\"><X size={12} /></button></div></div> : null}<div className=\"mx-auto min-h-[100dvh] w-full max-w-[520px] bg-[#fbfaf6] pb-[max(2rem,env(safe-area-inset-bottom))]\">",
    'profile fixed feedback',
)
# Avoid duplicating the same feedback at the bottom.
cloud = replace_once(
    cloud,
    "      {feedback ? <p role=\"status\" className=\"rounded-xl bg-[#eef6f3] px-3 py-3 text-xs leading-5 text-slate-700\">{feedback}</p> : null}\n",
    "",
    'remove bottom profile feedback',
)
write(cloud_path, cloud)

# Add regression coverage to the existing permanent test command.
tests = read(test_path)
tests = replace_once(
    tests,
    "import { compactSnapshotFingerprint, preserveDirtyRemoteRow, preserveDirtySharedGroupsOnBootstrap } from './splitzapSyncSafety';\n",
    "import { compactSnapshotFingerprint, preserveDirtyRemoteRow, preserveDirtySharedGroupsOnBootstrap } from './splitzapSyncSafety';\nimport { isValidUpiId, settlementAuthority, upiIdFromQrValue } from './splitzapPaymentSafety';\n",
    'payment safety test import',
)
tests += r'''

describe('Splitzap settlement and UPI safety', () => {
  it('keeps active-user receivables view-only but lets a disconnected debtor be marked received', () => {
    const debt = { from: 'friend', to: 'me', amount: 120 };
    expect(settlementAuthority(debt, 'me', new Set(['me', 'friend']))).toBeNull();
    expect(settlementAuthority(debt, 'me', new Set(['me']))).toBe('receiver-fallback');
    expect(settlementAuthority({ ...debt, from: 'me', to: 'friend' }, 'me', new Set(['me', 'friend']))).toBe('payer');
  });

  it('accepts manual UPI IDs and extracts the payee from a UPI QR payload', () => {
    expect(isValidUpiId('Akash.Test@Bank')).toBe(true);
    expect(upiIdFromQrValue('upi://pay?pa=akash.test%40bank&pn=Akash')).toBe('akash.test@bank');
    expect(upiIdFromQrValue('https://example.com/qr')).toBeNull();
  });
});
'''
write(test_path, tests)

print('Splitzap UX/payment hardening patch applied successfully.')
