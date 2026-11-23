"use client";

// The Medicines page's parts, each the web twin of an app component:
// MedicineCalendar (components/medicine-calendar.tsx), ReminderCalls
// (components/reminder-calls.tsx), StockModal (components/stock-sheet.tsx) and
// ReorderModal (components/reorder-all.tsx).

import { useState } from "react";

import { amazonCartUrl, formatDay, to12h, to24h, type MedicineDayState, type MedicineHistory, type Reminder, type StockItem } from "@/lib/kin/data";
import { useKin } from "@/lib/kin/kin";
import { color } from "@/lib/kin/theme";
import { INDIA, phoneDigits, phoneError, splitPhone, toE164 } from "@/lib/kin/validate";

import { PhoneField } from "./phone-field";
import { Button, Card, CardTitle, ErrorText, Icon, icon, Input, Modal, OutLink, Select, StatusPill, Toggle } from "./ui";

export const MED_SHOPS = [
  { name: "Tata 1mg", url: (q: string) => `https://www.1mg.com/search/all?name=${encodeURIComponent(q)}` },
  { name: "PharmEasy", url: (q: string) => `https://pharmeasy.in/search/all?name=${encodeURIComponent(q)}` },
  { name: "Apollo 24|7", url: (q: string) => `https://www.apollopharmacy.in/search-medicines/${encodeURIComponent(q)}` },
  { name: "Blinkit", url: (q: string) => `https://blinkit.com/s/?q=${encodeURIComponent(q)}` },
];

export function stockLine(s: StockItem) {
  const ends = s.courseEndsOn ? formatDay(s.courseEndsOn) : "";
  if (s.courseDone) return `Course finished${ends ? ` (${ends})` : ""}`;
  const tablets = `${s.left} ${s.left === 1 ? "tablet" : "tablets"} left`;
  if (s.enoughForCourse) return `${tablets} · enough to finish the course${ends ? ` (${ends === "Today" ? "today" : ends})` : ""}`;
  if (s.left <= 0) return s.courseEndsOn ? `Run out · course ends ${ends}` : "Run out";
  const when = s.runsOutOn ? formatDay(s.runsOutOn) : "";
  return `${tablets}${when ? ` · runs out ${when === "Today" ? "today" : when}` : ""}${s.courseEndsOn ? ` · course ends ${ends}` : ""}`;
}

export function buyLine(s: StockItem) {
  if (s.courseDone) return "The course is over: nothing to buy.";
  if (!s.suggestedStrips) return s.courseEndsOn ? "Enough at home to finish the course: nothing to buy." : "Enough for the next month.";
  const strips = `${s.suggestedStrips} ${s.suggestedStrips === 1 ? "strip" : "strips"}`;
  return s.courseEndsOn ? `To finish the course: ${strips}.` : `For about a month: ${strips}.`;
}

// ---- 30-day calendar ---------------------------------------------------------------------

