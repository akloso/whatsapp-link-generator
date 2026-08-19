import {
  AlertTriangle,
  Archive,
  CalendarDays,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  HardDrive,
  History,
  Home,
  Filter,
  ImagePlus,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Receipt,
  Search,
  Share2,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  CATEGORIES,
  CURRENCIES,
  baseAmountOf,
  categoryOf,
  createSplitBackup,
  expenseBalances,
  groupBalances,
  money,
  memberIdFor,
  paymentsOf,
  personalTotalOf,
  selectiveItemShare,
  shareOf,
  simplify,
  restoreSplitBackup,
  uid,
  useSplitData,
  useSplitStorageStatus,
  withLocalActivity,
  type AdditionalCharge,
  type Debt,
  type Expense,
  type ExpenseHistoryEntry,
  type Group,
  type HistoryChange,
  type PersonalItem,
  type ReceiptItem,
  type SelectiveItem,
  type SplitData,
  type SplitMode,
} from './splitStoreV4';

type View = { name: 'home' } | { name: 'activity' } | { name: 'group'; groupId: string };
type GroupTab = 'expenses' | 'balances' | 'insights';
type PersonalDraft = { id?: string; memberId: string; description: string; amount: string };
type SelectiveDraft = { id?: string; description: string; amount: string; memberIds: string[]; mode: SplitMode; split: Record<string, number> };
type ScanExpenseSeed = { groupId: string; description: string; amount: number; personalItems: PersonalItem[]; additionalCharges: AdditionalCharge[]; receiptItems: ReceiptItem[] };
type ParsedReceipt = { merchant: string; detectedTotal: number | null; items: ReceiptItem[]; charges: AdditionalCharge[] };

export type SplitzapAuditEvent = { id: string; group_id: string; actor_user_id: string | null; actor_member_id: string | null; actor_name: string | null; event_type: string; entity_type: string; entity_id: string | null; event_data: Record<string, unknown>; revision: number | null; occurred_at: string };
export type SplitzapJoinRequestView = { id: string; group_id: string; requested_member_id: string | null; requested_name: string; requested_email: string; status: string; requested_at: string };
export type SplitzapMembershipView = { group_id: string; user_id: string; member_id: string; role: 'owner' | 'member'; joined_at?: string };
export type SplitzapCollaboration = {
  signedIn: boolean;
  activity?: SplitzapAuditEvent[];
  pendingRequests?: SplitzapJoinRequestView[];
  memberships?: SplitzapMembershipView[];
  onInviteGroup: (groupId: string, memberId?: string) => void;
  onManageMembers?: (groupId: string) => void;
  onJoinGroup: () => void;
  onDeleteGroup: (group: Group, mode: 'self' | 'everyone', transferMemberId?: string) => Promise<void>;
  onArchiveGroup?: (group: Group, archive: boolean) => Promise<void>;
  onResolveJoinRequest?: (requestId: string, approve: boolean) => Promise<void>;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const parseView = (): View => {
  const hash = window.location.hash;
  if (hash === '#activity') return { name: 'activity' };
  if (hash.startsWith('#group=')) return { name: 'group', groupId: decodeURIComponent(hash.slice(7)) };
  return { name: 'home' };
};

const displayName = (group: Group, data: SplitData, id: string) => {
  const stored = group.members.find((member) => member.id === id)?.name?.trim();
  if (id === memberIdFor(group, data) && data.myName?.trim()) return data.myName.trim();
  return stored || 'Someone';
};

const shareMoney = (amount: number, currency = '₹') => {
  const value = Math.abs(amount);
  return `${currency}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const payerSummary = (expense: Expense, group: Group, data: SplitData, detailed = false) => {
  const entries = Object.entries(paymentsOf(expense)).filter(([, amount]) => amount > 0);
  if (!entries.length) return 'Someone';
  if (entries.length === 1) return displayName(group, data, entries[0]![0]);
  if (detailed) {
    return entries.map(([id, amount]) => `${displayName(group, data, id)} ${shareMoney(amount, group.currency)}`).join(' · ');
  }
  return entries.map(([id]) => displayName(group, data, id)).join(' + ');
};

const expenseSettlement = (expense: Expense, group: Group) => simplify(expenseBalances(expense, group));

function useSplitzapPwa() {
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

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/splitzap-sw.js', { scope: '/splitzap' }).catch(() => undefined);
    }

    return () => {
      if (manifest) manifest.setAttribute('href', previousManifest);
      if (theme) theme.content = previousTheme;
      if (apple) apple.setAttribute('href', previousApple);
    };
  }, []);
}

export default function SplitzapAppV4({ accountAction, collaboration }: { accountAction?: ReactNode; collaboration?: SplitzapCollaboration } = {}) {
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
        ? <HomeScreen navigate={navigate} onDataBackup={() => setDataToolsOpen(true)} accountAction={accountAction} collaboration={collaboration} />
        : view.name === 'activity'
          ? <ActivityScreen navigate={navigate} collaboration={collaboration} />
          : <GroupScreen groupId={view.groupId} navigate={navigate} collaboration={collaboration} />}
      {storageError ? <div role="alert" className="fixed left-1/2 top-[max(0.75rem,env(safe-area-inset-top))] z-[110] flex w-[calc(100%-1.5rem)] max-w-[496px] -translate-x-1/2 items-start gap-2 rounded-2xl border border-negative/20 bg-surface px-3 py-3 shadow-xl"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-negative" /><p className="min-w-0 flex-1 text-[11px] font-semibold leading-4 text-foreground">{storageError}</p><button type="button" onClick={() => setDataToolsOpen(true)} className="press shrink-0 rounded-lg bg-secondary px-2.5 py-2 text-[11px] font-bold text-primary">Backup</button><button type="button" aria-label="Dismiss storage warning" onClick={clearStorageError} className="press grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-muted-foreground"><X size={14} /></button></div> : null}
      <DataBackupDialog open={dataToolsOpen} onClose={() => setDataToolsOpen(false)} onRestored={afterRestore} />
    </div>
  );
}

function ExpenseConfetti({ strong = false }: { strong?: boolean }) {
  return <span className={'expense-confetti ' + (strong ? 'is-strong' : '')} aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</span>;
}

const expenseDateInputValue = (value?: string) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const expenseDateToIso = (value: string) => {
  const date = new Date(value + 'T12:00:00');
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '').join('');
  return <span className="splitzap-avatar grid shrink-0 place-items-center rounded-full bg-secondary font-semibold text-secondary-foreground" style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials || '?'}</span>;
}

function AppShell({ children, onAdd, view, navigate }: { children: ReactNode; onAdd?: () => void; view: View; navigate: (view: View) => void }) {
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
}

function NavItem({ label, icon, active, onClick }: { label: string; icon: ReactNode; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-current={active ? 'page' : undefined} className={`splitzap-nav-item flex flex-col items-center gap-0.5 py-1 text-[11px] font-semibold ${active ? 'is-active text-primary' : 'text-muted-foreground'}`}><span className="splitzap-nav-icon">{icon}</span>{label}</button>;
}

function Header({ title, subtitle, right, back, onTitleClick }: { title: string; subtitle?: string; right?: ReactNode; back?: ReactNode; onTitleClick?: () => void }) {
  const titleBlock = <div className="min-w-0 text-left"><h1 className="truncate text-2xl font-extrabold">{title}</h1>{subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}</div>;
  return <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 pb-3 pt-[max(1.5rem,env(safe-area-inset-top))]"><div className="flex min-w-0 items-center gap-2">{back}{onTitleClick ? <button type="button" onClick={onTitleClick} className="press min-w-0 text-left">{titleBlock}</button> : titleBlock}</div>{right}</header>;
}

function Field({ label, children, compact = false }: { label: string; children: ReactNode; compact?: boolean }) {
  return <fieldset className={`${compact ? 'mb-2' : 'mb-4'} m-0 min-w-0 border-0 p-0`}><legend className="mb-1.5 block p-0 text-[12px] font-semibold text-muted-foreground">{label}</legend>{children}</fieldset>;
}

const inputClass = 'splitzap-input w-full rounded-xl border border-border bg-surface-2 px-3.5 py-3 text-[15px] outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/25';

function PrimaryButton({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="splitzap-primary-button press w-full rounded-2xl bg-primary py-3.5 text-[15px] font-bold text-primary-foreground disabled:opacity-40">{children}</button>;
}

function useDialogAccessibility(open: boolean, onClose: () => void) {
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

  return <CompactDialog open={open} onClose={onClose} title="Backup & restore"><div className="space-y-3"><div className="rounded-2xl bg-secondary p-3"><div className="flex items-start gap-2"><HardDrive size={18} className="mt-0.5 shrink-0 text-primary" /><div><p className="text-sm font-extrabold">Keep an extra copy of your Splitzap data</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">Export a backup before clearing browser data, changing phones or reinstalling the app.</p></div></div></div><button type="button" onClick={downloadBackup} className="press flex min-h-12 w-full items-center gap-3 rounded-xl border border-border bg-surface-2 px-3 text-left"><span className="grid size-9 place-items-center rounded-xl bg-surface text-primary"><Download size={17} /></span><span className="min-w-0 flex-1"><b className="block text-sm">Export backup</b><span className="text-[11px] text-muted-foreground">Download all groups, expenses and payments</span></span></button><label className="press flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface-2 px-3 text-left"><span className="grid size-9 place-items-center rounded-xl bg-surface text-primary"><Upload size={17} /></span><span className="min-w-0 flex-1"><b className="block text-sm">Restore backup</b><span className="text-[11px] text-muted-foreground">Replace this device's data from a Splitzap JSON backup</span></span><input type="file" accept="application/json,.json" className="hidden" onChange={(event) => { void restoreFile(event.target.files?.[0] ?? null); event.currentTarget.value = ''; }} /></label>{feedback ? <p role="status" className={`rounded-xl px-3 py-2.5 text-[11px] font-bold ${feedback.kind === 'success' ? 'bg-secondary text-primary' : 'bg-negative/5 text-negative'}`}>{feedback.text}</p> : null}</div></CompactDialog>;
}

function IntroPanel({ hasGroups, onPrimary, onNewGroup, onInstall }: { hasGroups: boolean; onPrimary: () => void; onNewGroup: () => void; onInstall?: () => void }) {
  return <section className="px-5 pt-2"><div className="splitzap-welcome card-soft overflow-hidden p-6 text-center"><div className="welcome-orbit mx-auto mb-5" aria-hidden="true"><span>🍜</span><span>🚕</span><span>🏠</span><span>🎉</span><strong>₹</strong></div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Splitzap</p><h2 className="mt-2 text-3xl font-extrabold">Split bills, not bonds.</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Keep shared spending clear, personal items separate, and every balance easy to settle.</p><button type="button" onClick={onPrimary} className="splitzap-primary-cta press mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-sm font-bold text-primary-foreground">{hasGroups ? <Home size={18} /> : <Plus size={18} />}{hasGroups ? 'Back to your groups' : 'Create your first group'}</button>{hasGroups ? <button type="button" onClick={onNewGroup} className="press mt-3 block w-full text-sm font-bold text-primary">+ Create another group</button> : null}{onInstall ? <button type="button" onClick={onInstall} className="press mt-2 block w-full text-xs font-bold text-muted-foreground">Install Splitzap on this device</button> : null}<div className="mt-6 grid grid-cols-3 gap-2 text-left">{[['⚡', 'Fast', 'Add in seconds'], ['🧮', 'Clear', 'Automatic math'], ['🔒', 'Private', 'Saved on device']].map(([emoji, title, copy]) => <div key={title} className="welcome-feature rounded-2xl bg-surface-2 p-3"><span className="text-lg">{emoji}</span><p className="mt-1 text-xs font-bold">{title}</p><p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{copy}</p></div>)}</div></div></section>;
}

function QuickActionsSheet({ open, onClose, onAddExpense, onScanReceipt, onNewGroup, onRecordPayment }: { open: boolean; onClose: () => void; onAddExpense: () => void; onScanReceipt: () => void; onNewGroup: () => void; onRecordPayment: () => void }) {
  const action = (fn: () => void) => { onClose(); fn(); };
  return <SheetModal open={open} onClose={onClose} title="What do you want to do?"><div className="grid grid-cols-2 gap-2 pb-2">{[
    { label: 'Add expense', copy: 'Split a new bill', icon: '＋', run: onAddExpense, tone: 'quick-food' },
    { label: 'Record payment', copy: 'Settle a balance', icon: '₹', run: onRecordPayment, tone: 'quick-payment' },
    { label: 'Scan receipt', copy: 'Use a bill photo', icon: '▣', run: onScanReceipt, tone: 'quick-scan' },
    { label: 'New group', copy: 'Start a fresh split', icon: '👥', run: onNewGroup, tone: 'quick-group' },
  ].map((item) => <button type="button" key={item.label} onClick={() => action(item.run)} className={`quick-action press min-h-24 rounded-2xl border border-border bg-surface p-4 text-left ${item.tone}`}><span className="grid size-9 place-items-center rounded-xl bg-surface-2 text-lg font-extrabold">{item.icon}</span><b className="mt-3 block text-sm">{item.label}</b><span className="mt-0.5 block text-[10px] text-muted-foreground">{item.copy}</span></button>)}</div></SheetModal>;
}

function GroupPickerSheet({ open, onClose, groups, onPick }: { open: boolean; onClose: () => void; groups: Group[]; onPick: (groupId: string) => void }) {
  return <SheetModal open={open} onClose={onClose} title="Choose a group"><div className="space-y-2 pb-2">{groups.map((group) => <button type="button" key={group.id} onClick={() => { onClose(); onPick(group.id); }} className="press flex w-full items-center gap-3 rounded-2xl bg-surface-2 px-3 py-3 text-left"><span className="text-xl">{group.emoji}</span><span className="min-w-0 flex-1 truncate text-sm font-bold">{group.name}</span><ChevronRight size={15} className="text-muted-foreground" /></button>)}</div></SheetModal>;
}

const groupAccentIndex = (id: string) => [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 6;

function HomeScreen({ navigate, accountAction, collaboration }: { navigate: (view: View) => void; onDataBackup: () => void; accountAction?: ReactNode; collaboration?: SplitzapCollaboration }) {
  const { data, update, hydrated } = useSplitData();
  const [addOpen, setAddOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [scanSeed, setScanSeed] = useState<ScanExpenseSeed | null>(null);
  const [showIntro, setShowIntro] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [paymentPickerOpen, setPaymentPickerOpen] = useState(false);
  const [paymentGroupId, setPaymentGroupId] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (event: Event) => { event.preventDefault(); setInstallPrompt(event as BeforeInstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const summaries = data.groups.map((group) => {
    const balance = groupBalances(group, data.expenses, data.settlements);
    const spent = data.expenses.filter((expense) => expense.groupId === group.id).reduce((sum, expense) => sum + expense.amount, 0);
    return { group, mine: balance[memberIdFor(group, data)] ?? 0, spent };
  });
  const activeSummaries = summaries.filter(({ group }) => (group.status ?? group.sharedStatus ?? 'active') !== 'archived');
  const archivedSummaries = summaries.filter(({ group }) => (group.status ?? group.sharedStatus ?? 'active') === 'archived');
  const visibleSummaries = showArchived ? archivedSummaries : activeSummaries;
  const totalOwed = activeSummaries.filter((item) => item.mine > 0.01).reduce((sum, item) => sum + item.mine, 0);
  const totalOwe = activeSummaries.filter((item) => item.mine < -0.01).reduce((sum, item) => sum - item.mine, 0);
  const introVisible = hydrated && (data.groups.length === 0 || showIntro);
  const activeGroups = activeSummaries.map((item) => item.group);

  const beginPayment = () => {
    if (activeGroups.length === 1) setPaymentGroupId(activeGroups[0]!.id);
    else if (activeGroups.length > 1) setPaymentPickerOpen(true);
    else setGroupOpen(true);
  };

  const paymentGroup = paymentGroupId ? data.groups.find((group) => group.id === paymentGroupId) ?? null : null;
  const paymentBalances = paymentGroup ? groupBalances(paymentGroup, data.expenses, data.settlements) : {};

  return <AppShell onAdd={() => setQuickOpen(true)} view={{ name: 'home' }} navigate={navigate}>
    <Header title="Splitzap" subtitle="Split bills, not bonds" onTitleClick={data.groups.length ? () => setShowIntro(true) : undefined} right={<div className="flex items-center gap-2">{accountAction}<button type="button" onClick={() => setGroupOpen(true)} className="press flex items-center gap-1 rounded-full bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground"><Plus size={14} /> New</button></div>} />
    {!hydrated ? <section className="space-y-3 px-5 pt-2"><div className="splitzap-skeleton h-28 rounded-3xl" /><div className="splitzap-skeleton h-20 rounded-3xl" /></section> : introVisible ? <IntroPanel hasGroups={data.groups.length > 0} onPrimary={() => data.groups.length ? setShowIntro(false) : setGroupOpen(true)} onNewGroup={() => setGroupOpen(true)} onInstall={installPrompt ? install : undefined} /> : <>
      <section className="px-5"><div className="balance-strip grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-surface"><div className="p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">You get</p><p className="tabular mt-1 text-xl font-extrabold text-positive">{money(totalOwed)}</p></div><div className="border-l border-border p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">You owe</p><p className="tabular mt-1 text-xl font-extrabold text-negative">{money(totalOwe)}</p></div></div></section>
      <section className="px-5 pt-5"><div className="mb-2 flex items-end justify-between gap-3"><div><p className="text-sm font-extrabold">Your groups</p><p className="mt-0.5 text-[11px] text-muted-foreground">{activeSummaries.length} active · {archivedSummaries.length} archived</p></div>{archivedSummaries.length ? <button type="button" onClick={() => setShowArchived((value) => !value)} className="press rounded-full bg-surface-2 px-3 py-1.5 text-[10px] font-bold text-primary">{showArchived ? 'Show active' : 'Archived'}</button> : null}</div>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">{visibleSummaries.map(({ group, mine, spent }, index) => <button type="button" key={group.id} onClick={() => navigate({ name: 'group', groupId: group.id })} className={`group-row group-accent-${groupAccentIndex(group.id)} list-enter press flex w-full items-center gap-3 border-b border-border px-3.5 py-3.5 text-left last:border-b-0`} style={{ animationDelay: `${index * 40}ms` }}><span className="group-emoji grid size-11 shrink-0 place-items-center rounded-2xl text-xl">{group.emoji}</span><div className="min-w-0 flex-1"><p className="truncate font-bold">{group.name}</p><p className="truncate text-[11px] text-muted-foreground">{group.members.length} people · {money(spent, group.currency)} spent</p></div><div className="text-right"><p className={`text-[10px] font-semibold ${Math.abs(mine) < 0.01 ? 'text-muted-foreground' : mine > 0 ? 'text-positive' : 'text-negative'}`}>{Math.abs(mine) < 0.01 ? 'Settled' : mine > 0 ? 'You get' : 'You owe'}</p><p className={`tabular text-sm font-extrabold ${Math.abs(mine) < 0.01 ? 'text-muted-foreground' : mine > 0 ? 'text-positive' : 'text-negative'}`}>{Math.abs(mine) < 0.01 ? '—' : money(Math.abs(mine), group.currency)}</p></div><ChevronRight size={15} className="shrink-0 text-muted-foreground" /></button>)}{visibleSummaries.length === 0 ? <div className="p-6 text-center"><p className="text-sm font-extrabold">{showArchived ? 'No archived groups' : 'No active groups'}</p><p className="mt-1 text-xs text-muted-foreground">{showArchived ? 'Archived groups will stay safely stored here.' : 'Create a group to start splitting expenses.'}</p></div> : null}</div>
      </section>
    </>}
    <QuickActionsSheet open={quickOpen} onClose={() => setQuickOpen(false)} onAddExpense={() => data.groups.length ? setAddOpen(true) : setGroupOpen(true)} onScanReceipt={() => data.groups.length ? setScannerOpen(true) : setGroupOpen(true)} onNewGroup={() => setGroupOpen(true)} onRecordPayment={beginPayment} />
    <GroupPickerSheet open={paymentPickerOpen} onClose={() => setPaymentPickerOpen(false)} groups={activeGroups} onPick={setPaymentGroupId} />
    {data.groups.length ? <AddExpenseSheet open={addOpen} onClose={() => { setAddOpen(false); setScanSeed(null); }} data={data} update={update} seed={scanSeed} /> : null}
    <ReceiptScanner open={scannerOpen} onClose={() => setScannerOpen(false)} data={data} onUse={(seed) => { setScanSeed(seed); setScannerOpen(false); setAddOpen(true); }} />
    <NewGroupSheet open={groupOpen} onClose={() => setGroupOpen(false)} data={data} update={update} onCreated={(groupId) => navigate({ name: 'group', groupId })} onJoinGroup={collaboration?.onJoinGroup} />
    {paymentGroup ? <SettleSheet open={Boolean(paymentGroup)} onClose={() => setPaymentGroupId(null)} group={paymentGroup} balances={paymentBalances} data={data} update={update} /> : null}
  </AppShell>;
}

type ActivityFilter = 'all' | 'expense' | 'payment' | 'member' | 'group';

const activityEventCopy = (event: SplitzapAuditEvent, group: Group | undefined) => {
  const actor = event.actor_name?.trim() || 'Someone';
  const info = event.event_data ?? {};
  const after = (info.after && typeof info.after === 'object' ? info.after : {}) as Record<string, unknown>;
  const before = (info.before && typeof info.before === 'object' ? info.before : {}) as Record<string, unknown>;
  const amount = Number(after.amount ?? before.amount ?? 0);
  const currency = group?.currency ?? '₹';
  switch (event.event_type) {
    case 'expense_added': return { icon: '＋', title: `${actor} added ${String(after.description ?? 'an expense')}`, detail: amount ? money(amount, currency) : '' };
    case 'expense_updated': return { icon: '✎', title: `${actor} edited ${String(after.description ?? before.description ?? 'an expense')}`, detail: before.amount !== after.amount && amount ? `${money(Number(before.amount ?? 0), currency)} → ${money(amount, currency)}` : 'Expense details changed' };
    case 'expense_deleted': return { icon: '−', title: `${actor} deleted ${String(before.description ?? 'an expense')}`, detail: amount ? money(amount, currency) : '' };
    case 'payment_recorded': return { icon: '₹', title: `${actor} recorded a payment`, detail: amount ? money(amount, currency) : '' };
    case 'payment_updated': return { icon: '₹', title: `${actor} edited a payment`, detail: amount ? money(amount, currency) : '' };
    case 'payment_removed': return { icon: '↶', title: `${actor} removed a payment`, detail: amount ? money(amount, currency) : '' };
    case 'member_joined': return { icon: '👤', title: `${event.actor_name || String(info.name ?? 'A member')} joined ${group?.name ?? 'the group'}`, detail: '' };
    case 'member_left': return { icon: '↗', title: `${actor} left ${group?.name ?? 'the group'}`, detail: '' };
    case 'member_added': return { icon: '👤', title: `${actor} added ${String(((info.member as Record<string, unknown> | undefined)?.name) ?? 'a member')}`, detail: '' };
    case 'member_removed': return { icon: '👤', title: `${actor} removed ${String(((info.member as Record<string, unknown> | undefined)?.name) ?? 'a member')}`, detail: '' };
    case 'member_renamed': return { icon: '✎', title: `${String(info.from ?? 'A member')} changed name to ${String(info.to ?? '')}`, detail: `Changed by ${actor}` };
    case 'member_unlinked': return { icon: '🔗', title: `${actor} reset ${String(info.name ?? 'a member')}'s account link`, detail: '' };
    case 'join_requested': return { icon: '…', title: `${String(info.name ?? actor)} requested to join`, detail: String(info.email ?? '') };
    case 'join_approved': return { icon: '✓', title: `${actor} approved ${String(info.name ?? 'a member')}`, detail: String(info.email ?? '') };
    case 'join_denied': return { icon: '×', title: `${actor} denied ${String(info.name ?? 'a join request')}`, detail: String(info.email ?? '') };
    case 'group_created': return { icon: '✨', title: `${actor} created ${String(info.name ?? group?.name ?? 'the group')}`, detail: '' };
    case 'group_renamed': return { icon: '✎', title: `${actor} renamed the group`, detail: `${String(info.from ?? '')} → ${String(info.to ?? '')}` };
    case 'group_currency_changed': return { icon: '₹', title: `${actor} changed the group currency`, detail: `${String(info.from ?? '')} → ${String(info.to ?? '')}` };
    case 'group_archived': return { icon: '▣', title: `${actor} archived ${group?.name ?? 'the group'}`, detail: '' };
    case 'group_unarchived': return { icon: '↶', title: `${actor} restored ${group?.name ?? 'the group'} to active groups`, detail: '' };
    case 'group_deleted': return { icon: '⌫', title: `${actor} deleted ${group?.name ?? 'the group'}`, detail: 'Recoverable for 30 days' };
    case 'group_restored': return { icon: '↶', title: `${actor} restored ${group?.name ?? 'the group'}`, detail: '' };
    case 'ownership_transferred': return { icon: '👑', title: `${actor} transferred ownership to ${String(info.to_name ?? 'another member')}`, detail: '' };
    case 'invite_created': return { icon: '🔗', title: `${actor} created an invite`, detail: String(info.name ?? '') };
    default: return { icon: '•', title: `${actor} updated ${group?.name ?? 'a group'}`, detail: event.event_type.replace(/_/g, ' ') };
  }
};

