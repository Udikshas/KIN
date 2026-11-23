"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import {
  getDemoCall,
  getDemoCredits,
  placeDemoCall,
  type CallOutputs,
  type CallResult,
  type Credits,
  type PlaceState,
} from "@/app/actions/demo";
import { VoiceOrb } from "../ui/voice-orb";
import { FamilyFields } from "./family-fields";
import { LanguagePicker, type LanguageOption } from "./language-picker";

const field =
  "h-12 w-full rounded-[14px] border bg-white/90 px-4 text-[16px] text-ink outline-none transition-colors placeholder:text-faint focus:border-ink";

const POLL_MS = 3000;
// Same default as DEMO_RATE_PER_MIN in apps/api; the API's own value wins once loaded.
const DEFAULT_RATE = 5;

// The languages Kin's Sarvam agent can speak. Auto follows the parent's own language.
const languages: LanguageOption[] = [
  { value: "Auto", native: "Auto" },
  { value: "Hindi", native: "हिन्दी", english: "Hindi" },
  { value: "English", native: "English" },
  { value: "Bengali", native: "বাংলা", english: "Bengali" },
  { value: "Gujarati", native: "ગુજરાતી", english: "Gujarati" },
  { value: "Kannada", native: "ಕನ್ನಡ", english: "Kannada" },
  { value: "Malayalam", native: "മലയാളം", english: "Malayalam" },
  { value: "Marathi", native: "मराठी", english: "Marathi" },
  { value: "Odia", native: "ଓଡ଼ିଆ", english: "Odia" },
  { value: "Punjabi", native: "ਪੰਜਾਬੀ", english: "Punjabi" },
  { value: "Tamil", native: "தமிழ்", english: "Tamil" },
  { value: "Telugu", native: "తెలుగు", english: "Telugu" },
];

// Calls placed from this browser, so their cards can be opened again (no other visitor's calls).
type Past = { id: string; name: string; phone: string; at: number; minutes: number };
const HISTORY_KEY = "kin.try.history";

function readHistory(): Past[] {
  try {
    const list = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(list) ? list.slice(0, 10) : [];
  } catch {
    return [];
  }
}

