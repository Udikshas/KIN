"use client";

import Link from "next/link";
import { useState } from "react";

import { Card, Empty, Icon, icon, PageHead, Segment, StatusPill } from "@/components/dashboard/ui";
import { formatDay, formatDuration, medsLabel, moodLabel, signalLabel, signalTone, sleepOf } from "@/lib/kin/data";
import { useKin } from "@/lib/kin/kin";

const filters = ["All", "Answered", "Missed", "Reminders"] as const;

/** Every call Kin made (or took), newest first, grouped by day. */
export default function Calls() {
  const { family } = useKin();
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const shown = family.calls.filter((c) =>
    filter === "Answered" ? c.status === "connected" && c.kind !== "reminder" : filter === "Missed" ? c.status !== "connected" : filter === "Reminders" ? c.kind === "reminder" : true,
  );
  const days = [...new Set(shown.map((c) => c.date))];
  const answered = family.calls.filter((c) => c.status === "connected").length;

  return (
    <>
      <PageHead
        kicker={`${family.calls.length} calls · ${answered} answered`}
        title="Calls"
        right={family.calls.length ? <Segment options={filters} value={filter} onChange={setFilter} /> : null}
      />
      {!family.calls.length ? (
        <Empty title="No calls yet">Once Kin starts calling {family.parent.name}, each call shows up here with its summary.</Empty>
      ) : !shown.length ? (
        <Empty title={`No ${filter.toLowerCase()} calls`} />
      ) : (
        <div className="space-y-6">
          {days.map((day) => (
            <section key={day}>
              <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-[0.04em] text-body uppercase">{formatDay(day)}</h2>
              <Card className="!p-2">
                {shown
                  .filter((c) => c.date === day)
                  .map((c) => {
                    const o = c.outputs;
                    const sleep = sleepOf(o);
                    const facts = c.status === "connected" && c.kind !== "reminder"
                      ? [o.meds_taken && medsLabel[o.meds_taken], sleep && `Sleep ${sleep.label}`, o.mood && moodLabel[o.mood], o.pain_mentioned && (o.pain_location ? `Pain: ${o.pain_location}` : "Pain")].filter(Boolean)
                      : [];
                    return (
                      <Link key={c.id} href={`/dashboard/calls/${c.id}`} className="flex items-start gap-4 rounded-[20px] px-3 py-3 hover:bg-paper/80">
                        <span className="w-[64px] shrink-0 pt-0.5 text-[14px] font-semibold tabular-nums">{c.time}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-[15.5px] font-semibold">{c.headline}</span>
                            {c.signal ? <StatusPill tone={signalTone[c.signal]}>{signalLabel[c.signal]}</StatusPill> : null}
                            {c.direction === "inbound" ? <StatusPill tone="plain">They called</StatusPill> : null}
                          </span>
                          {c.status === "connected" ? <span className="mt-0.5 line-clamp-2 block text-[14px] leading-[1.5] text-body">{c.summary}</span> : null}
                          {facts.length ? <span className="mt-1 block text-[12.5px] font-medium text-faint">{facts.join(" · ")}</span> : null}
                        </span>
                        <span className="hidden shrink-0 pt-0.5 text-[13px] text-body tabular-nums sm:block">{c.status === "connected" ? `${formatDuration(c.duration_s)} · ${c.language}` : ""}</span>
                        <Icon d={icon.chevron} size={16} className="mt-1 text-faint" />
                      </Link>
                    );
                  })}
              </Card>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
