"use client";

import Link from "next/link";
import { useState } from "react";

import { kinNumber } from "@/lib/kin/data";
import { useKin, type CallTarget, type LiveCall } from "@/lib/kin/kin";

import { Avatar, Button, Icon, icon, Modal } from "./ui";

export function isLive(c: LiveCall | null) {
  return Boolean(c && (c.state === "placing" || c.state === "calling" || c.state === "connected"));
}

function liveText(c: LiveCall): { title: string; sub: string } {
  const { name } = c;
  switch (c.state) {
    case "placing":
      return { title: "Placing the call…", sub: `Kin is asking the phone line to ring ${name}.` };
    case "calling":
      return { title: `Kin is calling ${name}…`, sub: `Their phone rings from ${kinNumber}.` };
    case "connected":
      return { title: `Kin is talking with ${name}`, sub: "The evening card appears here when the call ends." };
    case "done":
      if (c.status === "connected") return { title: `Kin spoke with ${name}`, sub: "Open the call to read how they are." };
      return { title: c.status === "busy" ? `${name}'s line was busy` : `${name} didn't answer`, sub: "Try again a little later." };
    case "timeout":
      return { title: "No result yet", sub: "Kin has not heard back about this call. Refresh in a minute." };
    case "failed":
      return { title: "Kin couldn't call", sub: c.message };
  }
}

/** "Ask Kin to call now": pick who (the parent or a family member), confirm, then follow the call live. */
export function CallNow({ compact }: { compact?: boolean }) {
  const { mode, family, liveCall, callNow, dismissLiveCall, signOut } = useKin();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<CallTarget | null>(null);
  const { parent } = family;
  const options = [
    { key: "parent", name: parent.name, avatar: parent.avatar, sub: "Daily check-in", memberId: undefined as string | undefined },
    ...family.members
      .filter((m) => m.phone && m.id !== family.meId)
      .map((m) => ({ key: m.id, name: m.name, avatar: m.avatar, memberId: m.id, sub: [m.relation, m.city].filter(Boolean).join(" · ") })),
  ];

  const start = () => {
    if (isLive(liveCall)) return;
    setTarget(options.length === 1 ? { name: parent.name } : null);
    setOpen(true);
  };

  if (liveCall) {
    const t = liveText(liveCall);
    const live = isLive(liveCall);
    const openCall = liveCall.state === "done" && liveCall.status === "connected" && liveCall.callId ? liveCall.callId : null;
    return (
      <div className="rounded-[24px] bg-charcoal p-4 text-white">
        <div className="flex items-start gap-3">
          <span className={`mt-1.5 block size-2.5 shrink-0 rounded-full ${live ? "animate-pulse bg-green" : liveCall.state === "done" && liveCall.status === "connected" ? "bg-green" : "bg-coral"}`} />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">{t.title}</p>
            <p className="mt-0.5 text-[13px] leading-[1.45] text-white/65">{t.sub}</p>
          </div>
        </div>
        {!live ? (
          <div className="mt-3 flex gap-2">
            {openCall ? (
              <Link href={`/dashboard/calls/${openCall}`} onClick={dismissLiveCall} className="inline-flex h-9 items-center rounded-full bg-white px-4 text-[14px] font-medium text-ink">
                Open the call
              </Link>
            ) : null}
            <button type="button" onClick={dismissLiveCall} className="h-9 cursor-pointer rounded-full px-3 text-[14px] font-medium text-white/80 hover:text-white">
              Close
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={start}
        className={`group flex w-full cursor-pointer items-center gap-3 rounded-full bg-charcoal text-left text-white transition-colors hover:bg-black ${compact ? "p-1.5 pr-4" : "p-2 pr-5"}`}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/12">
          <Icon d={icon.phone} size={17} />
        </span>
        <span className="flex-1 truncate text-[14.5px] font-medium">{options.length > 1 ? "Ask Kin to call now" : `Ask Kin to call ${parent.name}`}</span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={target ? `Kin will ring ${target.name} now` : "Who should Kin call?"}>
        {mode !== "signed-in" ? (
          <div className="space-y-4">
            <p className="text-[15px] leading-[1.5] text-body">Kin can only call people you have set up. Sign in to add yours.</p>
            <Button onClick={signOut}>Sign in</Button>
          </div>
        ) : target ? (
          <div className="space-y-5">
            <p className="text-[15px] leading-[1.5] text-body">
              From {kinNumber}, for about {parent.callLengthMinutes} min. Make sure {target.name} knows Kin is calling.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="soft" onClick={() => (options.length > 1 ? setTarget(null) : setOpen(false))}>
                {options.length > 1 ? "Back" : "Cancel"}
              </Button>
              <Button
                onClick={() => {
                  setOpen(false);
                  callNow(target);
                }}
              >
                Call now
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {options.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setTarget({ name: o.name, memberId: o.memberId })}
                className="flex w-full cursor-pointer items-center gap-3 rounded-[18px] px-3 py-2.5 text-left hover:bg-cloud"
              >
                <Avatar name={o.avatar} label={o.name} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{o.name}</span>
                  <span className="block truncate text-[13px] text-body">{o.sub}</span>
                </span>
                <Icon d={icon.chevron} size={16} className="text-faint" />
              </button>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
