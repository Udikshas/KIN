"use client";

import { useState } from "react";

import { Compose } from "@/components/dashboard/cards";
import { Button, Card, Empty, PageHead, Segment } from "@/components/dashboard/ui";
import { formatDay, istDate, istTime, type FamilyMessage } from "@/lib/kin/data";
import { useKin } from "@/lib/kin/kin";

const filters = ["All", `From them`, "To them"] as const;

function status(m: FamilyMessage, name: string) {
  if (m.direction === "from_parent") return m.done ? `Done${m.doneBy ? ` · ${m.doneBy}` : ""}` : "Open";
  return m.delivered ? `Kin told ${name}` : "Kin will pass it on next call";
}

/** "Tell my family": everything the parent asked Kin to pass on, and the family's notes back. */
export default function Messages() {
  const { family, markMessageDone } = useKin();
  const name = family.parent.name;
  const [compose, setCompose] = useState<{ replyTo?: FamilyMessage } | null>(null);
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const shown = family.messages.filter((m) => filter === "All" || (filter === "From them" ? m.direction === "from_parent" : m.direction === "to_parent"));

  return (
    <>
      <PageHead
        kicker={`Said on calls, and passed on by Kin`}
        title="Messages"
        right={
          <>
            <Segment options={filters} value={filter} onChange={setFilter} />
            <Button onClick={() => setCompose({})}>Send {name} a message</Button>
          </>
        }
      />
      {!shown.length ? (
        <Empty title="No messages yet">
          When {name} asks Kin to tell the family something, it shows up here. Notes you send are passed on, warmly, during the next call.
        </Empty>
      ) : (
        <div className="max-w-[760px] space-y-3">
          {shown.map((m) => {
            const from = m.direction === "from_parent";
            const open = from && !m.done;
            const d = new Date(m.createdAt);
            return (
              <div key={m.id} className={`flex ${from ? "justify-start" : "justify-end"}`}>
                <Card tone={open ? "glass" : "cloud"} className={`max-w-[600px] ${from ? "" : "!bg-charcoal text-white"}`}>
                  <p className={`text-[12.5px] font-medium ${from ? "text-body" : "text-white/60"}`}>
                    {from ? `${name}${m.toName ? ` · for ${m.toName}` : ""}` : `${m.fromName ?? "Family"} to ${name}`} · {formatDay(istDate(d))} {istTime(d)}
                  </p>
                  <p className="mt-1.5 text-[17px] leading-[1.45] font-medium">{m.text}</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <span className={`text-[13px] font-semibold ${open ? "text-lilac" : from ? "text-body" : "text-white/70"}`}>{status(m, name)}</span>
                    {open ? (
                      <>
                        <Button size="sm" className="ml-auto" onClick={() => setCompose({ replyTo: m })}>
                          Reply
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => markMessageDone(m.id)}>
                          Mark done
                        </Button>
                      </>
                    ) : null}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}
      <Compose open={compose !== null} replyTo={compose?.replyTo} onClose={() => setCompose(null)} />
    </>
  );
}
