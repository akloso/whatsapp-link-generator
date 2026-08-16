from pathlib import Path

ROOT = Path('.')

cloud_ts = r'''import { createClient, type AuthChangeEvent, type Session } from '@supabase/supabase-js';
import type { SplitData } from './splitStoreV4';

export type SplitzapSession = Session;
export type SplitzapAuthEvent = AuthChangeEvent;

const SUPABASE_URL = 'https://cnbisaamlcisksacpozr.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_pvyXUidHeZbyTDaXwuS4Xg_eMrqjnzg';

export const splitzapSupabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type SplitzapCloudRow = {
  data: SplitData;
  updated_at: string;
};

const splitzapRedirectUrl = () => `${window.location.origin}/splitzap`;

export async function getSplitzapSession(): Promise<Session | null> {
  const { data, error } = await splitzapSupabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onSplitzapAuthChange(callback: (session: Session | null, event: AuthChangeEvent) => void) {
  const { data } = splitzapSupabase.auth.onAuthStateChange((event, session) => callback(session, event));
  return () => data.subscription.unsubscribe();
}

export async function signInSplitzapWithGoogle() {
  const { data, error } = await splitzapSupabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: splitzapRedirectUrl(),
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw error;
  return data;
}

export async function signInSplitzapWithPassword(email: string, password: string) {
  const { data, error } = await splitzapSupabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  return data;
}

export async function signUpSplitzapWithPassword(email: string, password: string) {
  const { data, error } = await splitzapSupabase.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: splitzapRedirectUrl() },
  });
  if (error) throw error;
  return data;
}

export async function sendSplitzapPasswordReset(email: string) {
  const { error } = await splitzapSupabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: splitzapRedirectUrl(),
  });
  if (error) throw error;
}

export async function updateSplitzapPassword(password: string) {
  const { data, error } = await splitzapSupabase.auth.updateUser({ password });
  if (error) throw error;
  return data;
}

export async function signOutSplitzap() {
  const { error } = await splitzapSupabase.auth.signOut();
  if (error) throw error;
}

export async function fetchSplitzapCloudState(userId: string): Promise<SplitzapCloudRow | null> {
  const { data, error } = await splitzapSupabase
    .from('splitzap_user_state')
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data as SplitzapCloudRow;
}

export async function saveSplitzapCloudState(userId: string, data: SplitData): Promise<string> {
  const updatedAt = new Date().toISOString();
  const { error } = await splitzapSupabase
    .from('splitzap_user_state')
    .upsert({ user_id: userId, data, updated_at: updatedAt }, { onConflict: 'user_id' });
  if (error) throw error;
  return updatedAt;
}
'''

