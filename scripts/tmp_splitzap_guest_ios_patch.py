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
payment_path = 'src/features/splitzap/splitzapPaymentSafety.ts'
test_path = 'src/features/splitzap/splitzapSyncSafety.test.ts'
css_path = 'src/features/splitzap/splitzap.css'

app = read(app_path)
receipt_start = app.index('function ReceiptScanner(')
receipt_end = app.index('function PersonalItemsDialog', receipt_start)
receipt_before = app[receipt_start:receipt_end]

# 1) Escape the Splitzap shell stacking context: all app dialogs render at document.body.
app = replace_once(
    app,
    "import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';\n",
    "import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';\nimport { createPortal } from 'react-dom';\n",
    'react portal import',
)
app = replace_once(
    app,
    "import { isValidUpiId, normalizeUpiId, settlementAuthority, upiIdFromQrValue } from './splitzapPaymentSafety';\n",
    "import { isValidUpiId, normalizeUpiId, settlementAuthority } from './splitzapPaymentSafety';\n",
    'remove QR helper import',
)

old_sheet = '''function SheetModal({ open, onClose, title, children, footer, tall = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; tall?: boolean }) {
  const titleId = useId();
  const panelRef = useDialogAccessibility(open, onClose);
  if (!open) return null;
  return <div className="sheet-wrap fixed inset-0 z-50 flex items-end justify-center"><button type="button" aria-label="Close dialog" onClick={onClose} className="sheet-backdrop absolute inset-0 bg-foreground/40 backdrop-blur-[2px]" /><div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`sheet-panel relative flex w-full max-w-[520px] flex-col rounded-t-[28px] bg-surface outline-none ${tall ? 'sheet-panel--tall' : ''}`}><div className="sheet-handle mx-auto mt-2 h-1 w-10 rounded-full bg-border" /><div className="flex items-center justify-between px-5 pb-2 pt-3"><h2 id={titleId} className="text-lg font-extrabold">{title}</h2><button type="button" onClick={onClose} aria-label="Close" className="press grid size-10 place-items-center rounded-full bg-muted text-muted-foreground"><X size={16} /></button></div><div className="sheet-scroll min-h-0 flex-1 px-5 pb-4">{children}</div>{footer ? <div className="sheet-footer border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div> : null}</div></div>;
}
'''
new_sheet = '''function SheetModal({ open, onClose, title, children, footer, tall = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; tall?: boolean }) {
  const titleId = useId();
  const panelRef = useDialogAccessibility(open, onClose);
  if (!open || typeof document === 'undefined') return null;
  return createPortal(<div className="sheet-wrap fixed inset-0 z-[220] flex items-end justify-center"><button type="button" aria-label="Close dialog" onClick={onClose} className="sheet-backdrop absolute inset-0 bg-foreground/40 backdrop-blur-[2px]" /><div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`sheet-panel relative flex w-full max-w-[520px] flex-col rounded-t-[28px] bg-surface outline-none ${tall ? 'sheet-panel--tall' : ''}`}><div className="sheet-handle mx-auto mt-2 h-1 w-10 rounded-full bg-border" /><div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-3"><h2 id={titleId} className="text-lg font-extrabold">{title}</h2><button type="button" onClick={onClose} aria-label="Close" className="press grid size-10 place-items-center rounded-full bg-muted text-muted-foreground"><X size={16} /></button></div><div className="sheet-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>{footer ? <div className="sheet-footer sticky bottom-0 z-10 shrink-0 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div> : null}</div></div>, document.body);
}
'''
app = replace_once(app, old_sheet, new_sheet, 'portal SheetModal')