function writeHistory(list: Past[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {}
}

export function DemoConsole() {
  // Bump to clear a finished call (and its form state) and place another.
  const [round, setRound] = useState(0);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [history, setHistory] = useState<Past[]>([]);
  const [viewing, setViewing] = useState<Past | null>(null);

  const refreshCredits = useCallback(() => {
    getDemoCredits().then(setCredits);
  }, []);

  useEffect(() => {
    refreshCredits();
    // localStorage only exists in the browser, so load it after the first render.
    Promise.resolve().then(() => setHistory(readHistory()));
  }, [refreshCredits]);

  const remember = useCallback((p: Past) => {
    setHistory((h) => {
      const next = [p, ...h.filter((x) => x.id !== p.id)].slice(0, 10);
      writeHistory(next);
      return next;
    });
    refreshCredits();
  }, [refreshCredits]);

  return (
    <>
      <Round
        key={round}
        credits={credits}
        viewing={viewing}
        onPlaced={remember}
        onDone={refreshCredits}
        onReset={() => {
          setViewing(null);
          setRound((r) => r + 1);
          refreshCredits();
        }}
      />
      <History
        items={history}
        activeId={viewing?.id}
        onView={(p) => {
          setRound((r) => r + 1);
          setViewing(p);
        }}
      />
    </>
  );
}

function Round({ credits, viewing, onPlaced, onDone, onReset }: {
  credits: Credits | null; viewing: Past | null; onPlaced: (p: Past) => void; onDone: () => void; onReset: () => void;
}) {
  const [state, action, pending] = useActionState<PlaceState, FormData>(placeDemoCall, { status: "idle" });
  const err = state.status === "error" ? state.fields : {};
  const v = state.status === "error" ? state.values : ({} as Record<string, string>);
  const placed = state.status === "placed" ? state : null;
  const [minutes, setMinutes] = useState(Number(v.minutes || "1"));

  useEffect(() => {
    if (placed) onPlaced({ id: placed.attemptId, name: placed.parentName, phone: mask(placed.phone), at: Date.now(), minutes: placed.minutes });
  }, [placed, onPlaced]);

  const rate = credits?.rate_per_min ?? DEFAULT_RATE;
  // The agent can run a little past the chosen length, so the API holds one extra minute.
  const need = (minutes + 1) * rate;
  const left = credits?.remaining ?? null;
  const short = left !== null && left < need;

  const advancedError = Boolean(err.family_name || err.medicines || err.health_notes || err.emergency_number);
  const shown = placed
    ? { id: placed.attemptId, name: placed.parentName, phone: mask(placed.phone), minutes: placed.minutes, at: undefined }
    : viewing;

  return (
    <section className="mx-auto max-w-[1100px] px-4 pt-8 pb-10 sm:px-8">
      <div className="mb-8 max-w-2xl">
        <h1 className="display text-[40px] sm:text-[48px]">Try Kin</h1>
        <p className="mt-3 text-[17px] leading-[1.4] text-body">
          Kin rings from +91 79714 13869 for a short check-in. The evening card appears here when the call ends.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <form action={action} noValidate className="glass flex min-w-0 flex-col gap-5 rounded-[28px] p-6 sm:p-7">
          <Field label="Phone number" error={err.phone}>
            <input name="phone" type="tel" inputMode="tel" placeholder="+91 98765 43210" defaultValue={v.phone}
              className={`${field} ${err.phone ? "border-alert" : "border-line"}`} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Call them" error={err.parent_name}>
              <input name="parent_name" placeholder="Amma" defaultValue={v.parent_name}
                className={`${field} ${err.parent_name ? "border-alert" : "border-line"}`} />
            </Field>
            <div className="flex flex-col gap-2">
              <span className="text-[15px] font-semibold">Language</span>
              <LanguagePicker name="language" options={languages} defaultValue={v.language || "Auto"} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Choice label="Call length" name="minutes" value={String(minutes)} onChange={(m) => setMinutes(Number(m))}
              options={[
                { value: "1", label: "1 min", hint: "Quick" },
                { value: "3", label: "3 min", hint: "Daily" },
                { value: "5", label: "5 min", hint: "Longer" },
              ]} />
            <p className={`text-[14px] leading-snug ${short ? "text-alert" : "text-body"}`}>
              {short
                ? `Not enough demo credit for a ${minutes}-minute call: ₹${fmt(Math.max(left, 0))} left, up to ₹${fmt(need)} needed.`
                : `Up to ₹${fmt(need)} · ₹${fmt(rate)} per started minute${left !== null ? ` · ₹${fmt(left)} demo credit left` : ""}`}
            </p>
          </div>

          <details open={advancedError || undefined} className="group rounded-[18px] border border-line bg-white/60">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
              <span>
                More options <span className="font-normal text-body">· optional</span>
              </span>
              <Chevron />
            </summary>
            <div className="grid gap-4 px-4 pt-1 pb-4 sm:grid-cols-2">
              <Field label="On behalf of" error={err.family_name}>
                <input name="family_name" placeholder="Neha" defaultValue={v.family_name}
                  className={`${field} ${err.family_name ? "border-alert" : "border-line"}`} />
              </Field>
              <Field label="Emergency number" error={err.emergency_number}>
                <input name="emergency_number" type="tel" inputMode="tel" placeholder="+91 …" defaultValue={v.emergency_number}
                  className={`${field} ${err.emergency_number ? "border-alert" : "border-line"}`} />
              </Field>
              <Field label="Medicines" error={err.medicines}>
                <input name="medicines" placeholder="BP tablet at night" defaultValue={v.medicines}
                  className={`${field} ${err.medicines ? "border-alert" : "border-line"}`} />
              </Field>
              <Field label="Health notes" error={err.health_notes}>
                <input name="health_notes" placeholder="Knee pain this week" defaultValue={v.health_notes}
                  className={`${field} ${err.health_notes ? "border-alert" : "border-line"}`} />
              </Field>
            </div>
          </details>

          <FamilyFields values={v} errors={err} />

          <label className="flex items-start gap-3 text-[15px] leading-snug text-body">
            <input name="consent" type="checkbox" defaultChecked={v.consent === "on"} className="mt-[3px] size-5 shrink-0 accent-ink" />
            <span>
              The person at this number knows Kin will call and agreed to a short test call.
              {err.consent ? <span className="mt-1 block text-[14px] text-alert">{err.consent}</span> : null}
            </span>
          </label>

          {state.status === "error" ? (
            <p role="alert" className="rounded-[14px] bg-alert-soft px-4 py-3 text-[15px] text-alert">{state.message}</p>
          ) : null}

          <button
            type="submit"
            disabled={pending || Boolean(placed) || short}
            className="inline-flex h-13 items-center justify-center gap-2 rounded-[128px] bg-charcoal px-7 text-[17px] font-medium text-cloud transition-[background,transform] hover:bg-black active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? "Placing the call…" : placed ? "Call placed" : short ? "Not enough credit" : "Place call"}
          </button>
        </form>

        {/* Stretches to the form's height (family details live in a dialog, so the form stays short). */}
        <div className="flex min-w-0 flex-col">
          {shown ? (
            <CallPanel key={shown.id} attemptId={shown.id} phone={shown.phone} name={shown.name} minutes={shown.minutes}
              startedAt={shown.at} onDone={onDone} onReset={onReset} />
          ) : (
            <Waiting />
          )}
        </div>
      </div>
    </section>
  );
}

function Waiting() {
  return (
    <div
      className="hidden min-h-[360px] flex-1 flex-col items-center justify-center gap-6 rounded-[28px] bg-charcoal bg-cover bg-center px-6 py-12 text-center text-white lg:flex"
      style={{ backgroundImage: "url(/art/night-glow.svg)" }}
    >
      <VoiceOrb size={160} />
      <div>
        <p className="text-[20px] font-semibold tracking-[-0.02em]">Ready when you are</p>
        <p className="mx-auto mt-2 max-w-xs text-[15px] leading-snug text-white/60">
          Place a call and its progress and evening card show up here.
        </p>
      </div>
      <ol className="flex flex-wrap justify-center gap-2 text-[13px] text-white/70">
        {["Kin calls", "They talk", "Evening card"].map((t, i) => (
          <li key={t} className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5">
            <span className="grid size-5 place-items-center rounded-full bg-white/15 text-[11px] font-semibold text-white">{i + 1}</span>
            {t}
          </li>
        ))}
      </ol>
    </div>
  );
}

function CallPanel({ attemptId, phone, name, minutes, startedAt, onDone, onReset }: {
  attemptId: string; phone: string; name: string; minutes: number; startedAt?: number; onDone: () => void; onReset: () => void;
}) {
  const [result, setResult] = useState<CallResult>({ state: "in_progress", elapsed_s: 0 });
  const [started] = useState(() => startedAt ?? Date.now());
  const [now, setNow] = useState(() => Date.now());

  const finished = result.state !== "in_progress";

  useEffect(() => {
    if (finished) {
      onDone();
      return;
    }
    const tick = setInterval(() => setNow(Date.now()), 1000);
    let alive = true;
    const poll = async () => {
      const r = await getDemoCall(attemptId);
      if (alive) setResult(r);
    };
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      alive = false;
      clearInterval(tick);
      clearInterval(timer);
    };
  }, [attemptId, finished, onDone]);

  const elapsed = Math.max(0, Math.floor((now - started) / 1000));

  if (result.state === "in_progress") {
    const connected = result.stage === "connected";
    const steps: [string, "done" | "now" | "next"][] = [
      ["Call placed", "done"],
      ["Calling", connected ? "done" : "now"],
      ["Connected", connected ? "now" : "next"],
      ["Evening card", "next"],
    ];
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-6 rounded-[28px] bg-charcoal bg-cover bg-center px-6 py-12 text-center text-white" style={{ backgroundImage: "url(/art/night-glow.svg)" }} role="status">
        <VoiceOrb size={180} active={connected} />
        <div>
          <p className="text-[13px] tracking-wide text-white/50 uppercase">{connected ? "Connected" : "Call placed"}</p>
          <p className="mt-2 text-2xl font-semibold">{connected ? `Kin is talking with ${name}` : `Calling ${name}…`}</p>
          <p className="mt-1 text-white/60">{phone} · {clock(elapsed)} of ~{minutes}:00</p>
        </div>
        <ol className="flex flex-wrap justify-center gap-2 text-[13px]">
          {steps.map(([t, s]) => (
            <li key={t} className={`flex items-center gap-2 rounded-full px-3 py-1.5 ${s === "now" ? "bg-white text-ink" : s === "done" ? "bg-white/15 text-white" : "bg-white/5 text-white/45"}`}>
              {s === "done" ? <Tick /> : <span className={`size-2 rounded-full ${s === "now" ? "animate-pulse bg-ink" : "bg-white/30"}`} />}
              {t}
            </li>
          ))}
        </ol>
        <p className="max-w-xs text-[14px] text-white/50">
          {connected
            ? "The evening card appears here a few seconds after the call ends."
            : "Their phone rings in a few seconds. This changes to Connected when they pick up."}
        </p>
      </div>
    );
  }

  if (result.state === "error" || result.state === "timeout") {
    return (
      <Notice
        title={result.state === "timeout" ? "No result yet" : "Something went wrong"}
        text={result.state === "timeout" ? "Kin has not received this call's result. It may still arrive; try placing the call again later." : result.message}
        onReset={onReset}
      />
    );
  }

  if (result.status !== "connected") {
    const reasons: Record<string, string> = {
      no_answer: "The call was not answered.",
      busy: "The line was busy.",
      failed: "The call could not be connected.",
    };
    return (
      <Notice
        title="Not connected"
        text={`${reasons[result.status] ?? `Call ended: ${result.status}.`} No credit was used.`}
        onReset={onReset}
      />
    );
  }

  return <CallResultView result={result} name={name} onReset={onReset} />;
}

