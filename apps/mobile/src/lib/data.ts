// What the app shows. Field names follow the Sarvam agent's output variables
// and the Postgres tables in apps/api (see CLAUDE.md, "Data model").
//
// Signed in, the family comes from the API (/me/family, /me/calls) through
// `fromApi` in ./api.ts. "Look around" mode uses `sampleFamily` below.

import { metric } from "./theme";

export type Mood = "happy" | "ok" | "low" | "distressed";
export type MedsTaken = "all" | "some" | "none" | "unclear";
export type Signal = "green" | "amber" | "red";

export type CallOutputs = {
  meds_taken?: MedsTaken;
  sleep_hours?: number; // sample only; the agent reports sleep_quality
  sleep_quality?: number; // 1–5
  pain_mentioned?: boolean;
  pain_location?: string;
  mood?: Mood;
  concerns?: string;
  wants_family_callback?: boolean;
  urgent_flag?: boolean;
};


export type Call = {
  id: string;
  phone?: string; // who Kin talked to (the parent, or a family member Kin was asked to call)
  date: string; // ISO date, IST
  time: string; // "7:14 pm", IST
  status: "connected" | "no_answer" | "busy" | "failed" | string;
  direction?: "outbound" | "inbound";
  duration_s: number;
  language: string;
  signal: Signal | null;
  headline: string;
  summary: string;
  outputs: CallOutputs;
  insight?: Insight; // what changed against the parent's own usual (apps/api/app/insights.py)
  kind?: "reminder"; // a medicine reminder call, not an evening call: left out of Today and Trends
};

/** The evening card for one call: what changed from the parent's usual, and one thing to do. */
export type Insight = { headline: string; changes: string[]; suggestion: string };

/** The note on the last 30 days (GET /me/trends). */
export type TrendNote = { summary: string; points: string[]; watch: string; calls: number };

export type Medicine = { name: string; hint: string; color: string; takenToday: boolean | null };
export type Memory = { tag: string; text: string; when: string };
export type Member = {
  id: string;
  name: string;
  avatar?: string;
  relation: string;
  city: string;
  phone?: string;
  email?: string;
  linked?: boolean;
  role?: "Owner" | "Red alerts" | "Teleconsult";
  is_emergency?: boolean;
};

/** "Tell my family": from_parent = said on a call; to_parent = Kin passes it on during the next call. */
export type FamilyMessage = {
  id: string;
  direction: "from_parent" | "to_parent";
  text: string;
  parentName: string;
  toName?: string; // "tell Rohan…"
  fromName?: string; // who wrote a to_parent note
  createdAt: string; // ISO
  done: boolean; // someone dealt with the parent's message
  doneBy?: string;
  delivered: boolean; // a to_parent note was passed on
};

/** Tonight's daily call (apps/api/app/me.py daily_status). Times are ISO. */
export type DailyStatus = {
  state: "scheduled" | "calling" | "retrying" | "answered" | "missed" | "failed";
  at?: string | null; // next call or next try
  next?: string | null; // tomorrow's call, once tonight is over
  tries?: number;
};

export type Parent = {
  name: string;
  avatar?: string;
  phone: string;
  city: string;
  language: string;
  callTime: string; // "7:15 pm"
  callLengthMinutes: 1 | 3 | 5;
  dailyCalls: boolean; // Kin rings every evening at callTime (off until the family turns it on)
  daily?: DailyStatus; // tonight's daily call, from the API's scheduler
  urgent?: { id: string; kind: "urgent" | "scam"; reason?: string; at: string }; // an emergency (or a scam call) Kin flagged during a call, until someone handles it
  consentAt?: string;
  medicinesText?: string;
  reminders?: Reminder[]; // medicine reminder calls (apps/api/app/reminders.py)
  medicine?: MedicineHistory; // 30-day calendar and streak (reminders.history)
  stock?: StockItem[]; // tablets left per medicine (apps/api/app/stock.py)
  chemistPhone?: string; // the local chemist's WhatsApp, for Reorder
  kiranaPhone?: string; // the local grocery shop's WhatsApp
  groceries?: GroceryItem[]; // monthly groceries (apps/api/app/groceries.py), due first
  products?: { name: string; amazonAsin: string }[]; // each medicine's Amazon product, for a one-tap cart
};

