export const appConfig = {
  googleSheetsWebhookUrl: import.meta.env.VITE_GOOGLE_SHEETS_WEBHOOK_URL || '',
  analyticsEnabled: true,
  dataRetentionLabel: 'limited time',
};

export function isGoogleSheetsLoggingEnabled() {
  return Boolean(appConfig.googleSheetsWebhookUrl);
}