function Notice({ title, text, onReset }: { title: string; text: string; onReset: () => void }) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 rounded-[28px] bg-cloud px-6 py-12 text-center">
      <p className="text-2xl font-semibold">{title}</p>
      <p className="max-w-sm text-body">{text}</p>
      <button onClick={onReset} className="mt-2 h-11 rounded-[128px] bg-charcoal px-5 font-medium text-cloud hover:bg-black">
        Place another call
      </button>
    </div>
  );
}

type Tone = "ok" | "watch" | "alert";
const toneStyle: Record<Tone, { dot: string; label: string; chip: string }> = {
  ok: { dot: "bg-ok", label: "All good", chip: "bg-ok-soft text-ok" },
  watch: { dot: "bg-watch", label: "Something to watch", chip: "bg-watch-soft text-watch" },
  alert: { dot: "bg-alert", label: "Needs attention", chip: "bg-alert-soft text-alert" },
};

function toneOf(o: CallOutputs): Tone {
  if (o.urgent_flag === true || o.mood === "distressed") return "alert";
  if (o.pain_mentioned === true || o.meds_taken === "none" || o.meds_taken === "some" || o.mood === "low")
    return "watch";
  return "ok";
}

// What the family could do next, only from what the agent actually recorded.
function followUps(o: CallOutputs, name: string): string[] {
  const out: string[] = [];
  if (o.urgent_flag === true) out.push(`Call ${name} now: Kin flagged something urgent on this call.`);
  if (o.wants_family_callback === true) out.push(`${name} asked for a call back from the family.`);
  if (o.pain_mentioned === true) out.push(`Ask about the ${o.pain_location ? String(o.pain_location) : "pain"} on the next call.`);
  if (o.meds_taken === "none" || o.meds_taken === "some") out.push("Check on the missed medicines.");
  if (o.mood === "low" || o.mood === "distressed") out.push(`${name} sounded low. A call from family would help.`);
  return out;
}

