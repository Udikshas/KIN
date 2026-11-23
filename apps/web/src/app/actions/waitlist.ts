"use server";

import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { apiConfigured, kinApi } from "@/lib/kin-api";

export type WaitlistState =
  | { status: "idle" }
  | { status: "error"; message: string; fields: Partial<Record<Field, string>>; values: Record<string, string> }
  | { status: "ok"; name: string; email: string };

type Field = "name" | "email" | "phone" | "city" | "language" | "role" | "consent";

const ROLES = ["family", "centre", "insurer"] as const;
const LANGUAGES = ["Hindi", "Tamil", "Malayalam", "Bengali", "English", "Other"] as const;

// Sign-ups go to Postgres through the Kin API. If the API is not configured or
// not reachable, they are appended to WAITLIST_FILE instead (a persistent
// volume in production) so nothing is lost; import those later with
// `python -m app.import_waitlist` on kin-api. The default path stays out of git.
const FILE = process.env.WAITLIST_FILE ?? path.join(process.cwd(), "data", "waitlist.jsonl");
const KIN_API_HINT = `KIN_API_URL=${process.env.KIN_API_URL ?? "unset"}`;

export async function joinWaitlist(_prev: WaitlistState, form: FormData): Promise<WaitlistState> {
  const get = (k: Field) => String(form.get(k) ?? "").trim();
  const entry = {
    name: get("name"),
    email: get("email").toLowerCase(),
    phone: get("phone"),
    city: get("city"),
    language: get("language"),
    role: get("role"),
  };

  const fields: Partial<Record<Field, string>> = {};
  if (entry.name.length < 2) fields.name = "Please tell us your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.email)) fields.email = "Please enter a valid email address.";
  if (entry.phone && !/^\+?[\d\s()-]{7,20}$/.test(entry.phone)) fields.phone = "Use digits, with a country code like +91.";
  if (!ROLES.includes(entry.role as (typeof ROLES)[number])) fields.role = "Please choose one.";
  if (entry.language && !LANGUAGES.includes(entry.language as (typeof LANGUAGES)[number]))
    fields.language = "Please choose a language.";
  if (form.get("consent") !== "on") fields.consent = "Please agree so we can contact you.";
  if (Object.values(entry).some((v) => v.length > 200)) fields.name = "That is a little long.";

  if (Object.keys(fields).length) {
    return { status: "error", message: "Please check the highlighted fields.", fields, values: { ...entry, consent: form.get("consent") === "on" ? "on" : "" } };
  }

  const saved = (await saveToApi(entry)) || (await saveToFile(entry));
  if (!saved) {
    return { status: "error", message: "We could not save that just now. Please try again.", fields: {}, values: { ...entry, consent: "on" } };
  }

  return { status: "ok", name: entry.name.split(" ")[0], email: entry.email };
}

type Entry = { name: string; email: string; phone: string; city: string; language: string; role: string };

async function saveToApi(entry: Entry) {
  if (!apiConfigured()) return false;
  try {
    const res = await kinApi("/waitlist", {
      method: "POST",
      body: JSON.stringify({ ...entry, language: entry.role === "family" ? entry.language || null : null }),
    });
    if (res.ok) return true;
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    // 401 = WEB_API_TOKEN differs between kin-web and kin-api; 503 = DATABASE_URL or Postgres.
    console.error(
      `waitlist: API returned ${res.status} ${detail}. Saved to ${FILE} instead; ` +
        "fix the config, then import with `python -m app.import_waitlist` on kin-api.",
    );
  } catch (e) {
    console.error(`waitlist: API unreachable (${KIN_API_HINT}). Saved to ${FILE} instead.`, e);
  }
  return false;
}

async function saveToFile(entry: Entry) {
  try {
    await mkdir(path.dirname(FILE), { recursive: true });
    await appendFile(FILE, JSON.stringify({ ...entry, at: new Date().toISOString() }) + "\n", "utf8");
    return true;
  } catch {
    return false;
  }
}
