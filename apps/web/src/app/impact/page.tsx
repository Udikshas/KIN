import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DailyChart, type Day } from "@/components/impact/daily-chart";
import { apiConfigured, kinApi } from "@/lib/kin-api";

export const metadata: Metadata = {
  title: "Kin so far",
  description: "Live totals from Kin's calls: answered calls, minutes talked, languages, and what Kin noticed for families.",
};

// GET /impact on the API (apps/api/app/impact.py): totals only, never names, numbers or transcripts.
type Impact = {
  families: number;
  parents: number;
  consented: number;
  calls: number;
  answered: number;
  answer_rate: number | null;
  minutes: number;
  inbound: number;
  demo_calls: number;
  languages: string[];
  noticed: { pain: number; missed_meds: number; low_mood: number };
  alerts: { urgent: number; scam: number };
  messages: { from_parents: number; to_parents: number };
  daily: Day[];
  since: string | null;
  updated_at: string;
};

export default function ImpactPage() {
  return (
    <main className="mesh-light min-h-dvh">
      <header className="mx-auto flex max-w-[1100px] items-center justify-between px-4 pt-8 sm:px-8">
        <Link href="/" aria-label="Kin home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/kin-logo.svg" alt="Kin" width={106} height={32} />
        </Link>
        <Link
          href="/"
          className="group inline-flex h-10 items-center gap-2 rounded-[128px] bg-paper pr-4 pl-3 text-[15px] font-medium text-ink shadow-chip transition-colors hover:bg-cloud"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="transition-transform group-hover:-translate-x-0.5" aria-hidden>
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          Back to the site
        </Link>
      </header>
      <Suspense fallback={<p className="px-4 py-24 text-center text-body">Loading…</p>}>
        <Numbers />
      </Suspense>
    </main>
  );
}

async function load(): Promise<Impact | null> {
  if (!apiConfigured()) return null;
  try {
    const res = await kinApi("/impact");
    return res.ok ? ((await res.json()) as Impact) : null;
  } catch {
    return null;
  }
}

const fmt = (n: number) => n.toLocaleString("en-IN");

async function Numbers() {
  await connection(); // live totals on every visit; WEB_API_TOKEN is a runtime env var
  const data = await load();
  if (!data) {
    return (
      <section className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="display text-[40px]">Numbers are resting</h1>
        <p className="mt-4 text-[17px] text-body">Kin&apos;s live totals can&apos;t be loaded right now. Please check back soon.</p>
      </section>
    );
  }
  const since = data.since
    ? new Date(data.since + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : null;
  const rate = data.answer_rate === null ? "–" : `${Math.round(data.answer_rate * 100)}%`;
  const noticed = data.noticed.pain + data.noticed.missed_meds + data.noticed.low_mood;

  return (
    <div className="mx-auto max-w-[1100px] px-4 pt-12 pb-20 sm:px-8">
      <p className="text-[15px] font-medium text-body">
        Live from Kin{since ? ` · since ${since}` : ""}
      </p>
      <h1 className="display mt-2 text-[40px] sm:text-[56px]">Kin so far</h1>
      <p className="mt-4 max-w-[620px] text-[18px] leading-[1.45] text-body">
        Every number here comes straight from Kin&apos;s calls. Only totals are shown: never a name, a phone number or what anyone said.
      </p>

      <section aria-label="Calls" className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile value={fmt(data.answered)} label="Calls answered" sub={`of ${fmt(data.calls)} placed`} />
        <Tile value={rate} label="Answer rate" sub="Kin retries twice when there's no answer" />
        <Tile value={fmt(data.minutes)} label="Minutes of conversation" sub="Parents talking with Kin" />
        <Tile value={fmt(data.languages.length)} label={data.languages.length === 1 ? "Language" : "Languages"} sub={data.languages.join(", ") || "–"} />
      </section>

      <section aria-label="Answered calls per day" className="mt-3 rounded-[24px] bg-cloud p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[18px] font-semibold text-ink">Answered calls, last 14 days</h2>
          <p className="text-[14px] text-body">India time · tap a day for details</p>
        </div>
        <div className="mt-4">
          <DailyChart days={data.daily} />
        </div>
      </section>

      <h2 className="display mt-14 text-[32px]">What Kin noticed for families</h2>
      <p className="mt-2 max-w-[620px] text-[17px] text-body">
        Things a family might not have heard about until the weekend call: {fmt(noticed)} so far.
      </p>
      <section aria-label="What Kin noticed" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile value={fmt(data.noticed.pain)} label="Calls where pain came up" tone="watch" />
        <Tile value={fmt(data.noticed.missed_meds)} label="Missed medicines caught" tone="watch" />
        <Tile value={fmt(data.noticed.low_mood)} label="Calls where they sounded low" tone="watch" />
        <Tile value={fmt(data.alerts.urgent + data.alerts.scam)} label="Alerts sent during a call" sub={`${fmt(data.alerts.urgent)} emergency · ${fmt(data.alerts.scam)} scam`} tone="alert" />
      </section>

      <h2 className="display mt-14 text-[32px]">Families and parents</h2>
      <section aria-label="Families" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile value={fmt(data.families)} label={data.families === 1 ? "Family on Kin" : "Families on Kin"} sub={`${fmt(data.parents)} ${data.parents === 1 ? "parent" : "parents"} called by Kin`} />
        <Tile value={fmt(data.consented)} label="Parents who said yes on a call" sub="Kin asks every parent itself" />
        <Tile value={fmt(data.inbound)} label="Times a parent called Kin" sub="On their own, from any phone" />
        <Tile value={fmt(data.messages.from_parents + data.messages.to_parents)} label="Messages carried" sub={`${fmt(data.messages.from_parents)} from parents · ${fmt(data.messages.to_parents)} to them`} />
      </section>

      <p className="mt-10 text-[14px] leading-[1.5] text-body">
        Includes {fmt(data.demo_calls)} {data.demo_calls === 1 ? "call" : "calls"} placed from the live demo. Callers Kin doesn&apos;t know are left out.
        Updated {new Date(data.updated_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST.
      </p>
    </div>
  );
}

function Tile({ value, label, sub, tone }: { value: string; label: string; sub?: string; tone?: "watch" | "alert" }) {
  return (
    <div className="flex flex-col gap-1 rounded-[24px] bg-cloud p-5">
      <div className="flex items-center gap-2">
        {tone ? <span aria-hidden className={`size-2 rounded-full ${tone === "alert" ? "bg-alert" : "bg-watch"}`} /> : null}
        <span className="text-[14px] font-medium text-body">{label}</span>
      </div>
      <span className="display text-[40px] leading-none text-ink tabular-nums">{value}</span>
      {sub ? <span className="text-[13px] leading-[1.4] text-body">{sub}</span> : null}
    </div>
  );
}
