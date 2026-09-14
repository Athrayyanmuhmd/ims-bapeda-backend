const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Indonesian mobile: 08… / 62… / +62…, 9–13 digits after the leading 8.
const PHONE_ID_RE = /^(\+62|62|0)8[1-9][0-9]{7,11}$/;

export const isValidEmail = (email: string): boolean => EMAIL_RE.test(email);

export const isValidPhoneId = (phone: string): boolean => {
  const compact = phone.replace(/[\s\-()]/g, "");
  return PHONE_ID_RE.test(compact);
};