/** A grocery the parent's home needs every so often; due a few days before it runs out. */
export type GroceryItem = {
  id: string;
  name: string;
  qty: string | null; // as the family writes it: "5 kg", "1 L"
  everyDays: number; // 7, 14, 21, 30 or 60
  lastBoughtOn: string | null; // IST date
  dueOn: string; // IST date
  due: boolean; // due within 3 days (or overdue)
  overdue: boolean;
  amazonAsin?: string | null; // its product on Amazon, saved once, for one "add all to cart" link
};

/** The Amazon product ID in a product link (or a bare ID); null if there isn't one. Short amzn.in links need the API. */
export function asinFromLink(link: string): string | null {
  const t = link.trim();
  if (/^[A-Z0-9]{10}$/.test(t)) return t;
  return /\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/.exec(t)?.[1] ?? null;
}

/** The API's grocery rules (apps/api/app/groceries.py view), for "Look around" where nothing is saved. */
export function groceryView(g: { id: string; name: string; qty: string | null; everyDays: number; lastBoughtOn: string | null; amazonAsin?: string | null }): GroceryItem {
  const today = istDate();
  const dueOn = g.lastBoughtOn ? istDate(new Date(Date.parse(g.lastBoughtOn + "T12:00:00+05:30") + g.everyDays * 86400000)) : today;
  const soon = istDate(new Date(Date.now() + 3 * 86400000));
  return { ...g, dueOn, due: dueOn <= soon, overdue: dueOn < today };
}

/** "Add the usual list": common monthly staples to start from (edit or remove any). */
export const USUAL_GROCERIES: { name: string; qty: string; everyDays: number }[] = [
  { name: "Atta", qty: "5 kg", everyDays: 30 },
  { name: "Rice", qty: "5 kg", everyDays: 30 },
  { name: "Toor dal", qty: "1 kg", everyDays: 30 },
  { name: "Cooking oil", qty: "1 L", everyDays: 30 },
  { name: "Sugar", qty: "1 kg", everyDays: 30 },
  { name: "Tea", qty: "250 g", everyDays: 30 },
  { name: "Salt", qty: "1 kg", everyDays: 60 },
  { name: "Haldi", qty: "100 g", everyDays: 60 },
  { name: "Bathing soap", qty: "4", everyDays: 30 },
  { name: "Detergent", qty: "1 kg", everyDays: 30 },
  { name: "Toothpaste", qty: "1", everyDays: 30 },
];

const groceryDays = (ago: number) => istDate(new Date(Date.now() - ago * 86400000));

/** One Amazon link that puts every product in the cart at once (Amazon's add-to-cart URL). */
export function amazonCartUrl(items: { asin: string; quantity: number }[]) {
  const q = items.map((it, i) => `ASIN.${i + 1}=${it.asin}&Quantity.${i + 1}=${it.quantity}`).join("&");
  return `https://www.amazon.in/gp/aws/cart/add.html?${q}`;
}

/** One medicine's stock at the parent's home, as the API works it out from the last count. */
export type StockItem = {
  id: string;
  name: string;
  perDay: number;
  packSize: number;
  left: number;
  daysLeft: number | null;
  runsOutOn: string | null; // IST date
  low: boolean; // 5 days or fewer (and, for a course, short of its end): the family gets a refill alert
  courseEndsOn: string | null; // last day of a set course (IST date); null = ongoing
  courseDone: boolean;
  enoughForCourse: boolean; // a course whose tablets at home already last to its end
  suggestedStrips: number; // to buy: about a month if ongoing, only what finishes a course
};

/** The API's stock rules (apps/api/app/stock.py view), for "Look around" where nothing is saved. */
export function stockView(s: { id: string; name: string; perDay: number; packSize: number; left: number; courseEndsOn: string | null }): StockItem {
  const today = istDate();
  const dayDiff = (a: string, b: string) => Math.round((Date.parse(a + "T12:00:00Z") - Date.parse(b + "T12:00:00Z")) / 86400000);
  const covered = Math.floor(s.left / s.perDay);
  const toCover = s.courseEndsOn === null ? 30 : Math.max(0, dayDiff(s.courseEndsOn, today) + 1);
  const need = Math.max(0, s.perDay * toCover - s.left);
  const lasts = s.courseEndsOn !== null && covered > 0 && covered - 1 >= dayDiff(s.courseEndsOn, today);
  return {
    ...s,
    daysLeft: covered,
    runsOutOn: istDate(new Date(Date.now() + covered * 86400000)),
    low: covered <= 5 && toCover > 0 && !lasts,
    courseDone: s.courseEndsOn !== null && dayDiff(today, s.courseEndsOn) > 0,
    enoughForCourse: lasts,
    suggestedStrips: need > 0 ? Math.ceil(need / s.packSize) : 0,
  };
}

