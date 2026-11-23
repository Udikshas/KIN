"use client";

// Today: the web twin of the app's Today tab (apps/mobile/src/app/(tabs)/index.tsx),
// with the evening card, rings and summary on the left and the week, Kin's next
// topic and the household (medicines running low, groceries due) on the right.

import Link from "next/link";

import { AlertCard, FamilyMessages, InsightCard, ShareCall, UrgentBanner } from "@/components/dashboard/cards";
import { CallNow } from "@/components/dashboard/call-now";
import { Card, CardTitle, Icon, icon, PageHead, Ring, Rings } from "@/components/dashboard/ui";
import { formatDay, formatDuration, istDate, istTime, medsLabel, moodLabel, painStreak, sleepOf, type DailyStatus } from "@/lib/kin/data";
import { useKin } from "@/lib/kin/kin";
import { color, metric } from "@/lib/kin/theme";

const moodValue = { happy: 1, ok: 0.88, low: 0.5, distressed: 0.25 };
const medsValue = { all: 1, some: 0.5, none: 0, unclear: 0 };

export default function Today() {
  const { family, mode } = useKin();
  const { parent } = family;
  const calls = family.calls.filter((c) => c.kind !== "reminder"); // reminders live under Medicines
  const latest = calls[0];
  const call = calls.find((c) => c.status === "connected");
  const o = call?.outputs ?? {};
  const sleep = sleepOf(o);
  const pain = painStreak(calls);
  const week = calls.filter((c) => c.status === "connected").slice(0, 7).reverse();
  const good = week.filter((c) => c.signal === "green").length;
  const dateLine = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });
  const meds = family.medicines;
  const medsStat =
    meds.length && meds.every((m) => m.takenToday !== null)
      ? `${meds.filter((m) => m.takenToday).length}/${meds.length}`
      : o.meds_taken
        ? medsLabel[o.meds_taken].split(" ")[0]
        : "–";
  const headline = latest && latest.status !== "connected" ? latest.headline : (call?.headline ?? "No calls yet");
  const callTitle = call && formatDay(call.date) === "Today" ? "Tonight's call" : call ? `${formatDay(call.date)}'s call` : "";

  return (
    <>
      <PageHead
        kicker={`${mode === "sample" ? "Sample · " : ""}${dateLine}${parent.city ? ` · ${parent.city}` : ""}`}
        title={<>{parent.name}: {headline.charAt(0).toLowerCase() + headline.slice(1)}</>}
        right={call ? <ShareCall name={parent.name} call={call} /> : null}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <UrgentBanner />
          {parent.dailyCalls && parent.daily ? <DailyLine status={parent.daily} name={parent.name} /> : null}
          <AlertCard />
          {call?.insight ? <InsightCard insight={call.insight} kicker={`${callTitle} · what changed`} /> : null}
          {call ? null : <GetStarted />}

          <Card className="relative">
            <div className={`flex flex-col items-center gap-6 sm:flex-row ${call ? "" : "opacity-30"}`}>
              <Rings
                size={150}
                stroke={15}
                rings={
                  call
                    ? [
                        { value: o.meds_taken ? medsValue[o.meds_taken] : 0, color: metric.green, to: "#a6f36b" },
                        { value: sleep?.value ?? 0, color: metric.lilac, to: "#d9cdff" },
                        { value: o.mood ? moodValue[o.mood] : 0, color: metric.blue, to: "#8fb0ff" },
                      ]
                    : [
                        { value: 0.8, color: metric.green, to: "#a6f36b" },
                        { value: 0.65, color: metric.lilac, to: "#d9cdff" },
                        { value: 0.9, color: metric.blue, to: "#8fb0ff" },
                      ]
                }
              />
              <div className="grid w-full flex-1 grid-cols-3 gap-2">
                <Stat c={metric.green} value={call ? medsStat : "2/3"} label="Medicine" />
                <Stat c={metric.lilac} value={call ? (sleep?.label ?? "–") : "7 h"} label="Sleep" />
                <Stat c={metric.blue} value={call ? (o.mood ? moodLabel[o.mood] : "–") : "Good"} label="Mood" />
              </div>
            </div>
            {call ? null : (
              <div className="absolute inset-0 grid place-items-center">
                <div className="flex items-center gap-2.5 rounded-full bg-paper py-2 pr-5 pl-2 shadow-[0_10px_30px_-12px_rgb(20_30_60/0.35)]">
                  <span className="grid size-8 place-items-center rounded-full bg-blue/10 text-blue">
                    <Icon d={icon.trends} size={16} />
                  </span>
                  <span>
                    <span className="block text-[14px] font-semibold">Not enough data yet</span>
                    <span className="block text-[12.5px] text-body">Fills in after the first call</span>
                  </span>
                </div>
              </div>
            )}
          </Card>

          {call ? (
            <Link href={`/dashboard/calls/${call.id}`} className="block rounded-[28px] bg-cloud p-5 transition-colors hover:bg-[#e3e9f4]">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-[14px] bg-gradient-to-br from-[#3a3c45] to-charcoal text-white shadow-[0_4px_8px_rgb(31_32_37/0.25)]">
                  <Icon d={icon.doc} size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-semibold">{callTitle}</p>
                  <p className="text-[13px] text-body tabular-nums">
                    {call.time} · {formatDuration(call.duration_s)} · {call.language}
                  </p>
                </div>
                <Icon d={icon.chevron} size={16} className="text-faint" />
              </div>
              <p className="mt-3 text-[15.5px] leading-[1.55] text-ink/80">{call.summary}</p>
            </Link>
          ) : (
            <Card>
              <p className="text-[16px] font-semibold">No call summary yet</p>
              <p className="mt-1 text-[14px] text-body">
                {parent.dailyCalls ? `First daily call at ${parent.callTime}.` : "Waiting for the first call."} After each call, Kin writes a short summary of how {parent.name} is.
              </p>
            </Card>
          )}

          {call && (o.pain_mentioned || o.wants_family_callback) ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {o.pain_mentioned ? (
                <Link href={`/dashboard/calls/${call.id}`} className="flex items-center gap-3 rounded-[24px] bg-gradient-to-br from-[#ffecbe] to-[#fff8e6] p-4">
                  <Ring value={Math.min(1, pain / 5)} color={metric.gold} size={44} stroke={5}>
                    {`${pain}d`}
                  </Ring>
                  <span>
                    <span className="block text-[12px] font-semibold tracking-[0.05em] text-watch uppercase">Watch</span>
                    <span className="block text-[16px] font-semibold">{o.pain_location ? `Pain: ${o.pain_location}` : "Mentioned pain"}</span>
                  </span>
                </Link>
              ) : null}
              {o.wants_family_callback ? (
                <a href={`tel:${parent.phone.replace(/\s/g, "")}`} className="flex items-center gap-3 rounded-[24px] bg-cloud p-4">
                  <span className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-[#c9bcff] to-[#ffc6b5] text-[26px] leading-none font-semibold text-white">&ldquo;</span>
                  <span>
                    <span className="block text-[12px] font-semibold tracking-[0.05em] text-body uppercase">{parent.name} asked</span>
                    <span className="block text-[16px] font-semibold">For the family to call back</span>
                  </span>
                </a>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <FamilyMessages />
          <CallNow />

          {family.nextTopic ? (
            <Link href="/dashboard/family#memory" className="flex items-center gap-3 rounded-full bg-cloud p-1.5 pr-4 hover:bg-[#e3e9f4]">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#8fb0ff] to-blue text-white">
                <Icon d={icon.bulb} size={17} />
              </span>
              <span className="truncate text-[14.5px]">
                <span className="text-body">Next call Kin asks </span>
                <span className="font-semibold">{family.nextTopic}</span>
              </span>
            </Link>
          ) : null}

          <Card>
            <CardTitle right={week.length ? `${good} of ${week.length} good ${week.length === 1 ? "day" : "days"}` : "Not enough calls yet"}>This week</CardTitle>
            <div className="flex justify-between">
              {(week.length ? week : lastWeek()).map((c, i, all) => {
                const last = i === all.length - 1;
                const day = "signal" in c ? c.date : c.key;
                const sig = "signal" in c ? c.signal : undefined;
                const tint = sig === "green" ? metric.green : sig === "red" ? color.alert : sig ? metric.gold : undefined;
                return (
                  <div key={day} className="flex flex-col items-center gap-1.5">
                    <span className={`rounded-full border-2 p-[2px] ${last ? "border-ink/80" : "border-transparent"}`}>
                      {tint ? (
                        <span className="grid size-9 place-items-center rounded-full text-white" style={{ backgroundColor: tint, boxShadow: `0 4px 8px ${tint}66` }}>
                          {sig === "green" ? <Icon d={icon.check} size={15} width={2.6} /> : <b className="text-[14px]">!</b>}
                        </span>
                      ) : (
                        <span className="block size-9 rounded-full border-[1.5px] border-dashed border-ink/20" />
                      )}
                    </span>
                    <span className={`text-[12px] font-semibold ${last ? "text-ink" : "text-body"}`}>
                      {new Date(day + "T12:00:00").toLocaleDateString("en-IN", { weekday: "narrow" })}
                    </span>
                  </div>
                );
              })}
            </div>
            <Link href="/dashboard/trends" className="mt-4 flex items-center justify-between border-t border-ink/10 pt-3 text-[13.5px] font-semibold">
              See trends <Icon d={icon.chevron} size={14} className="text-faint" />
            </Link>
          </Card>

          <Household />
        </div>
      </div>
    </>
  );
}

function Stat({ c, value, label }: { c: string; value: string; label: string }) {
  return (
    <div className="rounded-[20px] bg-paper/70 px-3 py-3">
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-body">
        <i className="block size-2 rounded-full" style={{ backgroundColor: c }} />
        {label}
      </p>
      <p className="mt-1 text-[24px] font-semibold tracking-[-0.03em]">{value}</p>
    </div>
  );
}

/** Medicines running low and groceries due: one line each, to the page that orders them. */
function Household() {
  const { family } = useKin();
  const low = (family.parent.stock ?? []).filter((s) => s.low);
  const due = (family.parent.groceries ?? []).filter((g) => g.due);
  const reminders = (family.parent.reminders ?? []).filter((r) => r.enabled);
  return (
    <Card>
      <CardTitle>{family.parent.name}&apos;s home</CardTitle>
      <div className="-mx-2 space-y-1">
        <Line href="/dashboard/medicines" dot={low.length ? color.alert : (family.parent.stock ?? []).length ? metric.green : color.faint} title={low.length ? `${low[0].name}${low[0].left <= 0 ? " has run out" : `: ${low[0].daysLeft} ${low[0].daysLeft === 1 ? "day" : "days"} left`}${low.length > 1 ? ` · +${low.length - 1} more` : ""}` : (family.parent.stock ?? []).length ? "Medicines in stock" : "Count tablets for refill alerts"} action={low.length ? "Reorder" : "Open"} />
        <Line href="/dashboard/groceries" dot={due.length ? color.watch : metric.green} title={due.length ? `Groceries due: ${due.slice(0, 3).map((g) => g.name).join(", ")}${due.length > 3 ? "…" : ""}` : (family.parent.groceries ?? []).length ? "No groceries due this week" : "Add the monthly groceries"} action={due.length ? "Order" : "Open"} />
        <Line href="/dashboard/medicines#reminders" dot={reminders.length ? metric.blue : color.faint} title={reminders.length ? `${reminders.length} medicine reminder ${reminders.length === 1 ? "call" : "calls"} a day` : "No medicine reminder calls"} action={reminders.length ? "Open" : "Set up"} />
      </div>
    </Card>
  );
}

function Line({ href, dot, title, action }: { href: string; dot: string; title: string; action: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-[16px] px-2 py-2.5 hover:bg-paper/70">
      <i className="block size-2.5 shrink-0 rounded-full" style={{ backgroundColor: dot }} />
      <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium">{title}</span>
      <span className="text-[14px] font-semibold text-blue">{action}</span>
    </Link>
  );
}

function lastWeek() {
  return Array.from({ length: 7 }, (_, i) => ({ key: istDate(new Date(Date.now() - (6 - i) * 86_400_000)) }));
}

function GetStarted() {
  const { family } = useKin();
  const { parent } = family;
  const steps = [
    { done: Boolean(parent.consentAt), title: `Introduce Kin to ${parent.name}`, sub: "A short call, so they know Kin. Use the app's Introduce screen, or ask Kin to call.", to: "/dashboard/profile" },
    { done: parent.dailyCalls, title: "Turn on daily calls", sub: `Pick a time that suits ${parent.name}`, to: "/dashboard/profile" },
    { done: family.medicines.length > 0, title: "Add medicines", sub: "Kin asks about each one by name", to: "/dashboard/medicines" },
  ];
  const done = steps.filter((x) => x.done).length;
  const next = steps.findIndex((x) => !x.done);
  return (
    <Card tone="glass" className="mesh-light">
      <div className="flex items-center gap-4">
        <Ring value={done / steps.length} color={metric.green} size={56} stroke={6}>
          {`${done}/${steps.length}`}
        </Ring>
        <div>
          <p className="text-[18px] font-semibold tracking-[-0.01em]">Set up Kin for {parent.name}</p>
          <p className="text-[14px] text-body">{done === steps.length ? "All set for the first daily call" : "A few steps before the first daily call"}</p>
        </div>
      </div>
      <div className="mt-4 space-y-1">
        {steps.map((x, i) => (
          <Link key={x.title} href={x.to} className={`flex items-center gap-3 rounded-[18px] px-3 py-2.5 ${i === next ? "bg-paper/85 shadow-[0_4px_12px_-4px_rgb(40_50_110/0.15)]" : "hover:bg-paper/50"}`}>
            <span className={`grid size-8 shrink-0 place-items-center rounded-full text-white ${x.done ? "bg-ok" : i === next ? "bg-charcoal" : "bg-ink/25"}`}>
              {x.done ? <Icon d={icon.check} size={15} width={2.6} /> : <b className="text-[13px]">{i + 1}</b>}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-[15px] font-semibold ${x.done ? "text-body" : ""}`}>{x.title}</span>
              <span className="block truncate text-[13px] text-body">{x.done ? "Done" : x.sub}</span>
            </span>
            {i === next ? <span className="rounded-full bg-charcoal px-3.5 py-1 text-[13px] font-semibold text-white">Start</span> : null}
          </Link>
        ))}
      </div>
    </Card>
  );
}

function when(iso: string) {
  const d = new Date(iso);
  const day = istDate(d) === istDate() ? "today" : istDate(d) === istDate(new Date(Date.now() + 86_400_000)) ? "tomorrow" : formatDay(istDate(d));
  return `${day} ${istTime(d)}`;
}

function DailyLine({ status, name }: { status: DailyStatus; name: string }) {
  const next = status.next ? ` Next call ${when(status.next)}.` : "";
  const [tone, text] = (() => {
    switch (status.state) {
      case "scheduled":
        return ["plain", status.at ? `Next call ${when(status.at)}` : "Next call today"] as const;
      case "calling":
        return ["live", `Kin is calling ${name} now${status.tries && status.tries > 1 ? ` (try ${status.tries} of 3)` : ""}`] as const;
      case "retrying":
        return ["watch", status.at ? `No answer yet. Kin tries again at ${istTime(new Date(status.at))}` : "No answer yet. Kin will try again in 20 minutes"] as const;
      case "answered":
        return ["ok", `Kin spoke with ${name} today.${next}`] as const;
      case "missed":
        return ["alert", `${name} didn't answer tonight after 3 tries.${next}`] as const;
      case "failed":
        return ["alert", `Tonight's call couldn't be placed.${next}`] as const;
    }
  })();
  const dot = { plain: color.faint, live: metric.green, watch: metric.gold, ok: metric.green, alert: color.alert }[tone];
  return (
    <Link href="/dashboard/profile" className="flex items-center gap-3 rounded-full bg-cloud px-5 py-3 hover:bg-[#e3e9f4]">
      <i className={`block size-2.5 rounded-full ${tone === "live" ? "animate-pulse" : ""}`} style={{ backgroundColor: dot }} />
      <span className="text-[14.5px] font-medium">{text}</span>
    </Link>
  );
}
