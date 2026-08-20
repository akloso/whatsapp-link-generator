from pathlib import Path
import re

ROOT = Path('.')


def must_replace(text: str, old: str, new: str, label: str, count: int = 1) -> str:
    found = text.count(old)
    if found < count:
        raise RuntimeError(f'{label}: expected at least {count} occurrence(s), found {found}')
    return text.replace(old, new, count)


def must_sub(text: str, pattern: str, replacement: str, label: str, count: int = 1, flags: int = 0) -> str:
    result, changed = re.subn(pattern, replacement, text, count=count, flags=flags)
    if changed != count:
        raise RuntimeError(f'{label}: expected {count} replacement(s), got {changed}')
    return result


def transform_region(text: str, start_marker: str, end_marker: str, fn, label: str) -> str:
    start = text.find(start_marker)
    if start < 0:
        raise RuntimeError(f'{label}: start marker missing')
    end = text.find(end_marker, start)
    if end < 0:
        raise RuntimeError(f'{label}: end marker missing')
    region = text[start:end]
    changed = fn(region)
    if changed == region:
        raise RuntimeError(f'{label}: transform made no changes')
    return text[:start] + changed + text[end:]


# -----------------------------------------------------------------------------
# SplitzapCloudApp.tsx — account authority, auth gate, privacy/help, member UX
# -----------------------------------------------------------------------------
cloud_path = ROOT / 'src/features/splitzap/SplitzapCloudApp.tsx'
cloud = cloud_path.read_text()

cloud = must_replace(
    cloud,
    "import { createSplitBackup, importSplitBackupSafely, memberIdFor, useSplitData, type Group, type SplitData } from './splitStoreV4';",
    "import { SPLITZAP_SCHEMA_VERSION, createSplitBackup, importSplitBackupSafely, memberIdFor, useSplitData, type Group, type SplitData } from './splitStoreV4';",
    'import schema version',
)
cloud = must_replace(cloud, "type Conflict = { cloud: SplitData; local: SplitData } | null;\n", '', 'remove conflict type')
cloud = must_replace(
    cloud,
    "const LAST_SYNC_AT_KEY = 'splitzap.cloud.lastSyncAt';\n",
    "const LAST_SYNC_AT_KEY = 'splitzap.cloud.lastSyncAt';\nconst LAST_USER_KEY = 'splitzap.cloud.lastUserId';\n",
    'add last user key',
)
cloud = must_sub(cloud, r"\nconst hasMeaningfulData = \(data: SplitData\) => .*?;\n", "\n", 'remove legacy meaningful-data helper')
cloud = must_replace(
    cloud,
    "if (/email rate limit|over_email_send_rate_limit/i.test(message)) return \"Splitzap's temporary test email limit is reached. Use Google or try the email action later.\";",
    "if (/email rate limit|over_email_send_rate_limit/i.test(message)) return 'Too many emails have been sent recently. Please try again later or use Google sign-in.';",
    'clean email rate limit copy',
)
cloud = must_replace(
    cloud,
    "  const [migrationOpen, setMigrationOpen] = useState(false);\n  const [conflict, setConflict] = useState<Conflict>(null);\n",
    "  const [accountDataReady, setAccountDataReady] = useState(false);\n",
    'replace migration/conflict state',
)
cloud = must_replace(
    cloud,
    "      setSession(next);\n      initializedUser.current = null;",
    "      setSession(next);\n      setAccountDataReady(false);\n      initializedUser.current = null;",
    'reset account readiness on auth change',
)
cloud = must_replace(
    cloud,
    "      if (!next) { setStatus('local'); setStatusMessage('Saved on this device'); setProfileOpen(false); }",
    "      if (!next) { setStatus('local'); setStatusMessage('Signed out'); setProfileOpen(false); setAccountOpen(false); }",
    'signed out status',
)
cloud = must_replace(
    cloud,
    "  useEffect(() => {\n    if (!session) return;\n    let active = true;\n    void getSplitzapProfile()",
    "  useEffect(() => {\n    if (!session || !accountDataReady) return;\n    let active = true;\n    void getSplitzapProfile()",
    'profile waits for account data',
)
cloud = must_replace(
    cloud,
    "  }, [session, update]);\n\n  useEffect(() => {\n    const theme = profile?.theme",
    "  }, [accountDataReady, session, update]);\n\n  useEffect(() => {\n    const theme = profile?.theme",
    'profile effect dependencies',
)

initial_sync_pattern = r"  useEffect\(\(\) => \{\n    if \(!hydrated \|\| !authReady \|\| !session \|\| initializedUser\.current === session\.user\.id\) return;.*?\n  \}, \[authReady, hydrated, session, update\]\);"
initial_sync_replacement = """  useEffect(() => {
    if (!hydrated || !authReady || !session || initializedUser.current === session.user.id) return;
    let active = true;
    setAccountDataReady(false);
    setStatus('connecting');
    setStatusMessage('Loading your Splitzap…');
    void (async () => {
      try {
        const row = await fetchSplitzapCloudState(session.user.id);
        if (!active) return;
        if (row) {
          update(() => row.data);
          saveSyncMarker(row.data, row.updated_at);
          setLastSyncedAt(row.updated_at);
        } else {
          const fresh: SplitData = {
            schemaVersion: SPLITZAP_SCHEMA_VERSION,
            me: session.user.id,
            myName: '',
            groups: [],
            expenses: [],
            settlements: [],
            history: [],
            activity: [],
            preferences: { defaultCurrency: '₹', theme: 'system', reducedMotion: false },
          };
          const updatedAt = await saveSplitzapCloudState(session.user.id, fresh);
          if (!active) return;
          update(() => fresh);
          saveSyncMarker(fresh, updatedAt);
          setLastSyncedAt(updatedAt);
        }
        try { window.localStorage.setItem(LAST_USER_KEY, session.user.id); } catch { /* best effort */ }
        initializedUser.current = session.user.id;
        setStatus('synced');
        setStatusMessage('Synced');
        setAccountDataReady(true);
      } catch (cause) {
        if (!active) return;
        const sameCachedUser = !navigator.onLine && safeGet(LAST_USER_KEY) === session.user.id;
        if (sameCachedUser) {
          initializedUser.current = session.user.id;
          setStatus('offline');
          setStatusMessage('Offline · changes saved on this device');
          setAccountDataReady(true);
          return;
        }
        initializedUser.current = null;
        setAccountDataReady(false);
        setStatus(navigator.onLine ? 'error' : 'offline');
        setStatusMessage(navigator.onLine ? (cause instanceof Error ? cause.message : 'Could not load your Splitzap') : 'Internet connection required to load your Splitzap');
      }
    })();
    return () => { active = false; };
  }, [authReady, hydrated, session, update]);"""