export type MedicineDayState = "taken" | "not_taken" | "partly" | "no_answer" | "unclear";

/** The Medicines screen's last 30 days (oldest first): reminder results plus what evening calls said. */
export type MedicineHistory = {
  days: { day: string; state: MedicineDayState | null; items: { what: string; result: string }[] }[];
  streak: number; // days in a row with everything taken, up to yesterday or today
  best: number;
  takenDays: number;
  knownDays: number;
};

/** A short call at tablet time; the family is told if the tablets weren't taken. */
export type Reminder = {
  id: string;
  time: string; // "20:30", IST
  medicines: string;
  enabled: boolean;
  today?: { state: "scheduled" | "calling" | "retrying" | "taken" | "not_taken" | "unclear" | "no_answer" | "skipped" | "failed"; at: string };
};

export type Alert = {
  level: Signal;
  title: string;
  basis: string;
  evidence: { label: string; value: string; color: string }[];
  ask: string;
  callId?: string;
};

/** A parent Kin calls, for the switcher when a family has more than one (e.g. mother and father). */
export type ParentChoice = { phone: string; name: string; avatar?: string; alert?: Signal };

export type Family = {
  source: "sample" | "api";
  name: string;
  parent: Parent; // the parent every screen is showing
  parents: ParentChoice[]; // all the family's parents, the shown one included
  members: Member[];
  meId?: string; // the signed-in user's own member row (can't remove themselves)
  messages: FamilyMessage[]; // "tell my family", newest first
  medicines: Medicine[];
  memories: Memory[];
  topicsAvoid: string[];
  nextTopic?: string; // short, for "Tomorrow Kin asks …"
  nextQuestion?: string; // longer, for "Tonight Kin will ask"
  calls: Call[]; // newest first
  speech30?: number[]; // sample only; not measured yet
  alert?: Alert;
};

export const kinNumber = "+91 79714 13869";

// ---- dates and times (always IST: the parent's evening) ------------------------

const IST_MS = 5.5 * 60 * 60 * 1000;

export function istDate(d = new Date()) {
  return new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);
}

export function istTime(d: Date) {
  const t = new Date(d.getTime() + IST_MS);
  return to12h(`${t.getUTCHours()}:${String(t.getUTCMinutes()).padStart(2, "0")}`);
}

