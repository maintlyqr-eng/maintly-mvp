// Shared validation for a Maintler's public contact info (Settings' Contact
// Info form, migration 026) — the fields a mechanic fills in that then show
// up as clickable links on their public /maintler/[code] card, and again as
// quick-contact icons in Settings itself. Two jobs, used in two places:
//
// 1. Save-time gate (normalizeContactUrl / isValidPhone / isValidEmail) —
//    reject anything that isn't a real http(s) link (or a phone/email-shaped
//    string) before it's ever written to the database, so a malicious
//    `javascript:`/`data:`/`vbscript:` value can never be saved in the
//    first place.
// 2. Render-time guard (isSafeHref) — re-checked independently at every
//    place a stored value is used as an <a href>, so even a row written
//    before this validation existed (or edited directly in the database)
//    can never execute anything. Defense in depth, not just a one-time gate.

const HTTP_SCHEME = /^https?:\/\//i;

// `error` is a stable CODE, not display text — this lib is shared across
// locales, so it can't bake in one language's message. Callers map the code
// to a translated string (e.g. Settings' CONTACT_URL_ERROR_MESSAGES).
export type ContactUrlErrorCode = "invalidUrl" | "invalidScheme";

export function normalizeContactUrl(input: string): { value: string | null; error: ContactUrlErrorCode | null } {
  const trimmed = input.trim();
  if (!trimmed) return { value: null, error: null }; // optional field, blank is fine

  // Let people type "instagram.com/taller" without the scheme — but never
  // let anything OTHER than http(s) through, which is what actually matters.
  const withScheme = HTTP_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { value: null, error: "invalidUrl" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { value: null, error: "invalidScheme" };
  }

  return { value: parsed.toString(), error: null };
}

// True only for values safe to use directly as an <a href>. Re-derived from
// the raw stored string every time, not trusted just because it made it
// into the database — see file header.
export function isSafeHref(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// Loose on purpose — phone formats vary too much across countries to
// validate precisely. Just rejects anything that isn't phone-shaped at all.
export function isValidPhone(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return true; // optional field, blank is fine
  if (!/^[0-9+\-() .]+$/.test(trimmed)) return false;
  const digitCount = (trimmed.match(/[0-9]/g) || []).length;
  return digitCount >= 6;
}

// Loose on purpose — catches obvious garbage/typos without rejecting
// valid-but-unusual real addresses.
export function isValidEmail(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return true; // optional field, blank is fine
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}