old_compact = '''function CompactDialog({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const titleId = useId();
  const panelRef = useDialogAccessibility(open, onClose);
  if (!open) return null;
  return <div className="fixed inset-0 z-[90] grid place-items-center px-5"><button type="button" aria-label="Close dialog" onClick={onClose} className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]" /><div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="relative w-full max-w-[400px] rounded-3xl bg-surface p-4 shadow-2xl outline-none"><div className="mb-3 flex items-center justify-between"><h2 id={titleId} className="text-base font-extrabold">{title}</h2><button type="button" aria-label="Close" onClick={onClose} className="press grid size-10 place-items-center rounded-full bg-surface-2 text-muted-foreground"><X size={14} /></button></div>{children}{footer ? <div className="mt-4">{footer}</div> : null}</div></div>;
}
'''
new_compact = '''function CompactDialog({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const titleId = useId();
  const panelRef = useDialogAccessibility(open, onClose);
  if (!open || typeof document === 'undefined') return null;
  return createPortal(<div className="fixed inset-0 z-[230] grid place-items-center overflow-y-auto px-5 py-[max(1rem,env(safe-area-inset-top))]"><button type="button" aria-label="Close dialog" onClick={onClose} className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]" /><div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="relative max-h-[calc(100svh-2rem)] w-full max-w-[400px] overflow-y-auto rounded-3xl bg-surface p-4 shadow-2xl outline-none"><div className="mb-3 flex items-center justify-between"><h2 id={titleId} className="text-base font-extrabold">{title}</h2><button type="button" aria-label="Close" onClick={onClose} className="press grid size-10 place-items-center rounded-full bg-surface-2 text-muted-foreground"><X size={14} /></button></div>{children}{footer ? <div className="sticky bottom-0 z-10 mt-4 bg-surface pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-2">{footer}</div> : null}</div></div>, document.body);
}
'''
app = replace_once(app, old_compact, new_compact, 'portal CompactDialog')

# 2) Persist the whole settlement context, not just an already-launched UPI attempt.
settle_helpers = r'''

type PendingSettlementSession = {
  groupId: string;
  from?: string;
  to?: string;
  paymentMode: 'full' | 'partial';
  partialAmount: string;
  note: string;
  updatedAt: string;
};

const SETTLEMENT_SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const settlementSessionKey = (userId: string) => `splitzap.settlementSession.${userId}`;

function readPendingSettlementSession(userId: string): PendingSettlementSession | null {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(settlementSessionKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingSettlementSession;
    const updated = +new Date(parsed.updatedAt);
    if (!parsed.groupId || !Number.isFinite(updated) || Date.now() - updated > SETTLEMENT_SESSION_MAX_AGE_MS) {
      window.localStorage.removeItem(settlementSessionKey(userId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function savePendingSettlementSession(userId: string, session: Omit<PendingSettlementSession, 'updatedAt'>) {
  if (!userId || typeof window === 'undefined') return;
  try { window.localStorage.setItem(settlementSessionKey(userId), JSON.stringify({ ...session, updatedAt: new Date().toISOString() })); } catch { /* best effort */ }
}

function clearPendingSettlementSession(userId: string) {
  if (!userId || typeof window === 'undefined') return;
  try { window.localStorage.removeItem(settlementSessionKey(userId)); } catch { /* best effort */ }
}
'''
app = replace_once(
    app,
    "function clearPendingUpiAttempt(userId: string) {\n  if (!userId || typeof window === 'undefined') return;\n  try { window.localStorage.removeItem(pendingUpiKey(userId)); } catch { /* best effort */ }\n}\n",
    "function clearPendingUpiAttempt(userId: string) {\n  if (!userId || typeof window === 'undefined') return;\n  try { window.localStorage.removeItem(pendingUpiKey(userId)); } catch { /* best effort */ }\n}\n" + settle_helpers,
    'settlement session helpers',
)

old_resume = '''  useEffect(() => {
    if (!rootData.me || pendingResumeChecked.current === rootData.me) return;
    const pending = readPendingUpiAttempt(rootData.me);
    if (!pending) { pendingResumeChecked.current = rootData.me; return; }
    const group = rootData.groups.find((item) => item.id === pending.groupId);
    if (!group) return;
    pendingResumeChecked.current = rootData.me;
    setResumeSettlementGroupId(group.id);
    const next: View = { name: 'group', groupId: group.id };
    window.history.replaceState({}, '', `/splitzap#group=${encodeURIComponent(group.id)}`);
    setView(next);
  }, [rootData.me, rootData.groups]);
'''
new_resume = '''  useEffect(() => {
    if (!rootData.me || pendingResumeChecked.current === rootData.me) return;
    const pendingUpi = readPendingUpiAttempt(rootData.me);
    const pendingSettlement = readPendingSettlementSession(rootData.me);
    const groupId = pendingUpi?.groupId ?? pendingSettlement?.groupId;
    if (!groupId) { pendingResumeChecked.current = rootData.me; return; }
    const group = rootData.groups.find((item) => item.id === groupId);
    if (!group) return;
    pendingResumeChecked.current = rootData.me;
    setResumeSettlementGroupId(group.id);
    const next: View = { name: 'group', groupId: group.id };
    window.history.replaceState({}, '', `/splitzap#group=${encodeURIComponent(group.id)}`);
    setView(next);
  }, [rootData.me, rootData.groups]);
'''
app = replace_once(app, old_resume, new_resume, 'root settlement resume')

