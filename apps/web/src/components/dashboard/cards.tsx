"use client";

// Cards shared by several dashboard pages, each the web twin of an app component:
// InsightCard / TrendNoteCard (components/insight-card.tsx), UrgentBanner,
// FamilyMessages + Compose (components/family-messages.tsx) and AlertCard (app/alert.tsx).

import Link from "next/link";
import { useState } from "react";

import { formatDay, istDate, istTime, type Call, type FamilyMessage, type Insight, type TrendNote } from "@/lib/kin/data";
import { useKin } from "@/lib/kin/kin";

import { Button, Card, ErrorText, Icon, icon, Modal, Textarea } from "./ui";

export function InsightCard({ insight, kicker = "What changed" }: { insight: Insight; kicker?: string }) {
  return (
    <Card tone="glass" className="mesh-light !bg-none">
      <p className="flex items-center gap-2 text-[12.5px] font-semibold tracking-[0.04em] text-body uppercase">
        <i className="block size-2 rounded-full bg-blue" />
        {kicker}
      </p>
      <p className="mt-2 text-[22px] leading-[1.2] font-semibold tracking-[-0.02em]">{insight.headline}</p>
      {insight.changes.length ? (
        <ul className="mt-3 space-y-1.5 text-[15px] leading-[1.45] text-ink/85">
          {insight.changes.map((c) => (
            <li key={c} className="flex gap-2">
              <span className="text-faint">•</span>
              {c}
            </li>
          ))}
        </ul>
      ) : null}
      {insight.suggestion ? (
        <div className="mt-4 rounded-[18px] bg-paper/80 px-4 py-3">
          <p className="text-[12px] font-semibold tracking-[0.04em] text-body uppercase">Try this</p>
          <p className="mt-0.5 text-[15px] leading-[1.45] font-medium">{insight.suggestion}</p>
        </div>
      ) : null}
    </Card>
  );
}

export function TrendNoteCard({ note }: { note: TrendNote }) {
  return (
    <Card>
      <p className="flex items-center gap-2 text-[12.5px] font-semibold tracking-[0.04em] text-body uppercase">
        <i className="block size-2 rounded-full bg-blue" />
        Kin noticed · last {note.calls} calls
      </p>
      <p className="mt-2 text-[17px] leading-[1.45] font-medium">{note.summary}</p>
      <ul className="mt-3 space-y-1.5 text-[15px] leading-[1.45] text-ink/85">
        {note.points.map((p) => (
          <li key={p} className="flex gap-2">
            <span className="text-faint">•</span>
            {p}
          </li>
        ))}
      </ul>
      {note.watch ? (
        <div className="mt-4 rounded-[18px] bg-paper px-4 py-3">
          <p className="text-[12px] font-semibold tracking-[0.04em] text-body uppercase">Keep an eye on</p>
          <p className="mt-0.5 text-[15px] leading-[1.45] font-medium">{note.watch}</p>
        </div>
      ) : null}
    </Card>
  );
}

/** The evening card as plain text, for the family WhatsApp group. */
export function callText(name: string, call: Call) {
  const i = call.insight;
  return [
    `${name} · ${formatDay(call.date)}, ${call.time}`,
    i ? i.headline : `${call.headline}. ${call.summary}`,
    ...(i?.changes.map((c) => `• ${c}`) ?? []),
    i?.suggestion ? `Try this: ${i.suggestion}` : "",
    "— from Kin",
  ]
    .filter(Boolean)
    .join("\n");
}