cloud = must_sub(cloud, initial_sync_pattern, initial_sync_replacement, 'replace initial account sync', flags=re.S)

# Collaboration effects now depend on a fully loaded account, never migration/conflict UI.
cloud = cloud.replace(
    "if (!hydrated || !session || initializedUser.current !== session.user.id || migrationOpen || conflict || status !== 'synced' || sharedInitializedUser.current === session.user.id) return;",
    "if (!hydrated || !session || !accountDataReady || initializedUser.current !== session.user.id || sharedInitializedUser.current === session.user.id || !navigator.onLine) return;",
)
cloud = cloud.replace(
    "}, [conflict, hydrated, migrationOpen, session, status, update]);",
    "}, [accountDataReady, hydrated, session, status, update]);",
    1,
)
cloud = cloud.replace(
    "if (!session || initializedUser.current !== session.user.id || migrationOpen || conflict || status === 'local' || status === 'connecting') return;",
    "if (!session || !accountDataReady || initializedUser.current !== session.user.id) return;",
)
cloud = cloud.replace(
    "}, [conflict, migrationOpen, productionTick, session, status, update]);",
    "}, [accountDataReady, productionTick, session, status, update]);",
)
cloud = cloud.replace(
    "if (!session || sharedInitializedUser.current !== session.user.id || migrationOpen || conflict || !navigator.onLine) return;",
    "if (!session || !accountDataReady || sharedInitializedUser.current !== session.user.id || !navigator.onLine) return;",
)
cloud = cloud.replace(
    "}, [conflict, data, migrationOpen, session, status, update]);",
    "}, [accountDataReady, data, session, status, update]);",
)
cloud = cloud.replace(
    "if (!hydrated || !session || initializedUser.current !== session.user.id || migrationOpen || conflict || syncing.current) return;",
    "if (!hydrated || !session || !accountDataReady || initializedUser.current !== session.user.id || syncing.current) return;",
)
cloud = cloud.replace(
    "if (!navigator.onLine) { setStatus('offline'); setStatusMessage('Offline · changes will sync later'); return; }",
    "if (!navigator.onLine) { setStatus('offline'); setStatusMessage('Offline · changes saved on this device'); return; }",
)
cloud = cloud.replace(
    "navigator.onLine ? (cause instanceof Error ? cause.message : 'Cloud sync failed') : 'Offline · changes will sync later'",
    "navigator.onLine ? (cause instanceof Error ? cause.message : 'Sync problem') : 'Offline · changes saved on this device'",
)
cloud = cloud.replace(
    "}, [conflict, data, hydrated, migrationOpen, session]);",
    "}, [accountDataReady, data, hydrated, session]);",
)

online_effect_pattern = r"  useEffect\(\(\) => \{\n    const onOffline = \(\) => \{.*?\n  \}, \[session\]\);"
online_effect_replacement = """  useEffect(() => {
    if (!session || !accountDataReady) return;
    const onOffline = () => { setStatus('offline'); setStatusMessage('Offline · changes saved on this device'); };
    const onOnline = () => {
      const current = latestData.current;
      if (dataHash(current) !== safeGet(LAST_SYNC_HASH_KEY)) {
        setStatus('syncing');
        setStatusMessage('Syncing…');
        void saveSplitzapCloudState(session.user.id, current)
          .then((updatedAt) => { saveSyncMarker(current, updatedAt); setLastSyncedAt(updatedAt); setStatus('synced'); setStatusMessage('Synced'); })
          .catch(() => { setStatus('error'); setStatusMessage('Sync problem · tap your profile to retry'); });
      } else {
        setStatus('synced');
        setStatusMessage('Synced');
      }
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => { window.removeEventListener('offline', onOffline); window.removeEventListener('online', onOnline); };
  }, [accountDataReady, session]);"""
cloud = must_sub(cloud, online_effect_pattern, online_effect_replacement, 'replace network status handling', flags=re.S)

legacy_merge_pattern = r"\n  const migrate = async \(\) => \{.*?\n  const keepCloudConflict = \(\) => \{.*?\};\n"
cloud = must_sub(cloud, legacy_merge_pattern, "\n", 'remove migration and conflict actions', flags=re.S)