# Work only inside SettleSheet to avoid touching unrelated dialogs.
settle_start = app.index('function SettleSheet(')
settle_end = app.index('function buildExpenseShareMessage', settle_start)
settle = app[settle_start:settle_end]

settle = replace_once(
    settle,
    "  const undoTimer = useRef<number | null>(null);\n",
    "  const undoTimer = useRef<number | null>(null);\n  const skipSettlementPersist = useRef(false);\n",
    'settlement persist ref',
)

old_restore = '''  useEffect(() => {
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
'''
new_restore = '''  useEffect(() => {
    if (!open) return;
    const pendingUpi = readPendingUpiAttempt(data.me);
    const pendingSettlement = readPendingSettlementSession(data.me);
    const pending = pendingUpi?.groupId === group.id ? pendingUpi : pendingSettlement?.groupId === group.id ? pendingSettlement : null;
    if (!pending) return;
    skipSettlementPersist.current = true;
    const matching = pending.from && pending.to ? [...debts, ...receivable].find((debt) => debt.from === pending.from && debt.to === pending.to) : null;
    if (matching) setSelectedDebt(matching);
    setPaymentMode(pending.paymentMode);
    setPartialAmount(pending.partialAmount);
    setNote(pending.note);
    setUpiAttempted(Boolean(pendingUpi && pendingUpi.groupId === group.id));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, group.id, data.me]);

  useEffect(() => {
    if (!open) return;
    if (skipSettlementPersist.current) { skipSettlementPersist.current = false; return; }
    savePendingSettlementSession(data.me, {
      groupId: group.id,
      from: selectedDebt?.from,
      to: selectedDebt?.to,
      paymentMode,
      partialAmount,
      note,
    });
  }, [open, data.me, group.id, selectedDebt?.from, selectedDebt?.to, paymentMode, partialAmount, note]);
'''
settle = replace_once(settle, old_restore, new_restore, 'restore settlement session')

old_reset = '''    const pending = readPendingUpiAttempt(data.me);
    const restoring = pending && pending.groupId === group.id && pending.from === selectedDebt.from && pending.to === selectedDebt.to;
    if (restoring) return;
'''
new_reset = '''    const pendingUpi = readPendingUpiAttempt(data.me);
    const pendingSettlement = readPendingSettlementSession(data.me);
    const restoring = (pendingUpi && pendingUpi.groupId === group.id && pendingUpi.from === selectedDebt.from && pendingUpi.to === selectedDebt.to)
      || (pendingSettlement && pendingSettlement.groupId === group.id && pendingSettlement.from === selectedDebt.from && pendingSettlement.to === selectedDebt.to);
    if (restoring) return;
'''
settle = replace_once(settle, old_reset, new_reset, 'preserve restored settlement fields')

settle = replace_once(
    settle,
    "    clearPendingUpiAttempt(data.me);\n    setSelectedDebt(null);\n",
    "    clearPendingUpiAttempt(data.me);\n    clearPendingSettlementSession(data.me);\n    setSelectedDebt(null);\n",
    'clear settled session after record',
)

settle = replace_once(
    settle,
    "    savePendingUpiAttempt(data.me, { groupId: group.id, from: selectedDebt.from, to: selectedDebt.to, amount: paymentAmount, paymentMode, partialAmount, note, createdAt: new Date().toISOString() });\n    setUpiAttempted(true);\n",
    "    savePendingSettlementSession(data.me, { groupId: group.id, from: selectedDebt.from, to: selectedDebt.to, paymentMode, partialAmount, note });\n    savePendingUpiAttempt(data.me, { groupId: group.id, from: selectedDebt.from, to: selectedDebt.to, amount: paymentAmount, paymentMode, partialAmount, note, createdAt: new Date().toISOString() });\n    setUpiAttempted(true);\n",
    'persist UPI settlement context',
)