export function ShareCall({ name, call }: { name: string; call: Call }) {
  const [copied, setCopied] = useState(false);
  const text = callText(name, call);
  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={`https://wa.me/?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-9 items-center gap-2 rounded-full bg-cloud px-4 text-[14px] font-medium hover:bg-line"
      >
        Share on WhatsApp
      </a>
      <button
        type="button"
        onClick={() => navigator.clipboard?.writeText(text).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1600)))}
        className="inline-flex h-9 cursor-pointer items-center rounded-full px-3 text-[14px] font-medium text-body hover:text-ink"
      >
        {copied ? "Copied" : "Copy text"}
      </button>
    </div>
  );
}

/** An emergency (or a scam call) Kin flagged during a call, until someone marks it handled. */
export function UrgentBanner() {
  const { family, markUrgentHandled } = useKin();
  const { parent } = family;
  const urgent = parent.urgent;
  if (!urgent) return null;
  const at = new Date(urgent.at);
  const scam = urgent.kind === "scam";
  const contact = family.members.find((m) => m.is_emergency && m.phone && m.id !== family.meId);
  const tel = (p: string) => `tel:${p.replace(/\s/g, "")}`;
  return (
    <div role="alert" className={`rounded-[28px] p-6 text-white ${scam ? "bg-watch" : "bg-alert"}`}>
      <p className="text-[13px] font-semibold tracking-[0.03em] text-white/80 uppercase">
        {scam ? "Scam warning" : "Kin flagged an emergency"} · {formatDay(istDate(at))} {istTime(at)}
      </p>
      <p className="mt-1.5 text-[28px] leading-[1.1] font-semibold tracking-[-0.02em]">{scam ? `${parent.name} may be talking to a scammer` : `${parent.name} may need help`}</p>
      {urgent.reason ? (
        <p className="mt-2 text-[16px] text-white/90">
          {scam ? `${parent.name} told Kin` : "Kin heard"}: &ldquo;{urgent.reason}&rdquo;
        </p>
      ) : null}
      <p className="mt-2 max-w-[680px] text-[14.5px] leading-[1.5] text-white/80">
        {scam
          ? `Kin told ${parent.name} not to share any OTP, PIN or bank details and not to send money. Call to check nothing was shared. If money was sent, call 1930 (cyber crime helpline) at once.`
          : `${contact ? `Kin tried to connect ${parent.name} to ${contact.name}.` : "No emergency contact is set."} If you can't reach them, call 108.`}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a href={tel(parent.phone)} className={`inline-flex h-10 items-center rounded-full bg-white px-5 text-[15px] font-semibold ${scam ? "text-watch" : "text-alert"}`}>
          Call {parent.name} · {parent.phone}
        </a>
        {scam ? (
          <a href="tel:1930" className="inline-flex h-10 items-center rounded-full bg-white/15 px-5 text-[15px] font-semibold">
            Call 1930
          </a>
        ) : contact?.phone ? (
          <a href={tel(contact.phone)} className="inline-flex h-10 items-center rounded-full bg-white/15 px-5 text-[15px] font-semibold">
            Call {contact.name}
          </a>
        ) : (
          <a href="tel:108" className="inline-flex h-10 items-center rounded-full bg-white/15 px-5 text-[15px] font-semibold">
            Call 108
          </a>
        )}
        <button type="button" onClick={() => markUrgentHandled(urgent.id)} className="ml-auto h-10 cursor-pointer rounded-full px-4 text-[14px] font-semibold text-white/85 hover:bg-white/10">
          {scam ? "All fine, nothing was shared" : "It's handled"}
        </button>
      </div>
    </div>
  );
}

/** A green / amber / red pattern across calls (app/alert.tsx), with what it is based on. */
export function AlertCard() {
  const { family } = useKin();
  const a = family.alert;
  if (!a) return null;
  const red = a.level === "red";
  return (
    <Card className={red ? "!bg-alert-soft" : "!bg-watch-soft"}>
      <p className={`flex items-center gap-2 text-[12.5px] font-semibold tracking-[0.04em] uppercase ${red ? "text-alert" : "text-watch"}`}>
        <Icon d={icon.bell} size={15} />
        {red ? "Alert" : "Something to watch"}
      </p>
      <p className="mt-1.5 text-[20px] leading-[1.25] font-semibold tracking-[-0.015em]">{a.title}</p>
      <p className="mt-1 text-[14px] leading-[1.5] text-body">{a.basis}</p>
      {a.evidence.length ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {a.evidence.map((e) => (
            <div key={e.label} className="flex items-center gap-2.5 rounded-[14px] bg-paper/80 px-3 py-2">
              <i className="block size-2 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
              <span className="flex-1 text-[13.5px] text-body">{e.label}</span>
              <span className="text-[14px] font-semibold">{e.value}</span>
            </div>
          ))}
        </div>
      ) : null}
      <p className="mt-3 text-[14px] text-body">
        Try asking: <span className="font-medium text-ink">&ldquo;{a.ask}&rdquo;</span>
      </p>
      {a.callId ? (
        <Link href={`/dashboard/calls/${a.callId}`} className="mt-3 inline-flex items-center gap-1 text-[14px] font-semibold hover:underline">
          Open the call <Icon d={icon.chevron} size={14} />
        </Link>
      ) : null}
    </Card>
  );
}

