"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  DEMO_COOKIE,
  DEMO_COOKIE_MAX_AGE,
  demoCookieValue,
  demoEnabled,
  isUnlocked,
  passwordMatches,
} from "@/lib/demo-auth";
import { kinApi } from "@/lib/kin-api";

// The API holds the Sarvam keys and places the call; kinApi adds the server-side token.

export type UnlockState = { error?: string };

export async function unlockDemo(_prev: UnlockState, form: FormData): Promise<UnlockState> {
  if (!demoEnabled()) return { error: "The demo is not switched on yet." };
  const password = String(form.get("password") ?? "");
  if (!passwordMatches(password)) {
    // Slow down guessing a little.
    await new Promise((r) => setTimeout(r, 600));
    return { error: "That access code is not right." };
  }
  (await cookies()).set(DEMO_COOKIE, demoCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/try",
    maxAge: DEMO_COOKIE_MAX_AGE,
  });
  redirect("/try");
}

export async function lockDemo() {
  (await cookies()).delete({ name: DEMO_COOKIE, path: "/try" });
  redirect("/try");
}

export type CallFields =
  | "phone" | "parent_name" | "family_name" | "medicines" | "health_notes" | "emergency_number" | "consent"
  | "fam_name" | "fam_context" | "fam_about" | "fam_avoid" | "members";

// Advanced "Family" section. Limits match DemoFamily in apps/api/app/routes/demo.py.
const MAX_MEMBERS = 4; // same as MAX_MEMBERS in components/try/family-fields.tsx
const MEMBER_KEYS = ["name", "relation", "city", "notes"] as const;
const FAMILY_LIMITS = { fam_name: 60, fam_context: 300, fam_about: 300, fam_avoid: 200 } as const;
const MEMBER_LIMITS = { name: 40, relation: 40, city: 60, notes: 200 } as const;

export type PlaceState =
  | { status: "idle" }
  | { status: "error"; message: string; fields: Partial<Record<CallFields, string>>; values: Record<string, string> }
  | { status: "placed"; attemptId: string; phone: string; parentName: string; minutes: number };

// Accepts "97174 88830", "+91 97174-88830" or "919717488830"; returns E.164 or "".
function toE164(raw: string) {
  const digits = raw.replace(/[^\d+]/g, "");
  if (/^\+[1-9]\d{7,14}$/.test(digits)) return digits;
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  return "";
}

// Must match `Language` in apps/api/app/routes/demo.py.
const DEMO_LANGUAGES = [
  "Auto", "Hindi", "English", "Bengali", "Gujarati", "Kannada",
  "Malayalam", "Marathi", "Odia", "Punjabi", "Tamil", "Telugu",
] as const;