# Account/profile avatar should not morph into a spinner during normal sync.
old_account_action = "  const indicatorClass = status === 'synced' ? 'bg-emerald-500' : status === 'syncing' || status === 'connecting' ? 'bg-amber-400' : status === 'error' ? 'bg-red-500' : 'bg-slate-400';\n  const accountInitial = (profile?.display_name?.trim()?.[0] || data.myName?.trim()?.[0] || session?.user.email?.[0] || '').toUpperCase();\n  const accountAction = <button type=\"button\" onClick={() => session ? setProfileOpen(true) : setAccountOpen(true)} aria-label={session ? 'My Profile' : 'Sign in to sync'} title={session ? (status === 'error' || status === 'offline' ? statusMessage : 'My Profile') : 'Sign in to sync'} className=\"press relative grid size-9 place-items-center rounded-full border border-border bg-surface text-primary shadow-sm\">{status === 'syncing' || status === 'connecting' ? <Loader2 size={15} className=\"animate-spin\" /> : session && accountInitial ? <span className=\"text-xs font-extrabold\">{accountInitial}</span> : <UserRound size={16} />}{status === 'error' || status === 'offline' ? <span aria-hidden=\"true\" className={`absolute right-0 top-0 size-2.5 rounded-full border-2 border-surface ${indicatorClass}`} /> : null}</button>;"
new_account_action = "  const indicatorClass = status === 'error' ? 'bg-red-500' : 'bg-amber-400';\n  const accountInitial = (profile?.display_name?.trim()?.[0] || data.myName?.trim()?.[0] || session?.user.email?.[0] || '').toUpperCase();\n  const accountAction = <button type=\"button\" onClick={() => setProfileOpen(true)} aria-label=\"My Profile\" title={status === 'error' || status === 'offline' ? statusMessage : 'My Profile'} className=\"press relative grid size-9 place-items-center rounded-full border border-border bg-surface text-primary shadow-sm\"><span className=\"text-xs font-extrabold\">{accountInitial || '?'}</span>{status === 'error' || status === 'offline' ? <span aria-hidden=\"true\" className={`absolute right-0 top-0 size-2.5 rounded-full border-2 border-surface ${indicatorClass}`} /> : null}</button>;"
cloud = must_replace(cloud, old_account_action, new_account_action, 'stable profile avatar')

# Gate Splitzap itself behind authentication and an account data load.
gate_marker = "  const managedGroup = manageGroupId ? data.groups.find((item) => item.id === manageGroupId) ?? null : null;\n\n  return <>"
gate_replacement = """  const managedGroup = manageGroupId ? data.groups.find((item) => item.id === manageGroupId) ?? null : null;

  if (!authReady) {
    return <div className=\"fixed inset-0 z-[120] grid place-items-center bg-[#fbfaf6] px-6 text-slate-900\"><div className=\"text-center\"><div className=\"mx-auto grid size-16 place-items-center rounded-2xl bg-[#256f66] text-2xl font-extrabold text-white shadow-lg\">₹</div><Loader2 size={22} className=\"mx-auto mt-5 animate-spin text-[#256f66]\" /><p className=\"mt-3 text-sm font-bold\">Opening Splitzap…</p></div></div>;
  }
  if (!session) {
    return <AccountSheet open locked onClose={() => undefined} session={null} status={status} statusMessage={statusMessage} lastSyncedAt={lastSyncedAt} recoveryMode={false} onRecoveryComplete={() => undefined} />;
  }
  if (!accountDataReady) {
    return <div className=\"fixed inset-0 z-[120] grid place-items-center bg-[#fbfaf6] px-6 text-slate-900\"><div className=\"w-full max-w-sm text-center\"><div className=\"mx-auto grid size-16 place-items-center rounded-2xl bg-[#256f66] text-2xl font-extrabold text-white shadow-lg\">₹</div>{status === 'connecting' ? <Loader2 size={22} className=\"mx-auto mt-5 animate-spin text-[#256f66]\" /> : null}<p className=\"mt-4 text-sm font-extrabold\">{status === 'connecting' ? 'Loading your Splitzap…' : statusMessage}</p>{status !== 'connecting' ? <><button type=\"button\" onClick={() => window.location.reload()} className=\"mt-4 w-full rounded-xl bg-[#256f66] px-4 py-3 text-sm font-bold text-white\">Try again</button><button type=\"button\" onClick={() => void signOutSplitzap()} className=\"mt-2 w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700\">Sign out</button></> : null}</div></div>;
  }

  return <>"""
cloud = must_replace(cloud, gate_marker, gate_replacement, 'add auth and data gate')

# Remove obsolete migration/conflict modals.
cloud = must_sub(cloud, r"\n    \{migrationOpen \? <SimpleModal.*? : null\}\n    \{conflict \? <SimpleModal.*? : null\}", "", 'remove migration/conflict UI', flags=re.S)

# Delete-account flow must clear the account marker too.
cloud = must_replace(
    cloud,
    "      window.localStorage.removeItem('splitzap.cloud.lastSyncAt');\n      window.location.replace('/splitzap');",
    "      window.localStorage.removeItem('splitzap.cloud.lastSyncAt');\n      window.localStorage.removeItem('splitzap.cloud.lastUserId');\n      window.location.replace('/splitzap');",
    'clear account marker on deletion',
)