cloud_app_tsx = r'''import { Cloud, CloudOff, Eye, EyeOff, KeyRound, Loader2, LogOut, Mail, ShieldCheck, UserRound, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import SplitzapAppV4 from './SplitzapAppV4';
import { useSplitData, type SplitData } from './splitStoreV4';
import {
  fetchSplitzapCloudState,
  getSplitzapSession,
  onSplitzapAuthChange,
  saveSplitzapCloudState,
  sendSplitzapPasswordReset,
  signInSplitzapWithGoogle,
  signInSplitzapWithPassword,
  signOutSplitzap,
  signUpSplitzapWithPassword,
  updateSplitzapPassword,
  type SplitzapSession,
} from './splitzapCloud';

type SyncStatus = 'local' | 'connecting' | 'syncing' | 'synced' | 'offline' | 'error';
type Conflict = { cloud: SplitData; local: SplitData } | null;
type EmailMode = 'signin' | 'signup';

const LAST_SYNC_HASH_KEY = 'splitzap.cloud.lastSyncHash';
const LAST_SYNC_AT_KEY = 'splitzap.cloud.lastSyncAt';

const dataHash = (data: SplitData) => JSON.stringify(data);
const hasMeaningfulData = (data: SplitData) => data.groups.length > 0 || data.expenses.length > 0 || data.settlements.length > 0;

function safeGet(key: string) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function saveSyncMarker(data: SplitData, updatedAt = new Date().toISOString()) {
  try {
    window.localStorage.setItem(LAST_SYNC_HASH_KEY, dataHash(data));
    window.localStorage.setItem(LAST_SYNC_AT_KEY, updatedAt);
  } catch { /* local storage warnings are handled by the main store */ }
}

function friendlyAuthError(cause: unknown) {
  const message = cause instanceof Error ? cause.message : 'Authentication failed.';
  if (/email rate limit|over_email_send_rate_limit/i.test(message)) return "Splitzap's temporary test email limit is reached. Use Google or try the email action later.";
  if (/invalid login credentials/i.test(message)) return 'Email or password is incorrect.';
  if (/email not confirmed/i.test(message)) return 'Confirm your email first, then sign in with your password.';
  if (/provider.*not enabled|unsupported provider/i.test(message)) return 'Google sign-in is not connected yet.';
  if (/password should be at least/i.test(message)) return 'Use a password with at least 8 characters.';
  return message;
}

export default function SplitzapCloudApp() {
  const { data, update, hydrated } = useSplitData();
  const [session, setSession] = useState<SplitzapSession | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [migrationOpen, setMigrationOpen] = useState(false);
  const [conflict, setConflict] = useState<Conflict>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [status, setStatus] = useState<SyncStatus>('local');
  const [statusMessage, setStatusMessage] = useState('Saved on this device');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => typeof window === 'undefined' ? null : safeGet(LAST_SYNC_AT_KEY));
  const initializedUser = useRef<string | null>(null);
  const syncing = useRef(false);
  const latestData = useRef(data);
  latestData.current = data;

  useEffect(() => {
    let active = true;
    getSplitzapSession()
      .then((next) => { if (active) { setSession(next); setAuthReady(true); } })
      .catch(() => { if (active) { setAuthReady(true); setStatus('error'); setStatusMessage('Could not check cloud account'); } });
    const unsubscribe = onSplitzapAuthChange((next, event) => {
      if (!active) return;
      setSession(next);
      initializedUser.current = null;
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
        setAccountOpen(true);
      }
      if (!next) {
        setStatus('local');
        setStatusMessage('Saved on this device');
      }
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!hydrated || !authReady || !session || initializedUser.current === session.user.id) return;
    let active = true;
    initializedUser.current = session.user.id;
    setStatus('connecting');
    setStatusMessage('Checking cloud copy…');

    void (async () => {
      try {
        const row = await fetchSplitzapCloudState(session.user.id);
        if (!active) return;
        const local = latestData.current;
        const localHash = dataHash(local);
        const lastHash = safeGet(LAST_SYNC_HASH_KEY);

        if (!row) {
          if (hasMeaningfulData(local)) {
            setMigrationOpen(true);
            setStatus('local');
            setStatusMessage('Device data ready to move online');
            return;
          }
          const updatedAt = await saveSplitzapCloudState(session.user.id, local);
          if (!active) return;
          saveSyncMarker(local, updatedAt);
          setLastSyncedAt(updatedAt);
          setStatus('synced');
          setStatusMessage('Synced');
          return;
        }

        const cloudHash = dataHash(row.data);
        if (localHash === cloudHash) {
          saveSyncMarker(row.data, row.updated_at);
          setLastSyncedAt(row.updated_at);
          setStatus('synced');
          setStatusMessage('Synced');
          return;
        }

        if (lastHash && localHash !== lastHash) {
          const updatedAt = await saveSplitzapCloudState(session.user.id, local);
          if (!active) return;
          saveSyncMarker(local, updatedAt);
          setLastSyncedAt(updatedAt);
          setStatus('synced');
          setStatusMessage('Offline changes synced');
          return;
        }

        if (!lastHash && hasMeaningfulData(local) && hasMeaningfulData(row.data)) {
          setConflict({ cloud: row.data, local });
          setStatus('error');
          setStatusMessage('Choose which copy to keep');
          return;
        }

        update(() => row.data);
        saveSyncMarker(row.data, row.updated_at);
        setLastSyncedAt(row.updated_at);
        setStatus('synced');
        setStatusMessage('Cloud data loaded');
      } catch (cause) {
        if (!active) return;
        setStatus(navigator.onLine ? 'error' : 'offline');
        setStatusMessage(navigator.onLine ? (cause instanceof Error ? cause.message : 'Cloud sync failed') : 'Offline · changes stay on this device');
      }
    })();

    return () => { active = false; };
  }, [authReady, hydrated, session, update]);

  useEffect(() => {
    if (!hydrated || !session || initializedUser.current !== session.user.id || migrationOpen || conflict || syncing.current) return;
    const currentHash = dataHash(data);
    if (currentHash === safeGet(LAST_SYNC_HASH_KEY)) return;
    if (!navigator.onLine) {
      setStatus('offline');
      setStatusMessage('Offline · changes will sync later');
      return;
    }

    const timer = window.setTimeout(() => {
      syncing.current = true;
      setStatus('syncing');
      setStatusMessage('Syncing…');
      void saveSplitzapCloudState(session.user.id, latestData.current)
        .then((updatedAt) => {
          saveSyncMarker(latestData.current, updatedAt);
          setLastSyncedAt(updatedAt);
          setStatus('synced');
          setStatusMessage('Synced');
        })
        .catch((cause) => {
          setStatus(navigator.onLine ? 'error' : 'offline');
          setStatusMessage(navigator.onLine ? (cause instanceof Error ? cause.message : 'Cloud sync failed') : 'Offline · changes will sync later');
        })
        .finally(() => { syncing.current = false; });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [conflict, data, hydrated, migrationOpen, session]);

  useEffect(() => {
    const onOffline = () => { if (session) { setStatus('offline'); setStatusMessage('Offline · changes will sync later'); } };
    const onOnline = () => {
      if (!session) return;
      const current = latestData.current;
      if (dataHash(current) !== safeGet(LAST_SYNC_HASH_KEY)) {
        setStatus('syncing');
        setStatusMessage('Back online · syncing…');
        void saveSplitzapCloudState(session.user.id, current).then((updatedAt) => {
          saveSyncMarker(current, updatedAt);
          setLastSyncedAt(updatedAt);
          setStatus('synced');
          setStatusMessage('Synced');
        }).catch(() => { setStatus('error'); setStatusMessage('Cloud sync failed'); });
      } else {
        setStatus('synced');
        setStatusMessage('Synced');
      }
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => { window.removeEventListener('offline', onOffline); window.removeEventListener('online', onOnline); };
  }, [session]);

  const migrate = async () => {
    if (!session) return;
    setStatus('syncing');
    setStatusMessage('Saving device data online…');
    try {
      const current = latestData.current;
      const updatedAt = await saveSplitzapCloudState(session.user.id, current);
      saveSyncMarker(current, updatedAt);
      setLastSyncedAt(updatedAt);
      setMigrationOpen(false);
      setStatus('synced');
      setStatusMessage('Synced');
    } catch (cause) {
      setStatus('error');
      setStatusMessage(cause instanceof Error ? cause.message : 'Could not move data online');
    }
  };

  const keepLocalConflict = async () => {
    if (!session || !conflict) return;
    const updatedAt = await saveSplitzapCloudState(session.user.id, conflict.local);
    saveSyncMarker(conflict.local, updatedAt);
    setLastSyncedAt(updatedAt);
    setConflict(null);
    setStatus('synced');
    setStatusMessage('Device copy saved online');
  };

  const keepCloudConflict = () => {
    if (!conflict) return;
    update(() => conflict.cloud);
    saveSyncMarker(conflict.cloud);
    setConflict(null);
    setStatus('synced');
    setStatusMessage('Cloud copy loaded');
  };

  const indicatorClass = status === 'synced' ? 'bg-emerald-500' : status === 'syncing' || status === 'connecting' ? 'bg-amber-400' : status === 'error' ? 'bg-red-500' : 'bg-slate-400';
  const accountInitial = (data.myName?.trim()?.[0] || session?.user.email?.[0] || '').toUpperCase();
  const accountAction = (
    <button
      type="button"
      onClick={() => setAccountOpen(true)}
      aria-label={session ? `Account · ${statusMessage}` : 'Sign in to sync'}
      title={session ? statusMessage : 'Sign in to sync'}
      className="press relative grid size-9 place-items-center rounded-full border border-border bg-surface text-primary shadow-sm"
    >
      {status === 'syncing' || status === 'connecting'
        ? <Loader2 size={15} className="animate-spin" />
        : session && accountInitial
          ? <span className="text-xs font-extrabold">{accountInitial}</span>
          : <UserRound size={16} />}
      <span aria-hidden="true" className={`absolute right-0 top-0 size-2.5 rounded-full border-2 border-surface ${indicatorClass}`} />
    </button>
  );

  return (
    <>
      <SplitzapAppV4 accountAction={accountAction} />
      <AccountSheet
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        session={session}
        status={status}
        statusMessage={statusMessage}
        lastSyncedAt={lastSyncedAt}
        recoveryMode={recoveryMode}
        onRecoveryComplete={() => setRecoveryMode(false)}
      />

      {migrationOpen ? (
        <SimpleModal title="Move this device's Splitzap data online" onClose={() => setMigrationOpen(false)}>
          <p className="text-sm leading-6 text-slate-600">We found {data.groups.length} {data.groups.length === 1 ? 'group' : 'groups'} on this device. Save them to your account so they can follow you to other devices.</p>
          <button type="button" onClick={() => void migrate()} className="mt-4 w-full rounded-xl bg-[#256f66] px-4 py-3 text-sm font-bold text-white">Save device data online</button>
          <button type="button" onClick={() => setMigrationOpen(false)} className="mt-2 w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700">Not now</button>
        </SimpleModal>
      ) : null}

      {conflict ? (
        <SimpleModal title="Two different Splitzap copies found" closable={false}>
          <p className="text-sm leading-6 text-slate-600">This device and your cloud account both contain data. Choose which copy should become your main Splitzap data.</p>
          <div className="mt-4 grid gap-2">
            <button type="button" onClick={() => void keepLocalConflict()} className="rounded-xl bg-[#256f66] px-4 py-3 text-left text-sm font-bold text-white">Keep this device · {conflict.local.groups.length} groups</button>
            <button type="button" onClick={keepCloudConflict} className="rounded-xl bg-slate-100 px-4 py-3 text-left text-sm font-bold text-slate-800">Use cloud copy · {conflict.cloud.groups.length} groups</button>
          </div>
        </SimpleModal>
      ) : null}
    </>
  );
}

function AccountSheet({ open, onClose, session, status, statusMessage, lastSyncedAt, recoveryMode, onRecoveryComplete }: {
  open: boolean;
  onClose: () => void;
  session: SplitzapSession | null;
  status: SyncStatus;
  statusMessage: string;
  lastSyncedAt: string | null;
  recoveryMode: boolean;
  onRecoveryComplete: () => void;
}) {
  const [mode, setMode] = useState<EmailMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [passwordEditorOpen, setPasswordEditorOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !recoveryMode) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, open, recoveryMode]);

  useEffect(() => {
    if (recoveryMode) {
      setPasswordEditorOpen(true);
      setFeedback('Set a new password to finish account recovery.');
    }
  }, [recoveryMode]);

  if (!open) return null;

  const runGoogle = async () => {
    setBusy(true);
    setFeedback('');
    try {
      await signInSplitzapWithGoogle();
    } catch (cause) {
      setBusy(false);
      setFeedback(friendlyAuthError(cause));
    }
  };

  const runEmailAuth = async () => {
    if (!email.trim() || !password) return;
    if (mode === 'signup' && password.length < 8) {
      setFeedback('Use at least 8 characters for your password.');
      return;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setFeedback('Passwords do not match.');
      return;
    }
    setBusy(true);
    setFeedback('');
    try {
      if (mode === 'signin') {
        await signInSplitzapWithPassword(email, password);
        setFeedback('Signed in. Loading your Splitzap data…');
      } else {
        const result = await signUpSplitzapWithPassword(email, password);
        if (result.user?.identities?.length === 0) {
          setFeedback('An account may already exist for this email. Try Sign in instead.');
        } else if (!result.session) {
          setFeedback('Account created. Verification email sent. This used 1 email from the shared 2-per-hour test allowance.');
        } else {
          setFeedback('Account created. Loading your Splitzap data…');
        }
      }
    } catch (cause) {
      setFeedback(friendlyAuthError(cause));
    } finally {
      setBusy(false);
    }
  };

  const runPasswordReset = async () => {
    if (!email.trim()) {
      setFeedback('Enter your email first.');
      return;
    }
    setBusy(true);
    setFeedback('');
    try {
      await sendSplitzapPasswordReset(email);
      setFeedback('Password reset email sent. This action used 1 email from the shared 2-per-hour test allowance.');
      setResetOpen(false);
    } catch (cause) {
      setFeedback(friendlyAuthError(cause));
    } finally {
      setBusy(false);
    }
  };

  const runPasswordUpdate = async () => {
    if (newPassword.length < 8) {
      setFeedback('Use at least 8 characters for your password.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setFeedback('Passwords do not match.');
      return;
    }
    setBusy(true);
    setFeedback('');
    try {
      await updateSplitzapPassword(newPassword);
      setFeedback(recoveryMode ? 'Password reset complete. You can use email + password next time.' : 'Password saved. Email + password sign-in is now available for this account.');
      setPasswordEditorOpen(false);
      setNewPassword('');
      setConfirmNewPassword('');
      if (recoveryMode) onRecoveryComplete();
    } catch (cause) {
      setFeedback(friendlyAuthError(cause));
    } finally {
      setBusy(false);
    }
  };

  const statusIcon = status === 'offline' ? <CloudOff size={16} /> : status === 'syncing' || status === 'connecting' ? <Loader2 size={16} className="animate-spin" /> : <Cloud size={16} />;
  const providers = session?.user.identities?.map((identity) => identity.provider) ?? [];

  return (
    <div className="fixed inset-0 z-[125] flex items-end justify-center" role="presentation">
      {!recoveryMode ? <button type="button" aria-label="Close account" onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" /> : <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />}
      <section role="dialog" aria-modal="true" aria-label={session ? 'Splitzap account' : 'Sign in to Splitzap'} className="relative max-h-[92dvh] w-full max-w-[520px] overflow-y-auto rounded-t-[28px] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl">
        <div className="mx-auto h-1 w-10 rounded-full bg-slate-200" />
        <div className="flex items-center justify-between gap-3 pb-3 pt-3">
          <div><h2 className="text-lg font-extrabold text-slate-900">{session ? 'Account & sync' : 'Keep your data synced'}</h2><p className="mt-0.5 text-xs text-slate-500">{session ? 'Your Splitzap account and cloud status' : 'Sign in once, use Splitzap across devices'}</p></div>
          {!recoveryMode ? <button type="button" onClick={onClose} aria-label="Close" className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500"><X size={15} /></button> : null}
        </div>

        {session ? (
          <div>
            <div className="rounded-2xl bg-[#eef6f3] p-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-extrabold text-slate-900">{session.user.email}</p><div className="mt-2 flex flex-wrap gap-1.5">{providers.length ? providers.map((provider) => <span key={provider} className="rounded-full bg-white px-2 py-1 text-[10px] font-bold capitalize text-slate-600">{provider}</span>) : <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-slate-600">email</span>}</div></div><ShieldCheck size={20} className="shrink-0 text-[#256f66]" /></div>
              <div className="mt-3 flex items-center gap-2 text-xs font-bold text-[#256f66]">{statusIcon}<span>{statusMessage}</span></div>
              {lastSyncedAt ? <p className="mt-1 text-[11px] text-slate-500">Last cloud sync: {new Date(lastSyncedAt).toLocaleString()}</p> : null}
            </div>

            <button type="button" onClick={() => setPasswordEditorOpen((value) => !value)} className="mt-3 flex min-h-12 w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 text-left">
              <span className="grid size-9 place-items-center rounded-xl bg-slate-100 text-[#256f66]"><KeyRound size={17} /></span>
              <span className="min-w-0 flex-1"><b className="block text-sm">Set / change password</b><span className="text-[11px] text-slate-500">Enable email + password sign-in for this same account</span></span>
            </button>

            {passwordEditorOpen ? (
              <div className="mt-3 rounded-2xl border border-slate-200 p-3">
                {recoveryMode ? <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-semibold leading-4 text-amber-800">Password recovery is active. Set your new password below.</p> : null}
                <PasswordInput label="New password" value={newPassword} onChange={setNewPassword} show={showPassword} onToggle={() => setShowPassword((value) => !value)} />
                <PasswordInput label="Confirm password" value={confirmNewPassword} onChange={setConfirmNewPassword} show={showPassword} />
                <button type="button" disabled={busy || newPassword.length < 8 || newPassword !== confirmNewPassword} onClick={() => void runPasswordUpdate()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#256f66] px-4 py-3 text-sm font-bold text-white disabled:opacity-45">{busy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />} Save password</button>
              </div>
            ) : null}

            {feedback ? <p role="status" className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">{feedback}</p> : null}
            <p className="mt-3 text-xs leading-5 text-slate-500">Expenses continue saving instantly on this device. When online, Splitzap also keeps the latest copy in your private cloud account.</p>
            <button type="button" onClick={() => void signOutSplitzap().then(onClose)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700"><LogOut size={16} /> Sign out</button>
          </div>
        ) : (
          <div>
            <button type="button" disabled={busy} onClick={() => void runGoogle()} className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 shadow-sm disabled:opacity-50">
              <GoogleMark /> Continue with Google
            </button>
            <div className="my-4 flex items-center gap-3"><span className="h-px flex-1 bg-slate-200" /><span className="text-[11px] font-semibold text-slate-400">or use email</span><span className="h-px flex-1 bg-slate-200" /></div>

            <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
              <button type="button" onClick={() => { setMode('signin'); setFeedback(''); setResetOpen(false); }} className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === 'signin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Sign in</button>
              <button type="button" onClick={() => { setMode('signup'); setFeedback(''); setResetOpen(false); }} className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Create account</button>
            </div>

            <label className="mt-4 block text-xs font-bold text-slate-600">Email</label>
            <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-[#256f66] focus:ring-2 focus:ring-[#256f66]/10" />
            <PasswordInput label="Password" value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword((value) => !value)} />
            {mode === 'signup' ? <PasswordInput label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} show={showPassword} /> : null}

            {mode === 'signup' ? <EmailAllowanceNotice action="Creating an account" /> : null}

            <button type="button" disabled={busy || !email.trim() || !password || (mode === 'signup' && (password.length < 8 || password !== confirmPassword))} onClick={() => void runEmailAuth()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#256f66] px-4 py-3 text-sm font-bold text-white disabled:opacity-45">{busy ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}{mode === 'signin' ? 'Sign in with email' : 'Create account · sends 1 email'}</button>

            {mode === 'signin' ? <button type="button" onClick={() => setResetOpen((value) => !value)} className="mt-3 w-full text-center text-xs font-bold text-[#256f66]">Forgot password?</button> : null}
            {resetOpen ? <div className="mt-3"><EmailAllowanceNotice action="Password reset" /><button type="button" disabled={busy || !email.trim()} onClick={() => void runPasswordReset()} className="mt-2 w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-bold text-amber-800 disabled:opacity-45">Send reset email · uses 1 email</button></div> : null}
            {feedback ? <p role="status" className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">{feedback}</p> : null}
          </div>
        )}
      </section>
    </div>
  );
}

function EmailAllowanceNotice({ action }: { action: string }) {
  return <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5"><div className="flex items-start gap-2"><Mail size={15} className="mt-0.5 shrink-0 text-amber-700" /><div><p className="text-[11px] font-extrabold text-amber-900">Temporary email limit</p><p className="mt-0.5 text-[11px] leading-4 text-amber-800">{action} sends 1 email. Supabase's current test sender allows only 2 authentication emails per hour across the whole Splitzap project.</p><div className="mt-2 flex gap-2 text-[10px] font-bold text-amber-800"><span className="rounded-full bg-white/70 px-2 py-1">This action: 1 email</span><span className="rounded-full bg-white/70 px-2 py-1">Hourly test allowance: 2</span></div></div></div></div>;
}

function PasswordInput({ label, value, onChange, show, onToggle }: { label: string; value: string; onChange: (value: string) => void; show: boolean; onToggle?: () => void }) {
  return <div className="mt-3"><label className="block text-xs font-bold text-slate-600">{label}</label><div className="relative mt-1"><input type={show ? 'text' : 'password'} autoComplete={label.toLowerCase().includes('new') || label.toLowerCase().includes('confirm') ? 'new-password' : 'current-password'} value={value} onChange={(event) => onChange(event.target.value)} placeholder="At least 8 characters" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 pr-11 text-sm outline-none focus:border-[#256f66] focus:ring-2 focus:ring-[#256f66]/10" />{onToggle ? <button type="button" onClick={onToggle} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-1 top-1 grid size-10 place-items-center rounded-lg text-slate-500">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button> : null}</div></div>;
}

function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px]"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.93A6.02 6.02 0 0 1 6.07 12c0-.67.12-1.32.32-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.55l3.35-2.62Z"/><path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"/></svg>;
}

function SimpleModal({ title, onClose, children, closable = true }: { title: string; onClose?: () => void; children: React.ReactNode; closable?: boolean }) {
  return (
    <div className="fixed inset-0 z-[130] grid place-items-center bg-black/40 px-5 backdrop-blur-[2px]" role="presentation">
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-[400px] rounded-3xl bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-base font-extrabold text-slate-900">{title}</h2>{closable && onClose ? <button type="button" onClick={onClose} aria-label="Close" className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500"><X size={15} /></button> : null}</div>
        {children}
      </div>
    </div>
  );
}
'''