# Remove QR scanning implementation completely.
settle = sub_once(
    settle,
    r"\n  const scanUpiQr = async \(file: File \| null\) => \{.*?\n  \};\n\n  return <>",
    "\n\n  const closeSettle = () => {\n    clearPendingSettlementSession(data.me);\n    clearPendingUpiAttempt(data.me);\n    setUpiAttempted(false);\n    onClose();\n  };\n\n  return <>",
    'remove QR scanner and add close handler',
)

settle = replace_once(
    settle,
    '<SheetModal open={open} onClose={onClose} title="Settle up" footer={<PrimaryButton onClick={onClose}>Done</PrimaryButton>}>',
    '<SheetModal open={open} onClose={closeSettle} title="Settle up" footer={<PrimaryButton onClick={closeSettle}>Done</PrimaryButton>}>',
    'clear session on deliberate settle close',
)

old_manual = '''{nameOf(selectedDebt.to)} has not shared a UPI ID. You can still enter one for this payment or scan their UPI QR.</p><input value={manualUpiId} onChange={(event) => setManualUpiId(normalizeUpiId(event.target.value))} autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="email" placeholder="name@bank" className={`${inputClass} mt-2`} /><div className="mt-2 grid grid-cols-2 gap-2"><label className="press flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-surface py-2.5 text-[10px] font-bold text-primary"><Camera size={13} /> Scan UPI QR<input type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { void scanUpiQr(event.target.files?.[0] ?? null); event.currentTarget.value = ''; }} /></label><button type="button" disabled={!isValidUpiId(manualUpiId) || paymentAmount <= 0} onClick={launchUpi} className="press rounded-xl bg-primary py-2.5 text-[10px] font-bold text-primary-foreground disabled:opacity-40">Pay via UPI</button></div></div>}'''
new_manual = '''{nameOf(selectedDebt.to)} has not shared a UPI ID. Enter their UPI ID for this payment.</p><input value={manualUpiId} onChange={(event) => setManualUpiId(normalizeUpiId(event.target.value))} autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="email" placeholder="name@bank" className={`${inputClass} mt-2`} /><button type="button" disabled={!isValidUpiId(manualUpiId) || paymentAmount <= 0} onClick={launchUpi} className="press mt-2 w-full rounded-xl bg-primary py-2.5 text-[10px] font-bold text-primary-foreground disabled:opacity-40">Pay via UPI</button></div>}'''
settle = replace_once(settle, old_manual, new_manual, 'remove QR UI')

app = app[:settle_start] + settle + app[settle_end:]

if 'Scan UPI QR' in app or 'BarcodeDetector' in app or 'upiIdFromQrValue' in app:
    raise RuntimeError('QR scanning residue remained in SplitzapAppV4')

receipt_start_after = app.index('function ReceiptScanner(')
receipt_end_after = app.index('function PersonalItemsDialog', receipt_start_after)
if app[receipt_start_after:receipt_end_after] != receipt_before:
    raise RuntimeError('Receipt scanner changed unexpectedly; aborting patch')
write(app_path, app)

# 3) Remove the now-unused QR parser helper.
payment = read(payment_path)
payment = sub_once(
    payment,
    r"\nexport function upiIdFromQrValue\(rawValue: string\) \{.*?\n\}\n",
    "\n",
    'remove QR payment helper',
)
write(payment_path, payment)

# 4) Update tests to keep manual UPI validation while removing QR-only expectations.
tests = read(test_path)
tests = replace_once(
    tests,
    "import { isValidUpiId, settlementAuthority, upiIdFromQrValue } from './splitzapPaymentSafety';\n",
    "import { isValidUpiId, settlementAuthority } from './splitzapPaymentSafety';\n",
    'remove QR test import',
)
old_test = '''  it('accepts manual UPI IDs and extracts the payee from a UPI QR payload', () => {
    expect(isValidUpiId('Akash.Test@Bank')).toBe(true);
    expect(upiIdFromQrValue('upi://pay?pa=akash.test%40bank&pn=Akash')).toBe('akash.test@bank');
    expect(upiIdFromQrValue('https://example.com/qr')).toBeNull();
  });
'''
new_test = '''  it('accepts valid manual UPI IDs and rejects malformed values', () => {
    expect(isValidUpiId('Akash.Test@Bank')).toBe(true);
    expect(isValidUpiId('not-a-upi-id')).toBe(false);
    expect(isValidUpiId('')).toBe(false);
  });
'''
tests = replace_once(tests, old_test, new_test, 'manual UPI regression test')
write(test_path, tests)

