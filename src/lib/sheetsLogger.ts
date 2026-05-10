const GOOGLE_SHEETS_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbzf7n0X0dLTY51Djnrr_bhXa4q4azIim9IyAa1p1wm9g82N-qeqSN85jntH2y6urNmyUQ/exec';

type SheetsPayload = {
  phone_number: string;
  country_code: string;
  message: string;
  generated_link: string;
  consent: boolean;
  created_at: string;
};

export const logToGoogleSheets = (payload: SheetsPayload) => {
  fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
    method: 'POST',
    mode: 'no-cors',
    body: JSON.stringify(payload),
  }).catch((error) => {
    console.warn('Google Sheets logging failed:', error);
  });
};