# Splitzap-specific, deliberately short Help/Privacy content. No generic Zapora routes.
help_old = "      <ProfileSection title=\"Help & About\"><a href=\"/contact\" className=\"flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3 text-xs font-bold\">Help & feedback <ChevronRight size={14} /></a><a href=\"/privacy\" className=\"mt-2 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3 text-xs font-bold\">Privacy <ChevronRight size={14} /></a></ProfileSection>"
help_new = "      <ProfileSection title=\"Help & About\"><details className=\"rounded-xl bg-slate-50 px-3 py-3\"><summary className=\"cursor-pointer list-none text-xs font-bold\">Help & feedback <ChevronRight size={14} className=\"float-right\" /></summary><p className=\"mt-2 text-[11px] leading-5 text-slate-600\">For help with groups, expenses, payments, invites or anything that does not look right, email <a className=\"font-bold text-[#256f66]\" href=\"mailto:hizapora@gmail.com?subject=Splitzap%20Help\">hizapora@gmail.com</a>.</p></details><details className=\"mt-2 rounded-xl bg-slate-50 px-3 py-3\"><summary className=\"cursor-pointer list-none text-xs font-bold\">Privacy <ChevronRight size={14} className=\"float-right\" /></summary><p className=\"mt-2 text-[11px] leading-5 text-slate-600\">Splitzap uses your account information to provide the service and keep your expense data available across your devices. Information inside a shared group can be seen by people in that group. We do not sell your personal information. You can export your data or delete your account from My Profile. For privacy questions, email hizapora@gmail.com.</p></details></ProfileSection>"
cloud = must_replace(cloud, help_old, help_new, 'Splitzap help and privacy')

# Remove technical provider/test-limit language from auth UI.
cloud = must_replace(
    cloud,
    "setFeedback('Account created. Verification email sent. This used 1 email from the shared 2-per-hour test allowance.');",
    "setFeedback('Account created. Verification email sent. If you do not receive it, wait a little and try again later.');",
    'signup email feedback',
)
cloud = must_replace(
    cloud,
    "setFeedback('Password reset email sent. This action used 1 email from the shared 2-per-hour test allowance.');",
    "setFeedback('Password reset email sent. If you do not receive it, wait a little and try again later.');",
    'reset email feedback',
)
cloud = cloud.replace("'Create account · sends 1 email'", "'Create account'")
cloud = cloud.replace("Send reset email · uses 1 email", "Send reset email")
cloud = must_sub(
    cloud,
    r"function EmailAllowanceNotice\(\{ action \}: \{ action: string \}\) \{\n  return <div.*?\n\}",
    """function EmailAllowanceNotice({ action }: { action: string }) {
  return <div className=\"mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5\"><div className=\"flex items-start gap-2\"><Mail size={15} className=\"mt-0.5 shrink-0 text-amber-700\" /><div><p className=\"text-[11px] font-extrabold text-amber-900\">Temporary email limit</p><p className=\"mt-0.5 text-[11px] leading-4 text-amber-800\">{action} sends an email. Authentication emails are temporarily limited, so if the limit is reached please try again later or use Google sign-in.</p></div></div></div>;
}""",
    'generic email allowance notice',
    flags=re.S,
)
cloud = cloud.replace(
    "<p className=\"mt-3 text-xs leading-5 text-slate-500\">Expenses continue saving instantly on this device. When online, Splitzap also keeps the latest copy in your private cloud account.</p>",
    "<p className=\"mt-3 text-xs leading-5 text-slate-500\">When you are online, Splitzap keeps your latest changes synced to your account. If your connection drops while you are signed in, you can keep working and changes will sync when you reconnect.</p>",
)

# AccountSheet becomes the signed-out full-screen gate when locked.
cloud = must_replace(
    cloud,
    "function AccountSheet({ open, onClose, session, status, statusMessage, lastSyncedAt, recoveryMode, onRecoveryComplete }: {",
    "function AccountSheet({ open, onClose, session, status, statusMessage, lastSyncedAt, recoveryMode, onRecoveryComplete, locked = false }: {",
    'AccountSheet locked prop signature',
)
cloud = must_replace(
    cloud,
    "  onRecoveryComplete: () => void;\n}) {",
    "  onRecoveryComplete: () => void;\n  locked?: boolean;\n}) {",
    'AccountSheet locked prop type',
)
cloud = cloud.replace("if (event.key === 'Escape' && !recoveryMode) onClose();", "if (event.key === 'Escape' && !recoveryMode && !locked) onClose();")
cloud = cloud.replace("}, [onClose, open, recoveryMode]);", "}, [locked, onClose, open, recoveryMode]);")
cloud = cloud.replace(
    "      {!recoveryMode ? <button type=\"button\" aria-label=\"Close account\" onClick={onClose} className=\"absolute inset-0 bg-black/40 backdrop-blur-[2px]\" /> : <div className=\"absolute inset-0 bg-black/40 backdrop-blur-[2px]\" />}",
    "      {locked ? <div className=\"absolute inset-0 bg-[#fbfaf6]\" /> : !recoveryMode ? <button type=\"button\" aria-label=\"Close account\" onClick={onClose} className=\"absolute inset-0 bg-black/40 backdrop-blur-[2px]\" /> : <div className=\"absolute inset-0 bg-black/40 backdrop-blur-[2px]\" />}",
)
cloud = cloud.replace(
    "      <section role=\"dialog\" aria-modal=\"true\" aria-label={session ? 'Splitzap account' : 'Sign in to Splitzap'} className=\"relative max-h-[92dvh] w-full max-w-[520px] overflow-y-auto rounded-t-[28px] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl\">",
    "      <section role=\"dialog\" aria-modal=\"true\" aria-label={session ? 'Splitzap account' : 'Sign in to Splitzap'} className={locked ? 'relative min-h-[100dvh] w-full max-w-[520px] overflow-y-auto bg-[#fbfaf6] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]' : 'relative max-h-[92dvh] w-full max-w-[520px] overflow-y-auto rounded-t-[28px] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl'}>",
)
cloud = cloud.replace("        <div className=\"mx-auto h-1 w-10 rounded-full bg-slate-200\" />", "        {!locked ? <div className=\"mx-auto h-1 w-10 rounded-full bg-slate-200\" /> : <div className=\"mx-auto mt-5 grid size-16 place-items-center rounded-2xl bg-[#256f66] text-2xl font-extrabold text-white shadow-lg\">₹</div>}")
cloud = cloud.replace(
    "<div><h2 className=\"text-lg font-extrabold text-slate-900\">{session ? 'Account & sync' : 'Keep your data synced'}</h2><p className=\"mt-0.5 text-xs text-slate-500\">{session ? 'Your Splitzap account and cloud status' : 'Sign in once, use Splitzap across devices'}</p></div>",
    "<div><h2 className=\"text-lg font-extrabold text-slate-900\">{session ? 'Account & sync' : 'Sign in to Splitzap'}</h2><p className=\"mt-0.5 text-xs text-slate-500\">{session ? 'Your Splitzap account and sync status' : 'Your groups and expenses stay with your account'}</p></div>",
)
cloud = cloud.replace("          {!recoveryMode ? <button type=\"button\" onClick={onClose}", "          {!recoveryMode && !locked ? <button type=\"button\" onClick={onClose}")