# 5) Guest mode: isolated local data, explicit limitations, free sign-in CTA, red profile warning.
cloud = read(cloud_path)
cloud = replace_once(
    cloud,
    "const SHARED_CONFIRMED_PREFIX = 'splitzap.shared.confirmed.';\n",
    "const SHARED_CONFIRMED_PREFIX = 'splitzap.shared.confirmed.';\nconst GUEST_MODE_KEY = 'splitzap.guestMode';\nconst GUEST_DATA_KEY = 'splitzap.guest.data.v1';\n",
    'guest storage constants',
)

guest_helpers = r'''
function freshGuestData(): SplitData {
  return {
    schemaVersion: SPLITZAP_SCHEMA_VERSION,
    me: `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    myName: '',
    groups: [],
    expenses: [],
    settlements: [],
    history: [],
    activity: [],
    preferences: { defaultCurrency: '₹', theme: 'system', reducedMotion: false },
  };
}

function loadGuestData(): SplitData | null {
  try {
    const raw = window.localStorage.getItem(GUEST_DATA_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SplitData;
    if (!parsed || typeof parsed.me !== 'string' || !parsed.me.startsWith('guest-') || !Array.isArray(parsed.groups) || !Array.isArray(parsed.expenses) || !Array.isArray(parsed.settlements)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistGuestData(data: SplitData) {
  try { window.localStorage.setItem(GUEST_DATA_KEY, JSON.stringify(data)); } catch { /* best effort */ }
}
'''
cloud = replace_once(
    cloud,
    "const dataHash = (data: SplitData) => JSON.stringify(data);\n",
    "const dataHash = (data: SplitData) => JSON.stringify(data);\n" + guest_helpers,
    'guest storage helpers',
)

cloud = replace_once(
    cloud,
    "  const [session, setSession] = useState<SplitzapSession | null>(null);\n  const [authReady, setAuthReady] = useState(false);\n",
    "  const [session, setSession] = useState<SplitzapSession | null>(null);\n  const [authReady, setAuthReady] = useState(false);\n  const [guestMode, setGuestMode] = useState(() => typeof window !== 'undefined' && safeGet(GUEST_MODE_KEY) === '1');\n",
    'guest mode state',
)

cloud = replace_once(
    cloud,
    "      setSession(next);\n      if (next && initializedUser.current === next.user.id && event !== 'PASSWORD_RECOVERY') {\n",
    "      setSession(next);\n      if (next) {\n        setGuestMode(false);\n        try { window.localStorage.removeItem(GUEST_MODE_KEY); } catch { /* best effort */ }\n      }\n      if (next && initializedUser.current === next.user.id && event !== 'PASSWORD_RECOVERY') {\n",
    'leave guest when authenticated',
)

# Guest snapshot must stay isolated from signed-in local state.
cloud = replace_once(
    cloud,
    "  useEffect(() => {\n    const theme = profile?.theme ?? data.preferences?.theme ?? 'system';\n",
    "  useEffect(() => {\n    if (!authReady || session || !guestMode) return;\n    persistGuestData(data);\n  }, [authReady, data, guestMode, session]);\n\n  useEffect(() => {\n    const theme = profile?.theme ?? data.preferences?.theme ?? 'system';\n",
    'persist isolated guest snapshot',
)

