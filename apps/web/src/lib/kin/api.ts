// Copied from apps/mobile/src/lib/api.ts (keep the two in step), with the
// requests going through the website's own /kin-api proxy (app/kin-api), which
// holds the session in httpOnly cookies.

import {
  formatDay,
  headlineFor,
  istDate,
  istTime,
  splitMedicines,
  to12h,
  type Alert,
  type Call,
  type CallOutputs,
  type DailyStatus,
  type Family,
  type FamilyMessage,
  type Insight,
  type MedicineHistory,
  type Member,
  type Reminder,
  type Signal,
  type TrendNote,
} from "./data";
import { metric } from "./theme";

export type ApiMember = {
  id: number;
  name: string;
  relation: string | null;
  phone: string | null;
  city: string | null;
  notes: string | null;
  is_emergency: boolean;
  email: string | null;
  role: string | null;
  linked: boolean;
  avatar?: string | null;
};

export type ApiParent = {
  phone: string;
  parent_name: string;
  language: string | null;
  medicines: string | null;
  health_notes: string | null;
  emergency_number: string | null;
  about: string | null;
  topics_avoid: string | null;
  consent_at: string | null;
  last_call_summary: string | null;
  last_call_at: string | null;
  city: string | null;
  call_time: string | null;
  call_length_minutes: number | null;
  daily_calls?: boolean;
  avatar?: string | null;
  daily?: DailyStatus | null;
  reminders?: { id: number; time: string; medicines: string; enabled: boolean; today: Reminder["today"] | null }[];
  medicine?: { days: MedicineHistory["days"]; streak: number; best: number; taken_days: number; known_days: number };
  stock?: {
    id: number; name: string; per_day: number; pack_size: number; left: number; days_left: number | null; runs_out_on: string | null; low: boolean;
    course_ends_on: string | null; course_done: boolean; enough_for_course: boolean; suggested_strips: number;
  }[];
  chemist_phone?: string | null;
  kirana_phone?: string | null;
  groceries?: {
    id: number; name: string; qty: string | null; every_days: number; last_bought_on: string | null; due_on: string; due: boolean; overdue: boolean;
    amazon_asin: string | null;
  }[];
  products?: { name: string; amazon_asin: string }[];
  urgent?: { id: number; kind?: "urgent" | "scam"; reason: string | null; created_at: string } | null; // an emergency (or scam) Kin flagged mid-call, not yet handled
  open_threads: string | null;
  alert: { level: Signal; reason: "urgent" | "no_answer" | "trend"; call_id: number; calls?: number; pain_days?: number; missed_meds?: number; low_mood?: number } | null;
};

export type ApiFamily = {
  family: { id: number; name: string; context: string | null };
  members: ApiMember[];
  parents: ApiParent[];
  me?: ApiMember;
};

export type ApiCall = {
  id: number;
  phone: string;
  direction: "outbound" | "inbound";
  status: string;
  duration_s: number | null;
  summary: string | null;
  outputs: CallOutputs & { call_summary?: string };
  failure_reason: string | null;
  created_at: string;
  signal: Signal | null;
  insight?: Insight | null;
  source?: string | null;
};

/** "Tell my family" (GET /me/messages): from_parent = said on a call; to_parent = Kin passes it on next call. */
export type ApiMessage = {
  id: number;
  phone: string;
  parent_name: string | null;
  direction: "from_parent" | "to_parent";
  text: string;
  to_name: string | null;
  call_id: number | null;
  reply_to: number | null;
  created_at: string;
  done_at: string | null;
  delivered_at: string | null;
  from_name: string | null;
  done_by_name: string | null;
};