export async function placeDemoCall(_prev: PlaceState, form: FormData): Promise<PlaceState> {
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const values = {
    phone: get("phone"),
    parent_name: get("parent_name"),
    family_name: get("family_name"),
    language: get("language") || "Auto",
    minutes: get("minutes") || "1",
    medicines: get("medicines"),
    health_notes: get("health_notes"),
    emergency_number: get("emergency_number"),
    consent: form.get("consent") === "on" ? "on" : "",
    fam_name: get("fam_name"),
    fam_context: get("fam_context"),
    fam_about: get("fam_about"),
    fam_avoid: get("fam_avoid"),
  } as Record<string, string>;
  for (let i = 0; i < MAX_MEMBERS; i++) for (const k of MEMBER_KEYS) values[`member_${i}_${k}`] = get(`member_${i}_${k}`);
  if (!(await isUnlocked())) {
    return { status: "error", message: "Your session ended. Reload the page and enter the access code again.", fields: {}, values };
  }

  const fields: Partial<Record<CallFields, string>> = {};
  const phone = toE164(values.phone);
  const emergency = values.emergency_number ? toE164(values.emergency_number) : "";
  if (!phone) fields.phone = "Use a mobile number, e.g. +91 98765 43210.";
  if (values.parent_name.length < 1) fields.parent_name = "How should Kin greet them?";
  if (values.emergency_number && !emergency) fields.emergency_number = "Use a full number with country code.";
  if (!values.consent) fields.consent = "Please confirm the person agreed to a test call.";
  for (const k of ["parent_name", "family_name"] as const) if (values[k].length > 40) fields[k] = "Keep it under 40 characters.";
  for (const k of ["medicines", "health_notes"] as const) if (values[k].length > 200) fields[k] = "Keep it under 200 characters.";
  for (const [k, max] of Object.entries(FAMILY_LIMITS)) if (values[k].length > max) fields[k as CallFields] = `Keep it under ${max} characters.`;
  const members = [];
  for (let i = 0; i < MAX_MEMBERS; i++) {
    const m = Object.fromEntries(MEMBER_KEYS.map((k) => [k, values[`member_${i}_${k}`]])) as Record<(typeof MEMBER_KEYS)[number], string>;
    if (!Object.values(m).some(Boolean)) continue;
    if (!m.name) fields.members = "Each family member needs a name.";
    for (const k of MEMBER_KEYS) if (m[k].length > MEMBER_LIMITS[k]) fields.members = `Keep member ${k}s under ${MEMBER_LIMITS[k]} characters.`;
    members.push(Object.fromEntries(MEMBER_KEYS.map((k) => [k, m[k] || null])));
  }
  const family =
    values.fam_name || values.fam_context || values.fam_about || values.fam_avoid || members.length
      ? {
          name: values.fam_name || null,
          context: values.fam_context || null,
          about: values.fam_about || null,
          topics_avoid: values.fam_avoid || null,
          members,
        }
      : null;
  if (Object.keys(fields).length) {
    return { status: "error", message: "Please check the highlighted fields.", fields, values };
  }

  try {
    const res = await kinApi("/demo/calls", {
      method: "POST",
      body: JSON.stringify({
        phone,
        parent_name: values.parent_name,
        family_name: values.family_name || null,
        language: (DEMO_LANGUAGES as readonly string[]).includes(values.language) ? values.language : "Auto",
        call_length_minutes: ["1", "3", "5"].includes(values.minutes) ? Number(values.minutes) : 1,
        medicines: values.medicines || null,
        health_notes: values.health_notes || null,
        emergency_number: emergency || null,
        family,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = typeof data.detail === "string" ? data.detail : "Kin could not place the call. Please try again.";
      return { status: "error", message: detail, fields: {}, values };
    }
    return {
      status: "placed",
      attemptId: data.attempt_id,
      phone,
      parentName: values.parent_name,
      minutes: ["1", "3", "5"].includes(values.minutes) ? Number(values.minutes) : 1,
    };
  } catch {
    return { status: "error", message: "Kin's server did not answer. Please try again in a moment.", fields: {}, values };
  }
}

export type CallOutputs = Record<string, string | number | boolean | null>;
// "connected" once Sarvam's agent has picked up (on-start hook); Sarvam doesn't report ringing.
export type CallStage = "calling" | "connected";
export type CallResult =
  | { state: "in_progress"; elapsed_s: number; stage?: CallStage }
  | { state: "timeout"; elapsed_s: number; stage?: CallStage }
  | {
      state: "done"; status: string; duration_s: number; failure_reason: string | null; outputs: CallOutputs;
      charge?: number; rate_per_min?: number; placed_at?: string | null; minutes?: number | null; language?: string | null;
      spoken_language?: string | null; // Kin never keeps the transcript, only which language they spoke
    }
  | { state: "error"; message: string };

// Kin's estimate of the demo budget (apps/api/app/routes/demo.py); null fields = unknown or no limit.
export type Credits = { rate_per_min: number; budget: number | null; used: number | null; held: number | null; remaining: number | null };

export async function getDemoCredits(): Promise<Credits | null> {
  if (!(await isUnlocked())) return null;
  try {
    const res = await kinApi("/demo/credits");
    return res.ok ? ((await res.json()) as Credits) : null;
  } catch {
    return null;
  }
}

export async function getDemoCall(attemptId: string): Promise<CallResult> {
  if (!(await isUnlocked())) return { state: "error", message: "Your session ended. Reload the page." };
  if (!/^[0-9a-fA-F-]{8,64}$/.test(attemptId)) return { state: "error", message: "Unknown call." };
  try {
    const res = await kinApi(`/demo/calls/${attemptId}`);
    if (!res.ok) return { state: "error", message: res.status === 404 ? "Kin lost track of this call." : "Could not load the call." };
    return (await res.json()) as CallResult;
  } catch {
    return { state: "error", message: "Kin's server did not answer." };
  }
}