function ActivityScreen({ navigate, collaboration }: { navigate: (view: View) => void; collaboration?: SplitzapCollaboration }) {
  const { data, update } = useSplitData();
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [quickOpen, setQuickOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanSeed, setScanSeed] = useState<ScanExpenseSeed | null>(null);
  const [paymentPickerOpen, setPaymentPickerOpen] = useState(false);
  const [paymentGroupId, setPaymentGroupId] = useState<string | null>(null);
  const [busyRequest, setBusyRequest] = useState<string | null>(null);

  const sharedEvents = collaboration?.activity ?? [];
  const sharedEventGroups = new Set(sharedEvents.map((event) => event.group_id));
  const localEvents: SplitzapAuditEvent[] = (data.activity ?? []).map((event) => ({
    id: event.id,
    group_id: event.groupId,
    actor_user_id: null,
    actor_member_id: null,
    actor_name: event.actorName,
    event_type: event.eventType,
    entity_type: event.entityType,
    entity_id: event.entityId ?? null,
    event_data: event.data ?? {},
    revision: null,
    occurred_at: event.date,
  }));
  const fallbackExpenses: SplitzapAuditEvent[] = data.expenses
    .filter((expense) => {
      const group = data.groups.find((item) => item.id === expense.groupId);
      return !group?.sharedId || !sharedEventGroups.has(group.sharedId);
    })
    .map((expense) => ({ id: `legacy-exp-${expense.id}`, group_id: data.groups.find((group) => group.id === expense.groupId)?.sharedId ?? expense.groupId, actor_user_id: null, actor_member_id: expense.paidBy, actor_name: data.groups.find((group) => group.id === expense.groupId) ? payerSummary(expense, data.groups.find((group) => group.id === expense.groupId)!, data) : 'Someone', event_type: 'expense_added', entity_type: 'expense', entity_id: expense.id, event_data: { after: expense }, revision: null, occurred_at: expense.date }));
  const fallbackPayments: SplitzapAuditEvent[] = data.settlements
    .filter((settlement) => {
      const group = data.groups.find((item) => item.id === settlement.groupId);
      return !group?.sharedId || !sharedEventGroups.has(group.sharedId);
    })
    .map((settlement) => ({ id: `legacy-pay-${settlement.id}`, group_id: data.groups.find((group) => group.id === settlement.groupId)?.sharedId ?? settlement.groupId, actor_user_id: null, actor_member_id: settlement.from, actor_name: data.groups.find((group) => group.id === settlement.groupId) ? displayName(data.groups.find((group) => group.id === settlement.groupId)!, data, settlement.from) : 'Someone', event_type: 'payment_recorded', entity_type: 'payment', entity_id: settlement.id, event_data: { after: settlement }, revision: null, occurred_at: settlement.date }));
  const deduped = new Map<string, SplitzapAuditEvent>();
  [...fallbackExpenses, ...fallbackPayments, ...localEvents, ...sharedEvents].forEach((event) => deduped.set(event.id, event));
  const events = [...deduped.values()].filter((event) => {
    const group = data.groups.find((item) => item.sharedId === event.group_id || item.id === event.group_id);
    if (groupFilter !== 'all' && group?.id !== groupFilter) return false;
    if (filter === 'all') return true;
    if (filter === 'expense') return event.entity_type === 'expense';
    if (filter === 'payment') return event.entity_type === 'payment';
    if (filter === 'member') return event.entity_type === 'member' || event.entity_type === 'join_request';
    return event.entity_type === 'group' || event.entity_type === 'invite';
  }).sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

  const pending = collaboration?.pendingRequests ?? [];
  const resolve = async (id: string, approve: boolean) => {
    if (!collaboration?.onResolveJoinRequest) return;
    setBusyRequest(id);
    try { await collaboration.onResolveJoinRequest(id, approve); } finally { setBusyRequest(null); }
  };
  const activeGroups = data.groups.filter((group) => (group.status ?? group.sharedStatus ?? 'active') !== 'archived');
  const paymentGroup = paymentGroupId ? data.groups.find((group) => group.id === paymentGroupId) ?? null : null;

  return <AppShell onAdd={() => setQuickOpen(true)} view={{ name: 'activity' }} navigate={navigate}>
    <Header title="Activity" subtitle="Everything that changed" />
    <section className="px-5">
      {pending.length ? <div className="mb-4 rounded-2xl border border-primary/20 bg-secondary p-3"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-extrabold text-primary">Join requests</p><span className="rounded-full bg-surface px-2 py-1 text-[10px] font-bold text-primary">{pending.length}</span></div><div className="space-y-2">{pending.map((request) => { const group = data.groups.find((item) => item.sharedId === request.group_id); return <div key={request.id} className="rounded-xl bg-surface p-3"><p className="text-sm font-bold">{request.requested_name}</p><p className="mt-0.5 break-all text-[11px] text-muted-foreground">{request.requested_email} · {group?.name ?? 'Shared group'}</p><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" disabled={busyRequest === request.id} onClick={() => void resolve(request.id, false)} className="press rounded-xl bg-surface-2 py-2 text-xs font-bold text-negative">Deny</button><button type="button" disabled={busyRequest === request.id} onClick={() => void resolve(request.id, true)} className="press rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground">Approve</button></div></div>; })}</div></div> : null}
      <div className="flex gap-1 overflow-x-auto pb-2">{([['all','All'],['expense','Expenses'],['payment','Payments'],['member','Members'],['group','Group']] as const).map(([id,label]) => <button type="button" key={id} onClick={() => setFilter(id)} className={`press shrink-0 rounded-full px-3 py-2 text-[11px] font-bold ${filter === id ? 'bg-primary text-primary-foreground' : 'bg-surface-2 text-muted-foreground'}`}>{label}</button>)}</div>
      <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} className={`${inputClass} mb-3 mt-1 py-2.5 text-xs`}><option value="all">All groups</option>{data.groups.map((group) => <option key={group.id} value={group.id}>{group.emoji} {group.name}</option>)}</select>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">{events.map((event) => { const group = data.groups.find((item) => item.sharedId === event.group_id || item.id === event.group_id); const copy = activityEventCopy(event, group); return <button type="button" key={event.id} onClick={() => group && navigate({ name: 'group', groupId: group.id })} className="press flex w-full gap-3 border-b border-border px-3.5 py-3.5 text-left last:border-b-0"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-sm">{copy.icon}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{copy.title}</span>{copy.detail ? <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{copy.detail}</span> : null}<span className="mt-1 block text-[10px] text-muted-foreground">{group ? `${group.emoji} ${group.name} · ` : ''}{new Date(event.occurred_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></span></button>; })}{events.length === 0 ? <div className="p-8 text-center"><p className="text-sm font-extrabold">No matching activity</p><p className="mt-1 text-xs text-muted-foreground">New expenses, payments, membership and group changes will appear here.</p></div> : null}</div>
    </section>
    <QuickActionsSheet open={quickOpen} onClose={() => setQuickOpen(false)} onAddExpense={() => data.groups.length ? setAddOpen(true) : setGroupOpen(true)} onScanReceipt={() => data.groups.length ? setScannerOpen(true) : setGroupOpen(true)} onNewGroup={() => setGroupOpen(true)} onRecordPayment={() => activeGroups.length === 1 ? setPaymentGroupId(activeGroups[0]!.id) : activeGroups.length ? setPaymentPickerOpen(true) : setGroupOpen(true)} />
    <GroupPickerSheet open={paymentPickerOpen} onClose={() => setPaymentPickerOpen(false)} groups={activeGroups} onPick={setPaymentGroupId} />
    {data.groups.length ? <AddExpenseSheet open={addOpen} onClose={() => { setAddOpen(false); setScanSeed(null); }} data={data} update={update} seed={scanSeed} /> : null}
    <ReceiptScanner open={scannerOpen} onClose={() => setScannerOpen(false)} data={data} onUse={(seed) => { setScanSeed(seed); setScannerOpen(false); setAddOpen(true); }} />
    <NewGroupSheet open={groupOpen} onClose={() => setGroupOpen(false)} data={data} update={update} onCreated={(groupId) => navigate({ name: 'group', groupId })} onJoinGroup={collaboration?.onJoinGroup} />
    {paymentGroup ? <SettleSheet open={Boolean(paymentGroup)} onClose={() => setPaymentGroupId(null)} group={paymentGroup} balances={groupBalances(paymentGroup, data.expenses, data.settlements)} data={data} update={update} /> : null}
  </AppShell>;
}