# Clear wording around member removal while preserving canonical history.
cloud = must_replace(
    cloud,
    "window.confirm(`Reset ${member.name}'s account connection? Their historical expenses remain intact.`) && void run(`unlink-${member.id}`, () => onUnlink(member.id))",
    "window.confirm(`Remove ${member.name} from ${group.name}? They will lose access, but their historical expenses and balances will remain intact.`) && void run(`unlink-${member.id}`, () => onUnlink(member.id))",
    'member remove confirmation',
)
cloud = must_replace(cloud, '>Reset account link</button>', '>Remove from group</button>', 'member remove label')

cloud_path.write_text(cloud)


# -----------------------------------------------------------------------------
# SplitzapAppV4.tsx — restore proven UI patterns + mobile stability
# -----------------------------------------------------------------------------
app_path = ROOT / 'src/features/splitzap/SplitzapAppV4.tsx'
app = app_path.read_text()

app = app.replace("window.scrollTo({ top: 0, behavior: 'smooth' });", "window.scrollTo({ top: 0, behavior: 'auto' });")
app = app.replace(
    "case 'member_unlinked': return { icon: '🔗', title: `${actor} reset ${String(info.name ?? 'a member')}'s account link`, detail: '' };",
    "case 'member_unlinked': return { icon: '👤', title: `${actor} removed ${String(info.name ?? 'a member')} from the group`, detail: 'Historical expenses and balances remain intact' };",
)

# More stable modal scroll container.
app = must_replace(
    app,
    "className=\"sheet-panel relative flex max-h-[94dvh] w-full max-w-[520px] flex-col rounded-t-[28px] bg-surface outline-none\"",
    "className=\"sheet-panel relative flex w-full max-w-[520px] flex-col rounded-t-[28px] bg-surface outline-none\"",
    'sheet panel height class',
)
app = must_replace(
    app,
    "className=\"min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4\"",
    "className=\"sheet-scroll min-h-0 flex-1 px-5 pb-4\"",
    'sheet scroll class',
)

# Actionable intro instead of marketing tiles.
intro_pattern = r"function IntroPanel\(.*?\n\}\n\nfunction QuickActionsSheet"
intro_replacement = """function IntroPanel({ hasGroups, onPrimary, onNewGroup, onJoinGroup, onAddExpense, onRecordPayment, onActivity, onInstall }: { hasGroups: boolean; onPrimary: () => void; onNewGroup: () => void; onJoinGroup: () => void; onAddExpense: () => void; onRecordPayment: () => void; onActivity: () => void; onInstall?: () => void }) {
  return <section className=\"px-5 pt-2\"><div className=\"splitzap-welcome card-soft overflow-hidden p-6 text-center\"><div className=\"welcome-orbit mx-auto mb-5\" aria-hidden=\"true\"><span>🍜</span><span>🚕</span><span>🏠</span><span>🎉</span><strong>₹</strong></div><p className=\"text-xs font-bold uppercase tracking-[0.18em] text-primary\">Splitzap</p><h2 className=\"mt-2 text-3xl font-extrabold\">Split bills, not bonds.</h2><p className=\"mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground\">Keep shared spending clear and settle with fewer payments.</p>{hasGroups ? <><button type=\"button\" onClick={onPrimary} className=\"press mt-5 text-xs font-bold text-primary\">Back to your groups</button><div className=\"mt-4 grid grid-cols-3 gap-2\"><button type=\"button\" onClick={onAddExpense} className=\"welcome-action press rounded-2xl bg-orange-50 p-3 text-left\"><span className=\"text-lg\">＋</span><b className=\"mt-2 block text-[11px]\">Add expense</b></button><button type=\"button\" onClick={onRecordPayment} className=\"welcome-action press rounded-2xl bg-emerald-50 p-3 text-left\"><span className=\"text-lg\">₹</span><b className=\"mt-2 block text-[11px]\">Record payment</b></button><button type=\"button\" onClick={onActivity} className=\"welcome-action press rounded-2xl bg-violet-50 p-3 text-left\"><span className=\"text-lg\">↗</span><b className=\"mt-2 block text-[11px]\">Activity</b></button></div><button type=\"button\" onClick={onNewGroup} className=\"press mt-3 text-xs font-bold text-muted-foreground\">+ Create another group</button></> : <div className=\"mt-6 grid grid-cols-2 gap-2\"><button type=\"button\" onClick={onNewGroup} className=\"press rounded-2xl bg-primary p-4 text-left text-primary-foreground\"><Plus size={18} /><b className=\"mt-3 block text-sm\">Create a group</b><span className=\"mt-1 block text-[10px] opacity-80\">Start a new split</span></button><button type=\"button\" onClick={onJoinGroup} className=\"press rounded-2xl bg-secondary p-4 text-left text-primary\"><UserPlus size={18} /><b className=\"mt-3 block text-sm\">Join a group</b><span className=\"mt-1 block text-[10px] text-muted-foreground\">Use an invite link</span></button></div>}{onInstall ? <button type=\"button\" onClick={onInstall} className=\"press mt-4 text-xs font-bold text-muted-foreground\">Install Splitzap on this device</button> : null}</div></section>;
}

function QuickActionsSheet"""
app = must_sub(app, intro_pattern, intro_replacement, 'replace intro panel', flags=re.S)