/** A call the family asked Kin to place now (GET /me/attempts/{id}). */
export type ApiAttempt = {
  state: "calling" | "connected" | "done" | "timeout";
  elapsed_s: number;
  call_id: number | null;
  status: string | null;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(`/kin-api${path}`, {
      ...rest,
      headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...(rest.headers as Record<string, string>) },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError(0, "Can't reach Kin. Check your internet connection.");
  }
  if (!res.ok) {
    let detail = `Something went wrong (${res.status}).`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
      else if (Array.isArray(body.detail) && body.detail[0]?.msg) detail = String(body.detail[0].msg).replace(/^Value error, /, "");
    } catch {}
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  me: () => call<{ email: string | null; family_id: number | null }>("/me"),
  family: () => call<ApiFamily>("/me/family"),
  calls: (phone: string, days = 90) => call<ApiCall[]>(`/me/calls?phone=${encodeURIComponent(phone)}&days=${days}`),
  call: (id: string) => call<ApiCall>(`/me/calls/${id}`),
  createFamily: (body: unknown) => call<ApiFamily>("/me/family", { method: "POST", json: body }),
  putParent: (phone: string, body: Record<string, unknown>) =>
    call<{ ok: true; phone: string }>(`/me/family/parents/${encodeURIComponent(phone)}`, { method: "PUT", json: body }),
  /** The parent has a new number: their calls, memory and settings move with them. */
  changeParentPhone: (phone: string, newPhone: string) =>
    call<{ ok: true; phone: string }>(`/me/family/parents/${encodeURIComponent(phone)}/phone`, { method: "PUT", json: { phone: newPhone } }),
  addMember: (body: Record<string, unknown>) => call<ApiMember>("/me/family/members", { method: "POST", json: body }),
  updateMember: (id: string, body: Record<string, unknown>) => call<ApiMember>(`/me/family/members/${id}`, { method: "PATCH", json: body }),
  deleteMember: (id: string) => call<{ ok: true }>(`/me/family/members/${id}`, { method: "DELETE" }),
  // A real Sarvam call: the API needs the explicit confirm and enforces the limits.
  callNow: (phone: string) =>
    call<{ attempt_id: string; parent_name: string }>(`/me/family/parents/${encodeURIComponent(phone)}/call`, {
      method: "POST",
      json: { confirm: true },
    }),
  callMember: (id: string) =>
    call<{ attempt_id: string; parent_name: string }>(`/me/family/members/${encodeURIComponent(id)}/call`, {
      method: "POST",
      json: { confirm: true },
    }),
  attempt: (id: string) => call<ApiAttempt>(`/me/attempts/${encodeURIComponent(id)}`),
  messages: () => call<ApiMessage[]>("/me/messages"),
  sendMessage: (text: string, replyTo?: number, phone?: string) =>
    call<{ ok: true; id: number }>("/me/messages", { method: "POST", json: { text, reply_to: replyTo ?? null, phone: phone ?? null } }),
  trends: (phone: string) => call<{ note: TrendNote | null }>(`/me/trends?phone=${encodeURIComponent(phone)}`),
  setStock: (body: { phone: string; name: string; per_day: number; pack_size: number; tablets: number; course_ends_on: string | null }) =>
    call<{ id: number }>("/me/stock", { method: "PUT", json: body }),
  restockAll: (items: { id: number; packs: number }[]) => call<unknown[]>("/me/stock/restock", { method: "POST", json: { items } }),
  restock: (id: string, body: { packs?: number; tablets?: number }) => call<{ id: number }>(`/me/stock/${id}/restock`, { method: "POST", json: body }),
  addGroceries: (phone: string, items: { name: string; qty?: string | null; every_days?: number }[]) =>
    call<unknown[]>("/me/groceries", { method: "POST", json: { phone, items } }),
  updateGrocery: (id: string, body: { name?: string; qty?: string | null; every_days?: number }) =>
    call<unknown[]>(`/me/groceries/${id}`, { method: "PATCH", json: body }),
  deleteGrocery: (id: string) => call<unknown[]>(`/me/groceries/${id}`, { method: "DELETE" }),
  setGroceryAmazon: (id: string, link: string | null) => call<unknown[]>(`/me/groceries/${id}/amazon`, { method: "PUT", json: { link } }),
  groceriesBought: (ids: string[]) => call<unknown[]>("/me/groceries/bought", { method: "POST", json: { ids: ids.map(Number) } }),
  setProduct: (body: { phone: string; name: string; link: string | null }) =>
    call<{ product: { name: string; amazon_asin: string } | null }>("/me/medicine-products", { method: "PUT", json: body }),
  deleteStock: (id: string) => call<{ ok: true }>(`/me/stock/${id}`, { method: "DELETE" }),
  addReminder: (body: { phone: string; time: string; medicines: string }) => call<{ id: number }>("/me/reminders", { method: "POST", json: body }),
  updateReminder: (id: string, body: { time?: string; medicines?: string; enabled?: boolean }) =>
    call<{ id: number }>(`/me/reminders/${id}`, { method: "PATCH", json: body }),
  deleteReminder: (id: string) => call<{ ok: true }>(`/me/reminders/${id}`, { method: "DELETE" }),
  deleteMe: () => call<{ deleted: "family" | "membership" | "account" }>("/me", { method: "DELETE" }),
  urgentHandled: (id: string) => call<{ ok: true }>(`/me/urgent/${id}/handled`, { method: "POST" }),
  messageDone: (id: number) => call<{ ok: true }>(`/me/messages/${id}/done`, { method: "POST" }),
};