# Add guest actions immediately before the existing status/account-action definitions.
guest_actions = r'''
  const continueAsGuest = () => {
    const guest = loadGuestData() ?? freshGuestData();
    update(() => guest);
    setGuestMode(true);
    setAccountOpen(false);
    setStatus('local');
    setStatusMessage('Guest · this device only');
    try { window.localStorage.setItem(GUEST_MODE_KEY, '1'); } catch { /* best effort */ }
  };

  const leaveGuestMode = () => {
    persistGuestData(latestData.current);
    setGuestMode(false);
    setAccountOpen(false);
    try { window.localStorage.removeItem(GUEST_MODE_KEY); } catch { /* best effort */ }
  };

  const guestCollaboration = {
    signedIn: false,
    activity: [],
    pendingRequests: [],
    memberships: [],
    onInviteGroup: () => setAccountOpen(true),
    onManageMembers: () => setAccountOpen(true),
    onJoinGroup: () => setAccountOpen(true),
    onDeleteGroup: removeGroup,
    onArchiveGroup: archiveGroup,
  };

  const guestAccountAction = <button type="button" onClick={() => setAccountOpen(true)} aria-label="Guest mode · sign in to sync" title="Guest mode · sign in to sync" className="press relative grid size-9 place-items-center rounded-full border border-red-200 bg-red-50 text-red-700 shadow-sm"><span className="text-[10px] font-extrabold">GUEST</span><span aria-hidden="true" className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full border-2 border-white bg-red-500 text-[8px] font-black text-white">!</span></button>;
'''
cloud = replace_once(
    cloud,
    "  const indicatorClass = status === 'error' ? 'bg-red-500' : 'bg-amber-400';\n",
    guest_actions + "\n  const indicatorClass = status === 'error' ? 'bg-red-500' : 'bg-amber-400';\n",
    'guest actions',
)

old_signed_out = '''  if (!session) {
    return <AccountSheet open locked onClose={() => undefined} session={null} status={status} statusMessage={statusMessage} lastSyncedAt={lastSyncedAt} recoveryMode={false} onRecoveryComplete={() => undefined} />;
  }
'''
new_signed_out = '''  if (!session && !guestMode) {
    return <AccountSheet open locked onClose={() => undefined} session={null} status={status} statusMessage={statusMessage} lastSyncedAt={lastSyncedAt} recoveryMode={false} onRecoveryComplete={() => undefined} onContinueAsGuest={continueAsGuest} />;
  }
  if (!session && guestMode) {
    if (!hydrated) return <div className="fixed inset-0 z-[120] grid place-items-center bg-[#fbfaf6] text-slate-900"><Loader2 size={22} className="animate-spin text-[#256f66]" /></div>;
    if (!data.myName?.trim()) return <GuestFirstRunSetup data={data} update={update} onSignIn={leaveGuestMode} />;
    return <>
      <SplitzapAppV4 accountAction={guestAccountAction} collaboration={guestCollaboration} />
      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} session={null} status="local" statusMessage="Guest · this device only" lastSyncedAt={null} recoveryMode={false} onRecoveryComplete={() => undefined} guestMode />
    </>;
  }
'''
cloud = replace_once(cloud, old_signed_out, new_signed_out, 'guest signed-out route')

# Insert guest first-run name setup before the signed-in profile setup.
guest_setup = r'''
function GuestFirstRunSetup({ data, update, onSignIn }: {
  data: SplitData;
  update: (fn: (data: SplitData) => SplitData) => void;
  onSignIn: () => void;
}) {
  const [name, setName] = useState(data.myName || '');
  const [error, setError] = useState('');
  const save = () => {
    const clean = name.trim();
    if (!clean) { setError('Enter the name people in your expenses should see.'); return; }
    update((current) => ({ ...current, myName: clean, groups: current.groups.map((group) => { const id = memberIdFor(group, current); return { ...group, members: group.members.map((member) => member.id === id ? { ...member, name: clean } : member) }; }) }));
  };
  return <div className="fixed inset-0 z-[135] grid place-items-center overflow-y-auto bg-[#fbfaf6] px-5 py-8 text-slate-900"><div className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-xl"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-50 text-xl font-extrabold text-red-600">G</div><h1 className="mt-4 text-center text-xl font-extrabold">Use Splitzap without login</h1><p className="mt-1 text-center text-xs leading-5 text-slate-500">You can create groups and split expenses on this device right away.</p><div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-3 py-3 text-[11px] leading-5 text-red-700"><b className="block">Guest mode is local only</b>Your data is not backed up or synced. You cannot join or live-share groups with friends. Sign in free anytime for cloud sync and sharing.</div><label className="mt-5 block text-xs font-bold text-slate-600">What should people call you?</label><input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Your name" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-[#256f66]" /><button type="button" disabled={!name.trim()} onClick={save} className="mt-3 w-full rounded-xl bg-[#256f66] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">Continue locally</button>{error ? <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700">{error}</p> : null}<button type="button" onClick={onSignIn} className="mt-3 w-full rounded-xl bg-slate-100 px-4 py-3 text-xs font-bold text-slate-700">Sign in instead</button></div></div>;
}

'''
cloud = replace_once(cloud, "function FirstRunProfileSetup({ session, data, update, onReady }:", guest_setup + "function FirstRunProfileSetup({ session, data, update, onReady }:", 'guest first-run setup')