function GroupScreen({ groupId, navigate, collaboration }: { groupId: string; navigate: (view: View) => void; collaboration?: SplitzapCollaboration }) {
  const { data, update, hydrated } = useSplitData();
  const group = data.groups.find((item) => item.id === groupId);
  const [tab, setTab] = useState<GroupTab>('expenses');
  const [addOpen, setAddOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanSeed, setScanSeed] = useState<ScanExpenseSeed | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'self' | 'everyone'>('self');
  const [transferMemberId, setTransferMemberId] = useState('');
  const [busyDelete, setBusyDelete] = useState(false);
  const [newMember, setNewMember] = useState('');
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [mineOnly, setMineOnly] = useState(false);
  const [unsettledOnly, setUnsettledOnly] = useState(false);
  const [undoExpense, setUndoExpense] = useState<Expense | null>(null);
  const undoTimer = useRef<number | null>(null);

  useEffect(() => () => { if (undoTimer.current) window.clearTimeout(undoTimer.current); }, []);

  if (!hydrated) return <AppShell onAdd={() => undefined} view={{ name: 'group', groupId }} navigate={navigate}><Header title="Loading…" back={<button type="button" onClick={() => navigate({ name: 'home' })} className="press grid size-9 place-items-center rounded-full bg-surface-2"><ArrowLeft size={18} /></button>} /><div className="px-5"><div className="splitzap-skeleton h-36 rounded-3xl" /></div></AppShell>;
  if (!group) return <AppShell onAdd={() => undefined} view={{ name: 'group', groupId }} navigate={navigate}><Header title="Group unavailable" back={<button type="button" onClick={() => navigate({ name: 'home' })} className="press grid size-9 place-items-center rounded-full bg-surface-2"><ArrowLeft size={18} /></button>} /><div className="px-5 py-12 text-center"><p className="text-sm font-bold">This group was removed, deleted, or is no longer available to your account.</p><button type="button" onClick={() => navigate({ name: 'home' })} className="press mt-4 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground">Back to groups</button></div></AppShell>;

  const expenses = data.expenses.filter((expense) => expense.groupId === groupId).sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const balances = groupBalances(group, data.expenses, data.settlements);
  const myMemberId = memberIdFor(group, data);
  const mine = balances[myMemberId] ?? 0;
  const groupStatus = group.status ?? group.sharedStatus ?? 'active';
  const isArchived = groupStatus === 'archived';
  const categoryMatch = (expense: Expense) => categoryFilter === 'all' || expense.category === categoryFilter;
  const mineMatch = (expense: Expense) => !mineOnly || (paymentsOf(expense)[myMemberId] ?? 0) > 0 || shareOf(expense, myMemberId, group.members.map((member) => member.id)) > 0;
  const unsettledMatch = (expense: Expense) => !unsettledOnly || expenseSettlement(expense, group).some((debt) => debt.from === myMemberId || debt.to === myMemberId);
  const filteredExpenses = expenses.filter((expense) => expense.description.toLowerCase().includes(search.trim().toLowerCase()) && categoryMatch(expense) && mineMatch(expense) && unsettledMatch(expense));
  const joinedMemberIds = new Set((collaboration?.memberships ?? []).filter((membership) => membership.group_id === group.sharedId).map((membership) => membership.member_id));
  const transferCandidates = group.members.filter((member) => member.id !== myMemberId && joinedMemberIds.has(member.id));
  const isOwner = group.sharedRole === 'owner';

  const removeExpense = (expense: Expense) => {
    update((current) => {
      const next = { ...current, expenses: current.expenses.filter((item) => item.id !== expense.id) };
      return group.sharedId ? next : withLocalActivity(next, { groupId: group.id, actorName: current.myName?.trim() || displayName(group, current, myMemberId), eventType: 'expense_deleted', entityType: 'expense', entityId: expense.id, data: { before: expense } });
    });
    setSelectedExpense(null);
    setUndoExpense(expense);
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndoExpense(null), 8000);
  };

  const restoreExpense = () => {
    if (!undoExpense) return;
    const expense = undoExpense;
    update((current) => {
      const next = { ...current, expenses: [expense, ...current.expenses] };
      return group.sharedId ? next : withLocalActivity(next, { groupId: group.id, actorName: current.myName?.trim() || displayName(group, current, myMemberId), eventType: 'expense_restored', entityType: 'expense', entityId: expense.id, data: { after: expense } });
    });
    setUndoExpense(null);
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
  };

  const confirmDelete = async () => {
    if (!collaboration?.onDeleteGroup) {
      update((current) => removeGroupLocalWithAudit(current, group));
      navigate({ name: 'home' });
      return;
    }
    setBusyDelete(true);
    try {
      await collaboration.onDeleteGroup(group, deleteMode, deleteMode === 'self' && isOwner ? transferMemberId || undefined : undefined);
      setDeleteOpen(false);
      navigate({ name: 'home' });
    } finally { setBusyDelete(false); }
  };

  const archive = async () => {
    if (collaboration?.onArchiveGroup) await collaboration.onArchiveGroup(group, !isArchived);
    else update((current) => ({ ...current, groups: current.groups.map((item) => item.id === group.id ? { ...item, status: isArchived ? 'active' : 'archived', archivedAt: isArchived ? undefined : new Date().toISOString() } : item) }));
    setMenuOpen(false);
    if (!isArchived) navigate({ name: 'home' });
  };

  return <AppShell onAdd={() => setQuickOpen(true)} view={{ name: 'group', groupId }} navigate={navigate}>
    <Header title={`${group.emoji} ${group.name}`} subtitle={`${group.members.length} people${group.sharedId ? ' · Shared live' : ''}${isArchived ? ' · Archived' : ''}`} back={<button type="button" onClick={() => navigate({ name: 'home' })} className="press grid size-9 place-items-center rounded-full bg-surface-2"><ArrowLeft size={18} /></button>} right={<div className="relative"><button type="button" onClick={() => setMenuOpen((value) => !value)} aria-label="Group options" className="press grid size-9 place-items-center rounded-full bg-surface-2"><MoreHorizontal size={18} /></button>{menuOpen ? <div className="absolute right-0 top-11 z-20 w-52 overflow-hidden rounded-2xl border border-border bg-surface p-1.5 shadow-xl"><button type="button" onClick={() => { setMenuOpen(false); setEditGroupOpen(true); }} className="press flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold"><Pencil size={14} /> Edit group</button>{group.sharedId ? <button type="button" onClick={() => { setMenuOpen(false); collaboration?.onManageMembers?.(group.id); }} className="press flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold"><Users size={14} /> Manage members</button> : null}<button type="button" onClick={() => { setMenuOpen(false); collaboration?.onInviteGroup(group.id); }} className="press flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold"><Share2 size={14} /> {group.sharedId ? 'Invite people' : 'Share group live'}</button><button type="button" onClick={() => void archive()} className="press flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold"><Archive size={14} /> {isArchived ? 'Unarchive group' : 'Archive group'}</button><button type="button" onClick={() => { setMenuOpen(false); setDuplicateOpen(true); }} className="press flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold"><Copy size={14} /> Duplicate group</button><div className="my-1 border-t border-border" /><button type="button" onClick={() => { setMenuOpen(false); setDeleteMode(group.sharedId && isOwner ? 'everyone' : 'self'); setTransferMemberId(''); setDeleteOpen(true); }} className="press flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-negative"><Trash2 size={14} /> {group.sharedId && !isOwner ? 'Leave group' : 'Delete / remove group'}</button></div> : null}</div>} />
    {isArchived ? <div className="mx-5 mb-3 flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2.5 text-xs font-semibold text-muted-foreground"><Archive size={14} /> Archived groups are read-only until restored.</div> : null}
    <section className="px-5"><div className="group-balance-card grid grid-cols-[1fr_auto] items-center gap-4 rounded-2xl border border-border bg-surface p-4"><div><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Your balance</p><p className={`tabular mt-1 text-2xl font-extrabold ${Math.abs(mine) < 0.01 ? 'text-muted-foreground' : mine > 0 ? 'text-positive' : 'text-negative'}`}>{Math.abs(mine) < 0.01 ? 'Settled up' : `${mine > 0 ? 'Get ' : 'Owe '}${money(Math.abs(mine), group.currency)}`}</p></div><div className="flex gap-2"><button type="button" disabled={isArchived} onClick={() => setAddOpen(true)} className="press rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-40">Add expense</button><button type="button" disabled={isArchived || !simplify(balances).length} onClick={() => setSettleOpen(true)} className="press rounded-xl bg-secondary px-3 py-2.5 text-xs font-bold text-primary disabled:opacity-40">Settle</button></div></div></section>
    <div className="mx-5 mt-4 grid grid-cols-3 rounded-xl bg-surface-2 p-1">{([['expenses','Expenses'],['balances','Balances'],['insights','Insights']] as const).map(([id,label]) => <button type="button" key={id} onClick={() => setTab(id)} className={`press rounded-lg py-2 text-xs font-bold ${tab === id ? 'bg-surface shadow-sm' : 'text-muted-foreground'}`}>{label}</button>)}</div>
    {tab === 'expenses' ? <section className="px-5 pt-3"><div className="mb-3 flex gap-2"><div className="relative min-w-0 flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search expenses" className="w-full rounded-xl border border-border bg-surface pl-9 pr-3 py-2.5 text-xs outline-none focus:border-primary" /></div><button type="button" onClick={() => setFilterOpen(true)} className={`press grid size-10 place-items-center rounded-xl border ${categoryFilter !== 'all' || mineOnly || unsettledOnly ? 'border-primary bg-secondary text-primary' : 'border-border bg-surface text-muted-foreground'}`}><Filter size={15} /></button></div><div className="overflow-hidden rounded-2xl border border-border bg-surface">{filteredExpenses.map((expense) => { const category = categoryOf(expense.category); return <button type="button" key={expense.id} onClick={() => setSelectedExpense(expense)} className={`expense-row category-${category.id} press flex w-full items-center gap-3 border-b border-border px-3 py-3.5 text-left last:border-b-0`}><span className="expense-category grid size-10 shrink-0 place-items-center rounded-xl text-lg">{category.emoji}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{expense.description}</p><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{payerSummary(expense, group, data)} paid · {new Date(expense.date).toLocaleDateString([], { day: 'numeric', month: 'short' })}</p></div><span className="tabular shrink-0 text-sm font-extrabold">{money(expense.amount, group.currency)}</span><ChevronRight size={14} className="text-muted-foreground" /></button>; })}{filteredExpenses.length === 0 ? <div className="p-8 text-center"><p className="text-sm font-extrabold">No matching expenses</p><p className="mt-1 text-xs text-muted-foreground">Change your search or filters.</p></div> : null}</div></section> : tab === 'balances' ? <BalancesTab group={group} data={data} balances={balances} update={update} newMember={newMember} setNewMember={setNewMember} /> : <InsightsTab group={group} data={data} expenses={expenses} />}
    <QuickActionsSheet open={quickOpen} onClose={() => setQuickOpen(false)} onAddExpense={() => !isArchived && setAddOpen(true)} onScanReceipt={() => !isArchived && setScannerOpen(true)} onNewGroup={() => navigate({ name: 'home' })} onRecordPayment={() => !isArchived && setSettleOpen(true)} />
    <AddExpenseSheet open={addOpen} onClose={() => { setAddOpen(false); setScanSeed(null); setEditingExpense(null); }} data={data} update={update} defaultGroupId={group.id} editing={editingExpense} seed={scanSeed} />
    <ReceiptScanner open={scannerOpen} onClose={() => setScannerOpen(false)} data={data} onUse={(seed) => { setScanSeed(seed); setScannerOpen(false); setAddOpen(true); }} />
    <SettleSheet open={settleOpen} onClose={() => setSettleOpen(false)} group={group} balances={balances} data={data} update={update} />
    <EditGroupSheet open={editGroupOpen} onClose={() => setEditGroupOpen(false)} group={group} update={update} />
    <DuplicateGroupDialog open={duplicateOpen} onClose={() => setDuplicateOpen(false)} group={group} data={data} update={update} onCreated={(id) => navigate({ name: 'group', groupId: id })} />
    <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} title={`Share ${group.name}`} message={buildGroupShareMessage(group, data)} />
    <ExpenseResultSheet open={Boolean(selectedExpense)} onClose={() => setSelectedExpense(null)} expense={selectedExpense} group={group} data={data} onEdit={() => { if (!selectedExpense) return; setEditingExpense(selectedExpense); setSelectedExpense(null); setAddOpen(true); }} onDelete={selectedExpense ? () => removeExpense(selectedExpense) : undefined} />
    <SheetModal open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter expenses" footer={<PrimaryButton onClick={() => setFilterOpen(false)}>Show {filteredExpenses.length} expenses</PrimaryButton>}><Field label="Category"><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={`${inputClass} py-2.5 text-sm`}><option value="all">All categories</option>{CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.emoji} {item.label}</option>)}</select></Field><label className="mb-2 flex items-center justify-between rounded-xl bg-surface-2 px-3 py-3 text-sm font-bold">Mine<input type="checkbox" checked={mineOnly} onChange={(event) => setMineOnly(event.target.checked)} className="size-5" /></label><label className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-3 text-sm font-bold">Involving an unsettled balance<input type="checkbox" checked={unsettledOnly} onChange={(event) => setUnsettledOnly(event.target.checked)} className="size-5" /></label><button type="button" onClick={() => { setCategoryFilter('all'); setMineOnly(false); setUnsettledOnly(false); }} className="press mt-3 w-full py-2 text-xs font-bold text-primary">Clear filters</button></SheetModal>
    <SheetModal open={deleteOpen} onClose={() => !busyDelete && setDeleteOpen(false)} title={group.sharedId ? 'Leave or delete group' : 'Delete group'}>{group.sharedId && isOwner ? <div className="space-y-3"><button type="button" onClick={() => setDeleteMode('everyone')} className={`w-full rounded-2xl border p-4 text-left ${deleteMode === 'everyone' ? 'border-negative bg-negative/5' : 'border-border'}`}><b className="text-sm text-negative">Delete for everyone</b><p className="mt-1 text-[11px] leading-5 text-muted-foreground">The group disappears for everyone and can be restored from Recently Deleted for 30 days.</p></button><button type="button" onClick={() => setDeleteMode('self')} className={`w-full rounded-2xl border p-4 text-left ${deleteMode === 'self' ? 'border-primary bg-secondary' : 'border-border'}`}><b className="text-sm">Remove for me</b><p className="mt-1 text-[11px] leading-5 text-muted-foreground">Transfer ownership, then leave. Everyone else keeps the group.</p></button>{deleteMode === 'self' ? <Field label="Transfer ownership to"><select value={transferMemberId} onChange={(event) => setTransferMemberId(event.target.value)} className={inputClass}><option value="">Choose a joined member</option>{transferCandidates.map((member) => <option key={member.id} value={member.id}>{displayName(group, data, member.id)}</option>)}</select></Field> : null}<button type="button" disabled={busyDelete || (deleteMode === 'self' && !transferMemberId)} onClick={() => void confirmDelete()} className={`press w-full rounded-xl py-3 text-sm font-bold disabled:opacity-40 ${deleteMode === 'everyone' ? 'bg-negative text-white' : 'bg-primary text-primary-foreground'}`}>{busyDelete ? 'Working…' : deleteMode === 'everyone' ? 'Delete for everyone' : 'Transfer and leave'}</button></div> : <div><p className="text-sm leading-6 text-muted-foreground">{group.sharedId ? 'You will lose access. Your historical expenses and member identity stay visible to the group.' : 'This removes the group and its expenses from this Splitzap account.'}</p><button type="button" disabled={busyDelete} onClick={() => void confirmDelete()} className="press mt-4 w-full rounded-xl bg-negative py-3 text-sm font-bold text-white disabled:opacity-40">{busyDelete ? 'Working…' : group.sharedId ? 'Leave group' : 'Delete group'}</button></div>}</SheetModal>
    {undoExpense ? <div className="fixed bottom-24 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-[488px] -translate-x-1/2 items-center gap-3 rounded-2xl bg-foreground px-4 py-3 text-primary-foreground shadow-xl"><span className="min-w-0 flex-1 truncate text-xs font-bold">{undoExpense.description} deleted</span><button type="button" onClick={restoreExpense} className="press rounded-lg bg-primary-foreground/12 px-3 py-2 text-xs font-extrabold">Undo</button></div> : null}
  </AppShell>;
}

function removeGroupLocalWithAudit(current: SplitData, group: Group): SplitData {
  return {
    ...current,
    groups: current.groups.filter((item) => item.id !== group.id),
    expenses: current.expenses.filter((expense) => expense.groupId !== group.id),
    settlements: current.settlements.filter((settlement) => settlement.groupId !== group.id),
    history: (current.history ?? []).filter((entry) => entry.groupId !== group.id),
    activity: (current.activity ?? []).filter((entry) => entry.groupId !== group.id),
  };
}

function BalancesTab({ group, data, balances, update, newMember, setNewMember }: { group: Group; data: SplitData; balances: Record<string, number>; update: (fn: (data: SplitData) => SplitData) => void; newMember: string; setNewMember: (value: string) => void }) {
  return <section className="space-y-2 px-5 pt-3">{group.members.map((member, index) => { const value = balances[member.id] ?? 0; return <div key={member.id} className="list-enter flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5" style={{ animationDelay: `${index * 35}ms` }}><Avatar name={displayName(group, data, member.id)} size={38} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{displayName(group, data, member.id)}</p><p className="text-[10px] text-muted-foreground">{member.id === memberIdFor(group, data) ? 'You' : 'Group member'}</p></div><p className={`tabular text-sm font-extrabold ${Math.abs(value) < 0.01 ? 'text-muted-foreground' : value > 0 ? 'text-positive' : 'text-negative'}`}>{Math.abs(value) < 0.01 ? 'Settled' : `${value > 0 ? 'Gets ' : 'Owes '}${money(Math.abs(value), group.currency)}`}</p></div>; })}{!group.sharedId ? <div className="rounded-2xl border border-dashed border-border bg-surface p-3.5"><p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground"><UserPlus size={13} /> Add someone</p><div className="flex gap-2"><input value={newMember} onChange={(event) => setNewMember(event.target.value)} placeholder="Name" className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary" /><button type="button" disabled={!newMember.trim()} onClick={() => { const name = newMember.trim(); update((current) => ({ ...current, groups: current.groups.map((item) => item.id === group.id ? { ...item, members: [...item.members, { id: uid(), name }] } : item) })); setNewMember(''); }} className="press shrink-0 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-40">Add</button></div></div> : <button type="button" className="w-full rounded-2xl bg-surface-2 px-3 py-3 text-left text-xs font-semibold text-muted-foreground" onClick={() => undefined}>Shared member access is managed from ··· → Manage members.</button>}</section>;
}

const INSIGHT_COLORS = ['#256f66', '#e07a5f', '#6c8ebf', '#9b5de5', '#f2b134', '#d95d8f', '#00a6a6', '#7aa95c'];

function InsightsTab({ group, data, expenses }: { group: Group; data: SplitData; expenses: Expense[] }) {
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const average = group.members.length ? total / group.members.length : 0;
  const categoryTotals = CATEGORIES.map((category) => ({ key: category.id, label: `${category.emoji} ${category.label}`, value: expenses.filter((expense) => expense.category === category.id).reduce((sum, expense) => sum + expense.amount, 0) })).filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  const memberRows = group.members.map((member) => ({ key: member.id, label: displayName(group, data, member.id), paid: expenses.reduce((sum, expense) => sum + (paymentsOf(expense)[member.id] ?? 0), 0), share: expenses.reduce((sum, expense) => sum + shareOf(expense, member.id, group.members.map((m) => m.id)), 0) }));
  const largest = [...expenses].sort((a, b) => b.amount - a.amount)[0];
  const personal = expenses.reduce((sum, expense) => sum + personalTotalOf(expense), 0);
  return <section className="space-y-3 px-5 pt-2"><div className="grid grid-cols-2 gap-2"><div className="card-soft p-4"><p className="text-[11px] font-semibold text-muted-foreground">Total spent</p><p className="mt-1 text-2xl font-extrabold text-primary">{money(total, group.currency)}</p><p className="mt-2 text-[11px] text-muted-foreground">{expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}</p></div><div className="card-soft p-4"><p className="text-[11px] font-semibold text-muted-foreground">Average per person</p><p className="mt-1 text-2xl font-extrabold">{money(average, group.currency)}</p><p className="mt-2 text-[11px] text-muted-foreground">{group.members.length} people</p></div></div><InsightDonut rows={categoryTotals} total={total} currency={group.currency} /><PaidShareChart rows={memberRows} currency={group.currency} /><div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-surface p-3 text-center"><div className="rounded-xl bg-surface-2 p-3"><p className="text-[11px] font-semibold text-muted-foreground">Expenses</p><p className="mt-1 text-lg font-extrabold">{expenses.length}</p></div><div className="rounded-xl bg-surface-2 p-3"><p className="text-[11px] font-semibold text-muted-foreground">Largest</p><p className="mt-1 truncate text-sm font-extrabold">{largest ? money(largest.amount, group.currency) : '—'}</p></div><div className="rounded-xl bg-surface-2 p-3"><p className="text-[11px] font-semibold text-muted-foreground">Personal</p><p className="mt-1 truncate text-sm font-extrabold">{money(personal, group.currency)}</p></div>{largest ? <p className="col-span-3 truncate px-2 pt-1 text-[11px] text-muted-foreground">Largest expense · {largest.description}</p> : null}</div></section>;
}