const look: Record<MedicineDayState, { bg: string; fg: string; mark: string; label: string }> = {
  taken: { bg: color.ok, fg: "#fff", mark: "✓", label: "All taken" },
  partly: { bg: color.watchSoft, fg: color.watch, mark: "½", label: "Some doses unanswered" },
  not_taken: { bg: color.alert, fg: "#fff", mark: "✕", label: "Not taken" },
  no_answer: { bg: color.watchSoft, fg: color.watch, mark: "–", label: "No answer" },
  unclear: { bg: "rgba(34,35,38,0.08)", fg: color.body, mark: "?", label: "Not sure" },
};
const result: Record<string, string> = { taken: "taken", not_taken: "not taken", no_answer: "no answer", unclear: "not sure" };
const WEEK = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function MedicineCalendar({ history, name }: { history: MedicineHistory; name: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  const { days, streak, best, takenDays, knownDays } = history;
  if (!knownDays) return null;
  const first = new Date(days[0].day + "T12:00:00");
  const lead = (first.getDay() + 6) % 7;
  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...days.map((_, i) => i)];
  while (cells.length % 7) cells.push(null);
  const sel = picked === null ? null : days[picked];

  return (
    <Card>
      <div className="flex items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ffd76a] to-[#ff8f70] text-[22px] font-semibold text-white shadow-[0_6px_16px_-6px_#ff8f70]">{streak}</span>
        <div>
          <p className="text-[18px] font-semibold tracking-[-0.01em]">{streak ? `${streak} ${streak === 1 ? "day" : "days"} in a row` : "No run yet"}</p>
          <p className="text-[14px] leading-[1.45] text-body">
            {streak
              ? `${name} has taken every dose ${streak === 1 ? "today" : `for ${streak} days`}. Best run: ${best}.`
              : `Every day ${name} takes all their medicines adds to the run. Best so far: ${best}.`}
          </p>
        </div>
      </div>
      <div className="mt-5 grid max-w-[420px] grid-cols-7 gap-1.5">
        {WEEK.map((d) => (
          <span key={d} className="pb-1 text-center text-[11.5px] font-semibold text-faint">
            {d}
          </span>
        ))}
        {cells.map((i, k) => {
          if (i === null) return <span key={`b${k}`} />;
          const d = days[i];
          const l = d.state ? look[d.state] : null;
          const today = i === days.length - 1;
          return (
            <button
              key={d.day}
              type="button"
              onClick={() => setPicked(picked === i ? null : i)}
              title={`${formatDay(d.day)}: ${l ? l.label : "no result"}`}
              className={`relative aspect-square cursor-pointer rounded-[12px] text-[12px] font-semibold transition-transform hover:scale-105 ${picked === i ? "ring-2 ring-ink" : today ? "ring-2 ring-ink/30" : ""}`}
              style={{ backgroundColor: l?.bg ?? "rgba(34,35,38,0.04)", color: l?.fg ?? color.faint }}
            >
              <span className="absolute top-1 left-1.5 text-[10px] font-medium opacity-80">{Number(d.day.slice(8))}</span>
              <span className="text-[14px]">{l?.mark ?? ""}</span>
            </button>
          );
        })}
      </div>
      {sel ? (
        <div className="mt-3 rounded-[16px] bg-paper px-4 py-3 text-[14px]">
          <p className="font-semibold">
            {formatDay(sel.day)} · {sel.state ? look[sel.state].label : "No result"}
          </p>
          {sel.items.map((it, j) => (
            <p key={j} className="text-body">
              {it.what}: {result[it.result] ?? it.result}
            </p>
          ))}
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
        {(["taken", "not_taken", "no_answer", "partly"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5 text-[12.5px] text-body">
            <i className="block size-2.5 rounded-[4px]" style={{ backgroundColor: look[s].bg === color.watchSoft ? color.watch : look[s].bg }} />
            {look[s].label}
          </span>
        ))}
        <span className="ml-auto text-[12.5px] text-body">
          {takenDays} of {knownDays} days all taken
        </span>
      </div>
    </Card>
  );
}

// ---- reminder calls ------------------------------------------------------------------------

const TIMES = ["7:00 am", "8:00 am", "9:00 am", "1:00 pm", "2:00 pm", "6:00 pm", "8:00 pm", "9:00 pm", "9:30 pm"];
const MAX = 4;
const status: Record<NonNullable<Reminder["today"]>["state"], { tone: "ok" | "watch" | "alert" | "plain"; text: string }> = {
  scheduled: { tone: "plain", text: "Calling soon" },
  calling: { tone: "plain", text: "Calling now" },
  retrying: { tone: "watch", text: "No answer, trying again" },
  taken: { tone: "ok", text: "Taken today" },
  not_taken: { tone: "alert", text: "Not taken today" },
  unclear: { tone: "watch", text: "Not sure today" },
  no_answer: { tone: "watch", text: "No answer today" },
  skipped: { tone: "plain", text: "Evening call asked instead" },
  failed: { tone: "watch", text: "Call didn't go through" },
};

export function ReminderCalls() {
  const { family, saveReminder, removeReminder } = useKin();
  const { parent } = family;
  const reminders = parent.reminders ?? [];
  const [adding, setAdding] = useState(false);
  const [asking, setAsking] = useState(false);
  const [time, setTime] = useState("8:00 pm");
  const [picked, setPicked] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const names = family.medicines.map((m) => m.name);
  const medicines = names.length ? picked.join(", ") : typed.trim();

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    setAsking(false);
    if (await run(() => saveReminder({ time: to24h(time), medicines }))) {
      setAdding(false);
      setPicked([]);
      setTyped("");
    }
  }

  return (
    <Card>
      <span id="reminders" className="block scroll-mt-24" />
      <CardTitle right={`${reminders.length} of ${MAX}`}>Reminder calls</CardTitle>
      <p className="-mt-1 mb-3 text-[14px] leading-[1.5] text-body">
        A one-minute call at tablet time, about ₹4. If {parent.name} hasn&apos;t taken them, you get a notification in the app.
      </p>
      <div className="space-y-2">
        {reminders.map((r) => {
          const s = r.today ? status[r.today.state] : null;
          return (
            <div key={r.id} className="flex items-center gap-3 rounded-[18px] bg-paper px-3.5 py-3">
              <span className="w-[62px] shrink-0 text-[15px] font-semibold tabular-nums">{to12h(r.time)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-medium">{r.medicines}</span>
                {s ? <StatusPill tone={s.tone}>{s.text}</StatusPill> : <span className="text-[13px] text-body">{r.enabled ? "Every day" : "Off"}</span>}
              </span>
              <Toggle on={r.enabled} label={`Reminder at ${to12h(r.time)}`} disabled={busy} onChange={(on) => void run(() => saveReminder({ id: r.id, enabled: on }))} />
              <button type="button" aria-label="Remove" onClick={() => void run(() => removeReminder(r.id))} className="grid size-8 cursor-pointer place-items-center rounded-full text-faint hover:bg-alert-soft hover:text-alert">
                <Icon d={icon.trash} size={16} />
              </button>
            </div>
          );
        })}
      </div>
      {adding ? (
        <div className="mt-3 space-y-3 rounded-[20px] bg-paper p-4">
          <Select label="Time (India)" value={time} onChange={(e) => setTime(e.target.value)}>
            {TIMES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
          {names.length ? (
            <div>
              <p className="mb-1.5 px-1 text-[13px] font-semibold text-body">Which medicines</p>
              <div className="flex flex-wrap gap-2">
                {names.map((n) => {
                  const on = picked.includes(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPicked((p) => (on ? p.filter((x) => x !== n) : [...p, n]))}
                      className={`h-9 cursor-pointer rounded-full px-3.5 text-[14px] font-medium ${on ? "bg-charcoal text-white" : "bg-cloud hover:bg-line"}`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <Input label="Which medicines" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Amlodipine 5 mg" maxLength={200} />
          )}
          <div className="flex justify-end gap-2">
            <Button variant="soft" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={busy || !medicines} onClick={() => (parent.consentAt ? add() : setAsking(true))}>
              Add reminder
            </Button>
          </div>
        </div>
      ) : reminders.length < MAX ? (
        <Button variant="white" size="sm" className="mt-3" onClick={() => setAdding(true)}>
          <Icon d={icon.plus} size={16} /> Add a reminder call
        </Button>
      ) : null}
      <div className="mt-3">
        <ErrorText>{error}</ErrorText>
      </div>
      <Modal open={asking} onClose={() => setAsking(false)} title={`Does ${parent.name} know?`}>
        <p className="text-[15px] leading-[1.5] text-body">
          Kin will ring {parent.name} at {time} to ask about {medicines}. Tell them first that Kin, an AI assistant, will call. If they ever say no, Kin stops.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="soft" onClick={() => setAsking(false)}>
            Cancel
          </Button>
          <Button onClick={add}>{parent.name} knows</Button>
        </div>
      </Modal>
    </Card>
  );
}

// ---- stock for one medicine ----------------------------------------------------------------

export function StockModal({ medicine, onClose }: { medicine: string | null; onClose: () => void }) {
  return (
    <Modal open={medicine !== null} onClose={onClose} title={medicine ?? ""}>
      {medicine ? <StockForm key={medicine} medicine={medicine} onClose={onClose} /> : null}
    </Modal>
  );
}

function StockForm({ medicine, onClose }: { medicine: string; onClose: () => void }) {
  const { family, setStock, restock, saveProduct, deleteStock } = useKin();
  const parent = family.parent;
  const item = parent.stock?.find((s) => s.name.toLowerCase() === medicine.toLowerCase());
  const product = parent.products?.find((x) => x.name.toLowerCase() === medicine.toLowerCase());
  const [tab, setTab] = useState<"count" | "add" | "order">(item ? (item.low ? "order" : "add") : "count");
  const [perDay, setPerDay] = useState(String(item?.perDay ?? 1));
  const [pack, setPack] = useState(String(item?.packSize ?? 10));
  const [tablets, setTablets] = useState(String(item ? Math.max(0, item.left) : ""));
  const [course, setCourse] = useState(item?.courseEndsOn ? "course" : "ongoing");
  const [courseDays, setCourseDays] = useState("5");
  const [packs, setPacks] = useState(String(Math.max(1, item?.suggestedStrips ?? 1)));
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const strips = Math.max(1, item?.suggestedStrips ?? 1);
  const order = `Namaste, please send ${strips} ${strips === 1 ? "strip" : "strips"} of ${medicine} for ${parent.name}${parent.city ? ` (${parent.city})` : ""}. Thank you.`;
  const whatsapp = parent.chemistPhone ? `https://wa.me/${parent.chemistPhone.replace(/\D/g, "")}?text=${encodeURIComponent(order)}` : null;

  async function run(fn: () => Promise<void>, close = true) {
    setBusy(true);
    setError("");
    try {
      await fn();
      if (close) onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const tabs: ["count" | "add" | "order", string][] = [
    ["count", item ? "Recount" : "Count tablets"],
    ...(item ? [["add", "Bought more"] as ["add", string]] : []),
    ["order", "Reorder"],
  ];

  return (
    <div className="space-y-4">
      {item ? (
        <div className={`rounded-[16px] px-4 py-3 ${item.low ? "bg-alert-soft" : "bg-cloud"}`}>
          <p className={`text-[15px] font-semibold ${item.low ? "text-alert" : ""}`}>{stockLine(item)}</p>
          <p className="text-[13.5px] text-body">{buyLine(item)}</p>
        </div>
      ) : null}
      <div className="flex gap-1 rounded-full bg-cloud p-1">
        {tabs.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`h-8 flex-1 cursor-pointer rounded-full text-[13.5px] font-semibold ${tab === k ? "bg-paper shadow-[0_1px_3px_rgb(0_0_0/0.1)]" : "text-body"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "count" ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Input label="A day" type="number" min={0.5} step={0.5} max={12} value={perDay} onChange={(e) => setPerDay(e.target.value)} />
            <Input label="Strip size" type="number" min={1} max={500} value={pack} onChange={(e) => setPack(e.target.value)} />
            <Input label="At home now" type="number" min={0} max={5000} value={tablets} onChange={(e) => setTablets(e.target.value)} placeholder="24" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Prescription" value={course} onChange={(e) => setCourse(e.target.value)}>
              <option value="ongoing">Ongoing</option>
              <option value="course">A set course</option>
            </Select>
            {course === "course" ? <Input label="Days left in the course" type="number" min={1} max={90} value={courseDays} onChange={(e) => setCourseDays(e.target.value)} /> : null}
          </div>
          <div className="flex justify-between gap-2 pt-1">
            {item ? (
              <Button variant="danger" size="sm" disabled={busy} onClick={() => run(() => deleteStock(item.id))}>
                Stop counting
              </Button>
            ) : (
              <span />
            )}
            <Button
              disabled={busy || !(Number(perDay) > 0) || !(Number(pack) >= 1) || tablets === "" || Number(tablets) < 0}
              onClick={() =>
                run(() => setStock({ name: medicine, perDay: Number(perDay), packSize: Math.round(Number(pack)), tablets: Number(tablets), courseDays: course === "course" ? Number(courseDays) || null : null }))
              }
            >
              Save count
            </Button>
          </div>
        </div>
      ) : tab === "add" && item ? (
        <div className="space-y-3">
          <Input label={`Strips bought (${item.packSize} tablets each)`} type="number" min={1} max={50} value={packs} onChange={(e) => setPacks(e.target.value)} />
          <div className="flex justify-end">
            <Button disabled={busy || !(Number(packs) >= 1)} onClick={() => run(() => restock(item.id, Math.round(Number(packs))))}>
              Add {Number(packs) || 0} {Number(packs) === 1 ? "strip" : "strips"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {whatsapp ? (
            <OutLink href={whatsapp} variant="filled" className="w-full">
              Message the chemist on WhatsApp
            </OutLink>
          ) : (
            <p className="text-[14px] text-body">Add the local chemist&apos;s WhatsApp number on this page to send an order in one click.</p>
          )}
          {product ? (
            <OutLink href={amazonCartUrl([{ asin: product.amazonAsin, quantity: strips }])} className="w-full">
              <Icon d={icon.cart} size={17} /> Add {strips} to the Amazon cart
            </OutLink>
          ) : (
            <div className="flex gap-2">
              <Input className="flex-1" aria-label="Amazon link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste its Amazon link (amazon.in/dp/… or amzn.in/…)" />
              <Button variant="white" disabled={busy || !link.trim()} onClick={() => run(() => saveProduct(medicine, link.trim()), false).then(() => setLink(""))}>
                Save
              </Button>
            </div>
          )}
          <div>
            <p className="mb-1.5 px-1 text-[13px] font-semibold text-body">Or search a pharmacy</p>
            <div className="flex flex-wrap gap-2">
              {MED_SHOPS.map((s) => (
                <OutLink key={s.name} href={s.url(medicine)} size="sm">
                  {s.name}
                </OutLink>
              ))}
              <OutLink href={`https://www.amazon.in/s?k=${encodeURIComponent(medicine)}`} size="sm">
                Amazon
              </OutLink>
            </div>
          </div>
          {product ? (
            <button type="button" onClick={() => run(() => saveProduct(medicine, null), false)} className="cursor-pointer text-[13px] text-body hover:text-ink">
              Forget the saved Amazon product
            </button>
          ) : null}
        </div>
      )}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

// ---- reorder several at once -------------------------------------------------------------

type Line = { name: string; strips: number; on: boolean; stockId?: string; detail?: string; low: boolean };

export function ReorderModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Reorder medicines" wide>
      {open ? <Reorder onClose={onClose} /> : null}
    </Modal>
  );
}

function Reorder({ onClose }: { onClose: () => void }) {
  const { family, restockAll, saveParent } = useKin();
  const { parent } = family;
  const [lines, setLines] = useState<Line[]>(() =>
    family.medicines
      .flatMap((m) => {
        const s = parent.stock?.find((x) => x.name.toLowerCase() === m.name.toLowerCase());
        if (s?.courseDone) return [];
        return [{ name: m.name, strips: s ? Math.max(1, s.suggestedStrips) : 1, on: Boolean(s?.low), stockId: s?.id, detail: s ? stockLine(s) : undefined, low: Boolean(s?.low) }];
      })
      .sort((a, b) => Number(b.low) - Number(a.low)),
  );
  const [opened, setOpened] = useState<string[]>([]);
  const [chemist, setChemist] = useState(() => splitPhone(parent.chemistPhone, [INDIA]).digits);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const chosen = lines.filter((l) => l.on);
  const update = (name: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.name === name ? { ...l, ...patch } : l)));
  const list = chosen.map((l, i) => `${i + 1}. ${l.name}: ${l.strips} ${l.strips === 1 ? "strip" : "strips"}`).join("\n");
  const message = `Namaste, please send these for ${parent.name}${parent.city ? ` (${parent.city})` : ""}:\n${list}\nThank you.`;
  const whatsapp = parent.chemistPhone ? `https://wa.me/${parent.chemistPhone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}` : null;
  const asinOf = (name: string) => parent.products?.find((x) => x.name.toLowerCase() === name.toLowerCase())?.amazonAsin;
  const onAmazon = chosen.filter((l) => asinOf(l.name));
  const amazonUrl = onAmazon.length ? amazonCartUrl(onAmazon.map((l) => ({ asin: asinOf(l.name)!, quantity: l.strips }))) : null;
  const counted = chosen.filter((l) => l.stockId);
  const chemistErr = phoneError(chemist, INDIA, false);

  async function run(fn: () => Promise<void>, msg: string) {
    setBusy(true);
    setError("");
    try {
      await fn();
      setDone(msg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  if (!lines.length) return <p className="text-[15px] text-body">Add {parent.name}&apos;s medicines first.</p>;

  return (
    <div className="space-y-4">
      <div className="divide-y divide-ink/10 rounded-[20px] bg-cloud px-2">
        {lines.map((l) => (
          <div key={l.name} className="flex items-center gap-3 px-2 py-2.5">
            <input type="checkbox" checked={l.on} onChange={(e) => update(l.name, { on: e.target.checked })} className="size-[18px] cursor-pointer accent-[#1f2025]" aria-label={l.name} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold">{l.name}</span>
              {l.detail ? <span className={`block truncate text-[12.5px] ${l.low ? "text-alert" : "text-body"}`}>{l.detail}</span> : null}
            </span>
            <span className="flex items-center gap-1">
              <button type="button" aria-label="Fewer" disabled={l.strips <= 1} onClick={() => update(l.name, { strips: l.strips - 1 })} className="grid size-8 cursor-pointer place-items-center rounded-full bg-paper text-[17px] disabled:opacity-40">
                −
              </button>
              <span className="w-[62px] text-center text-[13.5px] font-semibold tabular-nums">
                {l.strips} {l.strips === 1 ? "strip" : "strips"}
              </span>
              <button type="button" aria-label="More" disabled={l.strips >= 50} onClick={() => update(l.name, { strips: l.strips + 1 })} className="grid size-8 cursor-pointer place-items-center rounded-full bg-paper text-[17px] disabled:opacity-40">
                +
              </button>
            </span>
          </div>
        ))}
      </div>

      {chosen.length ? (
        <div className="space-y-2">
          {amazonUrl ? (
            <OutLink href={amazonUrl} variant="filled" className="w-full">
              <Icon d={icon.cart} size={17} /> Add {onAmazon.length === chosen.length ? "all" : onAmazon.length} to the Amazon cart
            </OutLink>
          ) : null}
          {whatsapp ? (
            <OutLink href={whatsapp} variant={amazonUrl ? "soft" : "filled"} className="w-full">
              Send all {chosen.length} to the chemist on WhatsApp
            </OutLink>
          ) : (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <PhoneField label="Chemist's WhatsApp (India)" digits={chemist} country={INDIA} onChange={(d) => setChemist(phoneDigits(d, INDIA))} indiaOnly error={chemistErr} />
              </div>
              <Button variant="white" disabled={busy || !chemist || Boolean(chemistErr)} onClick={() => run(() => saveParent({ chemistPhone: toE164(chemist, INDIA) }), "Chemist saved.")}>
                Save
              </Button>
            </div>
          )}
          <div className="pt-1">
            <p className="mb-1.5 px-1 text-[13px] font-semibold text-body">
              Or one at a time on a pharmacy site{chosen.length > 1 ? " (each opens in a new tab)" : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              {MED_SHOPS.map((s) => (
                <Button
                  key={s.name}
                  variant="soft"
                  size="sm"
                  onClick={() => {
                    for (const l of chosen) window.open(s.url(l.name), "_blank", "noopener");
                    setOpened(chosen.map((l) => l.name));
                  }}
                >
                  {s.name}
                </Button>
              ))}
            </div>
            {opened.length ? <p className="mt-2 px-1 text-[13px] text-body">Add each one to the same cart there. If the browser blocked the tabs, allow pop-ups for this site.</p> : null}
          </div>
        </div>
      ) : (
        <p className="text-[14px] text-body">Tick what to order.</p>
      )}

      {counted.length ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[18px] bg-ok-soft px-4 py-3">
          <span className="text-[14px] font-medium">Bought them? Add the strips to what&apos;s at home.</span>
          <Button size="sm" disabled={busy} onClick={() => run(() => restockAll(counted.map((l) => ({ id: l.stockId!, packs: l.strips }))), "Stock updated.")}>
            Restock {counted.length}
          </Button>
        </div>
      ) : null}
      <ErrorText>{error}</ErrorText>
      {done && !error ? <p className="text-[14px] font-medium text-ok">{done}</p> : null}
      <div className="flex justify-end">
        <Button variant="soft" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