quick_pattern = r"function QuickActionsSheet\(.*?\n\}\n\nfunction GroupPickerSheet"
quick_replacement = """function QuickActionsSheet({ open, onClose, onAddExpense, onNewGroup, onRecordPayment }: { open: boolean; onClose: () => void; onAddExpense: () => void; onNewGroup: () => void; onRecordPayment: () => void }) {
  const action = (fn: () => void) => { onClose(); fn(); };
  return <SheetModal open={open} onClose={onClose} title=\"Quick actions\"><div className=\"grid grid-cols-3 gap-2 pb-2\">{[
    { label: 'Add expense', icon: '＋', run: onAddExpense, tone: 'quick-food' },
    { label: 'Record payment', icon: '₹', run: onRecordPayment, tone: 'quick-payment' },
    { label: 'New group', icon: '👥', run: onNewGroup, tone: 'quick-group' },
  ].map((item) => <button type=\"button\" key={item.label} onClick={() => action(item.run)} className={`quick-action press min-h-20 rounded-2xl border border-border bg-surface p-3 text-left ${item.tone}`}><span className=\"grid size-8 place-items-center rounded-xl bg-surface-2 text-base font-extrabold\">{item.icon}</span><b className=\"mt-2 block text-[11px] leading-4\">{item.label}</b></button>)}</div></SheetModal>;
}

function GroupPickerSheet"""
app = must_sub(app, quick_pattern, quick_replacement, 'replace quick actions', flags=re.S)

# Home: scanner goes back to the header and nowhere else; intro actions are functional.
def patch_home(region: str) -> str:
    region = must_replace(
        region,
        "right={<div className=\"flex items-center gap-2\">{accountAction}<button type=\"button\" onClick={() => setGroupOpen(true)}",
        "right={<div className=\"flex items-center gap-1.5\">{accountAction}<button type=\"button\" onClick={() => activeGroups.length ? setScannerOpen(true) : setGroupOpen(true)} aria-label=\"Scan receipt\" title=\"Scan receipt\" className=\"press grid size-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm\"><Camera size={16} /></button><button type=\"button\" onClick={() => setGroupOpen(true)}",
        'home scanner header',
    )
    region = must_sub(
        region,
        r"<IntroPanel hasGroups=\{data\.groups\.length > 0\} onPrimary=\{\(\) => data\.groups\.length \? setShowIntro\(false\) : setGroupOpen\(true\)\} onNewGroup=\{\(\) => setGroupOpen\(true\)\} onInstall=\{installPrompt \? install : undefined\} />",
        "<IntroPanel hasGroups={data.groups.length > 0} onPrimary={() => setShowIntro(false)} onNewGroup={() => setGroupOpen(true)} onJoinGroup={() => collaboration?.onJoinGroup()} onAddExpense={() => activeGroups.length ? setAddOpen(true) : setGroupOpen(true)} onRecordPayment={beginPayment} onActivity={() => navigate({ name: 'activity' })} onInstall={installPrompt ? install : undefined} />",
        'home intro props',
    )
    region = region.replace(" onScanReceipt={() => activeGroups.length ? setScannerOpen(true) : setGroupOpen(true)}", "")
    return region

app = transform_region(app, 'function HomeScreen', 'function ActivityScreen', patch_home, 'home screen')

# Activity: no scanner entry/state here.
def patch_activity(region: str) -> str:
    region = region.replace("  const [scannerOpen, setScannerOpen] = useState(false);\n", '')
    region = region.replace("  const [scanSeed, setScanSeed] = useState<ScanExpenseSeed | null>(null);\n", '')
    region = region.replace(" onScanReceipt={() => activeGroups.length ? setScannerOpen(true) : setGroupOpen(true)}", '')
    region = region.replace(" onClose={() => { setAddOpen(false); setScanSeed(null); }}", " onClose={() => setAddOpen(false)}")
    region = region.replace(" seed={scanSeed}", '')
    region = must_sub(region, r"\n    <ReceiptScanner open=\{scannerOpen\}.*? />", '', 'remove activity scanner')
    return region

app = transform_region(app, 'function ActivityScreen', 'function GroupScreen', patch_activity, 'activity screen')

# Group: dedicated Share summary icon + outside-click close; no receipt scanner in + actions.
def patch_group(region: str) -> str:
    region = region.replace("  const [scannerOpen, setScannerOpen] = useState(false);\n", '')
    region = region.replace("  const [scanSeed, setScanSeed] = useState<ScanExpenseSeed | null>(null);\n", '')
    region = must_replace(
        region,
        "right={<div className=\"relative\"><button type=\"button\" onClick={() => setMenuOpen((value) => !value)}",
        "right={<div className=\"relative flex items-center gap-1\"><button type=\"button\" onClick={() => setShareOpen(true)} aria-label=\"Share group summary\" title=\"Share group\" className=\"press grid size-9 place-items-center rounded-full bg-secondary text-primary\"><Share2 size={16} /></button><button type=\"button\" onClick={() => setMenuOpen((value) => !value)}",
        'group share icon',
    )
    region = must_replace(
        region,
        "{menuOpen ? <div className=\"absolute right-0 top-11 z-20 w-52 overflow-hidden rounded-2xl border border-border bg-surface p-1.5 shadow-xl\">",
        "{menuOpen ? <><button type=\"button\" aria-label=\"Close group menu\" onClick={() => setMenuOpen(false)} className=\"fixed inset-0 z-30 cursor-default bg-transparent\" /><div className=\"absolute right-0 top-11 z-40 w-52 overflow-hidden rounded-2xl border border-border bg-surface p-1.5 shadow-xl\">",
        'group outside click backdrop',
    )
    # Close the fragment added above. Unique within the group header region.
    region = must_replace(region, "</button></div> : null}</div>} />", "</button></div></> : null}</div>} />", 'close group menu fragment')
    region = region.replace(" onScanReceipt={() => !isArchived && setScannerOpen(true)}", '')
    region = region.replace(" onClose={() => { setAddOpen(false); setScanSeed(null); setEditingExpense(null); }}", " onClose={() => { setAddOpen(false); setEditingExpense(null); }}")
    region = region.replace(" seed={scanSeed}", '')
    region = must_sub(region, r"\n    <ReceiptScanner open=\{scannerOpen\}.*? />", '', 'remove group scanner')
    return region

