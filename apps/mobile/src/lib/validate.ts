/**
 * Checks for the names, emails and phone numbers people type into Kin's forms.
 * Each `…Error` returns the message to show, or "" when the value is fine.
 */

// ---- Names ----

const NAME_MAX = 40;
// Letters in any script are fine (नीलम, அம்மா); digits and symbols are not.
const NAME_BAD = /[0-9@#$%^&*_=+<>{}[\]|\\/~`"!?;:,()]/;

/** Trims and folds runs of spaces: "  Papa   ji " → "Papa ji". */
export const cleanName = (s: string) => s.replace(/\s+/g, " ").trim();

export function nameError(raw: string, required = true): string {
  const s = cleanName(raw);
  if (!s) return required ? "Enter a name." : "";
  if (NAME_BAD.test(s)) return "Use letters only, no numbers or symbols.";
  if (!/[^\s.'-]/.test(s)) return "Enter a name.";
  if (s.length > NAME_MAX) return `Keep the name under ${NAME_MAX} letters.`;
  return "";
}

// ---- Email ----

const EMAIL = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;

/** Removes spaces (often added by autocorrect or paste) and lower-cases. */
export const cleanEmail = (s: string) => s.replace(/\s+/g, "").toLowerCase();

export function emailError(raw: string, required = false): string {
  const s = cleanEmail(raw);
  if (!s) return required ? "Enter your email address." : "";
  if (s.length > 254 || !EMAIL.test(s)) return "Check the email address, e.g. name@example.com.";
  return "";
}

// ---- Phone ----

export type Country = {
  id: string;
  name: string;
  dial: string; // "+91"
  length: number; // digits after the country code
  start?: RegExp; // what a mobile number starts with
  startHint?: string;
  groups: number[]; // how the digits are spaced for reading
  example: string;
};

export const INDIA: Country = { id: "IN", name: "India", dial: "+91", length: 10, start: /^[6-9]/, startHint: "6, 7, 8 or 9", groups: [5, 5], example: "9876543210" };

/** Where family members tend to live. Parents are in India only (Kin's v1). */
export const countries: Country[] = [
  INDIA,
  { id: "SG", name: "Singapore", dial: "+65", length: 8, start: /^[3689]/, startHint: "3, 6, 8 or 9", groups: [4, 4], example: "81234567" },
  { id: "AE", name: "UAE", dial: "+971", length: 9, start: /^5/, startHint: "5", groups: [2, 3, 4], example: "501234567" },
  { id: "GB", name: "United Kingdom", dial: "+44", length: 10, start: /^7/, startHint: "7", groups: [4, 6], example: "7400123456" },
  { id: "US", name: "United States / Canada", dial: "+1", length: 10, start: /^[2-9]/, startHint: "2–9", groups: [3, 3, 4], example: "2015550123" },
  { id: "AU", name: "Australia", dial: "+61", length: 9, start: /^4/, startHint: "4", groups: [3, 3, 3], example: "412345678" },
];

export const countryLabel = (c: Country) => `${c.name}  ${c.dial}`;

/**
 * The local digits from whatever was typed or pasted: drops spaces, dashes and
 * brackets, a leading "+91" / "0091" / "91" when it makes the number too long,
 * and India's trunk "0" (098765 43210).
 */
export function phoneDigits(text: string, c: Country): string {
  let d = text.replace(/\D/g, "");
  const code = c.dial.slice(1);
  if (d.startsWith("00" + code) && d.length > c.length) d = d.slice(2 + code.length);
  else if (d.startsWith(code) && d.length > c.length) d = d.slice(code.length);
  if (c.id === "IN" && d.startsWith("0")) d = d.replace(/^0+/, "");
  return d.slice(0, c.length);
}

/** "9876543210" → "98765 43210" (grouped as people read it). */
export function groupDigits(d: string, c: Country): string {
  const out: string[] = [];
  let i = 0;
  for (const g of c.groups) {
    if (i >= d.length) break;
    out.push(d.slice(i, i + g));
    i += g;
  }
  if (i < d.length) out.push(d.slice(i));
  return out.join(" ");
}

export function phoneError(digits: string, c: Country, required = true): string {
  if (!digits) return required ? "Enter a phone number." : "";
  if (c.start && !c.start.test(digits)) return `${c.name} mobile numbers start with ${c.startHint}.`;
  if (digits.length < c.length) return `Enter all ${c.length} digits (${c.length - digits.length} more).`;
  if (/^(\d)\1+$/.test(digits)) return "Check the number.";
  return "";
}

/** E.164 for the API: "+919876543210". */
export const toE164 = (digits: string, c: Country) => (digits ? c.dial + digits : "");

/**
 * A saved number back into country + local digits. A code Kin has no rules for
 * (e.g. +852) comes back as `other`, so the form can keep it instead of losing it.
 */
export function splitPhone(phone: string | undefined | null, allowed: Country[] = countries): { country: Country; digits: string; other?: string } {
  const p = (phone ?? "").replace(/[^\d+]/g, "");
  // Longest dial code first, so "+1" doesn't swallow "+12…" style codes.
  for (const c of [...allowed].sort((a, b) => b.dial.length - a.dial.length)) {
    if (p.startsWith(c.dial)) return { country: c, digits: p.slice(c.dial.length).slice(0, c.length) };
  }
  const fallback = allowed[0] ?? INDIA;
  return p.startsWith("+") ? { country: fallback, digits: "", other: p } : { country: fallback, digits: phoneDigits(p, fallback) };
}