// ---- mapping ---------------------------------------------------------------------------

const languageNames: Record<string, string> = { Hindi: "हिन्दी", Tamil: "தமிழ்", Bengali: "বাংলা", Malayalam: "മലയാളം", English: "English" };

function reminderHeadline(status: string, o: CallOutputs) {
  if (status !== "connected") return "Medicine reminder · no answer";
  return o.meds_taken === "all" ? "Medicine reminder · taken" : o.meds_taken === "some" || o.meds_taken === "none" ? "Medicine reminder · not taken" : "Medicine reminder";
}

export function toCall(c: ApiCall, language: string): Call {
  const created = new Date(c.created_at);
  const outputs = c.outputs ?? {};
  return {
    id: String(c.id),
    phone: c.phone,
    date: istDate(created),
    time: istTime(created),
    status: c.status,
    direction: c.direction,
    duration_s: c.duration_s ?? 0,
    language: languageNames[language] ?? language,
    signal: c.signal,
    headline: c.source === "med_reminder" ? reminderHeadline(c.status, outputs) : headlineFor(c.status, c.signal, outputs),
    summary: c.summary || outputs.call_summary || (c.status === "connected" ? "No summary for this call." : "Kin will try again."),
    outputs,
    insight: c.insight ?? undefined,
    kind: c.source === "med_reminder" ? "reminder" : undefined,
  };
}

function toMember(m: ApiMember): Member {
  const doctor = /doctor/i.test(m.relation ?? "");
  return {
    id: String(m.id),
    name: m.name,
    avatar: m.avatar ?? undefined,
    relation: m.relation ?? "Family",
    city: m.city ?? "",
    phone: m.phone ?? undefined,
    email: m.email ?? undefined,
    linked: m.linked,
    is_emergency: m.is_emergency,
    role: m.role === "owner" ? "Owner" : m.is_emergency ? "Red alerts" : doctor ? "Teleconsult" : undefined,
  };
}