app = transform_region(app, 'function GroupScreen', 'function removeGroupLocalWithAudit', patch_group, 'group screen')

# Add Expense: older fast-access option layout, compact exact mode, explicit validation feedback.
def patch_expense(region: str) -> str:
    region = must_sub(region, r"\n  const \[moreOpen, setMoreOpen\] = useState\(.*?\);", '', 'remove more-options state')
    region = must_replace(
        region,
        "  const [submitAttempted, setSubmitAttempted] = useState(false);",
        "  const [submitAttempted, setSubmitAttempted] = useState(false);\n  const [saveError, setSaveError] = useState('');",
        'expense save error state',
    )
    region = must_replace(
        region,
        "  const valid = !!group && description.trim().length > 0 && baseTotal > 0 && personalOver <= 0.009 && splitSectionValid && payerValid;\n  const setWeight",
        "  const valid = !!group && description.trim().length > 0 && baseTotal > 0 && personalOver <= 0.009 && splitSectionValid && payerValid;\n  const validationMessage = !group ? 'Choose a group.' : !description.trim() ? 'Add a description.' : baseTotal <= 0 ? 'Enter an amount greater than zero.' : personalOver > 0.009 ? `Personal and selected items exceed the expense by ${money(personalOver, group.currency)}.` : !payerValid ? 'Payer amounts exceed the expense total.' : hasSharedAmount && !hasSharedPeople ? 'Select at least one person for the shared amount.' : mode === 'exact' && Math.abs(exactRemaining) >= 0.01 ? `${money(Math.abs(exactRemaining), group.currency)} ${exactRemaining > 0 ? 'is still left to assign.' : 'is over-assigned.'}` : mode === 'percentage' && Math.abs(percentageRemaining) >= 0.01 ? `${Math.abs(percentageRemaining).toFixed(2)}% ${percentageRemaining > 0 ? 'is still left to assign.' : 'is over-assigned.'}` : '';\n  const setWeight",
        'expense validation message',
    )
    region = must_replace(
        region,
        "  const save = () => {\n    setSubmitAttempted(true);\n    if (!group || !valid) return;",
        "  const save = () => {\n    setSubmitAttempted(true);\n    if (!group || !valid) { setSaveError(validationMessage || 'Review the highlighted fields before adding this expense.'); return; }\n    setSaveError('');",
        'expense explicit save failure',
    )

    paid_date_pattern = r"\{group \? <div className=\"mb-4 grid grid-cols-2 gap-2\"><Field label=\"Paid by\" compact>.*?</Field><Field label=\"Date\" compact>.*?</Field></div> : null\}"
    paid_date_replacement = """{group ? <div className=\"mb-3 grid grid-cols-[minmax(0,1fr)_108px] gap-2\"><Field label=\"Paid by\" compact><div className=\"grid grid-cols-[minmax(0,1fr)_auto] gap-1.5\"><select value={paidBy} onChange={(event) => { setPaidBy(event.target.value); setMultiPayer(false); setPayments({}); setPayersOpen(false); }} className={`${inputClass} min-w-0 py-2.5 text-xs`}>{group.members.map((member) => <option key={member.id} value={member.id}>{displayName(group, data, member.id)}{member.id === memberIdFor(group, data) ? ' (Me)' : ''}</option>)}</select><button type=\"button\" onClick={openMultiplePayers} className={`press shrink-0 rounded-xl px-2 py-2 text-[9px] font-extrabold ${multiPayer ? 'bg-primary text-primary-foreground' : 'bg-secondary text-primary'}`}>{multiPayer ? 'Payers' : '+ Multiple'}</button></div></Field><Field label=\"Date\" compact><div className=\"relative\"><CalendarDays size={13} className=\"pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground\" /><input type=\"date\" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} className={`${inputClass} pl-7 pr-1 py-2.5 text-[10px]`} /></div></Field></div> : null}"""
    region = must_sub(region, paid_date_pattern, paid_date_replacement, 'restore payer/date layout', flags=re.S)

    more_pattern = r"<button type=\"button\" onClick=\{\(\) => setMoreOpen\(\(value\) => !value\)\}.*?\{moreOpen \? <div className=\"mb-3 grid grid-cols-2 gap-2\">.*?</div> : null\}"
    direct_options = """{saveError ? <p role=\"alert\" className=\"mb-2 rounded-xl bg-negative/5 px-3 py-2 text-[11px] font-bold leading-5 text-negative\">{saveError}</p> : null}<div className=\"mb-3 grid grid-cols-3 gap-1.5\"><button type=\"button\" onClick={() => setPersonalOpen(true)} title=\"Personal item\" className={`press flex min-h-10 items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[10px] font-bold ${personalItems.length ? 'border-primary/20 bg-secondary text-primary' : 'border-border bg-surface-2 text-foreground'}`}><span>👤</span><span>Personal</span>{personalItems.length ? <span className=\"rounded-full bg-surface px-1.5 py-0.5 text-[9px]\">{personalItems.length}</span> : null}</button><button type=\"button\" onClick={() => setSelectiveOpen(true)} title=\"Split an item with only some people\" className={`press flex min-h-10 items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[10px] font-bold ${selectiveItems.length ? 'border-primary/20 bg-secondary text-primary' : 'border-border bg-surface-2 text-foreground'}`}><span>👥</span><span>Some people</span>{selectiveItems.length ? <span className=\"rounded-full bg-surface px-1.5 py-0.5 text-[9px]\">{selectiveItems.length}</span> : null}</button><button type=\"button\" onClick={() => { if (!charges.length) setCharges([{ id: uid(), description: '', amount: 0, distribution: 'equal' }]); setChargesOpen(true); }} title=\"Additional charges\" className={`press flex min-h-10 items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[10px] font-bold ${charges.length ? 'border-primary/20 bg-secondary text-primary' : 'border-border bg-surface-2 text-foreground'}`}><span>🧾</span><span>Charges</span>{charges.length ? <span className=\"rounded-full bg-surface px-1.5 py-0.5 text-[9px]\">{charges.length}</span> : null}</button></div>"""
    region = must_sub(region, more_pattern, direct_options, 'restore direct expense options', flags=re.S)

    region = must_replace(
        region,
        'return <div key={member.id} className="bg-surface px-3 py-2.5"><div className="flex items-center gap-3"><Avatar name={displayName(group, data, member.id)} size={30} />',
        'return <div key={member.id} className={`bg-surface px-2.5 ${mode === \'exact\' ? \'py-1.5\' : \'py-2.5\'}`}><div className={`flex items-center ${mode === \'exact\' ? \'gap-2\' : \'gap-3\'}`}><Avatar name={displayName(group, data, member.id)} size={mode === \'exact\' ? 24 : 30} />',
        'compact split member rows',
    )
    region = region.replace('className="tabular w-20 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-right text-sm"', 'className={`tabular rounded-lg border border-border bg-surface-2 px-2 text-right ${mode === \'exact\' ? \'w-[72px] py-1 text-xs\' : \'w-20 py-1.5 text-sm\'}`}')
    region = region.replace('className="ml-[42px] mt-1.5"', 'className="ml-[32px] mt-1"')
    region = region.replace('className="press rounded-lg bg-surface-2 px-2.5 py-2 text-[11px] font-semibold text-primary"', 'className="press rounded-lg bg-surface-2 px-2 py-1 text-[9px] font-semibold text-primary"')
    region = region.replace('className="press text-[11px] font-bold text-primary">+ Add Label (optional)</button>', 'className="press text-[9px] font-bold text-primary">+ label</button>')
    return region