function when(iso: string) {
  const d = new Date(iso);
  return `${formatDay(istDate(d))} ${istTime(d)}`;
}

/** "Tell my family": what the parent asked Kin to pass on, and a note for Kin to pass back. */
export function FamilyMessages({ limit = 3 }: { limit?: number }) {
  const { family, markMessageDone } = useKin();
  const name = family.parent.name;
  const open = family.messages.filter((m) => m.direction === "from_parent" && !m.done).slice(0, limit);
  const waiting = family.messages.filter((m) => m.direction === "to_parent" && !m.delivered).length;
  const [compose, setCompose] = useState<{ replyTo?: FamilyMessage } | null>(null);

  return (
    <>
      {open.map((m) => (
        <Card key={m.id} tone="glass">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-[#c9bcff] to-[#ffc6b5] text-[20px] leading-none font-semibold text-white">&ldquo;</span>
            <p className="text-[13px] font-medium text-body">
              {name} says{m.toName ? ` · for ${m.toName}` : ""} · {when(m.createdAt)}
            </p>
          </div>
          <p className="mt-2.5 text-[19px] leading-[1.35] font-medium tracking-[-0.01em]">{m.text}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => setCompose({ replyTo: m })}>
              Reply
            </Button>
            <Button size="sm" variant="ghost" onClick={() => markMessageDone(m.id)}>
              Mark done
            </Button>
          </div>
        </Card>
      ))}
      <div className="flex items-center gap-2 rounded-full bg-cloud p-1.5 pr-2">
        <button type="button" onClick={() => setCompose({})} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-full text-left">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#c9bcff] to-[#8a72ff] text-white">
            <Icon d={icon.message} size={17} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[14.5px] font-semibold">Send {name} a message</span>
            <span className="block truncate text-[12.5px] text-body">
              {waiting ? `${waiting} ${waiting === 1 ? "note" : "notes"} waiting for the next call` : "Kin passes it on during the next call"}
            </span>
          </span>
        </button>
        {family.messages.length ? (
          <Link href="/dashboard/messages" className="flex h-8 items-center gap-1.5 rounded-full bg-paper px-3 text-[13px] font-semibold hover:bg-mist">
            All <span className="text-body">{family.messages.length}</span>
          </Link>
        ) : null}
      </div>
      <Compose open={compose !== null} replyTo={compose?.replyTo} onClose={() => setCompose(null)} />
    </>
  );
}

export function Compose({ open, replyTo, onClose }: { open: boolean; replyTo?: FamilyMessage; onClose: () => void }) {
  const { family, sendMessage } = useKin();
  const name = family.parent.name;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    try {
      await sendMessage(text.trim(), replyTo?.id);
      setText("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={replyTo ? `Reply to ${name}` : `A message for ${name}`}>
      <form onSubmit={send} className="space-y-4">
        {replyTo ? <p className="rounded-[14px] bg-cloud px-3.5 py-2.5 text-[14px] text-body">&ldquo;{replyTo.text}&rdquo;</p> : null}
        <Textarea
          label="Kin passes it on, warmly, during the next call"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          placeholder={`We'll visit on Sunday, ${name}!`}
          autoFocus
        />
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button variant="soft" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !text.trim()}>
            {busy ? "Sending…" : "Send"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
