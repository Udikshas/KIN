"use client";

// Trends: the app's Trends tab (apps/mobile/src/app/(tabs)/trends.tsx) on a wide
// screen. Every number comes from the answered calls in the range; the 30-day
// note comes from GET /me/trends (apps/api/app/insights.py).

import { useEffect, useState } from "react";

import { AlertCard, TrendNoteCard } from "@/components/dashboard/cards";
import { CallNow } from "@/components/dashboard/call-now";
import { ButtonLink, Card, CardTitle, PageHead, Ring, Segment } from "@/components/dashboard/ui";
import { api } from "@/lib/kin/api";
import { istDate, sampleTrendNote, type Mood, type TrendNote } from "@/lib/kin/data";
import { useKin } from "@/lib/kin/kin";
import { color, metric } from "@/lib/kin/theme";

const ranges = [7, 30, 90] as const;
type Range = (typeof ranges)[number];
const moodColor: Record<Mood, string> = { happy: metric.green, ok: metric.blue, low: metric.gold, distressed: color.alert };
const moodName: Record<Mood, string> = { happy: "Happy", ok: "Good", low: "Low", distressed: "Upset" };

export default function Trends() {
  const { family } = useKin();
  const [range, setRange] = useState<Range>(30);
  const name = family.parent.name;
  const phone = family.parent.phone;
  const [apiNote, setNote] = useState<TrendNote | null>(null);
  const note = family.source === "api" ? apiNote : sampleTrendNote;
  const answeredCount = family.calls.filter((c) => c.status === "connected").length;
  const evening = family.calls.filter((c) => c.kind !== "reminder");

  useEffect(() => {
    if (family.source !== "api") return;
    let alive = true;
    api
      .trends(phone)
      .then((r) => alive && setNote(r.note))
      .catch(() => alive && setNote(null));
    return () => {
      alive = false;
    };
  }, [family.source, phone, answeredCount]);

  const from = daysBack(range - 1);
  const fromIso = istDate(from);
  const inRange = evening.filter((c) => c.date >= fromIso);
  const answered = inRange.filter((c) => c.status === "connected").reverse(); // oldest first
  const withMeds = answered.filter((c) => c.outputs.meds_taken && c.outputs.meds_taken !== "unclear");
  const medsPct = withMeds.length ? withMeds.filter((c) => c.outputs.meds_taken === "all").length / withMeds.length : 0;
  const hours = answered.every((c) => c.outputs.sleep_hours != null);
  const sleep = answered.map((c) => (hours ? c.outputs.sleep_hours : c.outputs.sleep_quality)).filter((v): v is number => v != null);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const avgSleep = avg(sleep);
  const lastWeek = avg(sleep.slice(-7));
  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const speech = family.speech30?.slice(-Math.min(range, 30));

  return (
    <>
      <PageHead
        kicker={`${fmt(from)} to ${fmt(new Date())} · ${inRange.length} ${inRange.length === 1 ? "call" : "calls"}`}
        title="Trends"
        right={family.calls.length ? <Segment options={ranges} value={range} onChange={setRange} label={(r) => `${r} days`} /> : null}
      />

      {family.calls.length === 0 ? (
        <Card className="max-w-[640px]">
          <CardTitle>No calls yet</CardTitle>
          <p className="text-[15px] leading-[1.5] text-body">After a few calls with Kin you&apos;ll see how {name} is doing over time, each compared with their own usual.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <div className="w-full sm:w-auto">
              <CallNow />
            </div>
            {!family.parent.dailyCalls ? (
              <ButtonLink href="/dashboard/profile" variant="white">
                Turn on daily calls
              </ButtonLink>
            ) : null}
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat ring={medsPct} c={metric.green} value={withMeds.length ? `${Math.round(medsPct * 100)}%` : "–"} label="Medicine" note="of calls with all doses taken" />
            <Stat ring={hours ? avgSleep / 7.5 : avgSleep / 5} c={metric.lilac} value={sleep.length ? `${avgSleep.toFixed(1)}${hours ? " h" : "/5"}` : "–"} label="Sleep" note={hours ? "a night, on average" : "on average"} />
            <Stat ring={inRange.length ? answered.length / inRange.length : 0} c={metric.blue} value={inRange.length ? `${answered.length}/${inRange.length}` : "–"} label="Answered" note="calls picked up" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              {note ? <TrendNoteCard note={note} /> : null}
              <AlertCard />
            </div>
            <div className="space-y-4">
              {sleep.length >= 2 ? (
                <Card>
                  <CardTitle
                    right={
                      <>
                        <b className="font-semibold text-ink">
                          {lastWeek.toFixed(1)}
                          {hours ? " h" : "/5"}
                        </b>{" "}
                        last 7 calls
                      </>
                    }
                  >
                    Sleep
                  </CardTitle>
                  <BarChart
                    values={sleep}
                    min={hours ? 3.5 : 0}
                    max={hours ? 8 : 5}
                    usual={hours ? 7 : avgSleep}
                    usualLabel={hours ? "usual 7 h" : `usual ${avgSleep.toFixed(1)}/5`}
                    from={answered[0] ? fmt(new Date(answered[0].date + "T12:00:00")) : ""}
                  />
                </Card>
              ) : (
                <Card>
                  <CardTitle>{!inRange.length ? `No calls in the last ${range} days` : !answered.length ? `${name} didn't answer in these ${range} days` : "Not enough sleep answers yet"}</CardTitle>
                  <p className="text-[14px] text-body">
                    {!inRange.length
                      ? `Kin hasn't called ${name} in this time. Older calls are still in Calls.`
                      : !answered.length
                        ? "Trends start from the first answered call."
                        : `It appears after 2 calls where ${name} talks about sleep.`}
                  </p>
                </Card>
              )}

              {answered.length >= 2 ? (
                <Card>
                  <CardTitle
                    right={
                      <>
                        <b className="font-semibold text-ink">{answered.filter((c) => c.outputs.pain_mentioned).length}</b> of {answered.length} calls with pain
                      </>
                    }
                  >
                    Mood and pain
                  </CardTitle>
                  <Strip label="Mood" values={answered.map((c) => (c.outputs.mood ? moodColor[c.outputs.mood] : null))} />
                  <Strip label="Pain" values={answered.map((c) => (c.outputs.pain_mentioned ? metric.gold : c.outputs.pain_mentioned === false ? "#e3e8f0" : null))} />
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                    {(Object.keys(moodColor) as Mood[]).map((m) => (
                      <span key={m} className="flex items-center gap-1.5 text-[12.5px] text-body">
                        <i className="block size-2 rounded-full" style={{ backgroundColor: moodColor[m] }} />
                        {moodName[m]}
                      </span>
                    ))}
                    <span className="flex items-center gap-1.5 text-[12.5px] text-body">
                      <i className="block size-2 rounded-full bg-gold" />
                      Pain
                    </span>
                  </div>
                </Card>
              ) : null}

              {speech && speech.length > 5 ? (
                <Card>
                  <CardTitle right={<span className="font-semibold text-watch">Slower</span>}>Speech rate</CardTitle>
                  <SpeechChart values={speech} />
                  <p className="mt-2 text-[13.5px] text-body">Below her usual range (dashed) for the last 5 calls.</p>
                </Card>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function daysBack(n: number) {
  return new Date(Date.now() - n * 86400000);
}

function Stat({ ring, c, value, label, note }: { ring: number; c: string; value: string; label: string; note: string }) {
  return (
    <div className="flex items-center gap-4 rounded-[24px] p-5" style={{ backgroundColor: c + "1a" }}>
      <Ring value={Math.max(0, Math.min(1, ring))} color={c} size={58} stroke={7} />
      <div>
        <p className="flex items-center gap-1.5 text-[13.5px] font-medium text-body">{label}</p>
        <p className="text-[30px] leading-none font-semibold tracking-[-0.03em]">{value}</p>
        <p className="mt-1 text-[12.5px] text-body">{note}</p>
      </div>
    </div>
  );
}

function Strip({ label, values }: { label: string; values: (string | null)[] }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-12 text-[13px] font-medium text-body">{label}</span>
      <div className="flex flex-1 flex-wrap gap-[5px]">
        {values.slice(-30).map((c, i) => (
          <i key={i} className="block size-[13px] rounded-full" style={{ backgroundColor: c ?? "rgba(34,35,38,0.08)" }} />
        ))}
      </div>
    </div>
  );
}

const W = 440;

function BarChart({ values, min, max, usual, usualLabel, from }: { values: number[]; min: number; max: number; usual: number; usualLabel: string; from: string }) {
  const H = 110;
  const y = (v: number) => H - ((Math.max(min, Math.min(max, v)) - min) / (max - min)) * H;
  const bw = W / Math.max(values.length, 7);
  const recent = values.length - 7;
  return (
    <svg width="100%" viewBox={`0 -16 ${W} ${H + 34}`} className="overflow-visible" role="img" aria-label={`Sleep over ${values.length} calls`}>
      <defs>
        <linearGradient id="sleepBar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={metric.lilac} />
          <stop offset="1" stopColor="#c9bcff" />
        </linearGradient>
      </defs>
      {values.map((v, i) => (
        <rect key={i} x={i * bw + 1.5} y={y(v)} width={Math.max(1, bw - 3)} height={Math.max(2, H - y(v))} rx={3} fill={i >= recent ? "url(#sleepBar)" : "#ddd6fb"}>
          <title>{v}</title>
        </rect>
      ))}
      <line x1={0} x2={W} y1={y(usual)} y2={y(usual)} stroke={color.ink} strokeOpacity={0.45} strokeDasharray="2 4" />
      <text x={W} y={y(usual) - 6} fontSize={11} fill="#4d5056" textAnchor="end" fontWeight="600">
        {usualLabel}
      </text>
      <text x={0} y={H + 16} fontSize={11} fill={color.body}>
        {from}
      </text>
      <text x={W} y={H + 16} fontSize={11} fill={color.body} textAnchor="end">
        Latest
      </text>
    </svg>
  );
}

function SpeechChart({ values }: { values: number[] }) {
  const H = 100;
  const y = (v: number) => H - ((v - 90) / 40) * H;
  const x = (i: number) => (i * W) / Math.max(1, values.length - 1);
  const pts = (arr: number[], offset = 0) => arr.map((v, i) => `${x(i + offset)},${y(v)}`).join(" ");
  const split = Math.max(0, values.length - 5);
  const last = values.length - 1;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="mt-1 overflow-visible" role="img" aria-label="Speech rate">
      <defs>
        <linearGradient id="speechArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={metric.blue} stopOpacity={0.22} />
          <stop offset="1" stopColor={metric.blue} stopOpacity={0} />
        </linearGradient>
      </defs>
      {[113, 127].map((v) => (
        <line key={v} x1={0} x2={W} y1={y(v)} y2={y(v)} stroke={color.ink} strokeOpacity={0.3} strokeDasharray="2 4" />
      ))}
      <polygon points={`0,${H} ${pts(values)} ${W},${H}`} fill="url(#speechArea)" />
      <polyline points={pts(values.slice(0, split + 1))} fill="none" stroke={metric.blue} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={pts(values.slice(split), split)} fill="none" stroke="#ff7a59" strokeWidth={2.8} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(values[last])} r={5} fill="#ff7a59" stroke="#fff" strokeWidth={2} />
    </svg>
  );
}