app = transform_region(app, 'function AddExpenseSheet', 'const EMOJIS', patch_expense, 'add expense sheet')

app_path.write_text(app)


# -----------------------------------------------------------------------------
# splitzap.css — more vibrant, larger group icon, stable iOS/mobile scrolling
# -----------------------------------------------------------------------------
css_path = ROOT / 'src/features/splitzap/splitzap.css'
css = css_path.read_text()
css = css.replace('  --surface-2: 0.962 0.012 120;', '  --surface-2: 0.965 0.025 150;')
css = css.replace('  --primary: 0.52 0.115 176;', '  --primary: 0.55 0.15 171;')
css = css.replace('  --secondary: 0.945 0.03 160;', '  --secondary: 0.94 0.055 165;')
css = css.replace('  --positive: 0.55 0.13 165;', '  --positive: 0.56 0.16 158;')
css = css.replace('  --negative: 0.6 0.17 30;', '  --negative: 0.61 0.19 28;')
css = css.replace('  overscroll-behavior-y: none;', '  overscroll-behavior-y: auto;')

polish_css = r'''

/* Production mobile polish: stable sheets, stronger affordances, larger group marks. */
.sheet-panel {
  max-height: calc(100dvh - max(0.5rem, env(safe-area-inset-top)));
  overscroll-behavior: contain;
}

.sheet-scroll {
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  scrollbar-gutter: stable;
}

.group-emoji {
  font-size: 1.7rem !important;
  line-height: 1;
}

.welcome-action {
  border: 1px solid oklch(var(--border) / 0.55);
  min-height: 84px;
}

.quick-food { background: linear-gradient(145deg, oklch(0.98 0.045 70), oklch(1 0 0)); }
.quick-payment { background: linear-gradient(145deg, oklch(0.97 0.04 155), oklch(1 0 0)); }
.quick-group { background: linear-gradient(145deg, oklch(0.97 0.04 285), oklch(1 0 0)); }

/* iOS Chrome uses WebKit. Remove the continuous motion/blur that makes the UI feel unstable. */
@supports (-webkit-touch-callout: none) {
  .splitzap-ambient,
  .splitzap-fab,
  .splitzap-hero::before,
  .splitzap-hero::after {
    animation: none !important;
  }

  .splitzap-bottom-nav {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    background: oklch(var(--surface) / 0.98);
  }

  .sheet-backdrop {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }

  .screen-enter,
  .list-enter {
    animation-duration: 0.16s !important;
    transform: none !important;
  }

  .splitzap-root .press {
    transition-duration: 0.1s;
  }
}
'''
if 'Production mobile polish: stable sheets' not in css:
    css += polish_css
css_path.write_text(css)

print('Splitzap product polish patch applied successfully.')