# Extend AccountSheet with a guest notice + explicit continue-without-login option.
cloud = replace_once(
    cloud,
    "function AccountSheet({ open, onClose, session, status, statusMessage, lastSyncedAt, recoveryMode, onRecoveryComplete, locked = false }: {\n",
    "function AccountSheet({ open, onClose, session, status, statusMessage, lastSyncedAt, recoveryMode, onRecoveryComplete, locked = false, guestMode = false, onContinueAsGuest }: {\n",
    'AccountSheet guest props signature',
)
cloud = replace_once(
    cloud,
    "  locked?: boolean;\n}) {\n",
    "  locked?: boolean;\n  guestMode?: boolean;\n  onContinueAsGuest?: () => void;\n}) {\n",
    'AccountSheet guest prop types',
)

cloud = replace_once(
    cloud,
    "          <div>\n            <button type=\"button\" disabled={busy} onClick={() => void runGoogle()} className=\"flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 shadow-sm disabled:opacity-50\">\n",
    "          <div>\n            {guestMode ? <div className=\"mb-3 rounded-2xl border border-red-100 bg-red-50 p-3\"><p className=\"text-xs font-extrabold text-red-700\">You are using Guest mode</p><p className=\"mt-1 text-[11px] leading-5 text-red-600\">Data is kept only on this device. Sign in free to back it up, sync across devices, and join or live-share groups with friends.</p></div> : null}\n            <button type=\"button\" disabled={busy} onClick={() => void runGoogle()} className=\"flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 shadow-sm disabled:opacity-50\">\n",
    'guest warning in auth sheet',
)

continue_guest_ui = r'''
            {!guestMode && onContinueAsGuest ? <><div className="my-4 flex items-center gap-3"><span className="h-px flex-1 bg-slate-200" /><span className="text-[11px] font-semibold text-slate-400">or</span><span className="h-px flex-1 bg-slate-200" /></div><button type="button" onClick={onContinueAsGuest} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">Continue without login</button><p className="mt-2 text-center text-[10px] leading-4 text-slate-500">Local-only mode: no cloud backup, cross-device sync, shared-group invites or live collaboration.</p></> : null}
'''
cloud = replace_once(
    cloud,
    "            {feedback ? <p role=\"status\" className=\"mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600\">{feedback}</p> : null}\n          </div>\n        )}\n",
    "            {feedback ? <p role=\"status\" className=\"mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600\">{feedback}</p> : null}\n" + continue_guest_ui + "          </div>\n        )}\n",
    'continue guest UI',
)

for required in ['Continue without login', 'Guest mode is local only', 'splitzap.guest.data.v1', 'guestAccountAction']:
    if required not in cloud:
        raise RuntimeError(f'Guest-mode requirement missing: {required}')
write(cloud_path, cloud)

# 6) iOS/Safari sheet sizing now uses small viewport units and a portal-safe footer.
css = read(css_path)
css += r'''

/* iOS Safari bottom-sheet hardening: sheets are portaled above app navigation. */
.sheet-wrap {
  padding-top: max(0.35rem, env(safe-area-inset-top));
}

.sheet-panel {
  max-height: calc(100svh - max(0.35rem, env(safe-area-inset-top)));
}

.sheet-footer {
  position: sticky;
  bottom: 0;
  z-index: 10;
  flex: 0 0 auto;
  box-shadow: 0 -10px 24px -18px oklch(0.2 0.04 165 / 0.45);
}

@supports (-webkit-touch-callout: none) {
  .sheet-panel--tall {
    height: calc(100svh - max(0.35rem, env(safe-area-inset-top)));
    max-height: calc(100svh - max(0.35rem, env(safe-area-inset-top)));
  }
  .sheet-panel .sheet-scroll {
    min-height: 0;
    overflow-y: scroll;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y;
  }
}
'''
write(css_path, css)

print('Splitzap guest/iOS/settlement patch applied successfully.')
