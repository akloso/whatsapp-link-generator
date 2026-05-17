import { appConfig, isGoogleSheetsLoggingEnabled } from '../config';

type SheetsPayload = {
  phone_number: string;
  country_code: string;
  message: string;
  generated_link: string;
  user_action_consent: boolean;
  created_at: string;
};

export const logToGoogleSheets = (payload: SheetsPayload) => {
  if (!isGoogleSheetsLoggingEnabled()) {
    if (import.meta.env.DEV) {
      console.warn('Google Sheets logging skipped: VITE_GOOGLE_SHEETS_WEBHOOK_URL is not set.');
    }
    return;
  }

  fetch(appConfig.googleSheetsWebhookUrl, {
    method: 'POST',
    mode: 'no-cors',
    body: JSON.stringify(payload),
  }).catch((error) => {
    console.warn('Google Sheets logging failed:', error);
  });
};