(ROOT / 'src/features/splitzap/splitzapCloud.ts').write_text(cloud_ts, encoding='utf-8')
(ROOT / 'src/features/splitzap/SplitzapCloudApp.tsx').write_text(cloud_app_tsx, encoding='utf-8')

app_path = ROOT / 'src/features/splitzap/SplitzapAppV4.tsx'
app = app_path.read_text(encoding='utf-8')
replacements = [
    (
        'export default function SplitzapAppV4() {',
        'export default function SplitzapAppV4({ accountAction }: { accountAction?: ReactNode } = {}) {'
    ),
    (
        '<HomeScreen navigate={navigate} onDataBackup={() => setDataToolsOpen(true)} />',
        '<HomeScreen navigate={navigate} onDataBackup={() => setDataToolsOpen(true)} accountAction={accountAction} />'
    ),
    (
        'function HomeScreen({ navigate, onDataBackup }: { navigate: (view: View) => void; onDataBackup: () => void }) {',
        'function HomeScreen({ navigate, onDataBackup, accountAction }: { navigate: (view: View) => void; onDataBackup: () => void; accountAction?: ReactNode }) {'
    ),
    (
        'right={<div className="flex items-center gap-1.5"><button type="button" onClick={() => data.groups.length ? setScannerOpen(true) : setGroupOpen(true)}',
        'right={<div className="flex items-center gap-1.5">{accountAction}<button type="button" onClick={() => data.groups.length ? setScannerOpen(true) : setGroupOpen(true)}'
    ),
    (
        'Your Splitzap data lives on this device',
        'Keep an extra copy of your Splitzap data'
    ),
]
for old, new in replacements:
    if old not in app:
        raise SystemExit(f'Missing expected SplitzapAppV4 pattern: {old[:100]}')
    app = app.replace(old, new, 1)
app_path.write_text(app, encoding='utf-8')

print('Splitzap auth upgrade applied')
