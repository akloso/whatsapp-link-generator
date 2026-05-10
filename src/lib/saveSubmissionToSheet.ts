type SubmissionPayload = {
  phoneNumber: string;
  countryCode: string;
  message: string;
  generatedLink: string;
};

const WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbzf7n0X0dLTY51Djnrr_bhXa4q4azIim9IyAa1p1wm9g82N-qeqSN85jntH2y6urNmyUQ/exec';

export const saveSubmissionToSheet = async (payload: SubmissionPayload) => {
  const sheetPayload = {
    phone_number: payload.phoneNumber,
    country_code: payload.countryCode,
    message: payload.message,
    generated_link: payload.generatedLink,
    consent: true,
    created_at: new Date().toISOString(),
  };

  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify(sheetPayload),
    });
  } catch (error) {
    console.warn('Failed to save submission to Google Sheets.', error);
  }
};
