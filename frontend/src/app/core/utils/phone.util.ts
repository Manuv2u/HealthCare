/**
 * Normalise a typed or pasted Indian mobile number down to its 10 digits.
 *
 * Naive `replace(/\D/g,'').slice(0,10)` silently corrupts a pasted
 * "+91 98765 43210" into "9198765432" — the right digits, shifted. Strip the
 * country code first, then take 10.
 */
export function normalizeIndianMobile(raw: string): string {
  let digits = (raw ?? '').replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length > 10 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

/**
 * Rewrite an input's value in place to the normalised number, keeping the bound
 * control in sync. Returns the cleaned value.
 */
export function sanitizePhoneInput(event: Event, apply: (v: string) => void): string {
  const input = event.target as HTMLInputElement;
  const digits = normalizeIndianMobile(input.value);
  if (digits !== input.value) {
    input.value = digits;
    apply(digits);
  }
  return digits;
}

/**
 * Same idea as sanitizePhoneInput, but for a combined "email or phone" field.
 * Only touches the value when it looks like a phone number (no "@", and
 * mostly digits/+/spaces/dashes) — an email is left completely untouched.
 * Handles the common case where a browser autofills or a user pastes a
 * number with the +91/91 country code prefix still attached.
 */
export function sanitizeIdentifierInput(event: Event, apply: (v: string) => void): string {
  const input = event.target as HTMLInputElement;
  const raw = input.value;

  if (raw.includes('@') || !/^[\d+\-\s()]+$/.test(raw)) {
    return raw;
  }

  const digits = normalizeIndianMobile(raw);
  if (digits.length === 10 && digits !== raw) {
    input.value = digits;
    apply(digits);
    return digits;
  }
  return raw;
}
