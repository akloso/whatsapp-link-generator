import { splitzapSupabase } from './splitzapCloud';

export type SplitzapNotificationPreferences = {
  expenses: boolean;
  payments: boolean;
  group_activity: boolean;
};

export type NativePushTokenDetail = {
  token: string;
  platform: 'android';
  appVersion?: string;
  permission?: 'granted' | 'not-granted';
};

const PUSH_TOKEN_KEY = 'splitzap.native.pushToken.v1';
const ANDROID_UA_MARKER = 'SplitzapAndroid/';

export function isSplitzapAndroidApp() {
  return typeof navigator !== 'undefined' && navigator.userAgent.includes(ANDROID_UA_MARKER);
}

export function readStoredNativePushToken(): NativePushTokenDetail | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PUSH_TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NativePushTokenDetail;
    if (!parsed || parsed.platform !== 'android' || typeof parsed.token !== 'string' || parsed.token.length < 20) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function storeNativePushToken(detail: NativePushTokenDetail) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(PUSH_TOKEN_KEY, JSON.stringify(detail)); } catch { /* best effort */ }
}

export function listenForNativePushToken(callback: (detail: NativePushTokenDetail) => void) {
  if (typeof window === 'undefined') return () => undefined;
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<NativePushTokenDetail>).detail;
    if (!detail || detail.platform !== 'android' || typeof detail.token !== 'string' || detail.token.length < 20) return;
    storeNativePushToken(detail);
    callback(detail);
  };
  window.addEventListener('splitzap:native-push-token', handler as EventListener);
  return () => window.removeEventListener('splitzap:native-push-token', handler as EventListener);
}

export function listenForNativeNotificationStatus(callback: (permission: 'granted' | 'not-granted') => void) {
  if (typeof window === 'undefined') return () => undefined;
  const handler = (event: Event) => {
    const permission = (event as CustomEvent<{ permission?: string }>).detail?.permission;
    if (permission === 'granted' || permission === 'not-granted') callback(permission);
  };
  window.addEventListener('splitzap:native-notification-status', handler as EventListener);
  return () => window.removeEventListener('splitzap:native-notification-status', handler as EventListener);
}

export async function registerSplitzapPushDevice(detail: NativePushTokenDetail) {
  const { error } = await splitzapSupabase.rpc('splitzap_register_push_device', {
    p_token: detail.token,
    p_platform: 'android',
    p_app_version: detail.appVersion ?? null,
  });
  if (error) throw error;
}

export async function unregisterStoredSplitzapPushDevice() {
  const detail = readStoredNativePushToken();
  if (!detail) return;
  const { error } = await splitzapSupabase.rpc('splitzap_unregister_push_device', { p_token: detail.token });
  if (error) throw error;
}

export async function getSplitzapNotificationPreferences(): Promise<SplitzapNotificationPreferences> {
  const { data, error } = await splitzapSupabase.rpc('splitzap_get_notification_preferences');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    expenses: row?.expenses !== false,
    payments: row?.payments !== false,
    group_activity: row?.group_activity !== false,
  };
}

export async function updateSplitzapNotificationPreferences(preferences: SplitzapNotificationPreferences) {
  const { data, error } = await splitzapSupabase.rpc('splitzap_update_notification_preferences', {
    p_expenses: preferences.expenses,
    p_payments: preferences.payments,
    p_group_activity: preferences.group_activity,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    expenses: row?.expenses !== false,
    payments: row?.payments !== false,
    group_activity: row?.group_activity !== false,
  } satisfies SplitzapNotificationPreferences;
}

export function requestNativeNotificationPermission() {
  if (!isSplitzapAndroidApp() || typeof window === 'undefined') return false;
  window.location.href = 'splitzap-native://notifications/request-permission';
  return true;
}
