type SubmissionPayload = {
  phoneNumber: string;
  countryCode: string;
  message: string;
  generatedLink: string;
};

const WEBHOOK_URL = import.meta.env.VITE_GOOGLE_SHEETS_WEBHOOK_URL;

export const saveSubmissionToSheet = async (payload: SubmissionPayload) => {
  if (!WEBHOOK_URL) {
    console.warn('Google Sheets webhook URL is not configured. Skipping submission logging.');
    return;
  }

  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // fire-and-forget by design; intentionally swallow errors
  }
};