function InsightDonut({ rows, total, currency }: { rows: Array<{ key: string; label: string; value: number }>; total: number; currency: string }) {
  const circumference = 2 * Math.PI * 42;
  let cumulative = 0;
  return <div className="card-soft p-4"><div className="mb-3 flex items-center gap-2"><BarChart3 size={15} className="text-primary" /><h3 className="text-sm font-extrabold">Spending by category</h3></div>{rows.length ? <div className="grid grid-cols-[132px_minmax(0,1fr)] items-center gap-3"><div className="relative mx-auto size-[132px]"><svg viewBox="0 0 120 120" className="size-full"><circle cx="60" cy="60" r="42" fill="none" stroke="#edf0ee" strokeWidth="16" />{rows.map((row, index) => { const fraction = total > 0 ? row.value / total : 0; const dashOffset = -cumulative * circumference; cumulative += fraction; return <circle key={row.key} cx="60" cy="60" r="42" fill="none" stroke={INSIGHT_COLORS[index % INSIGHT_COLORS.length]} strokeWidth="16" strokeLinecap="butt" strokeDasharray={`${fraction * circumference} ${circumference}`} strokeDashoffset={dashOffset} transform="rotate(-90 60 60)" />; })}</svg><div className="absolute inset-0 grid place-items-center text-center"><div><p className="text-[9px] font-bold uppercase text-muted-foreground">Total</p><p className="text-sm font-extrabold">{money(total, currency)}</p></div></div></div><div className="min-w-0 space-y-2">{rows.slice(0, 6).map((row, index) => <div key={row.key} className="flex items-center gap-2 text-[11px]"><span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: INSIGHT_COLORS[index % INSIGHT_COLORS.length] }} /><span className="min-w-0 flex-1 truncate font-semibold">{row.label}</span><span className="tabular shrink-0 font-extrabold">{Math.round(row.value / total * 100)}%</span></div>)}</div></div> : <p className="text-xs text-muted-foreground">No category data yet.</p>}</div>;
}

function PaidShareChart({ rows, currency }: { rows: Array<{ key: string; label: string; paid: number; share: number }>; currency: string }) {
  const max = Math.max(1, ...rows.flatMap((row) => [row.paid, row.share]));
  return <div className="card-soft p-4"><div className="mb-1 flex items-center justify-between"><h3 className="text-sm font-extrabold">Paid vs actual share</h3><div className="flex gap-2 text-[9px] font-bold text-muted-foreground"><span className="flex items-center gap-1"><i className="size-2 rounded-full" style={{ backgroundColor: '#256f66' }} />Paid</span><span className="flex items-center gap-1"><i className="size-2 rounded-full" style={{ backgroundColor: '#e07a5f' }} />Share</span></div></div><p className="mb-4 text-[10px] text-muted-foreground">See who fronted the money versus what they actually consumed.</p><div className="space-y-4">{rows.map((row) => <div key={row.key}><div className="mb-1.5 flex items-center justify-between gap-2"><span className="truncate text-xs font-bold">{row.label}</span><span className="tabular shrink-0 text-[10px] font-semibold text-muted-foreground">{money(row.paid, currency)} / {money(row.share, currency)}</span></div><div className="space-y-1"><div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full" style={{ width: `${Math.max(2, row.paid / max * 100)}%`, backgroundColor: '#256f66' }} /></div><div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full" style={{ width: `${Math.max(2, row.share / max * 100)}%`, backgroundColor: '#e07a5f' }} /></div></div></div>)}</div></div>;
}

function EditGroupSheet({ open, onClose, group, update }: { open: boolean; onClose: () => void; group: Group; update: (fn: (data: SplitData) => SplitData) => void }) {
  const [name, setName] = useState(group.name);
  const [emoji, setEmoji] = useState(group.emoji);
  const [currency, setCurrency] = useState(group.currency);
  useEffect(() => { if (open) { setName(group.name); setEmoji(group.emoji); setCurrency(group.currency); } }, [open, group]);
  const save = () => { if (!name.trim()) return; update((current) => ({ ...current, groups: current.groups.map((item) => item.id === group.id ? { ...item, name: name.trim(), emoji, currency } : item) })); onClose(); };
  return <SheetModal open={open} onClose={onClose} title="Edit group" footer={<PrimaryButton onClick={save} disabled={!name.trim()}>Save group</PrimaryButton>}><Field label="Name"><input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} /></Field><Field label="Icon"><div className="flex flex-wrap gap-2">{EMOJIS.map((item) => <button type="button" key={item} onClick={() => setEmoji(item)} className={`press grid size-10 place-items-center rounded-xl border text-lg ${emoji === item ? 'border-primary bg-secondary' : 'border-border bg-surface-2'}`}>{item}</button>)}</div></Field><Field label="Currency"><div className="flex gap-2">{CURRENCIES.map((item) => <button type="button" key={item} onClick={() => setCurrency(item)} className={`press size-10 rounded-xl border font-bold ${currency === item ? 'border-primary bg-secondary' : 'border-border bg-surface-2'}`}>{item}</button>)}</div></Field></SheetModal>;
}

function DuplicateGroupDialog({ open, onClose, group, data, update, onCreated }: { open: boolean; onClose: () => void; group: Group; data: SplitData; update: (fn: (data: SplitData) => SplitData) => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState(`${group.name} Copy`);
  const [copyMembers, setCopyMembers] = useState(true);
  const [copyCurrency, setCopyCurrency] = useState(true);
  const [copyExpenses, setCopyExpenses] = useState(false);
  useEffect(() => { if (open) { setName(`${group.name} Copy`); setCopyMembers(true); setCopyCurrency(true); setCopyExpenses(false); } }, [open, group.name]);
  const duplicate = () => {
    if (!name.trim()) return;
    const newId = uid();
    const creatorName = data.myName?.trim() || displayName(group, data, memberIdFor(group, data));
    const members = copyMembers ? group.members.map((member) => ({ ...member })) : [{ id: data.me, name: creatorName }];
    const clonedExpenses = copyExpenses && copyMembers ? data.expenses.filter((expense) => expense.groupId === group.id).map((expense) => ({ ...expense, id: uid(), groupId: newId, date: new Date().toISOString(), personalItems: (expense.personalItems ?? []).map((item) => ({ ...item, id: uid() })), selectiveItems: (expense.selectiveItems ?? []).map((item) => ({ ...item, id: uid(), memberIds: [...item.memberIds], split: { ...item.split } })), additionalCharges: (expense.additionalCharges ?? []).map((charge) => ({ ...charge, id: uid() })) })) : [];
    update((current) => ({ ...current, groups: [{ id: newId, name: name.trim(), emoji: group.emoji, currency: copyCurrency ? group.currency : '₹', members, createdAt: new Date().toISOString(), myMemberId: copyMembers ? memberIdFor(group, data) : undefined }, ...current.groups], expenses: [...clonedExpenses, ...current.expenses] }));
    onClose();
    onCreated(newId);
  };
  return <CompactDialog open={open} onClose={onClose} title="Duplicate group" footer={<PrimaryButton onClick={duplicate} disabled={!name.trim()}>Duplicate</PrimaryButton>}><input value={name} onChange={(event) => setName(event.target.value)} className={`${inputClass} py-2.5 text-sm`} /><div className="mt-3 grid grid-cols-3 gap-1.5">{([['Members', copyMembers, () => { const next = !copyMembers; setCopyMembers(next); if (!next) setCopyExpenses(false); }], ['Currency', copyCurrency, () => setCopyCurrency(!copyCurrency)], ['Expenses', copyExpenses, () => { if (copyMembers) setCopyExpenses(!copyExpenses); }]] as const).map(([label, checked, action]) => <button type="button" key={label} onClick={action} className={`press rounded-xl border px-2 py-2 text-[11px] font-bold ${checked ? 'border-primary bg-secondary text-primary' : 'border-border bg-surface-2 text-muted-foreground'} ${label === 'Expenses' && !copyMembers ? 'opacity-40' : ''}`}>{checked ? '✓ ' : ''}{label}</button>)}</div></CompactDialog>;
}

function ShareDialog({ open, onClose, title, message }: { open: boolean; onClose: () => void; title: string; message: string }) {
  if (!open) return null;
  const share = () => window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  return <div className="fixed inset-0 z-[80] flex items-end justify-center"><button type="button" aria-label="Close share preview" onClick={onClose} className="absolute inset-0 bg-foreground/45 backdrop-blur-[3px]" /><div className="relative flex max-h-[88dvh] w-full max-w-[520px] flex-col rounded-t-[28px] bg-surface shadow-2xl"><div className="sheet-handle mx-auto mt-2 h-1 w-10 rounded-full bg-border" /><div className="flex items-center justify-between px-5 pb-3 pt-3"><div><h2 className="text-lg font-extrabold">{title}</h2><p className="mt-0.5 text-xs text-muted-foreground">Review the result before opening WhatsApp.</p></div><button type="button" onClick={onClose} className="press grid size-8 place-items-center rounded-full bg-muted text-muted-foreground"><X size={16} /></button></div><div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4"><pre className="whitespace-pre-wrap break-words rounded-3xl border border-border bg-surface-2 p-4 font-sans text-sm leading-6 text-foreground">{message}</pre></div><div className="grid grid-cols-[.8fr_1.2fr] gap-2 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"><button type="button" onClick={onClose} className="press rounded-2xl bg-surface-2 py-3.5 text-sm font-bold">Close</button><button type="button" onClick={share} className="press flex items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground"><MessageCircle size={17} /> Share on WhatsApp</button></div></div></div>;
}

function ExpenseBreakdown({ expense, group, data, onHistory }: { expense: Expense; group: Group; data: SplitData; onHistory?: () => void }) {
  const debts = expenseSettlement(expense, group);
  const labels = group.members.flatMap((member) => {
    const name = displayName(group, data, member.id);
    const label = expense.mode === 'exact' ? expense.splitLabels?.[member.id]?.trim() : '';
    const personalItems = (expense.receiptItems?.length ? [] : expense.personalItems ?? []).filter((item) => item.memberId === member.id);
    return [...(label ? [{ key: `label-${member.id}`, text: `${name}: ${label}` }] : []), ...personalItems.map((item) => ({ key: item.id, text: `${name}: ${item.description} · ${shareMoney(item.amount, group.currency)}` }))];
  });
  const chargeLine = (expense.additionalCharges ?? []).filter((charge) => charge.amount > 0).map((charge) => `${charge.description} ${shareMoney(charge.amount, group.currency)}`).join(' · ');
  const historyCount = (data.history ?? []).filter((entry) => entry.expenseId === expense.id).length;
  const receiptItems = expense.receiptItems ?? [];
  const selectiveItems = expense.selectiveItems ?? [];
  return <div className="space-y-3"><div className="result-total rounded-2xl bg-surface-2 p-4"><p className="text-[12px] font-extrabold text-primary">💸 Splitzap</p><p className="mt-1.5 text-xl font-extrabold">{expense.description} · {shareMoney(expense.amount, group.currency)}</p>{chargeLine ? <p className="mt-1.5 text-[11px] font-semibold text-muted-foreground">Additional charges · {chargeLine}</p> : null}<p className="mt-1 text-[12px] text-muted-foreground">Paid by {payerSummary(expense, group, data, true)}</p></div><div className="result-document overflow-hidden rounded-2xl border border-border bg-surface"><section className="p-4"><div className="flex items-center justify-between"><p className="text-sm font-extrabold">Settlement</p><span className="text-[11px] font-semibold text-muted-foreground">Who owes whom</span></div><div className="mt-3 space-y-2">{debts.length ? debts.map((debt) => <div key={`${debt.from}-${debt.to}`} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-3"><span className="min-w-0 flex-1 truncate text-sm font-semibold">{displayName(group, data, debt.from)} → {displayName(group, data, debt.to)}</span><span className="tabular text-sm font-extrabold">{shareMoney(debt.amount, group.currency)}</span></div>) : <div className="rounded-xl bg-surface-2 px-3 py-3 text-sm font-semibold text-muted-foreground">Everyone is settled for this expense.</div>}</div></section>{selectiveItems.length ? <section className="border-t border-border p-4"><div className="flex items-center justify-between"><p className="text-sm font-extrabold">Shared by some people</p><span className="text-[11px] text-muted-foreground">{selectiveItems.length} {selectiveItems.length === 1 ? 'item' : 'items'}</span></div><div className="mt-2 space-y-2">{selectiveItems.map((item) => <div key={item.id} className="flex items-start justify-between gap-3 py-1"><div className="min-w-0"><p className="truncate text-xs font-bold">{item.description}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{item.memberIds.map((id) => displayName(group, data, id)).join(', ')} · {item.mode === 'equal' ? 'Equal' : item.mode === 'exact' ? 'Exact' : 'Percentage'}</p></div><span className="tabular shrink-0 text-xs font-extrabold">{shareMoney(item.amount, group.currency)}</span></div>)}</div></section> : null}{receiptItems.length ? <section className="border-t border-border p-4"><div className="flex items-center justify-between"><p className="text-sm font-extrabold">Scanned bill items</p><span className="text-[11px] text-muted-foreground">{receiptItems.length} items</span></div><div className="mt-2 divide-y divide-border">{receiptItems.map((item) => <div key={item.id} className="flex items-center gap-3 py-2.5"><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{item.description}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{item.memberId ? displayName(group, data, item.memberId) : 'Shared'}</p></div><span className="tabular text-xs font-extrabold">{shareMoney(item.amount, group.currency)}</span></div>)}</div></section> : null}{labels.length ? <section className="border-t border-border p-4"><p className="text-sm font-extrabold">Details</p><div className="mt-2 divide-y divide-border">{labels.map((detail) => <div key={detail.key} className="py-2.5 text-[12px] text-muted-foreground">{detail.text}</div>)}</div></section> : null}</div>{historyCount && onHistory ? <button type="button" onClick={onHistory} className="press flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-surface-2 px-3 text-xs font-bold text-muted-foreground"><History size={14} /> View edit history ({historyCount})</button> : null}</div>;
}

function ExpenseResultSheet({ open, onClose, expense, group, data, onEdit, onDelete }: { open: boolean; onClose: () => void; expense: Expense | null; group: Group; data: SplitData; onEdit: () => void; onDelete?: () => void }) {
  const [shareOpen, setShareOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  if (!expense) return null;
  return <><SheetModal open={open} onClose={onClose} title="Expense result" footer={<div className="grid grid-cols-3 gap-2"><button type="button" onClick={onEdit} className="press rounded-2xl bg-surface-2 py-3.5 text-xs font-bold">Edit</button><button type="button" onClick={() => setShareOpen(true)} className="press flex items-center justify-center gap-1 rounded-2xl bg-secondary py-3.5 text-xs font-bold text-primary"><Share2 size={14} /> Share</button><button type="button" onClick={onClose} className="press rounded-2xl bg-primary py-3.5 text-xs font-bold text-primary-foreground">Done</button></div>}><ExpenseBreakdown expense={expense} group={group} data={data} onHistory={() => setHistoryOpen(true)} />{onDelete ? <button type="button" onClick={onDelete} className="press mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-negative/5 py-3 text-xs font-bold text-negative"><Trash2 size={14} /> Delete expense</button> : null}</SheetModal><ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} title="Share expense" message={buildExpenseShareMessage(expense, group, data)} /><HistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} expense={expense} data={data} /></>;
}

function HistoryDialog({ open, onClose, expense, data }: { open: boolean; onClose: () => void; expense: Expense; data: SplitData }) {
  const entries = (data.history ?? []).filter((entry) => entry.expenseId === expense.id).sort((a, b) => +new Date(b.date) - +new Date(a.date));
  return <SheetModal open={open} onClose={onClose} title="Edit history" footer={<PrimaryButton onClick={onClose}>Done</PrimaryButton>}>{entries.length ? <div className="space-y-3">{entries.map((entry) => <div key={entry.id} className="rounded-2xl border border-border bg-surface-2 p-3"><p className="mb-2 text-[11px] font-bold text-muted-foreground">{new Date(entry.date).toLocaleString()}</p><div className="space-y-2">{entry.changes.map((change, index) => <div key={`${change.field}-${index}`} className="text-xs"><p className="font-bold">{change.field}</p><p className="mt-0.5 break-words text-muted-foreground">{change.from} → {change.to}</p></div>)}</div></div>)}</div> : <div className="rounded-3xl bg-surface-2 p-6 text-center"><div className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary text-primary"><History size={20} /></div><p className="mt-3 text-sm font-extrabold">No edits yet</p><p className="mt-1 text-xs text-muted-foreground">Changes to this expense will appear here.</p></div>}</SheetModal>;
}


function receiptAmount(raw: string) {
  const clean = raw.replace(/[,\s]/g, '').replace(/[^0-9.-]/g, '');
  const value = Number(clean);
  return Number.isFinite(value) ? value : 0;
}

function parseReceiptText(text: string): ParsedReceipt {
  const rawLines = text.split(/\r?\n/).map((line) => line.replace(/[|]+/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const totalPattern = /\b(grand\s*total|net\s*total|total\s*amount|amount\s*(due|payable)|payable\s*amount|total)\b/i;
  const subTotalPattern = /\b(sub\s*total|subtotal)\b/i;
  const chargePattern = /\b(cgst|sgst|igst|gst|vat|tax|cess|service\s*(charge|fee)|tip|packing\s*(charge|fee)|delivery\s*(charge|fee))\b/i;
  const discountPattern = /\b(discount|coupon|saving|savings|promo)\b/i;
  const headerPattern = /\b(qty|quantity|rate|price|amount|description|item)\b/i;
  const pricePattern = /(?:₹|rs\.?|inr)?\s*(-?\d{1,7}(?:,\d{3})*(?:\.\d{1,2})?)\s*$/i;
  let detectedTotal: number | null = null;
  const items: ReceiptItem[] = [];
  const charges: AdditionalCharge[] = [];

  const merchant = rawLines.find((line) => /[a-z]{3}/i.test(line) && !pricePattern.test(line) && line.length <= 70 && !/invoice|receipt|tax\s*invoice|phone|gstin|date|time/i.test(line))?.slice(0, 60) ?? 'Scanned bill';

  rawLines.forEach((line) => {
    const match = line.match(pricePattern);
    if (!match || match.index == null) return;
    const amount = receiptAmount(match[1] ?? '');
    if (amount <= 0 || amount > 10000000) return;
    const description = line.slice(0, match.index).replace(/[.:\-–—]+$/g, '').trim();
    if (!description) return;
    if (subTotalPattern.test(description)) return;
    if (totalPattern.test(description)) { detectedTotal = amount; return; }
    if (discountPattern.test(description)) return;
    if (headerPattern.test(description) && description.split(' ').length <= 3) return;
    if (chargePattern.test(description)) {
      charges.push({ id: uid(), description, amount, distribution: 'equal' });
      return;
    }
    items.push({ id: uid(), description, amount });
  });

  if (!items.length && detectedTotal && detectedTotal > 0) items.push({ id: uid(), description: 'Bill total', amount: detectedTotal });
  return { merchant, detectedTotal, items, charges };
}

async function preprocessReceiptImage(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Could not read this image.')); image.src = url; });
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const targetWidth = Math.min(1800, Math.max(1200, sourceWidth));
    const scale = targetWidth / sourceWidth;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return file;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const gray = pixels.data[index]! * 0.299 + pixels.data[index + 1]! * 0.587 + pixels.data[index + 2]! * 0.114;
      const contrasted = Math.max(0, Math.min(255, (gray - 128) * 1.28 + 128));
      pixels.data[index] = contrasted;
      pixels.data[index + 1] = contrasted;
      pixels.data[index + 2] = contrasted;
    }
    context.putImageData(pixels, 0, 0);
    return await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), 'image/jpeg', 0.94));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function ReceiptScanner({ open, onClose, data, onUse }: { open: boolean; onClose: () => void; data: SplitData; onUse: (seed: ScanExpenseSeed) => void }) {
  const [groupId, setGroupId] = useState(data.groups[0]?.id ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'scanning' | 'review' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('Preparing image…');
  const [error, setError] = useState('');
  const [merchant, setMerchant] = useState('Scanned bill');
  const [detectedTotal, setDetectedTotal] = useState<number | null>(null);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [charges, setCharges] = useState<AdditionalCharge[]>([]);
  const [rawText, setRawText] = useState('');
  const group = data.groups.find((entry) => entry.id === groupId) ?? data.groups[0];
  const baseTotal = items.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
  const chargeTotal = charges.reduce((sum, charge) => sum + Math.max(0, Number(charge.amount) || 0), 0);
  const reviewedTotal = baseTotal + chargeTotal;
  const mismatch = detectedTotal != null && Math.abs(detectedTotal - reviewedTotal) > 0.05;

  useEffect(() => {
    if (open && !groupId && data.groups[0]) setGroupId(data.groups[0].id);
  }, [open, groupId, data.groups]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const chooseFile = (next: File | null) => {
    if (!next) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
    setStatus('idle');
    setProgress(0);
    setError('');
    setRawText('');
    setItems([]);
    setCharges([]);
    setDetectedTotal(null);
    setMerchant('Scanned bill');
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null); setPreviewUrl(''); setStatus('idle'); setProgress(0); setError(''); setRawText(''); setItems([]); setCharges([]); setDetectedTotal(null); setMerchant('Scanned bill');
  };

  const close = () => { reset(); onClose(); };

  const scan = async () => {
    if (!file) return;
    setStatus('scanning'); setProgress(0.03); setError(''); setProgressLabel('Cleaning up the receipt…');
    let worker: Awaited<ReturnType<(typeof import('tesseract.js'))['createWorker']>> | null = null;
    try {
      const processed = await preprocessReceiptImage(file);
      setProgress(0.12); setProgressLabel('Loading on-device OCR…');
      const { createWorker } = await import('tesseract.js');
      worker = await createWorker('eng', 1, { logger: (message) => {
        if (message.status === 'recognizing text') {
          setProgress(Math.max(0.15, Math.min(0.98, 0.15 + (message.progress ?? 0) * 0.83)));
          setProgressLabel(`Reading bill… ${Math.round((message.progress ?? 0) * 100)}%`);
        }
      } });
      const result = await worker.recognize(processed);
      const text = result.data.text ?? '';
      const parsed = parseReceiptText(text);
      setRawText(text);
      setMerchant(parsed.merchant);
      setDetectedTotal(parsed.detectedTotal);
      setItems(parsed.items);
      setCharges(parsed.charges);
      setProgress(1);
      setStatus('review');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not scan this bill. Try a clearer, straighter photo.');
      setStatus('error');
    } finally {
      await worker?.terminate().catch(() => undefined);
    }
  };

  const changeGroup = (nextId: string) => {
    setGroupId(nextId);
    setItems((current) => current.map((item) => ({ ...item, memberId: undefined })));
  };

  const useBill = () => {
    if (!group || baseTotal <= 0) return;
    const cleanItems = items.filter((item) => item.amount > 0).map((item) => ({ ...item, description: item.description.trim() || 'Bill item' }));
    const receiptIds = new Set(cleanItems.map((item) => item.id));
    const personalItems: PersonalItem[] = cleanItems.filter((item) => item.memberId).map((item) => ({ id: item.id, memberId: item.memberId!, description: item.description, amount: item.amount }));
    const cleanCharges = charges.filter((charge) => charge.amount > 0).map((charge) => ({ ...charge, description: charge.description.trim() || 'Charge' }));
    onUse({ groupId: group.id, description: merchant.trim() || 'Scanned bill', amount: cleanItems.reduce((sum, item) => sum + item.amount, 0), personalItems: personalItems.filter((item) => receiptIds.has(item.id)), additionalCharges: cleanCharges, receiptItems: cleanItems });
    reset();
  };

  if (!open) return null;
  return <SheetModal open={open} onClose={close} title="Scan a bill" footer={status === 'review' ? <div className="grid grid-cols-[.8fr_1.2fr] gap-2"><button type="button" onClick={reset} className="press rounded-2xl bg-surface-2 py-3.5 text-xs font-bold">Scan another</button><PrimaryButton onClick={useBill} disabled={!group || baseTotal <= 0}>Use this bill</PrimaryButton></div> : undefined}>
    {!data.groups.length ? <div className="rounded-3xl bg-surface-2 p-6 text-center"><Camera size={24} className="mx-auto text-primary" /><p className="mt-3 font-extrabold">Create a group first</p><p className="mt-1 text-xs text-muted-foreground">A scanned bill needs a group so items can be shared or assigned.</p></div> : <>
      <Field label="Group"><select value={group?.id ?? ''} onChange={(event) => changeGroup(event.target.value)} className={`${inputClass} py-2.5 text-sm`}>{data.groups.map((entry) => <option key={entry.id} value={entry.id}>{entry.emoji} {entry.name}</option>)}</select></Field>
      {status !== 'review' ? <>
        <div className="grid grid-cols-2 gap-2"><label className="press flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary px-3 py-3.5 text-xs font-bold text-primary-foreground"><Camera size={16} /> Camera<input type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { chooseFile(event.target.files?.[0] ?? null); event.currentTarget.value = ''; }} /></label><label className="press flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-secondary px-3 py-3.5 text-xs font-bold text-primary"><ImagePlus size={16} /> Photo library<input type="file" accept="image/*" className="hidden" onChange={(event) => { chooseFile(event.target.files?.[0] ?? null); event.currentTarget.value = ''; }} /></label></div>
        {previewUrl ? <div className="mt-3 overflow-hidden rounded-3xl border border-border bg-surface-2"><img src={previewUrl} alt="Receipt preview" className="max-h-72 w-full object-contain" /></div> : <div className="mt-3 rounded-3xl border border-dashed border-border bg-surface-2 p-7 text-center"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-primary"><Camera size={24} /></div><p className="mt-3 text-sm font-extrabold">Photograph the full receipt</p><p className="mx-auto mt-1 max-w-[290px] text-xs leading-5 text-muted-foreground">Keep it flat, well lit and readable. Splitzap processes the image on this device.</p></div>}
        {status === 'scanning' ? <div className="mt-3 rounded-2xl bg-secondary p-3"><div className="flex items-center gap-2 text-xs font-bold text-primary"><Loader2 size={15} className="animate-spin" /> {progressLabel}</div><div className="mt-2 h-2 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(4, progress * 100)}%` }} /></div></div> : null}
        {status === 'error' ? <div className="mt-3 rounded-2xl border border-negative/20 bg-negative/5 p-3 text-xs font-semibold text-negative">{error}</div> : null}
        <button type="button" disabled={!file || status === 'scanning'} onClick={scan} className="press mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-40">{status === 'scanning' ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} {status === 'scanning' ? 'Scanning…' : 'Scan bill'}</button>
      </> : <>
        <div className="rounded-2xl bg-secondary p-3"><p className="text-xs font-extrabold text-primary">Review before adding</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">OCR can make mistakes. Edit anything that does not match the receipt.</p></div>
        <Field label="Expense name"><input value={merchant} onChange={(event) => setMerchant(event.target.value)} placeholder="Restaurant, groceries…" className={inputClass} /></Field>
        <div className="mb-1 grid grid-cols-[minmax(100px,1fr)_76px_108px_28px] gap-1.5 px-1 text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground"><span>Item</span><span className="text-right">Amount</span><span className="text-center">For</span><span /></div>
        <div className="space-y-1.5">{items.map((item) => <div key={item.id} className="grid grid-cols-[minmax(100px,1fr)_76px_108px_28px] items-center gap-1.5"><input value={item.description} onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, description: event.target.value } : entry))} placeholder="Item" className="min-w-0 rounded-xl border border-border bg-surface-2 px-2 py-2.5 text-xs" /><input value={item.amount || ''} onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, amount: Number(event.target.value.replace(/[^0-9.]/g, '')) || 0 } : entry))} inputMode="decimal" placeholder="0" className="tabular min-w-0 rounded-xl border border-border bg-surface-2 px-2 py-2.5 text-right text-xs font-bold" /><select value={item.memberId ?? ''} onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, memberId: event.target.value || undefined } : entry))} className="min-w-0 rounded-xl border border-border bg-surface-2 px-1 py-2.5 text-center text-[10px] font-semibold"><option value="">Shared</option>{group?.members.map((member) => <option key={member.id} value={member.id}>{displayName(group, data, member.id)}</option>)}</select><button type="button" onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))} className="press grid size-7 place-items-center rounded-full bg-surface-2 text-negative"><X size={12} /></button></div>)}</div>
        <button type="button" onClick={() => setItems((current) => [...current, { id: uid(), description: '', amount: 0 }])} className="press mt-2 w-full rounded-xl border border-dashed border-border bg-surface-2 py-2.5 text-xs font-bold text-primary">+ Add item</button>
        {charges.length ? <div className="mt-4"><p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Detected charges</p><div className="grid grid-cols-[minmax(100px,1fr)_82px_106px_28px] gap-1.5 px-1 pb-1 text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground"><span>Item</span><span className="text-right">Amount</span><span className="text-center">Split</span><span /></div><div className="space-y-1.5">{charges.map((charge) => <div key={charge.id} className="grid grid-cols-[minmax(100px,1fr)_82px_106px_28px] items-center gap-1.5"><input value={charge.description} onChange={(event) => setCharges((current) => current.map((entry) => entry.id === charge.id ? { ...entry, description: event.target.value } : entry))} className="min-w-0 rounded-xl border border-border bg-surface-2 px-2 py-2.5 text-xs" /><input value={charge.amount || ''} onChange={(event) => setCharges((current) => current.map((entry) => entry.id === charge.id ? { ...entry, amount: Number(event.target.value.replace(/[^0-9.]/g, '')) || 0 } : entry))} inputMode="decimal" className="tabular min-w-0 rounded-xl border border-border bg-surface-2 px-2 py-2.5 text-right text-xs font-bold" /><select value={charge.distribution} onChange={(event) => setCharges((current) => current.map((entry) => entry.id === charge.id ? { ...entry, distribution: event.target.value === 'proportional' ? 'proportional' : 'equal' } : entry))} className="min-w-0 rounded-xl border border-border bg-surface-2 px-1 py-2.5 text-center text-[10px] font-semibold"><option value="equal">Equal</option><option value="proportional">Proportional</option></select><button type="button" onClick={() => setCharges((current) => current.filter((entry) => entry.id !== charge.id))} className="press grid size-7 place-items-center rounded-full bg-surface-2 text-negative"><X size={12} /></button></div>)}</div></div> : null}
        <div className={`mt-4 rounded-2xl p-3 ${mismatch ? 'border border-amber-300 bg-amber-50' : 'bg-secondary'}`}><div className="flex items-center justify-between text-xs"><span className="font-semibold text-muted-foreground">Reviewed total</span><span className="tabular text-base font-extrabold text-primary">{money(reviewedTotal, group?.currency)}</span></div>{detectedTotal != null ? <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground"><span>Receipt total detected</span><span className="tabular font-bold">{money(detectedTotal, group?.currency)}</span></div> : null}{mismatch ? <p className="mt-2 text-[10px] font-bold text-amber-700">Totals do not match. Review missing items, discounts or OCR mistakes before continuing.</p> : null}</div>
        {rawText ? <details className="mt-3 rounded-2xl bg-surface-2 p-3"><summary className="cursor-pointer text-xs font-bold text-muted-foreground">View raw OCR text</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-4 text-muted-foreground">{rawText}</pre></details> : null}
      </>}
    </>}
  </SheetModal>;
}