/** "19:15" -> "7:15 pm" */
export function to12h(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

// The languages Kin has opening lines for (apps/api/app/greetings.py).
export const parentLanguages = ["Hindi", "English", "Tamil", "Malayalam", "Bengali", "Telugu", "Kannada", "Marathi", "Gujarati", "Punjabi", "Odia"] as const;

/** Times a family can pick for the daily call (India time), by part of the day. */
export const callTimeGroups = [
  { part: "Morning", times: ["7:30 am", "8:30 am", "9:30 am", "10:30 am"] },
  { part: "Afternoon", times: ["12:30 pm", "2:00 pm", "3:30 pm", "5:00 pm"] },
  { part: "Evening", times: ["6:30 pm", "7:15 pm", "8:00 pm", "8:45 pm"] },
  { part: "Night", times: ["9:30 pm"] },
] as const;
export const callTimes: string[] = callTimeGroups.flatMap((g) => g.times);

/** "8:30 am" -> "Morning" (5–12 morning, 12–17 afternoon, 17–21 evening, else night). */
export function partOfDay(label: string) {
  const h = Number(to24h(label).split(":")[0]);
  return h >= 5 && h < 12 ? "Morning" : h >= 12 && h < 17 ? "Afternoon" : h >= 17 && h < 21 ? "Evening" : "Night";
}

/** "7:15 pm" -> "19:15" */
export function to24h(label: string) {
  const m = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(label.trim());
  if (!m) return label;
  const h = (Number(m[1]) % 12) + (m[3].toLowerCase() === "pm" ? 12 : 0);
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

function daysAgo(offset: number) {
  return istDate(new Date(Date.now() - offset * 86400000));
}

export function formatDay(iso: string) {
  if (iso === daysAgo(0)) return "Today";
  if (iso === daysAgo(1)) return "Yesterday";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export function formatDuration(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ---- reading call outputs ---------------------------------------------------------

export const moodLabel: Record<Mood, string> = { happy: "Happy", ok: "Good", low: "Low", distressed: "Upset" };
export const signalTone = { green: "ok", amber: "watch", red: "alert" } as const;
export const signalLabel: Record<Signal, string> = { green: "Normal", amber: "Watch", red: "Alert" };
export const medsLabel: Record<MedsTaken, string> = { all: "All taken", some: "Some missed", none: "Not taken", unclear: "Not sure" };

/** Sleep as a 0–1 value and a label: hours when known, else the 1–5 score. */
export function sleepOf(o: CallOutputs): { value: number; label: string } | null {
  if (o.sleep_hours != null) return { value: o.sleep_hours / 7.5, label: `${o.sleep_hours} h` };
  if (o.sleep_quality != null) return { value: o.sleep_quality / 5, label: `${o.sleep_quality}/5` };
  return null;
}

export function headlineFor(status: string, signal: Signal | null, o: CallOutputs) {
  if (status === "no_answer") return "No answer";
  if (status === "busy") return "Line was busy";
  if (status !== "connected") return "The call didn't go through";
  if (signal === "red") return "Needs your attention";
  if (o.pain_mentioned) return o.pain_location ? `${cap(o.pain_location)} pain` : "Mentioned pain";
  if (o.meds_taken === "none" || o.meds_taken === "some") return "Missed some medicine";
  if (o.mood === "low") return "Feeling low";
  return "A normal day";
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** How many answered calls in a row (newest first) mentioned pain. */
export function painStreak(calls: Call[]) {
  let n = 0;
  for (const c of calls) {
    if (c.status !== "connected") continue;
    if (!c.outputs.pain_mentioned) break;
    n++;
  }
  return n;
}

export const medColors = [metric.blue, metric.lilac, metric.coral, metric.gold, metric.green];

/** "Amlodipine 5 mg after breakfast, Metformin …" -> one entry per medicine. */
export function splitMedicines(text: string | null | undefined, lastMeds?: MedsTaken): Medicine[] {
  return (text ?? "")
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s, i) => {
      const m = /^(.*?)(\s+(?:after|before|with|at|in the)\s+.*)$/i.exec(s);
      return {
        name: m ? m[1] : s,
        hint: m ? cap(m[2].trim()) : "Kin asks about it on every call",
        color: medColors[i % medColors.length],
        takenToday: lastMeds === "all" ? true : lastMeds === "none" ? false : null,
      };
    });
}

export function joinMedicines(meds: Medicine[]) {
  return meds.map((m) => (m.hint && !m.hint.startsWith("Kin asks") ? `${m.name} ${m.hint.toLowerCase()}` : m.name)).join(", ");
}

// ---- the sample family ("Look around") ----------------------------------------------

const sleep30 = [7, 7.2, 6.8, 7.1, 7.4, 6.9, 7, 7.2, 6.6, 7.1, 7.3, 6.9, 7, 6.8, 7.2, 7, 6.7, 7.1, 6.9, 7.2, 6.5, 6.4, 6.2, 6.3, 6.1, 6, 6.2, 5.9, 6.1, 6];

const latest: Call = {
  id: "c-0",
  date: daysAgo(0),
  time: "7:14 pm",
  status: "connected",
  duration_s: 220,
  language: "हिन्दी",
  signal: "green",
  headline: "A normal day",
  summary: "Took both medicines, slept about 6 hours. Knee pain for the third day, a little worse on the stairs. Asked if Neha can call on Sunday.",
  insight: {
    headline: "Amma is fine, but the knee pain is now three days old",
    changes: ["Knee pain on 3 calls in a row; before Tuesday she had none for a month", "Sleep about 6 h, an hour under her usual 7", "Asked for Neha by name, which she rarely does"],
    suggestion: "Call her on Sunday as she asked, and ask whether the knee needs a doctor.",
  },
  outputs: { meds_taken: "all", sleep_hours: 6, sleep_quality: 3, pain_mentioned: true, pain_location: "left knee", mood: "ok", concerns: "Knee pain, day 3", wants_family_callback: true },
};

const older: Call[] = sleep30
  .slice(0, -1)
  .reverse()
  .map((sleep, i) => {
    const pain = i < 2;
    const amber = i === 2;
    return {
      id: `c-${i + 1}`,
      date: daysAgo(i + 1),
      time: `7:1${(i + 2) % 10} pm`,
      status: "connected",
      duration_s: 160 + ((i * 37) % 80),
      language: "हिन्दी",
      signal: amber ? "amber" : "green",
      headline: amber ? "Tired and low" : pain ? "Knee pain, otherwise fine" : "A good day",
      summary: amber
        ? "Sounded tired. Slept under 6 hours. Knee pain started on the stairs. Took all medicines."
        : pain
          ? "Took all medicines. Knee still hurts a little. Sharma aunty visited."
          : "Took all medicines, slept well, cooked kadhi for lunch.",
      outputs: { meds_taken: i === 11 ? "some" : "all", sleep_hours: sleep, sleep_quality: sleep >= 6.8 ? 4 : 3, pain_mentioned: pain || amber, pain_location: pain || amber ? "left knee" : undefined, mood: amber ? "low" : "ok", wants_family_callback: false },
    } satisfies Call;
  });

const sampleParents: ParentChoice[] = [
  { phone: "+91 98765 43210", name: "Amma", avatar: "amma", alert: "amber" },
  { phone: "+91 98765 43211", name: "Papa", avatar: "papa" },
];

export const sampleTrendNote: TrendNote = {
  summary: "A steady month for Amma: she answered almost every evening and took her medicines. The last week is softer: shorter sleep and a sore knee.",
  points: [
    "Answered 29 of 30 calls",
    "Sleep fell from about 7 h to 6 h over the last 5 calls",
    "Left knee pain on 3 of the last 3 calls, none in the 3 weeks before",
    "Missed one dose of medicine all month",
  ],
  watch: "The knee: if it is still there on Sunday, a doctor's visit may help.",
  calls: 30,
};

// 30 days for "Look around": a miss 13 days ago, then 12 days in a row and today's morning dose.
function sampleMedicine(): MedicineHistory {
  const miss: Record<number, MedicineDayState> = { 13: "not_taken", 21: "no_answer", 26: "partly" };
  const days = Array.from({ length: 30 }, (_, i) => {
    const ago = 29 - i;
    const state: MedicineDayState = miss[ago] ?? "taken";
    const items =
      state === "taken"
        ? [{ what: "8:30 am reminder", result: "taken" }, ...(ago ? [{ what: "9:30 pm reminder", result: "taken" }] : [])]
        : state === "partly"
          ? [{ what: "8:30 am reminder", result: "taken" }, { what: "9:30 pm reminder", result: "no_answer" }]
          : [{ what: "8:30 am reminder", result: state }];
    return { day: daysAgo(ago), state, items };
  });
  return { days, streak: 13, best: 13, takenDays: 27, knownDays: 30 };
}

export const sampleFamily: Family = {
  source: "sample",
  name: "Sharma family",
  parents: sampleParents,
  parent: {
    name: "Amma",
    avatar: "amma",
    phone: "+91 98765 43210",
    city: "Lucknow",
    language: "Hindi",
    callTime: "7:15 pm",
    callLengthMinutes: 3,
    dailyCalls: true,
    consentAt: daysAgo(32),
    reminders: [
      { id: "r1", time: "08:30", medicines: "Amlodipine 5 mg", enabled: true, today: { state: "taken", at: new Date().toISOString() } },
      { id: "r2", time: "21:30", medicines: "Calcium + D3", enabled: true },
    ],
    medicine: sampleMedicine(),
    stock: [
      stockView({ id: "s1", name: "Amlodipine 5 mg", perDay: 1, packSize: 10, left: 3, courseEndsOn: null }),
      stockView({ id: "s2", name: "Metformin 500 mg", perDay: 2, packSize: 15, left: 38, courseEndsOn: null }),
      stockView({ id: "s3", name: "Calcium + D3", perDay: 1, packSize: 15, left: 4, courseEndsOn: null }),
      // A 5-day antibiotic on day 3: its 3 tablets cover the last 3 days, so nothing to buy.
      stockView({ id: "s4", name: "Azithromycin 500 mg", perDay: 1, packSize: 3, left: 3, courseEndsOn: daysAgo(-2) }),
    ],
    chemistPhone: "+919820011122",
    kiranaPhone: "+919820033344",
    groceries: [
      groceryView({ id: "g1", name: "Atta", qty: "5 kg", everyDays: 30, lastBoughtOn: groceryDays(29) }),
      groceryView({ id: "g2", name: "Toor dal", qty: "1 kg", everyDays: 30, lastBoughtOn: groceryDays(28) }),
      groceryView({ id: "g3", name: "Tea", qty: "250 g", everyDays: 30, lastBoughtOn: groceryDays(33) }),
      groceryView({ id: "g4", name: "Milk powder", qty: "500 g", everyDays: 14, lastBoughtOn: groceryDays(13) }),
      groceryView({ id: "g5", name: "Rice", qty: "5 kg", everyDays: 30, lastBoughtOn: groceryDays(10) }),
      groceryView({ id: "g6", name: "Cooking oil", qty: "1 L", everyDays: 30, lastBoughtOn: groceryDays(12) }),
      groceryView({ id: "g7", name: "Salt", qty: "1 kg", everyDays: 60, lastBoughtOn: groceryDays(20) }),
    ].sort((a, b) => Number(b.due) - Number(a.due) || a.dueOn.localeCompare(b.dueOn)),
  },
  members: [
    { id: "m1", name: "Neha", avatar: "neha", relation: "Daughter", city: "Singapore", role: "Owner", linked: true },
    { id: "m2", name: "Rahul", avatar: "rahul", relation: "Son", city: "Pune", role: "Red alerts", is_emergency: true, phone: "+91 98200 00000", linked: true },
    { id: "m3", name: "Dr. Priya Menon", avatar: "priya", relation: "Family doctor", city: "Lucknow", role: "Teleconsult" },
  ],
  medicines: [
    { name: "Amlodipine 5 mg", hint: "White tablet · after breakfast", color: metric.blue, takenToday: true },
    { name: "Metformin 500 mg", hint: "Big white tablet · after lunch", color: metric.lilac, takenToday: true },
    { name: "Calcium + D3", hint: "Pink tablet · after dinner", color: metric.coral, takenToday: false },
    { name: "Azithromycin 500 mg", hint: "For 5 days · after lunch", color: metric.gold, takenToday: true },
  ],
  memories: [
    { tag: "Family", text: "Grandson Aarav has his board exams in March.", when: "Mon" },
    { tag: "Health", text: "Knee pain since Tuesday. Left knee, worse on stairs.", when: "Today" },
    { tag: "Plans", text: "Wants a green silk sari for Diwali.", when: "Today" },
    { tag: "People", text: "Sharma aunty visits on Wednesdays.", when: "Last week" },
  ],
  topicsAvoid: ["Property dispute", "Late husband's illness"],
  nextTopic: "about Aarav's exam",
  nextQuestion: "Did Aarav's maths test go well? You were worried on Monday.",
  calls: [latest, ...older],
  speech30: [118, 121, 116, 123, 119, 122, 117, 120, 124, 118, 121, 119, 116, 122, 120, 123, 118, 117, 121, 119, 122, 120, 118, 121, 119, 108, 104, 101, 99, 97],
  messages: [
    {
      id: "s-msg-1",
      direction: "from_parent",
      text: "Can Neha call me on Sunday? I want to hear about the new flat.",
      parentName: "Amma",
      toName: "Neha",
      createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
      done: false,
      delivered: false,
    },
  ],
  alert: {
    level: "amber",
    title: "Amma is speaking more slowly this week",
    basis: "Based on 5 calls, compared with her own last 30 days.",
    evidence: [
      { label: "Speech rate", value: "−18%", color: metric.coral },
      { label: "Sleep", value: "6.0 h, down 1 h", color: metric.lilac },
      { label: "Knee pain", value: "3 days", color: metric.gold },
      { label: "Medicine", value: "All taken", color: metric.green },
    ],
    ask: "Are you feeling tired in the afternoons, Amma?",
  },
};

/** Sample mode's second parent: just added, so no calls yet (shows the new-parent screens). */
export const sampleFather: Family = {
  ...sampleFamily,
  parent: {
    name: "Papa",
    avatar: "papa",
    phone: "+91 98765 43211",
    city: "Lucknow",
    language: "Hindi",
    callTime: "8:00 pm",
    callLengthMinutes: 3,
    dailyCalls: false,
  },
  medicines: [{ name: "Atorvastatin 10 mg", hint: "After dinner", color: metric.blue, takenToday: null }],
  memories: [],
  topicsAvoid: [],
  nextTopic: undefined,
  nextQuestion: undefined,
  calls: [],
  speech30: undefined,
  messages: [],
  alert: undefined,
};
