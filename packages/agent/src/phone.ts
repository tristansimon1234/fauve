// Phone numbers are stored in E.164 (+33612345678). French numbers typed
// locally ("06 12 34 56 78") are accepted and converted.
export function normalizePhone(input: string, defaultCountryCode = "33"): string | null {
  const trimmed = input.trim();
  let digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    // already international
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0") && digits.length === 10) {
    digits = defaultCountryCode + digits.slice(1);
  }
  return /^[1-9]\d{6,14}$/.test(digits) ? `+${digits}` : null;
}

/** "+33612345678" → "+33 6 12 34 56 78" for display. */
export function formatPhone(e164: string): string {
  const m = /^\+33(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(e164);
  return m ? `+33 ${m.slice(1).join(" ")}` : e164;
}