function PersonalItemsDialog({ open, onClose, items, onChange, group, data }: { open: boolean; onClose: () => void; items: PersonalItem[]; onChange: (items: PersonalItem[]) => void; group: Group; data: SplitData }) {
  const [draft, setDraft] = useState<PersonalDraft | null>(null);
  useEffect(() => { if (open && !items.length) setDraft((current) => current ?? { memberId: group.members[0]?.id ?? data.me, description: '', amount: '' }); }, [open, items.length, group.members, data.me]);
  const startAdd = () => { if (!draft) setDraft({ memberId: group.members[0]?.id ?? data.me, description: '', amount: '' }); };
  const saveDraft = () => { if (!draft) return; const amount = Number(draft.amount) || 0; if (!draft.memberId || amount <= 0) return; const saved: PersonalItem = { id: draft.id ?? uid(), memberId: draft.memberId, description: draft.description.trim() || 'Personal item', amount }; onChange(draft.id ? items.map((item) => item.id === draft.id ? saved : item) : [...items, saved]); setDraft(null); };
  return <SheetModal open={open} onClose={onClose} title="Personal items" footer={<div className="grid grid-cols-2 gap-2"><button type="button" onClick={startAdd} className="press rounded-2xl bg-surface-2 py-3.5 text-sm font-bold text-primary">+ Add item</button><PrimaryButton onClick={onClose}>Done</PrimaryButton></div>}>{items.length ? <div className="space-y-2">{items.map((item) => <div key={item.id} className="flex items-center gap-2 rounded-2xl border border-border bg-surface-2 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{item.description}</p><p className="text-[11px] text-muted-foreground">{displayName(group, data, item.memberId)}</p></div><p className="tabular text-sm font-extrabold">{money(item.amount, group.currency)}</p><button type="button" onClick={() => setDraft({ id: item.id, memberId: item.memberId, description: item.description, amount: String(item.amount) })} className="press grid size-8 place-items-center rounded-full bg-surface"><Pencil size={13} /></button><button type="button" onClick={() => onChange(items.filter((current) => current.id !== item.id))} className="press grid size-8 place-items-center rounded-full bg-surface text-negative"><Trash2 size={13} /></button></div>)}</div> : !draft ? <button type="button" onClick={startAdd} className="press flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface-2 p-5 text-sm font-bold text-primary"><Plus size={16} /> Add your first personal item</button> : null}{draft ? <div className="mt-3 rounded-3xl border border-primary/20 bg-secondary p-3"><div className="grid grid-cols-[92px_minmax(0,1fr)_76px] gap-1.5 px-1 pb-1 text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground"><span>Person</span><span>Item</span><span className="text-right">Amount</span></div><div className="grid grid-cols-[92px_minmax(0,1fr)_76px] gap-1.5"><select value={draft.memberId} onChange={(event) => setDraft({ ...draft, memberId: event.target.value })} className="min-w-0 rounded-xl border border-border bg-surface px-1.5 py-2.5 text-[10px] font-semibold">{group.members.map((member) => <option key={member.id} value={member.id}>{displayName(group, data, member.id)}</option>)}</select><input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Beer, dessert…" className="min-w-0 rounded-xl border border-border bg-surface px-2 py-2.5 text-xs" /><input value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value.replace(/[^0-9.]/g, '') })} inputMode="decimal" placeholder="0" className="tabular min-w-0 rounded-xl border border-border bg-surface px-2 py-2.5 text-right text-xs font-bold" /></div><button type="button" disabled={!(Number(draft.amount) > 0)} onClick={saveDraft} className="press mt-2 w-full rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-40">Save item</button></div> : null}</SheetModal>;
}



