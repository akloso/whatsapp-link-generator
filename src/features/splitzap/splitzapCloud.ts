import { createClient, type Session } from '@supabase/supabase-js';
import type { SplitData } from './splitStoreV4';

export type SplitzapSession = Session;

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

export async function getSplitzapSession(): Promise<Session | null> {
  const { data, error } = await splitzapSupabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onSplitzapAuthChange(callback: (session: Session | null) => void) {
  const { data } = splitzapSupabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function sendSplitzapMagicLink(email: string) {
  const { error } = await splitzapSupabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      emailRedirectTo: `${window.location.origin}/splitzap`,
    },
  });
  if (error) throw error;
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