function toAlert(p: ApiParent, calls: Call[]): Alert | undefined {
  const a = p.alert;
  if (!a) return undefined;
  const name = p.parent_name;
  const callId = String(a.call_id);
  if (a.reason === "no_answer") {
    return {
      level: "red",
      title: `${name} hasn't answered for 3 calls`,
      basis: "Kin called and tried again each time. Please check on them.",
      evidence: calls.slice(0, 3).map((c) => ({ label: `${formatDay(c.date)} · ${c.time}`, value: c.headline, color: metric.coral })),
      ask: `Is everything all right, ${name}?`,
      callId,
    };
  }
  if (a.reason === "urgent") {
    const c = calls.find((x) => x.id === callId);
    return {
      level: "red",
      title: `${name} needed help on the last call`,
      basis: c?.summary ?? "Kin flagged the last call as urgent.",
      evidence: c ? [{ label: "Call", value: `${formatDay(c.date)} · ${c.time}`, color: metric.coral }] : [],
      ask: `How are you feeling now, ${name}?`,
      callId,
    };
  }
  const evidence = [
    a.pain_days ? { label: "Pain mentioned", value: `${a.pain_days} of ${a.calls} calls`, color: metric.gold } : null,
    a.missed_meds ? { label: "Medicine missed", value: `${a.missed_meds} of ${a.calls} calls`, color: metric.green } : null,
    a.low_mood ? { label: "Low mood", value: `${a.low_mood} of ${a.calls} calls`, color: metric.lilac } : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null);
  const top = [...evidence].sort((x, y) => parseInt(y.value, 10) - parseInt(x.value, 10))[0];
  return {
    level: "amber",
    title: top?.label === "Pain mentioned" ? `${name} keeps mentioning pain` : top?.label === "Medicine missed" ? `${name} is missing medicine` : `${name} has sounded low this week`,
    basis: `Based on the last ${a.calls} calls Kin made.`,
    evidence,
    ask: top?.label === "Pain mentioned" ? `Is the pain getting better, ${name}?` : `How have you been feeling, ${name}?`,
    callId,
  };
}

export function toMessage(m: ApiMessage): FamilyMessage {
  return {
    id: String(m.id),
    direction: m.direction,
    text: m.text,
    parentName: m.parent_name ?? "",
    toName: m.to_name ?? undefined,
    fromName: m.from_name ?? undefined,
    createdAt: m.created_at,
    done: Boolean(m.done_at),
    doneBy: m.done_by_name ?? undefined,
    delivered: Boolean(m.delivered_at),
  };
}