function SelectiveItemsDialog({ open, onClose, items, onChange, group, data }: { open: boolean; onClose: () => void; items: SelectiveItem[]; onChange: (items: SelectiveItem[]) => void; group: Group; data: SplitData }) {
  const makeDraft = (): SelectiveDraft => ({ description: '', amount: '', memberIds: group.members.map((member) => member.id), mode: 'equal', split: {} });
  const [draft, setDraft] = useState<SelectiveDraft | null>(null);
  useEffect(() => { if (open && !items.length) setDraft((current) => current ?? makeDraft()); }, [open, items.length, group.id]);

  const redistribute = (mode: SplitMode, memberIds: string[], amount: number) => {
    if (!memberIds.length || mode === 'equal') return {};
    const value = mode === 'percentage' ? 100 / memberIds.length : amount / memberIds.length;
    return Object.fromEntries(memberIds.map((id) => [id, value]));
  };
  const startAdd = () => { if (!draft) setDraft(makeDraft()); };
  const editItem = (item: SelectiveItem) => setDraft({ id: item.id, description: item.description, amount: String(item.amount), memberIds: [...item.memberIds], mode: item.mode, split: { ...item.split } });
  const amountValue = Number(draft?.amount) || 0;
  const allocationTotal = draft ? draft.memberIds.reduce((sum, id) => sum + Math.max(0, Number(draft.split[id]) || 0), 0) : 0;
  const allocationValid = !draft || draft.mode === 'equal' || (draft.mode === 'exact' ? Math.abs(allocationTotal - amountValue) < 0.01 : Math.abs(allocationTotal - 100) < 0.01);
  const draftValid = Boolean(draft && amountValue > 0 && draft.memberIds.length >= 2 && allocationValid);

  const toggleMember = (memberId: string) => {
    if (!draft) return;
    const memberIds = draft.memberIds.includes(memberId) ? draft.memberIds.filter((id) => id !== memberId) : [...draft.memberIds, memberId];
    setDraft({ ...draft, memberIds, split: redistribute(draft.mode, memberIds, amountValue) });
  };
  const changeMode = (mode: SplitMode) => { if (draft) setDraft({ ...draft, mode, split: redistribute(mode, draft.memberIds, amountValue) }); };
  const changeAmount = (raw: string) => {
    if (!draft) return;
    const clean = raw.replace(/[^0-9.]/g, '');
    const nextAmount = Number(clean) || 0;
    setDraft({ ...draft, amount: clean, split: draft.mode === 'exact' ? redistribute('exact', draft.memberIds, nextAmount) : draft.split });
  };
  const saveDraft = () => {
    if (!draft || !draftValid) return;
    const saved: SelectiveItem = { id: draft.id ?? uid(), description: draft.description.trim() || 'Selective item', amount: amountValue, memberIds: [...draft.memberIds], mode: draft.mode, split: draft.mode === 'equal' ? {} : Object.fromEntries(draft.memberIds.map((id) => [id, Math.max(0, Number(draft.split[id]) || 0)])) };
    onChange(draft.id ? items.map((item) => item.id === draft.id ? saved : item) : [...items, saved]);
    setDraft(null);
  };

  return <SheetModal open={open} onClose={onClose} title="Split with some people" footer={<div className="grid grid-cols-2 gap-2"><button type="button" onClick={startAdd} className="press rounded-2xl bg-surface-2 py-3.5 text-xs font-bold text-primary">+ Add item</button><PrimaryButton onClick={onClose}>Done</PrimaryButton></div>}>
    {items.length ? <div className="space-y-2">{items.map((item) => <div key={item.id} className="flex items-center gap-2 rounded-2xl border border-border bg-surface-2 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold">{item.description}</p><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{item.memberIds.map((id) => displayName(group, data, id)).join(', ')} · {item.mode === 'equal' ? 'Equal' : item.mode === 'exact' ? 'Exact' : 'Percentage'}</p></div><p className="tabular text-sm font-extrabold">{money(item.amount, group.currency)}</p><button type="button" onClick={() => editItem(item)} className="press grid size-8 place-items-center rounded-full bg-surface"><Pencil size={13} /></button><button type="button" onClick={() => onChange(items.filter((entry) => entry.id !== item.id))} className="press grid size-8 place-items-center rounded-full bg-surface text-negative"><Trash2 size={13} /></button></div>)}</div> : null}
    {draft ? <div className="mt-3 rounded-3xl border border-primary/20 bg-secondary p-3"><div className="grid grid-cols-[minmax(0,1fr)_90px] gap-2"><div><p className="mb-1 text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground">Item</p><input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Drinks, dessert…" className="min-w-0 w-full rounded-xl border border-border bg-surface px-2.5 py-2.5 text-xs" /></div><div><p className="mb-1 text-right text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground">Amount</p><input value={draft.amount} onChange={(event) => changeAmount(event.target.value)} inputMode="decimal" placeholder="0" className="tabular w-full rounded-xl border border-border bg-surface px-2 py-2.5 text-right text-xs font-bold" /></div></div><p className="mb-1.5 mt-3 text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground">Split between</p><div className="flex flex-wrap gap-1.5">{group.members.map((member) => { const selected = draft.memberIds.includes(member.id); return <button type="button" key={member.id} onClick={() => toggleMember(member.id)} className={`press rounded-full border px-2.5 py-2 text-[11px] font-bold ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface text-muted-foreground'}`}>{selected ? '✓ ' : '+ '}{displayName(group, data, member.id)}</button>; })}</div>{draft.memberIds.length < 2 ? <p className="mt-1.5 text-[10px] font-bold text-negative">Select at least two people.</p> : null}<p className="mb-1.5 mt-3 text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground">Split method</p><div className="splitzap-segment grid grid-cols-3 gap-1 rounded-xl bg-surface p-1">{([['equal', 'Equal'], ['exact', 'Exact'], ['percentage', '%']] as const).map(([mode, label]) => <button type="button" key={mode} onClick={() => changeMode(mode)} className={`press rounded-lg py-2 text-[11px] font-bold ${draft.mode === mode ? 'bg-secondary text-primary shadow-sm' : 'text-muted-foreground'}`}>{label}</button>)}</div>{draft.mode !== 'equal' ? <div className="mt-2 space-y-1.5">{draft.memberIds.map((memberId) => <div key={memberId} className="grid grid-cols-[minmax(0,1fr)_92px] items-center gap-2"><span className="truncate text-xs font-semibold">{displayName(group, data, memberId)}</span><div className="flex items-center gap-1"><input value={draft.split[memberId] ? String(Number(draft.split[memberId].toFixed(2))) : ''} onChange={(event) => setDraft({ ...draft, split: { ...draft.split, [memberId]: Number(event.target.value.replace(/[^0-9.]/g, '')) || 0 } })} inputMode="decimal" placeholder="0" className="tabular min-w-0 w-full rounded-lg border border-border bg-surface px-2 py-2 text-right text-xs font-bold" />{draft.mode === 'percentage' ? <span className="text-xs font-bold text-muted-foreground">%</span> : null}</div></div>)}<p className={`text-right text-[10px] font-bold ${allocationValid ? 'text-positive' : 'text-negative'}`}>{draft.mode === 'exact' ? `${money(allocationTotal, group.currency)} / ${money(amountValue, group.currency)}` : `${allocationTotal.toFixed(2)}% / 100%`}</p></div> : draft.memberIds.length >= 2 && amountValue > 0 ? <p className="mt-2 text-right text-[10px] font-semibold text-muted-foreground">{money(amountValue / draft.memberIds.length, group.currency)} each</p> : null}<button type="button" onClick={saveDraft} disabled={!draftValid} className="press mt-3 w-full rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-40">Save item</button></div> : null}
  </SheetModal>;
}

function AdditionalChargesDialog({ open, onClose, charges, onChange, currency, expenseTotal }: { open: boolean; onClose: () => void; charges: AdditionalCharge[]; onChange: (charges: AdditionalCharge[]) => void; currency: string; expenseTotal: number }) {
  const total = charges.reduce((sum, charge) => sum + Math.max(0, Number(charge.amount) || 0), 0);
  const add = () => onChange([...charges, { id: uid(), description: '', amount: 0, distribution: 'equal' }]);
  return <SheetModal open={open} onClose={onClose} title="Additional charges" footer={<div className="grid grid-cols-2 gap-2"><button type="button" onClick={add} className="press rounded-2xl bg-surface-2 py-3.5 text-xs font-bold text-primary">+ Add charge</button><PrimaryButton onClick={onClose}>Done</PrimaryButton></div>}><div className="grid grid-cols-[minmax(72px,1fr)_82px_106px_28px] gap-1.5 px-1 pb-1 text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground"><span>Item</span><span className="text-right">Amount</span><span className="text-center">Split</span><span /></div>{charges.length ? <div className="space-y-1.5">{charges.map((charge) => <div key={charge.id} className="grid grid-cols-[minmax(72px,1fr)_82px_106px_28px] items-center gap-1.5"><input value={charge.description} onChange={(event) => onChange(charges.map((item) => item.id === charge.id ? { ...item, description: event.target.value } : item))} placeholder="Tax, service…" className="min-w-0 rounded-xl border border-border bg-surface-2 px-2 py-2.5 text-xs" /><input value={charge.amount || ''} onChange={(event) => onChange(charges.map((item) => item.id === charge.id ? { ...item, amount: Number(event.target.value.replace(/[^0-9.]/g, '')) || 0 } : item))} inputMode="decimal" placeholder="0" className="tabular min-w-0 rounded-xl border border-border bg-surface-2 px-2 py-2.5 text-right text-xs font-bold" /><select value={charge.distribution} onChange={(event) => onChange(charges.map((item) => item.id === charge.id ? { ...item, distribution: event.target.value === 'proportional' ? 'proportional' : 'equal' } : item))} className="min-w-0 rounded-xl border border-border bg-surface-2 px-1.5 py-2.5 text-center text-[10px] font-semibold"><option value="equal">Equal</option><option value="proportional">Proportional</option></select><button type="button" onClick={() => onChange(charges.filter((item) => item.id !== charge.id))} className="press grid size-7 place-items-center rounded-full bg-surface-2 text-negative"><X size={12} /></button></div>)}</div> : <button type="button" onClick={add} className="press mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface-2 p-5 text-sm font-bold text-primary"><Plus size={15} /> Add tax, service charge or tip</button>}<div className="mt-3 flex items-center justify-between rounded-2xl bg-secondary px-3 py-2.5 text-xs"><span className="font-semibold text-muted-foreground">Charges {money(total, currency)}</span><span className="font-extrabold text-primary">Total {money(expenseTotal, currency)}</span></div></SheetModal>;
}

function MultiplePayersDialog({ open, onClose, group, data, total, primaryPayerId, payments, onChange, onUseSingle }: { open: boolean; onClose: () => void; group: Group; data: SplitData; total: number; primaryPayerId: string; payments: Record<string, number>; onChange: (value: Record<string, number>) => void; onUseSingle: () => void }) {
  const otherMembers = group.members.filter((member) => member.id !== primaryPayerId);
  const otherTotal = otherMembers.reduce((sum, member) => sum + Math.max(0, Number(payments[member.id]) || 0), 0);
  const primaryAmount = Math.max(0, total - otherTotal);

  const setOtherAmount = (memberId: string, raw: string) => {
    const otherWithoutCurrent = otherMembers
      .filter((member) => member.id !== memberId)
      .reduce((sum, member) => sum + Math.max(0, Number(payments[member.id]) || 0), 0);
    const maxAllowed = Math.max(0, total - otherWithoutCurrent);
    const requested = Math.max(0, Number(raw.replace(/[^0-9.]/g, '')) || 0);
    const nextAmount = Math.min(requested, maxAllowed);
    const next = { ...payments, [memberId]: nextAmount };
    const nextOtherTotal = otherMembers.reduce((sum, member) => sum + (member.id === memberId ? nextAmount : Math.max(0, Number(next[member.id]) || 0)), 0);
    next[primaryPayerId] = Math.max(0, total - nextOtherTotal);
    onChange(next);
  };

  return <SheetModal open={open} onClose={onClose} title="Multiple payers" footer={<div className="grid grid-cols-2 gap-2"><button type="button" onClick={onUseSingle} className="press rounded-2xl bg-surface-2 py-3.5 text-xs font-bold">Use single payer</button><PrimaryButton onClick={onClose}>Save</PrimaryButton></div>}><div className="mb-3 rounded-2xl border border-primary/20 bg-secondary p-3"><div className="flex items-center gap-3"><Avatar name={displayName(group, data, primaryPayerId)} size={30} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{displayName(group, data, primaryPayerId)}</p><p className="text-[11px] text-muted-foreground">Primary payer</p></div><p className="tabular text-sm font-extrabold text-primary">{money(primaryAmount, group.currency)}</p></div></div><div className="space-y-2">{otherMembers.map((member) => { const otherWithoutCurrent = otherMembers.filter((item) => item.id !== member.id).reduce((sum, item) => sum + Math.max(0, Number(payments[item.id]) || 0), 0); const maxAllowed = Math.max(0, total - otherWithoutCurrent); return <div key={member.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3"><Avatar name={displayName(group, data, member.id)} size={30} /><span className="min-w-0 flex-1 truncate text-sm font-semibold">{displayName(group, data, member.id)}</span><input value={payments[member.id] ? String(payments[member.id]) : ''} onChange={(event) => setOtherAmount(member.id, event.target.value)} inputMode="decimal" placeholder="0" aria-label={`${displayName(group, data, member.id)} paid amount`} className="tabular w-24 rounded-xl border border-border bg-surface px-2 py-2 text-right text-sm font-bold" /><span className="hidden text-[10px] text-muted-foreground min-[420px]:inline">max {money(maxAllowed, group.currency)}</span></div>; })}</div></SheetModal>;
}

function makeHistoryChanges(before: Expense, after: Expense, group: Group, data: SplitData): HistoryChange[] {
  const changes: HistoryChange[] = [];
  const add = (field: string, from: string, to: string) => { if (from !== to) changes.push({ field, from, to }); };
  add('Description', before.description, after.description);
  add('Amount', shareMoney(before.amount, group.currency), shareMoney(after.amount, group.currency));
  add('Paid by', payerSummary(before, group, data, true), payerSummary(after, group, data, true));
  add('Split mode', before.mode, after.mode);
  add('Category', categoryOf(before.category).label, categoryOf(after.category).label);
  if (JSON.stringify(before.split) !== JSON.stringify(after.split)) add('Split allocation', 'Previous allocation', 'Updated allocation');
  if (JSON.stringify(before.personalItems ?? []) !== JSON.stringify(after.personalItems ?? [])) add('Personal items', 'Previous items', 'Updated items');
  if (JSON.stringify(before.selectiveItems ?? []) !== JSON.stringify(after.selectiveItems ?? [])) add('Selective items', 'Previous items', 'Updated items');
  if (JSON.stringify(before.additionalCharges ?? []) !== JSON.stringify(after.additionalCharges ?? [])) add('Additional charges', 'Previous charges', 'Updated charges');
  if (JSON.stringify(before.receiptItems ?? []) !== JSON.stringify(after.receiptItems ?? [])) add('Scanned bill items', 'Previous items', 'Updated items');
  if (JSON.stringify(before.splitLabels ?? {}) !== JSON.stringify(after.splitLabels ?? {})) add('Labels', 'Previous labels', 'Updated labels');
  if (expenseDateInputValue(before.date) !== expenseDateInputValue(after.date)) add('Date', expenseDateInputValue(before.date), expenseDateInputValue(after.date));
  return changes;
}

function AddExpenseSheet({ open, onClose, data, update, defaultGroupId, editing, seed }: { open: boolean; onClose: () => void; data: SplitData; update: (fn: (data: SplitData) => SplitData) => void; defaultGroupId?: string; editing?: Expense | null; seed?: ScanExpenseSeed | null }) {
  const groups = data.groups;
  const initialPayments = editing ? paymentsOf(editing) : {};
  const startingGroupId = editing?.groupId ?? seed?.groupId ?? defaultGroupId ?? groups[0]?.id ?? '';
  const startingGroup = groups.find((item) => item.id === startingGroupId);
  const [groupId, setGroupId] = useState(startingGroupId);
  const [description, setDescription] = useState(editing?.description ?? seed?.description ?? '');
  const [amount, setAmount] = useState(editing ? String(baseAmountOf(editing)) : seed ? String(seed.amount) : '');
  const [category, setCategory] = useState(editing?.category ?? 'general');
  const [categoryTouched, setCategoryTouched] = useState(Boolean(editing));
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [expenseDate, setExpenseDate] = useState(expenseDateInputValue(editing?.date));
  const [moreOpen, setMoreOpen] = useState(Boolean(editing && (editing.personalItems?.length || editing.selectiveItems?.length || editing.additionalCharges?.length || Object.keys(editing.payments ?? {}).length > 1)));
  const [paidBy, setPaidBy] = useState(editing?.paidBy ?? (startingGroup ? memberIdFor(startingGroup, data) : data.me));
  const [multiPayer, setMultiPayer] = useState(Object.keys(initialPayments).filter((id) => (initialPayments[id] ?? 0) > 0).length > 1);
  const [payments, setPayments] = useState<Record<string, number>>(initialPayments);
  const [payersOpen, setPayersOpen] = useState(false);
  const [mode, setMode] = useState<SplitMode>(editing?.mode ?? 'equal');
  const [splitExpanded, setSplitExpanded] = useState((editing?.mode ?? 'equal') !== 'equal');
  const [split, setSplit] = useState<Record<string, number>>(editing?.split ?? {});
  const [splitLabels, setSplitLabels] = useState<Record<string, string>>(editing?.splitLabels ?? {});
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>(editing?.splitLabels ?? {});
  const [labelOpen, setLabelOpen] = useState<Record<string, boolean>>({});
  const [personalItems, setPersonalItems] = useState<PersonalItem[]>(editing?.personalItems ?? seed?.personalItems ?? []);
  const [personalOpen, setPersonalOpen] = useState(false);
  const [selectiveItems, setSelectiveItems] = useState<SelectiveItem[]>(editing?.selectiveItems ?? []);
  const [selectiveOpen, setSelectiveOpen] = useState(false);
  const [charges, setCharges] = useState<AdditionalCharge[]>(editing?.additionalCharges ?? seed?.additionalCharges ?? []);
  const [receiptItems] = useState<ReceiptItem[]>(editing?.receiptItems ?? seed?.receiptItems ?? []);
  const [chargesOpen, setChargesOpen] = useState(false);
  const [savedExpense, setSavedExpense] = useState<Expense | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const group = groups.find((item) => item.id === groupId);
  const baseTotal = Number(amount) || 0;
  const chargeTotal = charges.reduce((sum, charge) => sum + (Number(charge.amount) || 0), 0);
  const grandTotal = baseTotal + chargeTotal;
  const personalTotal = personalItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const selectiveTotal = selectiveItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const sharedTotal = Math.max(0, baseTotal - personalTotal - selectiveTotal);
  const personalOver = personalTotal + selectiveTotal - baseTotal;

  const activeSplit = useMemo<Record<string, number>>(() => {
    if (!group) return {};
    if (Object.keys(split).length) return split;
    if (mode === 'percentage') return Object.fromEntries(group.members.map((member) => [member.id, 100 / group.members.length]));
    return Object.fromEntries(group.members.map((member) => [member.id, mode === 'exact' ? 0 : 1]));
  }, [group, split, mode]);

  const weightTotal = Object.values(activeSplit).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const exactAssigned = weightTotal;
  const exactRemaining = sharedTotal - exactAssigned;
  const percentageRemaining = 100 - weightTotal;
  const hasSharedAmount = sharedTotal > 0.009;
  const hasSharedPeople = Object.values(activeSplit).some((value) => value > 0);
  const otherPaidTotal = multiPayer ? Object.entries(payments).filter(([id]) => id !== paidBy).reduce((sum, [, value]) => sum + Math.max(0, Number(value) || 0), 0) : 0;
  const payerValid = !multiPayer || otherPaidTotal <= grandTotal + 0.009;
  const splitValid = mode === 'exact' ? Math.abs(exactRemaining) < 0.01 : mode === 'percentage' ? Math.abs(percentageRemaining) < 0.01 : true;
  const splitSectionValid = splitValid && (!hasSharedAmount || hasSharedPeople);
  const valid = !!group && description.trim().length > 0 && baseTotal > 0 && personalOver <= 0.009 && splitSectionValid && payerValid;
  const setWeight = (id: string, value: number) => setSplit({ ...activeSplit, [id]: value });

  const setModeCleanly = (next: SplitMode) => {
    if (!group || mode === next) return;
    setMode(next);
    setSplitExpanded(next !== 'equal');
    if (next === 'exact') setSplit(Object.fromEntries(group.members.map((member) => [member.id, 0])));
    else if (next === 'percentage') setSplit(Object.fromEntries(group.members.map((member) => [member.id, 100 / group.members.length])));
    else setSplit(Object.fromEntries(group.members.map((member) => [member.id, 1])));
    if (next !== 'exact') setLabelOpen({});
  };

  const saveLabel = (memberId: string) => {
    const clean = (labelDrafts[memberId] ?? '').trim();
    const next = { ...splitLabels };
    if (clean) next[memberId] = clean; else delete next[memberId];
    setSplitLabels(next);
    setLabelDrafts({ ...labelDrafts, [memberId]: clean });
    setLabelOpen({ ...labelOpen, [memberId]: false });
  };

  const openMultiplePayers = () => {
    const existingOthers = Object.fromEntries(Object.entries(payments).filter(([id, value]) => id !== paidBy && Number(value) > 0));
    const others = Object.values(existingOthers).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
    setPayments({ [paidBy]: Math.max(0, grandTotal - Math.min(grandTotal, others)), ...existingOthers });
    setMultiPayer(true);
    setPayersOpen(true);
  };

  const save = () => {
    setSubmitAttempted(true);
    if (!group || !valid) return;
    const otherPayments = multiPayer ? Object.fromEntries(Object.entries(payments).filter(([id, value]) => id !== paidBy && Number(value) > 0)) : {};
    const normalizedOtherTotal = Object.values(otherPayments).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
    const cleanPayments = multiPayer ? { [paidBy]: Math.max(0, grandTotal - normalizedOtherTotal), ...otherPayments } : { [paidBy]: grandTotal };
    const payload: Expense = {
      id: editing?.id ?? uid(), groupId: group.id, description: description.trim(), amount: grandTotal, baseAmount: baseTotal, paidBy, payments: cleanPayments,
      split: hasSharedAmount ? Object.fromEntries(Object.entries(activeSplit).filter(([, value]) => Number(value) > 0)) : {}, splitLabels: mode === 'exact' ? Object.fromEntries(Object.entries(splitLabels).map(([id, value]) => [id, value.trim()]).filter(([, value]) => value)) : {}, mode, category,
      date: expenseDateToIso(expenseDate), personalItems, selectiveItems, additionalCharges: charges.filter((charge) => charge.amount > 0).map((charge) => ({ ...charge, description: charge.description.trim() || 'Charge' })), receiptItems,
    };
    update((current) => {
      const historyChanges = editing ? makeHistoryChanges(editing, payload, group, current) : [];
      const entry: ExpenseHistoryEntry | null = historyChanges.length ? { id: uid(), expenseId: payload.id, groupId: group.id, date: new Date().toISOString(), changes: historyChanges } : null;
      const next = { ...current, expenses: editing ? current.expenses.map((expense) => expense.id === editing.id ? payload : expense) : [payload, ...current.expenses], history: entry ? [entry, ...(current.history ?? [])] : current.history ?? [] };
      return group.sharedId ? next : withLocalActivity(next, { groupId: group.id, actorName: current.myName?.trim() || displayName(group, current, memberIdFor(group, current)), eventType: editing ? 'expense_updated' : 'expense_added', entityType: 'expense', entityId: payload.id, data: editing ? { before: editing, after: payload } : { after: payload } });
    });
    if (!editing) { try { navigator.vibrate?.(15); } catch { /* optional */ } }
    setSavedExpense(payload);
  };

  if (savedExpense && group) return <><SheetModal open={open} onClose={onClose} title={editing ? 'Expense updated' : 'Expense added'} footer={<div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setShareOpen(true)} className="press flex items-center justify-center gap-2 rounded-2xl bg-secondary py-3.5 text-sm font-bold text-primary"><Share2 size={16} /> Share</button><PrimaryButton onClick={onClose}>Done</PrimaryButton></div>}><div className="success-state relative py-3 text-center">{!editing ? <ExpenseConfetti /> : null}<div className="success-check mx-auto grid size-16 place-items-center rounded-full bg-secondary text-primary"><Check size={30} strokeWidth={3} /></div><p className="mt-3 text-sm font-extrabold text-primary">{editing ? 'Expense updated' : 'Expense saved'}</p><p className="mt-1 text-xs text-muted-foreground">Balances and settlements are updated instantly.</p></div><ExpenseBreakdown expense={savedExpense} group={group} data={data} /></SheetModal><ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} title="Share expense" message={buildExpenseShareMessage(savedExpense, group, data)} /></>;

  return <><SheetModal open={open} onClose={onClose} title={editing ? 'Edit expense' : 'Add an expense'} footer={<PrimaryButton onClick={save}>{editing ? 'Save changes' : 'Add expense'}</PrimaryButton>}>{groups.length > 1 || !defaultGroupId ? <Field label="Group"><select value={groupId} onChange={(event) => { const nextId = event.target.value; const nextGroup = groups.find((item) => item.id === nextId); setGroupId(nextId); setPaidBy(nextGroup ? memberIdFor(nextGroup, data) : data.me); setPayments({}); setMultiPayer(false); setSplit({}); setPersonalItems([]); setSelectiveItems([]); setCharges([]); }} className={inputClass}>{groups.map((item) => <option key={item.id} value={item.id}>{item.emoji} {item.name}</option>)}</select></Field> : null}<div className="expense-main-row mb-3 grid grid-cols-[46px_minmax(0,1fr)_104px] gap-2"><div><label className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">Category</label><button type="button" onClick={() => setCategoryOpen((value) => !value)} aria-label="Choose category" className={`expense-category-button press grid h-[46px] w-[46px] place-items-center rounded-xl border border-border bg-surface-2 text-xl category-${category}`}>{categoryOf(category).emoji}</button></div><Field label="Description" compact><input value={description} onChange={(event) => { const next = event.target.value; setDescription(next); if (!categoryTouched) setCategory(suggestExpenseCategory(next)); }} placeholder="Dinner, cab…" aria-invalid={submitAttempted && !description.trim()} className={`${inputClass} ${submitAttempted && !description.trim() ? 'border-negative ring-2 ring-negative/15' : ''}`} />{submitAttempted && !description.trim() ? <p className="mt-1 text-[10px] font-bold text-negative">Required</p> : null}</Field><Field label={`Amount (${group?.currency ?? '₹'})`} compact><input value={amount} inputMode="decimal" onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))} placeholder="0" aria-invalid={submitAttempted && baseTotal <= 0} className={`${inputClass} tabular px-2 text-right font-extrabold ${submitAttempted && baseTotal <= 0 ? 'border-negative ring-2 ring-negative/15' : ''}`} />{submitAttempted && baseTotal <= 0 ? <p className="mt-1 text-right text-[10px] font-bold text-negative">Required</p> : null}</Field></div>{categoryOpen ? <div className="mb-3 grid grid-cols-4 gap-1.5 rounded-2xl border border-border bg-surface p-2">{CATEGORIES.map((item) => <button type="button" key={item.id} onClick={() => { setCategory(item.id); setCategoryTouched(true); setCategoryOpen(false); }} className={`press rounded-xl px-1 py-2 text-center ${category === item.id ? 'bg-secondary text-primary' : 'bg-surface-2'}`}><span className="block text-lg">{item.emoji}</span><span className="mt-1 block truncate text-[9px] font-bold">{item.label}</span></button>)}</div> : null}{group ? <div className="mb-4 grid grid-cols-2 gap-2"><Field label="Paid by" compact><select value={paidBy} onChange={(event) => { setPaidBy(event.target.value); setMultiPayer(false); setPayments({}); setPayersOpen(false); }} className={`${inputClass} py-2.5 text-xs`}>{group.members.map((member) => <option key={member.id} value={member.id}>{displayName(group, data, member.id)}{member.id === memberIdFor(group, data) ? ' (Me)' : ''}</option>)}</select></Field><Field label="Date" compact><div className="relative"><CalendarDays size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} className={`${inputClass} pl-8 py-2.5 text-xs`} /></div></Field></div> : null}

<Field label={`Split shared amount · ${money(sharedTotal, group?.currency)}`}><div className={`splitzap-segment mb-2 grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1 ${submitAttempted && !splitSectionValid ? 'ring-2 ring-negative/25' : ''}`}>{([['equal', 'Equally'], ['exact', 'Exact'], ['percentage', 'Percentage']] as const).map(([id, label]) => <button type="button" key={id} onClick={() => setModeCleanly(id)} className={`press rounded-lg py-2 text-xs font-bold ${mode === id ? 'is-active bg-surface text-foreground shadow-sm' : 'text-muted-foreground'}`}>{label}</button>)}</div>{mode === 'equal' && !splitExpanded ? <button type="button" onClick={() => setSplitExpanded(true)} className="press flex w-full items-center gap-3 rounded-xl border border-border bg-surface-2 px-3 py-3 text-left"><div className="min-w-0 flex-1"><p className="text-sm font-bold">Split equally</p><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{group?.members.filter((member) => Number(activeSplit[member.id] ?? 0) > 0).map((member) => displayName(group, data, member.id)).join(', ') || 'Nobody selected'}</p></div><span className="tabular text-xs font-bold text-muted-foreground">{money(sharedTotal, group?.currency)}</span><span className="text-xs font-extrabold text-primary">Edit</span></button> : <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">{group?.members.map((member) => { const value = Number(activeSplit[member.id] ?? 0); const personal = personalItems.filter((item) => item.memberId === member.id).reduce((sum, item) => sum + item.amount, 0); const selective = selectiveItems.reduce((sum, item) => sum + selectiveItemShare(item, member.id), 0); const sharedOwed = mode === 'exact' ? value : mode === 'percentage' ? sharedTotal * value / 100 : weightTotal ? sharedTotal * value / weightTotal : 0; const coPayerPaid = multiPayer && member.id !== paidBy ? Math.max(0, Number(payments[member.id]) || 0) : 0; const responsibility = sharedOwed + personal + selective; const remainingAfterCoPay = responsibility - coPayerPaid; const savedLabel = splitLabels[member.id]?.trim() ?? ''; const editingLabel = mode === 'exact' && labelOpen[member.id]; return <div key={member.id} className="bg-surface px-3 py-2.5"><div className="flex items-center gap-3"><Avatar name={displayName(group, data, member.id)} size={30} /><div className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{displayName(group, data, member.id)}</span>{personal > 0 ? <span className="text-[10px] font-bold text-primary">+ {money(personal, group.currency)} personal</span> : null}{selective > 0 ? <span className="block text-[10px] font-bold text-primary">+ {money(selective, group.currency)} selected item</span> : null}{coPayerPaid > 0 ? <span className={`block text-[10px] font-bold ${remainingAfterCoPay < -0.009 ? 'text-positive' : 'text-muted-foreground'}`}>{money(coPayerPaid, group.currency)} paid · {remainingAfterCoPay > 0.009 ? `${money(remainingAfterCoPay, group.currency)} remaining` : remainingAfterCoPay < -0.009 ? `gets ${money(-remainingAfterCoPay, group.currency)}` : 'covered'}</span> : null}</div>{mode === 'equal' ? <><span className={`tabular text-sm ${coPayerPaid > 0 && remainingAfterCoPay < -0.009 ? 'font-bold text-positive' : 'text-muted-foreground'}`}>{value > 0 ? coPayerPaid > 0 ? remainingAfterCoPay < -0.009 ? `gets ${money(-remainingAfterCoPay, group.currency)}` : money(Math.max(0, remainingAfterCoPay), group.currency) : money(responsibility, group.currency) : personal + selective > 0 ? money(personal + selective, group.currency) : '—'}</span><input type="checkbox" checked={value > 0} onChange={(event) => setWeight(member.id, event.target.checked ? 1 : 0)} className="size-5" /></> : <div className="flex items-center gap-1"><input value={value === 0 ? '' : String(Number(value.toFixed(2)))} inputMode="decimal" placeholder="0" onChange={(event) => setWeight(member.id, Number(event.target.value.replace(/[^0-9.]/g, '')) || 0)} className="tabular w-20 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-right text-sm" />{mode === 'percentage' ? <span className="text-xs font-bold text-muted-foreground">%</span> : null}</div>}</div>{mode === 'exact' ? <div className="ml-[42px] mt-1.5">{editingLabel ? <div className="flex items-center gap-2"><input value={labelDrafts[member.id] ?? ''} onChange={(event) => setLabelDrafts({ ...labelDrafts, [member.id]: event.target.value })} placeholder="e.g. Beer & starter" className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-xs outline-none focus:border-primary" /><button type="button" onClick={() => saveLabel(member.id)} className="press grid size-8 place-items-center rounded-full bg-primary text-primary-foreground"><Check size={14} /></button><button type="button" onClick={() => setLabelOpen({ ...labelOpen, [member.id]: false })} className="press grid size-8 place-items-center rounded-full bg-surface-2"><X size={12} /></button></div> : savedLabel ? <button type="button" onClick={() => { setLabelDrafts({ ...labelDrafts, [member.id]: savedLabel }); setLabelOpen({ ...labelOpen, [member.id]: true }); }} className="press rounded-lg bg-surface-2 px-2.5 py-2 text-[11px] font-semibold text-primary">{savedLabel}</button> : <button type="button" onClick={() => setLabelOpen({ ...labelOpen, [member.id]: true })} className="press text-[11px] font-bold text-primary">+ Add Label (optional)</button>}</div> : null}</div>; })}</div>}{mode === 'exact' && baseTotal > 0 ? <p className={`mt-2 text-xs font-semibold ${Math.abs(exactRemaining) < 0.01 ? 'text-positive' : 'text-negative'}`}>{Math.abs(exactRemaining) < 0.01 ? 'Shared amount is fully assigned.' : `${money(Math.abs(exactRemaining), group?.currency)} ${exactRemaining > 0 ? 'left to assign' : 'over'}`}</p> : null}{mode === 'percentage' && hasSharedAmount ? <p className={`mt-2 text-xs font-semibold ${Math.abs(percentageRemaining) < 0.01 ? 'text-positive' : 'text-negative'}`}>{Math.abs(percentageRemaining) < 0.01 ? '100% assigned.' : `${Math.abs(percentageRemaining).toFixed(2)}% ${percentageRemaining > 0 ? 'left to assign' : 'over'}`}</p> : null}</Field><div className={`mb-3 flex items-center gap-2 rounded-2xl px-3 py-2.5 text-xs font-bold ${splitSectionValid && personalOver <= 0.009 && payerValid ? 'bg-secondary text-primary' : 'bg-surface-2 text-negative'}`}><span className={`grid size-6 place-items-center rounded-full ${splitSectionValid && personalOver <= 0.009 && payerValid ? 'bg-primary text-primary-foreground' : 'bg-surface text-negative'}`}>{splitSectionValid && personalOver <= 0.009 && payerValid ? <Check size={13} /> : '!'}</span><span>{personalOver > 0.009 ? `Personal + selective items exceed the expense by ${money(personalOver, group?.currency)}` : !payerValid ? 'Check payer amounts' : hasSharedAmount && !hasSharedPeople ? 'Select at least one person to split with' : splitValid ? 'Fully assigned' : mode === 'percentage' ? `${Math.abs(percentageRemaining).toFixed(2)}% left to fix` : `${money(Math.abs(exactRemaining), group?.currency)} left to fix`}</span></div><button type="button" onClick={() => setMoreOpen((value) => !value)} className="press mb-3 flex w-full items-center gap-3 rounded-xl border border-border bg-surface-2 px-3 py-3 text-left"><span className="grid size-8 place-items-center rounded-xl bg-surface text-primary"><MoreHorizontal size={15} /></span><span className="min-w-0 flex-1"><b className="block text-xs">More options</b><span className="block text-[10px] text-muted-foreground">Personal items, some people, charges, multiple payers</span></span><ChevronDown size={15} className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`} /></button>{moreOpen ? <div className="mb-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setPersonalOpen(true)} className={`press rounded-xl border px-3 py-3 text-left text-[11px] font-bold ${personalItems.length ? 'border-primary/20 bg-secondary text-primary' : 'border-border bg-surface'}`}><span className="mr-1">👤</span> Personal items{personalItems.length ? ` · ${personalItems.length}` : ''}</button><button type="button" onClick={() => setSelectiveOpen(true)} className={`press rounded-xl border px-3 py-3 text-left text-[11px] font-bold ${selectiveItems.length ? 'border-primary/20 bg-secondary text-primary' : 'border-border bg-surface'}`}><span className="mr-1">👥</span> Some people{selectiveItems.length ? ` · ${selectiveItems.length}` : ''}</button><button type="button" onClick={() => { if (!charges.length) setCharges([{ id: uid(), description: '', amount: 0, distribution: 'equal' }]); setChargesOpen(true); }} className={`press rounded-xl border px-3 py-3 text-left text-[11px] font-bold ${charges.length ? 'border-primary/20 bg-secondary text-primary' : 'border-border bg-surface'}`}><span className="mr-1">🧾</span> Charges{charges.length ? ` · ${charges.length}` : ''}</button><button type="button" onClick={openMultiplePayers} className={`press rounded-xl border px-3 py-3 text-left text-[11px] font-bold ${multiPayer ? 'border-primary/20 bg-secondary text-primary' : 'border-border bg-surface'}`}><span className="mr-1">💳</span> {multiPayer ? 'Manage payers' : 'Multiple payers'}</button></div> : null}

{chargeTotal > 0 ? <p className="pb-2 text-right text-[11px] font-bold text-muted-foreground">Expense total with charges: {money(grandTotal, group?.currency)}</p> : null}</SheetModal>{group ? <PersonalItemsDialog open={personalOpen} onClose={() => setPersonalOpen(false)} items={personalItems} onChange={setPersonalItems} group={group} data={data} /> : null}{group ? <SelectiveItemsDialog open={selectiveOpen} onClose={() => setSelectiveOpen(false)} items={selectiveItems} onChange={setSelectiveItems} group={group} data={data} /> : null}{group ? <AdditionalChargesDialog open={chargesOpen} onClose={() => setChargesOpen(false)} charges={charges} onChange={setCharges} currency={group.currency} expenseTotal={grandTotal} /> : null}{group ? <MultiplePayersDialog open={payersOpen} onClose={() => setPayersOpen(false)} group={group} data={data} total={grandTotal} primaryPayerId={paidBy} payments={payments} onChange={setPayments} onUseSingle={() => { setMultiPayer(false); setPayments({}); setPayersOpen(false); }} /> : null}</>;
}

const EMOJIS = ['👥', '🏖️', '🏠', '🍽️', '✈️', '🎓', '🎉', '🚗', '💼'];

const suggestExpenseCategory = (value: string) => {
  const text = value.trim().toLowerCase();
  if (!text) return 'general';
  if (/dinner|lunch|breakfast|food|restaurant|cafe|coffee|tea|drink|beer|pizza|burger|grocery|groceries|snack/.test(text)) return 'food';
  if (/hotel|stay|airbnb|hostel|room|resort|accommodation/.test(text)) return 'stay';
  if (/flight|airport|train|travel|trip|tour|visa/.test(text)) return 'travel';
  if (/uber|ola|cab|taxi|auto|metro|bus|fuel|petrol|diesel|parking|toll|transport/.test(text)) return 'transport';
  if (/movie|cinema|game|bowling|club|party|ticket|concert|fun|entertainment/.test(text)) return 'fun';
  if (/shopping|shop|clothes|shirt|shoes|gift|mall|purchase/.test(text)) return 'shopping';
  if (/rent|electricity|electric|wifi|internet|broadband|water|gas|bill|recharge|maintenance/.test(text)) return 'bills';
  return 'general';
};

const suggestGroupEmoji = (value: string) => {
  const name = value.trim().toLowerCase();
  if (!name) return '👥';
  if (/goa|beach|vacation|holiday|resort|sea|ocean/.test(name)) return '🏖️';
  if (/trip|travel|flight|airport|tour/.test(name)) return '✈️';
  if (/flat|home|house|apartment|rent|roommate/.test(name)) return '🏠';
  if (/dinner|lunch|food|restaurant|cafe|meal|party dinner/.test(name)) return '🍽️';
  if (/birthday|party|celebration|wedding|event/.test(name)) return '🎉';
  if (/college|school|class|study|course/.test(name)) return '🎓';
  if (/car|cab|taxi|drive|road/.test(name)) return '🚗';
  if (/office|work|team|company|business/.test(name)) return '💼';
  return '👥';
};

function NewGroupSheet({ open, onClose, data, update, onCreated, onJoinGroup }: { open: boolean; onClose: () => void; data: SplitData; update: (fn: (data: SplitData) => SplitData) => void; onCreated?: (groupId: string) => void; onJoinGroup?: () => void }) {
  const [name, setName] = useState('');
  const [creatorName, setCreatorName] = useState(data.myName?.trim() ?? '');
  const [emoji, setEmoji] = useState('👥');
  const [emojiTouched, setEmojiTouched] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  const [currency, setCurrency] = useState(data.preferences?.defaultCurrency ?? '₹');
  const [people, setPeople] = useState<string[]>(['']);
  const presets = useMemo(() => {
    const stats = new Map<string, { name: string; count: number; last: number }>();
    data.groups.forEach((group) => group.members.forEach((member) => { if (member.id === memberIdFor(group, data)) return; const clean = member.name.trim(); if (!clean) return; const key = clean.toLowerCase(); const current = stats.get(key); stats.set(key, { name: clean, count: (current?.count ?? 0) + 1, last: Math.max(current?.last ?? 0, +new Date(group.createdAt)) }); }));
    return [...stats.values()].sort((a, b) => b.count - a.count || b.last - a.last).slice(0, 8).map((item) => item.name);
  }, [data.groups, data.me]);
  useEffect(() => { if (open && data.myName?.trim() && !creatorName.trim()) setCreatorName(data.myName.trim()); }, [open, data.myName, creatorName]);
  const selectedPreset = (preset: string) => people.some((person) => person.trim().toLowerCase() === preset.toLowerCase());
  const togglePreset = (preset: string) => { if (selectedPreset(preset)) setPeople(people.filter((person) => person.trim().toLowerCase() !== preset.toLowerCase()).length ? people.filter((person) => person.trim().toLowerCase() !== preset.toLowerCase()) : ['']); else { const blank = people.findIndex((person) => !person.trim()); if (blank >= 0) setPeople(people.map((person, index) => index === blank ? preset : person)); else setPeople([...people, preset]); } };
  const valid = Boolean(name.trim() && creatorName.trim() && people.some((person) => person.trim()));
  const create = () => { if (!valid) return; const groupId = uid(); const creator = creatorName.trim(); const unique = [...new Map(people.map((person) => person.trim()).filter(Boolean).map((person) => [person.toLowerCase(), person])).values()]; update((current) => ({ ...current, myName: creator, groups: [{ id: groupId, name: name.trim(), emoji, currency, createdAt: new Date().toISOString(), members: [{ id: current.me, name: creator }, ...unique.map((person) => ({ id: uid(), name: person }))] }, ...current.groups.map((group) => ({ ...group, members: group.members.map((member) => member.id === current.me && (!member.name.trim() || member.name.toLowerCase() === 'you') ? { ...member, name: creator } : member) }))] })); onClose(); setName(''); setEmoji('👥'); setEmojiTouched(false); setIconOpen(false); setPeople(['']); onCreated?.(groupId); };
  return <SheetModal open={open} onClose={onClose} title="New group" footer={<PrimaryButton onClick={create} disabled={!valid}>Create group</PrimaryButton>}>
    {onJoinGroup ? <button type="button" onClick={() => { onClose(); onJoinGroup(); }} className="press mb-4 flex min-h-12 w-full items-center gap-3 rounded-xl border border-primary/15 bg-secondary px-3 text-left"><span className="grid size-9 place-items-center rounded-xl bg-surface text-primary"><UserPlus size={17} /></span><span className="min-w-0 flex-1"><b className="block text-sm">Join a shared group</b><span className="text-[11px] text-muted-foreground">Use an invite link or code from a friend</span></span><ChevronRight size={15} className="text-primary" /></button> : null}
    <Field label="Group name"><input value={name} onChange={(event) => { const next = event.target.value; setName(next); if (!emojiTouched) setEmoji(suggestGroupEmoji(next)); }} placeholder="Trip, apartment, dinner crew…" className={inputClass} /></Field>
    <Field label="Your name"><input value={creatorName} onChange={(event) => setCreatorName(event.target.value)} placeholder="Your name" className={inputClass} /></Field>
    <div className="mb-4 grid grid-cols-[minmax(0,1fr)_112px] gap-2"><button type="button" onClick={() => setIconOpen((value) => !value)} className="press flex min-h-12 items-center gap-3 rounded-xl border border-border bg-surface-2 px-3 text-left"><span className="text-2xl">{emoji}</span><span className="min-w-0 flex-1"><b className="block text-xs">Group icon</b><span className="block truncate text-[11px] text-muted-foreground">Auto-selected · Change</span></span></button><div><label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Currency</label><select value={currency} onChange={(event) => setCurrency(event.target.value)} className={`${inputClass} py-2.5 text-sm`}>{CURRENCIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div></div>
    {iconOpen ? <div className="mb-4 rounded-xl border border-border bg-surface-2 p-3"><p className="mb-2 text-[11px] text-muted-foreground">Choose a different icon</p><div className="flex flex-wrap gap-2">{EMOJIS.map((item) => <button key={item} type="button" onClick={() => { setEmoji(item); setEmojiTouched(true); setIconOpen(false); }} className={`emoji-choice press grid size-10 place-items-center rounded-xl border text-lg ${emoji === item ? 'is-selected border-primary bg-secondary' : 'border-border bg-surface'}`}>{item}</button>)}</div></div> : null}
    {presets.length ? <Field label="Frequently added"><div className="flex flex-wrap gap-2">{presets.map((preset) => <button type="button" key={preset} onClick={() => togglePreset(preset)} className={`press rounded-full border px-3 py-2 text-xs font-bold ${selectedPreset(preset) ? 'border-primary bg-secondary text-primary' : 'border-border bg-surface-2 text-muted-foreground'}`}>{selectedPreset(preset) ? '✓ ' : '+ '}{preset}</button>)}</div></Field> : null}
    <Field label="Other people"><div className="space-y-2">{people.map((person, index) => <div key={index} className="flex items-center gap-2"><input value={person} onChange={(event) => setPeople(people.map((item, personIndex) => personIndex === index ? event.target.value : item))} placeholder={`Person ${index + 1}`} className={inputClass} />{people.length > 1 ? <button type="button" onClick={() => setPeople(people.filter((_, personIndex) => personIndex !== index))} className="press grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"><X size={15} /></button> : null}</div>)}<button type="button" onClick={() => setPeople([...people, ''])} className="press min-h-10 px-1 text-sm font-bold text-primary">+ Add another person</button></div></Field>
  </SheetModal>;
}

function SettleSheet({ open, onClose, group, balances, data, update }: { open: boolean; onClose: () => void; group: Group; balances: Record<string, number>; data: SplitData; update: (fn: (data: SplitData) => SplitData) => void }) {
  const debts = simplify(balances);
  const nameOf = (id: string) => displayName(group, data, id);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [paymentMode, setPaymentMode] = useState<'full' | 'partial'>('full');
  const [partialAmount, setPartialAmount] = useState('');
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  useEffect(() => { if (selectedDebt) { setPaymentMode('full'); setPartialAmount(''); } }, [selectedDebt?.from, selectedDebt?.to, selectedDebt?.amount]);
  const partialValue = selectedDebt ? Math.min(selectedDebt.amount, Math.max(0, Number(partialAmount) || 0)) : 0;
  const rawDebts = data.expenses.filter((expense) => expense.groupId === group.id).flatMap((expense) => expenseSettlement(expense, group).map((debt) => ({ ...debt, expense })));
  const recorded = data.settlements.filter((settlement) => settlement.groupId === group.id).sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const savePayment = () => {
    if (!selectedDebt) return;
    const amount = paymentMode === 'full' ? selectedDebt.amount : partialValue;
    if (amount <= 0) return;
    const settlement = { id: uid(), groupId: group.id, from: selectedDebt.from, to: selectedDebt.to, amount, date: new Date().toISOString() };
    update((current) => {
      const next = { ...current, settlements: [settlement, ...current.settlements] };
      return group.sharedId ? next : withLocalActivity(next, { groupId: group.id, actorName: current.myName?.trim() || nameOf(memberIdFor(group, current)), eventType: 'payment_recorded', entityType: 'payment', entityId: settlement.id, data: { after: settlement } });
    });
    setSelectedDebt(null);
  };
  return <><SheetModal open={open} onClose={onClose} title="Settle up" footer={<PrimaryButton onClick={onClose}>Done</PrimaryButton>}>{debts.length === 0 ? <div className="celebration relative overflow-hidden rounded-3xl bg-secondary p-7 text-center"><ExpenseConfetti strong /><div className="success-check mx-auto grid size-16 place-items-center rounded-full bg-primary text-primary-foreground"><Check size={30} strokeWidth={3} /></div><p className="mt-3 text-xl font-extrabold">All settled up</p><p className="mt-1 text-xs text-muted-foreground">Nothing is owed right now.</p></div> : <><div className="rounded-2xl bg-secondary px-3.5 py-3"><div className="flex items-start gap-2"><span className="mt-0.5 text-sm">↔</span><p className="text-[11px] leading-5 text-secondary-foreground"><b>Simplified settlement.</b> Splitzap nets debts across the whole group to reduce the number of payments. You may be asked to pay someone different from the person who originally covered a specific expense.</p></div></div><div className="mt-3 space-y-2">{debts.map((debt) => <div key={`${debt.from}-${debt.to}`} className="settle-row flex items-center gap-3 rounded-2xl border border-border bg-surface p-3"><Avatar name={nameOf(debt.from)} size={32} /><ArrowRight size={16} className="text-muted-foreground" /><Avatar name={nameOf(debt.to)} size={32} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{nameOf(debt.from)} → {nameOf(debt.to)}</p><p className="tabular text-sm font-bold text-primary">{money(debt.amount, group.currency)}</p></div><button type="button" onClick={() => setSelectedDebt(debt)} className="press rounded-full bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Mark paid</button></div>)}</div><button type="button" onClick={() => setBreakdownOpen((value) => !value)} className="press mt-3 flex w-full items-center gap-2 rounded-xl bg-surface-2 px-3 py-3 text-left"><span className="min-w-0 flex-1"><b className="block text-xs">Original breakdown</b><span className="mt-0.5 block text-[10px] text-muted-foreground">See who originally owed whom before simplification</span></span><ChevronDown size={16} className={`transition-transform ${breakdownOpen ? 'rotate-180' : ''}`} /></button>{breakdownOpen ? <div className="mt-2 overflow-hidden rounded-2xl border border-border bg-surface"><div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Expense obligations</div>{rawDebts.length ? rawDebts.map(({ expense, ...debt }, index) => <div key={`${expense.id}-${debt.from}-${debt.to}-${index}`} className="flex items-center gap-2 border-t border-border px-3 py-3"><span className="min-w-0 flex-1"><b className="block truncate text-xs">{nameOf(debt.from)} → {nameOf(debt.to)}</b><span className="block truncate text-[10px] text-muted-foreground">{expense.description}</span></span><span className="tabular shrink-0 text-xs font-extrabold">{money(debt.amount, group.currency)}</span></div>) : <div className="border-t border-border px-3 py-3 text-xs text-muted-foreground">No original obligations.</div>}{recorded.length ? <><div className="border-t border-border px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Payments already recorded</div>{recorded.map((payment) => <div key={payment.id} className="flex items-center gap-2 border-t border-border px-3 py-3"><span className="min-w-0 flex-1 text-xs font-semibold">{nameOf(payment.from)} → {nameOf(payment.to)}</span><span className="tabular text-xs font-extrabold">{money(payment.amount, group.currency)}</span></div>)}</> : null}</div> : null}</>}</SheetModal><CompactDialog open={!!selectedDebt} onClose={() => setSelectedDebt(null)} title="Record payment" footer={<PrimaryButton onClick={savePayment} disabled={!selectedDebt || (paymentMode === 'partial' && partialValue <= 0)}>Save payment</PrimaryButton>}>{selectedDebt ? <><div className="rounded-2xl bg-surface-2 p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Amount due</p><p className="mt-1 text-2xl font-extrabold">{money(selectedDebt.amount, group.currency)}</p><p className="mt-1 text-xs text-muted-foreground">{nameOf(selectedDebt.from)} → {nameOf(selectedDebt.to)}</p></div><div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1"><button type="button" onClick={() => setPaymentMode('full')} className={`press rounded-xl py-2.5 text-xs font-bold ${paymentMode === 'full' ? 'bg-surface text-primary shadow-sm' : 'text-muted-foreground'}`}>Full payment</button><button type="button" onClick={() => setPaymentMode('partial')} className={`press rounded-xl py-2.5 text-xs font-bold ${paymentMode === 'partial' ? 'bg-surface text-primary shadow-sm' : 'text-muted-foreground'}`}>Partial payment</button></div>{paymentMode === 'partial' ? <div className="mt-3"><Field label="Amount paid" compact><input value={partialAmount} onChange={(event) => { const raw = event.target.value.replace(/[^0-9.]/g, ''); const next = Math.min(selectedDebt.amount, Math.max(0, Number(raw) || 0)); setPartialAmount(raw === '' ? '' : String(next)); }} inputMode="decimal" placeholder="0" className={`${inputClass} tabular text-right font-bold`} /></Field><div className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2 text-xs"><span className="font-semibold text-muted-foreground">Remaining after payment</span><span className="font-extrabold text-primary">{money(Math.max(0, selectedDebt.amount - partialValue), group.currency)}</span></div></div> : <p className="mt-3 text-xs text-muted-foreground">This records the full outstanding amount as paid.</p>}</> : null}</CompactDialog></>;
}

function buildExpenseShareMessage(expense: Expense, group: Group, data: SplitData) {
  const debts = expenseSettlement(expense, group);
  const settlementLines = debts.length ? debts.map((debt) => `• ${displayName(group, data, debt.from)} → ${displayName(group, data, debt.to)}: *${shareMoney(debt.amount, group.currency)}*`) : ['• Everyone is settled'];
  const detailLines = group.members.flatMap((member) => { const person = displayName(group, data, member.id); const label = expense.mode === 'exact' ? expense.splitLabels?.[member.id]?.trim() : ''; const items = (expense.personalItems ?? []).filter((item) => item.memberId === member.id); return [...(label ? [`• ${person}: ${label}`] : []), ...items.map((item) => `• ${person}: ${item.description} — ${shareMoney(item.amount, group.currency)}`)]; });
  const chargeLine = (expense.additionalCharges ?? []).filter((charge) => charge.amount > 0).map((charge) => `${charge.description} ${shareMoney(charge.amount, group.currency)}`).join(' · ');
  const receiptLines = (expense.receiptItems ?? []).map((item) => `• ${item.description} — ${shareMoney(item.amount, group.currency)}${item.memberId ? ` · ${displayName(group, data, item.memberId)}` : ' · Shared'}`);
  const lines = ['*💸 Splitzap*', `*${expense.description} · ${shareMoney(expense.amount, group.currency)}*`];
  if (chargeLine) lines.push(`*Additional charges:* ${chargeLine}`);
  lines.push(`Paid by: ${payerSummary(expense, group, data, true)}`);
  if (receiptLines.length) lines.push('', '*Bill items*', ...receiptLines);
  lines.push('', '*Settlement*', ...settlementLines);
  if (detailLines.length) lines.push('', '*Details*', ...detailLines);
  return lines.join('\n');
}

function buildGroupShareMessage(group: Group, data: SplitData) {
  const expenses = data.expenses.filter((expense) => expense.groupId === group.id).sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const debts = simplify(groupBalances(group, data.expenses, data.settlements));
  const settlementLines = debts.length ? debts.map((debt) => `• ${displayName(group, data, debt.from)} → ${displayName(group, data, debt.to)}: *${shareMoney(debt.amount, group.currency)}*`) : ['• Everyone is settled'];
  const expenseLines = expenses.length ? expenses.flatMap((expense, index) => [
    `${index + 1}. *${expense.description}* — ${shareMoney(expense.amount, group.currency)}`,
    `   Paid by: ${payerSummary(expense, group, data, true)}`,
  ]) : ['• No expenses yet'];
  return [
    '*💸 Splitzap*',
    `*${group.emoji} ${group.name}*`,
    `Total spent: *${shareMoney(total, group.currency)}*`,
    `${group.members.length} people · ${expenses.length} ${expenses.length === 1 ? 'expense' : 'expenses'}`,
    '',
    '*Expenses*',
    ...expenseLines,
    '',
    '*Settlement*',
    ...settlementLines,
  ].join('\n');
}
