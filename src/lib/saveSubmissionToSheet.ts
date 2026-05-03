const SHEET_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbzf7n0X0dLTY51Djnrr_bhXa4q4azIim9IyAa1p1wm9g82N-qeqSN85jntH2y6urNmyUQ/exec';

export type SheetSubmissionPayload = {
  phone_number: string;
  country_code: string;
  message: string;
  generated_link: string;
  consent: boolean;
  created_at: string;
};

export async function saveSubmissionToSheet(payload: SheetSubmissionPayload): Promise<void> {
  try {
    const response = await fetch(SHEET_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn('Failed to save submission to Google Sheets:', response.status, response.statusText);
    }
  } catch (error) {
    console.warn('Failed to save submission to Google Sheets:', error);
  }
}