/** One parent's view: the parent with `phone` (the one the user picked), else the family's first. */
export function fromApi(f: ApiFamily, apiCalls: ApiCall[], apiMessages: ApiMessage[] = [], phone?: string): Family | null {
  const p = f.parents.find((x) => x.phone === phone) ?? f.parents[0];
  if (!p) return null;
  const language = p.language ?? "Hindi";
  const calls = apiCalls.map((c) => toCall(c, language));
  const lastAnswered = calls.find((c) => c.status === "connected");
  const threads = (p.open_threads ?? "").split(";").map((s) => s.trim()).filter(Boolean);

  return {
    source: "api",
    name: f.family.name,
    parents: f.parents.map((x) => ({ phone: x.phone, name: x.parent_name, avatar: x.avatar ?? undefined, alert: x.alert?.level })),
    parent: {
      name: p.parent_name,
      avatar: p.avatar ?? undefined,
      phone: p.phone,
      city: p.city ?? "",
      language,
      callTime: to12h(p.call_time ?? "19:15"),
      callLengthMinutes: (p.call_length_minutes ?? 3) as 1 | 3 | 5,
      dailyCalls: p.daily_calls ?? false,
      daily: p.daily ?? undefined,
      urgent: p.urgent
        ? { id: String(p.urgent.id), kind: p.urgent.kind ?? "urgent", reason: p.urgent.reason ?? undefined, at: p.urgent.created_at }
        : undefined,
      consentAt: p.consent_at ? istDate(new Date(p.consent_at)) : undefined,
      medicinesText: p.medicines ?? "",
      reminders: (p.reminders ?? []).map((r) => ({ id: String(r.id), time: r.time, medicines: r.medicines, enabled: r.enabled, today: r.today ?? undefined })),
      stock: (p.stock ?? []).map((s) => ({
        id: String(s.id), name: s.name, perDay: s.per_day, packSize: s.pack_size, left: s.left, daysLeft: s.days_left, runsOutOn: s.runs_out_on, low: s.low,
        courseEndsOn: s.course_ends_on, courseDone: s.course_done, enoughForCourse: s.enough_for_course, suggestedStrips: s.suggested_strips,
      })),
      chemistPhone: p.chemist_phone ?? undefined,
      kiranaPhone: p.kirana_phone ?? undefined,
      groceries: (p.groceries ?? []).map((g) => ({
        id: String(g.id), name: g.name, qty: g.qty, everyDays: g.every_days, lastBoughtOn: g.last_bought_on, dueOn: g.due_on, due: g.due, overdue: g.overdue,
        amazonAsin: g.amazon_asin,
      })),
      products: (p.products ?? []).map((x) => ({ name: x.name, amazonAsin: x.amazon_asin })),
      medicine: p.medicine
        ? { days: p.medicine.days, streak: p.medicine.streak, best: p.medicine.best, takenDays: p.medicine.taken_days, knownDays: p.medicine.known_days }
        : undefined,
    },
    members: f.members.map(toMember),
    meId: f.me ? String(f.me.id) : undefined,
    messages: apiMessages.filter((m) => m.phone === p.phone).map(toMessage),
    medicines: splitMedicines(p.medicines, lastAnswered?.outputs.meds_taken),
    // What Kin carries into the next call: the summaries of recent calls.
    memories: calls
      .filter((c) => c.status === "connected" && c.summary && c.summary !== "No summary for this call.")
      .slice(0, 5)
      .map((c) => ({ tag: c.direction === "inbound" ? "They called" : "Call", text: c.summary, when: formatDay(c.date) })),
    topicsAvoid: (p.topics_avoid ?? "").split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean),
    nextTopic: threads[0] ? `about ${threads[0].replace(/\s*\(.*\)$/, "")}` : undefined,
    nextQuestion: threads.length ? `Kin will follow up on: ${threads.join("; ")}.` : undefined,
    calls,
    alert: toAlert(p, calls),
  };
}


// ---- sign-in (SuperTokens passwordless, email OTP) ---------------------------------------

export type CodeRequest = { deviceId: string; preAuthSessionId: string };

async function auth(path: string, body: unknown) {
  let res: Response;
  try {
    res = await fetch(`/kin-api/auth/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error("Can't reach Kin. Check your internet connection.");
  }
  if (!res.ok) throw new Error(`Kin is not reachable right now (${res.status}). Try again in a minute.`);
  return res.json();
}

/** Emails a one-time code. */
export async function sendCode(email: string): Promise<CodeRequest> {
  const data = await auth("signinup/code", { email });
  if (data.status !== "OK") throw new Error(data.message ?? "Could not send the code. Check the email address.");
  return { deviceId: data.deviceId, preAuthSessionId: data.preAuthSessionId };
}

/** Emails a fresh code for the same sign-in attempt. */
export async function resendCode(req: CodeRequest) {
  const data = await auth("signinup/code/resend", req);
  if (data.status !== "OK") throw new Error("Please start again and send a new code.");
}

/** Exchanges the code for a session (the proxy keeps the tokens). Throws a readable message on a wrong code. */
export async function verifyCode(req: CodeRequest, code: string) {
  const data = await auth("signinup/code/consume", { ...req, userInputCode: code });
  if (data.status === "OK") return;
  if (data.status === "INCORRECT_USER_INPUT_CODE_ERROR") {
    const left = data.maximumCodeInputAttempts - data.failedCodeInputAttemptCount;
    throw new Error(`That code is not right. ${left} ${left === 1 ? "try" : "tries"} left.`);
  }
  if (data.status === "EXPIRED_USER_INPUT_CODE_ERROR") throw new Error("That code has expired. Send a new one.");
  throw new Error("Please start again and send a new code.");
}

export async function signOut() {
  await fetch("/kin-api/auth/signout", { method: "POST" }).catch(() => null);
}
