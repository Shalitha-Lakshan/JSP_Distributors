/**
 * Sri Lankan phone number validation helper.
 * Phone is optional. If provided, checks for common Sri Lankan phone patterns:
 * - 10 digits starting with 0 (e.g. 0771234567, 0112345678)
 * - 9 digits without leading 0 (e.g. 771234567)
 * - International format with +94 or 94 (e.g. +94771234567, 94771234567)
 */
export function validateSriLankanPhone(phone?: string): { isValid: boolean; error?: string } {
  if (!phone || !phone.trim()) {
    return { isValid: true };
  }

  const cleaned = phone.replace(/[\s\-\(\)]/g, "");

  // Match Sri Lankan phone patterns:
  // Optional +94 or 94 or 0, followed by valid 9 digits
  const lkRegex = /^(?:(?:\+94|94|0)?[1-9]\d{8})$/;

  if (!lkRegex.test(cleaned)) {
    return {
      isValid: false,
      error: "Please enter a valid Sri Lankan phone number (e.g. 077 123 4567 or +94 77 123 4567)"
    };
  }

  return { isValid: true };
}

