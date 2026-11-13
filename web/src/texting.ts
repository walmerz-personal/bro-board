// Texting: phone numbers and the link that opens his Messages app.
//
// A website cannot send a text by itself. It can only open the Messages app
// with the person and the message filled in; he then taps Send there. The text
// comes from his own number.

/** Phone numbers without a + are taken as US / Canada numbers. */
export const DEFAULT_COUNTRY_CODE = '1';

/** Added after the phrase so people know where the text came from. */
export const TEXT_NOTE = '(sent from Bro Board)';

/**
 * Turn a number as family type it into the international form (+15551234567),
 * or null if it does not look like a phone number.
 * "(555) 123-4567", "555.123.4567", "1 555 123 4567" and "+44 7700 900123" all work.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) {
    return /^[1-9]\d{6,14}$/.test(digits) ? `+${digits}` : null;
  }
  if (digits.length === 10 && /^[2-9]/.test(digits)) return `+${DEFAULT_COUNTRY_CODE}${digits}`;
  if (digits.length === 11 && digits.startsWith(DEFAULT_COUNTRY_CODE) && /^[2-9]/.test(digits.slice(1))) {
    return `+${digits}`;
  }
  return null;
}

/** Whether a stored number is in the international form. */
export function isStoredPhone(value: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(value);
}

/** A stored number written the way people read it: +1 (555) 123-4567. */
export function formatPhone(e164: string): string {
  const us = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return us ? `(${us[1]}) ${us[2]}-${us[3]}` : e164;
}

/** The words that go in the text. */
export function textBody(phrase: string): string {
  return `${phrase.trim()} ${TEXT_NOTE}`;
}

/**
 * The link that opens Messages with the number and words filled in.
 * "?&body=" works on Android and on iPhones.
 */
export function smsLink(phone: string, phrase: string): string {
  return `sms:${phone}?&body=${encodeURIComponent(textBody(phrase))}`;
}