function CallResultView({ result, name, onReset }: {
  result: Extract<CallResult, { state: "done" }>; name: string; onReset: () => void;
}) {
  const { outputs, duration_s: duration } = result;
  const tone = toneStyle[toneOf(outputs)];
  const meds: Record<string, string> = { all: "All taken", some: "Some taken", none: "Not taken", unclear: "Unclear" };
  // Which language they spoke; the API keeps only this, never the transcript.
  const spoken = result.spoken_language ?? null;
  const chosen = result.language && result.language !== "Auto" ? result.language : "Auto";
  const language = spoken ? (chosen === "Auto" || chosen === spoken ? spoken : `${spoken} (chose ${chosen})`) : chosen;
  const rows: [string, string][] = [
    ["Mood", outputs.mood ? cap(String(outputs.mood)) : "Not clear"],
    ["Sleep", outputs.sleep_quality != null ? `${outputs.sleep_quality} / 5` : "Not discussed"],
    ["Pain", outputs.pain_mentioned === true ? String(outputs.pain_location || "Mentioned") : "None mentioned"],
    ["Medicines", meds[String(outputs.meds_taken)] ?? "Not discussed"],
    ["Wants a call back", outputs.wants_family_callback === true ? "Yes" : "No"],
    ["Language", language],
    ["Call length", clock(duration)],
  ];
  if (result.charge != null) rows.push(["Charge", `₹${fmt(result.charge)}`]);
  const todo = followUps(outputs, name);

  return (
    <div className="flex flex-col gap-6">
      {/* evening card */}
      <div className="rounded-[28px] bg-cloud p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold tracking-wide text-body uppercase">Evening card</p>
            <p className="mt-1 text-[22px] font-semibold tracking-[-0.02em]">{name}</p>
            {result.placed_at ? <p className="text-[14px] text-body">{when(Date.parse(result.placed_at))}</p> : null}
          </div>
          <span className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1 text-[13px] font-medium ${tone.chip}`}>
            <span className={`size-2 rounded-full ${tone.dot}`} />
            {tone.label}
          </span>
        </div>
        {outputs.call_summary ? <p className="mt-4 text-[17px] leading-[1.4]">{String(outputs.call_summary)}</p> : null}
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-[15px] sm:grid-cols-3">
          {rows.map(([k, val]) => (
            <div key={k}>
              <dt className="text-body">{k}</dt>
              <dd className="font-medium">{val}</dd>
            </div>
          ))}
        </dl>
        {outputs.concerns ? (
          <div className="mt-5 border-t border-line pt-4">
            <p className="text-[13px] font-semibold tracking-wide text-body uppercase">Concerns or requests</p>
            <p className="mt-1 text-[15px]">{String(outputs.concerns)}</p>
          </div>
        ) : null}
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-[13px] font-semibold tracking-wide text-body uppercase">Follow up</p>
          {todo.length ? (
            <ul className="mt-2 flex flex-col gap-1.5 text-[15px]">
              {todo.map((t) => (
                <li key={t} className="flex gap-2"><span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-ink" />{t}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[15px] text-body">Nothing to follow up from this call.</p>
          )}
        </div>
      </div>


      <button onClick={onReset} className="h-11 self-start rounded-[128px] bg-charcoal px-5 font-medium text-cloud hover:bg-black">
        Place another call
      </button>
    </div>
  );
}

function History({ items, activeId, onView }: { items: Past[]; activeId?: string; onView: (p: Past) => void }) {
  if (!items.length) return null;
  return (
    <section className="mx-auto max-w-[1100px] px-4 pb-10 sm:px-8">
      <div className="glass rounded-[28px] p-6">
        <p className="text-[13px] font-semibold tracking-wide text-body uppercase">Recent calls from this browser</p>
        <ul className="mt-2 divide-y divide-line">
          {items.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.name}</p>
                <p className="text-[14px] text-body">{p.phone} · {when(p.at)} · {p.minutes} min</p>
              </div>
              <button
                onClick={() => onView(p)}
                disabled={p.id === activeId}
                className="h-9 shrink-0 rounded-[128px] bg-white px-4 text-[14px] font-medium text-ink shadow-chip transition-colors hover:bg-cloud disabled:opacity-60"
              >
                {p.id === activeId ? "Showing" : "View"}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Field({ label, error, wide, children }: {
  label: string; error?: string; wide?: boolean; children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-2 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-[15px] font-semibold">{label}</span>
      {children}
      {error ? <span className="text-[14px] text-alert">{error}</span> : null}
    </label>
  );
}

// Segmented radio pills, e.g. language or call length.
function Choice({ label, name, value, options, onChange }: {
  label: string; name: string; value: string; onChange?: (value: string) => void;
  options: { value: string; label: string; hint?: string; className?: string }[];
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[15px] font-semibold">{label}</legend>
      <div className="grid h-12 auto-cols-fr grid-flow-col gap-1 rounded-[14px] border border-line bg-white/90 p-1">
        {options.map((o) => (
          <label
            key={o.value}
            className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-[10px] text-[15px] font-medium text-body transition-colors hover:text-ink has-[:checked]:bg-charcoal has-[:checked]:text-cloud has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink ${o.className ?? ""}`}
          >
            <input type="radio" name={name} value={o.value} defaultChecked={value === o.value}
              onChange={onChange ? () => onChange(o.value) : undefined} className="sr-only" />
            {o.label}
            {o.hint ? <span className="hidden text-[13px] font-normal opacity-60 sm:inline">{o.hint}</span> : null}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="shrink-0 transition-transform group-open:rotate-180" aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function Tick() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

function clock(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function mask(phone: string) {
  return phone.replace(/(\+\d{2})\d+(\d{4})$/, "$1 ••••• $2");
}

// Rupees without a trailing ".00".
function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

// Calls are about parents in India, so show India time.
function when(ms: number) {
  return new Date(ms).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  }) + " IST";
}
