"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { InsightCard, ShareCall } from "@/components/dashboard/cards";
import { Button, Card, CardTitle, Icon, icon, PageHead, StatusPill } from "@/components/dashboard/ui";
import { api, toCall } from "@/lib/kin/api";
import { formatDay, formatDuration, medsLabel, moodLabel, signalLabel, signalTone, sleepOf, type Call } from "@/lib/kin/data";
import { useKin } from "@/lib/kin/kin";
import { color, metric } from "@/lib/kin/theme";

const failure: Record<string, string> = {
  no_answer: "Kin tries again after 20 minutes, up to two times.",
  busy: "The line was busy. Kin tries again after 20 minutes.",
};

/** One call: Kin keeps only the summary and results, never a transcript. */
export default function CallDetail() {
  const { id } = useParams<{ id: string }>();
  const { family } = useKin();
  const listed = family.calls.find((c) => c.id === id);
  const [fetched, setFetched] = useState<Call | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reading, setReading] = useState(false);
  const call = fetched ?? listed;

  // A call Kin made to a family member isn't in the parent's list: fetch it on its own.
  useEffect(() => {
    if (family.source !== "api" || listed) return;
    let live = true;
    api
      .call(id)
      .then((c) => live && setFetched(toCall(c, family.parent.language)))
      .catch((e) => live && setLoadError(e instanceof Error ? e.message : "Could not load the call."));
    return () => {
      live = false;
    };
  }, [id, listed, family.source, family.parent.language]);

  useEffect(() => () => globalThis.speechSynthesis?.cancel(), []);

  if (!call)
    return (
      <>
        <Back />
        <PageHead title={loadError || family.source !== "api" ? "Call not found" : "Loading…"} />
      </>
    );

  const speaker = call.phone && call.phone !== family.parent.phone ? (family.members.find((m) => m.phone === call.phone)?.name ?? "Them") : family.parent.name;
  const o = call.outputs;
  const sleep = sleepOf(o);
  const rows =
    call.status === "connected"
      ? [
          o.meds_taken && { c: metric.green, label: "Medicine", value: medsLabel[o.meds_taken] },
          sleep && { c: metric.lilac, label: "Sleep", value: sleep.label },
          o.mood && { c: metric.blue, label: "Mood", value: moodLabel[o.mood] },
          o.pain_mentioned != null && { c: metric.gold, label: "Pain", value: o.pain_mentioned ? (o.pain_location ?? "Yes") : "None" },
          o.wants_family_callback != null && { c: metric.coral, label: "Wants a call back", value: o.wants_family_callback ? "Yes" : "No" },
          o.concerns && { c: color.alert, label: "Concerns", value: o.concerns },
        ].filter((r): r is { c: string; label: string; value: string } => !!r)
      : [];

  // Read the summary aloud with the browser's own voice.
  function listen() {
    const synth = globalThis.speechSynthesis;
    if (!synth || !call) return;
    if (reading) {
      synth.cancel();
      setReading(false);
      return;
    }
    const i = call.insight;
    const changed = i && (i.changes.length || i.suggestion) ? ` What changed: ${[...i.changes, i.suggestion].filter(Boolean).join(". ")}.` : "";
    const u = new SpeechSynthesisUtterance(`${speaker}'s call, ${formatDay(call.date)}, ${call.time}. ${call.summary}${changed}`);
    u.lang = "en-IN";
    u.onend = u.onerror = () => setReading(false);
    setReading(true);
    synth.speak(u);
  }

  return (
    <>
      <Back />
      <PageHead
        kicker={`${speaker !== family.parent.name ? `${speaker} · ` : ""}${formatDay(call.date)} · ${call.time}${call.direction === "inbound" ? " · they called Kin" : ""}${call.kind === "reminder" ? " · medicine reminder" : ""}`}
        title={call.headline}
        right={call.status === "connected" ? <ShareCall name={speaker} call={call} /> : null}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between gap-3">
              {call.signal ? <StatusPill tone={signalTone[call.signal]}>{signalLabel[call.signal]}</StatusPill> : <StatusPill tone="plain">{call.headline}</StatusPill>}
              <span className="text-[13px] text-body tabular-nums">{call.status === "connected" ? `${formatDuration(call.duration_s)} · ${call.language}` : ""}</span>
            </div>
            <p className="mt-3 text-[17px] leading-[1.6]">{call.summary}</p>
            {call.status !== "connected" && failure[call.status] ? <p className="mt-2 text-[14px] text-body">{failure[call.status]}</p> : null}
            {call.status === "connected" ? (
              <Button variant="white" size="sm" className="mt-4" onClick={listen}>
                <Icon d={reading ? "M7 7h10v10H7z" : "M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"} size={16} />
                {reading ? "Stop" : "Listen to the summary"}
              </Button>
            ) : null}
          </Card>
          {call.insight ? <InsightCard insight={call.insight} /> : null}
        </div>
        <div className="space-y-4">
          {rows.length ? (
            <Card>
              <CardTitle>What Kin heard</CardTitle>
              <div className="divide-y divide-ink/10">
                {rows.map((r) => (
                  <div key={r.label} className="flex items-start gap-3 py-2.5">
                    <i className="mt-1.5 block size-2 shrink-0 rounded-full" style={{ backgroundColor: r.c }} />
                    <span className="flex-1 text-[14.5px] text-body">{r.label}</span>
                    <span className="max-w-[60%] text-right text-[14.5px] font-semibold">{r.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
          <Card tone="white">
            <p className="text-[13.5px] leading-[1.55] text-body">
              Kin keeps the summary and these answers only. Recordings and transcripts are never stored by Kin.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}

function Back() {
  return (
    <Link href="/dashboard/calls" className="mb-4 inline-flex items-center gap-1 text-[14px] font-medium text-body hover:text-ink">
      <Icon d={icon.back} size={16} /> Calls
    </Link>
  );
}
