import { Cloud, CloudOff, Loader2, LogOut, Mail, UserRound, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import SplitzapAppV4 from './SplitzapAppV4';
import { useSplitData, type SplitData } from './splitStoreV4';
import {
  fetchSplitzapCloudState,
  getSplitzapSession,
  onSplitzapAuthChange,
  saveSplitzapCloudState,
  sendSplitzapMagicLink,
  signOutSplitzap,
  type SplitzapSession,
} from './splitzapCloud';

type SyncStatus = 'local' | 'connecting' | 'syncing' | 'synced' | 'offline' | 'error';
type Conflict = { cloud: SplitData; local: SplitData } | null;

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

export default function SplitzapCloudApp() {
  const { data, update, hydrated } = useSplitData();
  const [session, setSession] = useState<SplitzapSession | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [migrationOpen, setMigrationOpen] = useState(false);
  const [conflict, setConflict] = useState<Conflict>(null);
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
    const unsubscribe = onSplitzapAuthChange((next) => {
      if (!active) return;
      setSession(next);
      initializedUser.current = null;
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

  return (
    <>
      <SplitzapAppV4 />
      <button
        type="button"
        onClick={() => setAccountOpen(true)}
        aria-label={session ? `Splitzap account · ${statusMessage}` : 'Sign in to sync Splitzap'}
        title={session ? statusMessage : 'Sign in to sync'}
        className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-4 z-[105] grid size-11 place-items-center rounded-full border border-black/10 bg-white text-[#256f66] shadow-lg"
      >
        {status === 'syncing' || status === 'connecting' ? <Loader2 size={18} className="animate-spin" /> : session ? (status === 'offline' ? <CloudOff size={18} /> : <Cloud size={18} />) : <UserRound size={18} />}
        <span aria-hidden="true" className={`absolute right-0.5 top-0.5 size-2.5 rounded-full border-2 border-white ${indicatorClass}`} />
      </button>

      <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} session={session} status={status} statusMessage={statusMessage} lastSyncedAt={lastSyncedAt} />

      {migrationOpen ? (
        <SimpleModal title="Move this device's Splitzap data online" onClose={() => setMigrationOpen(false)}>
          <p className="text-sm leading-6 text-slate-600">We found {data.groups.length} {data.groups.length === 1 ? 'group' : 'groups'} on this device. Save them to your account so they can follow you to other devices.</p>
          <button type="button" onClick={() => void migrate()} className="mt-4 w-full rounded-xl bg-[#256f66] px-4 py-3 text-sm font-bold text-white">Save device data online</button>
          <button type="button" onClick={() => setMigrationOpen(false)} className="mt-2 w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700">Not now</button>
        </SimpleModal>
      ) : null}

      {conflict ? (
        <SimpleModal title="Two different Splitzap copies found" onClose={() => undefined}>
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

function AccountDialog({ open, onClose, session, status, statusMessage, lastSyncedAt }: { open: boolean; onClose: () => void; session: SplitzapSession | null; status: SyncStatus; statusMessage: string; lastSyncedAt: string | null }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const statusIcon = useMemo(() => status === 'offline' ? <CloudOff size={17} /> : status === 'syncing' || status === 'connecting' ? <Loader2 size={17} className="animate-spin" /> : <Cloud size={17} />, [status]);
  if (!open) return null;

  const sendLink = async () => {
    if (!email.trim()) return;
    setSending(true);
    setFeedback('');
    try {
      await sendSplitzapMagicLink(email);
      setFeedback('Sign-in link sent. Open the email on this device and tap the link.');
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : 'Could not send the sign-in email.');
    } finally { setSending(false); }
  };

  return (
    <SimpleModal title={session ? 'Splitzap account' : 'Sync Splitzap'} onClose={onClose}>
      {session ? (
        <div>
          <div className="rounded-2xl bg-[#eef6f3] p-3">
            <p className="text-sm font-extrabold text-slate-900">{session.user.email}</p>
            <div className="mt-2 flex items-center gap-2 text-xs font-bold text-[#256f66]">{statusIcon}<span>{statusMessage}</span></div>
            {lastSyncedAt ? <p className="mt-1 text-[11px] text-slate-500">Last cloud sync: {new Date(lastSyncedAt).toLocaleString()}</p> : null}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">Expenses still save instantly on this device. When online, Splitzap also keeps the latest copy in your private cloud account.</p>
          <button type="button" onClick={() => void signOutSplitzap().then(onClose)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700"><LogOut size={16} /> Sign out</button>
        </div>
      ) : (
        <div>
          <div className="rounded-2xl bg-[#eef6f3] p-3">
            <div className="flex items-start gap-2"><Mail size={18} className="mt-0.5 text-[#256f66]" /><div><p className="text-sm font-extrabold">Your data can follow you</p><p className="mt-1 text-xs leading-5 text-slate-500">Sign in by email. No password needed.</p></div></div>
          </div>
          <label className="mt-4 block text-xs font-bold text-slate-600">Email</label>
          <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-[#256f66]" />
          <button type="button" disabled={sending || !email.trim()} onClick={() => void sendLink()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#256f66] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{sending ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />} Send sign-in link</button>
          {feedback ? <p role="status" className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">{feedback}</p> : null}
        </div>
      )}
    </SimpleModal>
  );
}

function SimpleModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[130] grid place-items-center bg-black/40 px-5 backdrop-blur-[2px]" role="presentation">
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-[400px] rounded-3xl bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-base font-extrabold text-slate-900">{title}</h2>{onClose.toString() !== (() => undefined).toString() ? <button type="button" onClick={onClose} aria-label="Close" className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500"><X size={15} /></button> : null}</div>
        {children}
      </div>
    </div>
  );
}
