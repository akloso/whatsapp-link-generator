import { createClient, type AuthChangeEvent, type Session } from '@supabase/supabase-js';
import type { SplitData } from './splitStoreV4';
import { assertSplitDataIntegrity } from './splitzapFinancialIntegrity';

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
  assertSplitDataIntegrity(data);
  const updatedAt = new Date().toISOString();
  const { error } = await splitzapSupabase
    .from('splitzap_user_state')
    .upsert({ user_id: userId, data, updated_at: updatedAt }, { onConflict: 'user_id' });
  if (error) throw error;
  return updatedAt;
}
