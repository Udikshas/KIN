"use client";

// The parent's profile and daily call settings (apps/mobile/src/app/parent.tsx).

import { useState } from "react";

import { PhoneField } from "@/components/dashboard/phone-field";
import { Avatar, avatarNames, Button, Card, CardTitle, ErrorText, Icon, icon, Input, Modal, PageHead, Segment, Select, Toggle } from "@/components/dashboard/ui";
import { callTimeGroups, formatDay, kinNumber, parentLanguages, partOfDay } from "@/lib/kin/data";
import { useKin } from "@/lib/kin/kin";
import { cleanName, INDIA, nameError, phoneError, splitPhone, toE164 } from "@/lib/kin/validate";

const lengths = [1, 3, 5] as const;
const MAX_TOPICS = 6;
const TOPICS_CHARS = 200;

export default function Profile() {
  const { family } = useKin();
  // Remount the form when another parent is picked, so it starts from their values.
  return <ProfileForm key={family.parent.phone} />;
}

function ProfileForm() {
  const { family, saveParent } = useKin();
  const p = family.parent;
  const [name, setName] = useState(p.name);
  const [avatar, setAvatar] = useState(p.avatar);
  const [city, setCity] = useState(p.city);
  const [digits, setDigits] = useState(() => splitPhone(p.phone, [INDIA]).digits);
  const [language, setLanguage] = useState<string>(p.language);
  const [callTime, setCallTime] = useState(p.callTime);
  const [length, setLength] = useState(p.callLengthMinutes);
  const [daily, setDaily] = useState(p.dailyCalls);
  const [topics, setTopics] = useState(family.topicsAvoid);
  const [topic, setTopic] = useState("");
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const shown = cleanName(name) || p.name;
  const nameErr = nameError(name);
  const cityErr = nameError(city, false) ? "Check the city name." : "";
  // A new number moves the parent and everything Kin keeps about them (PUT /me/family/parents/{phone}/phone).
  const phone = toE164(digits, INDIA);
  const otherParent = family.parents.find((x) => x.phone !== p.phone && x.phone === phone);
  const phoneErr = phoneError(digits, INDIA) || (otherParent ? `${otherParent.name} already has this number.` : "");
  const topicsTooLong = topics.join(", ").length > TOPICS_CHARS;
  const known = callTimeGroups.flatMap((g) => g.times as readonly string[]);
  const dirty =
    name !== p.name || phone !== p.phone || avatar !== p.avatar || city !== p.city || language !== p.language || callTime !== p.callTime || length !== p.callLengthMinutes || daily !== p.dailyCalls || topics.join("|") !== family.topicsAvoid.join("|");

  function toggleDaily(on: boolean) {
    if (!on || p.consentAt) return setDaily(on);
    setAsking(true);
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      await saveParent({ name: cleanName(name), avatar, city: cleanName(city), language, callTime, callLengthMinutes: length, dailyCalls: daily, topicsAvoid: topics, ...(phone !== p.phone && { phone }) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  function addTopic(e: React.FormEvent) {
    e.preventDefault();
    const t = topic.trim().replace(/[,;]/g, " ");
    if (!t) return;
    if (!topics.some((x) => x.toLowerCase() === t.toLowerCase())) setTopics([...topics, t]);
    setTopic("");
  }

  return (
    <>
      <PageHead
        kicker={[phoneErr ? p.phone : phone, cleanName(city)].filter(Boolean).join(" · ")}
        title={
          <span className="flex items-center gap-4">
            <Avatar name={avatar} label={shown} size={56} />
            {shown}
          </span>
        }
        right={
          <Button onClick={save} disabled={!dirty || Boolean(nameErr || cityErr || phoneErr) || topicsTooLong || busy}>
            {busy ? "Saving…" : saved ? "Saved" : "Save changes"}
          </Button>
        }
      />
      <div className="mb-4">
        <ErrorText>{error}</ErrorText>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardTitle>Who Kin calls</CardTitle>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} error={nameErr} />
                <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} maxLength={40} error={cityErr} />
              </div>
              <div>
                <PhoneField label="Mobile (India)" digits={digits} country={INDIA} onChange={setDigits} indiaOnly error={digits.length === INDIA.length || !digits ? phoneErr : ""} />
                {phone !== p.phone && !phoneErr ? (
                  <p className="mt-1.5 px-1 text-[13px] leading-[1.45] text-body">Kin will call {shown} on the new number. Their calls, memory and reminders move with them.</p>
                ) : null}
              </div>
              <Select label="Language Kin speaks" value={language} onChange={(e) => setLanguage(e.target.value)}>
                {parentLanguages.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </Select>
              <div>
                <p className="mb-1.5 px-1 text-[13px] font-semibold text-body">Picture</p>
                <div className="flex flex-wrap gap-1.5">
                  {avatarNames.map((a) => (
                    <button key={a} type="button" onClick={() => setAvatar(a)} aria-pressed={avatar === a} className={`cursor-pointer rounded-full p-0.5 ${avatar === a ? "ring-2 ring-ink" : "opacity-80 hover:opacity-100"}`}>
                      <Avatar name={a} size={38} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
          <Card>
            <CardTitle>Topics Kin avoids</CardTitle>
            <p className="-mt-1 mb-3 text-[14px] leading-[1.5] text-body">
              Kin never brings these up and never says it was asked not to. If {shown} raises one, Kin listens kindly and gently moves on.
            </p>
            <div className="flex flex-wrap gap-2">
              {topics.map((t) => (
                <span key={t} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-paper pr-1.5 pl-3.5 text-[14px] font-medium">
                  {t}
                  <button type="button" aria-label={`Remove ${t}`} onClick={() => setTopics(topics.filter((x) => x !== t))} className="grid size-6 cursor-pointer place-items-center rounded-full text-faint hover:bg-cloud hover:text-ink">
                    <Icon d={icon.close} size={13} />
                  </button>
                </span>
              ))}
            </div>
            {topics.length < MAX_TOPICS ? (
              <form onSubmit={addTopic} className="mt-3 flex gap-2">
                <Input className="flex-1" aria-label="Add a topic" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={60} placeholder={topics.length ? "Add another" : "A person, a loss, a dispute…"} />
                <Button type="submit" variant="white" disabled={!topic.trim()}>
                  Add
                </Button>
              </form>
            ) : null}
            {topicsTooLong ? <p className="mt-2 text-[13px] text-alert">That&apos;s too much to keep. Shorten or remove a topic.</p> : null}
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-[16px] font-semibold">Call every day</h3>
                <p className="text-[13.5px] text-body">{daily ? `At ${callTime} India time` : "Off: Kin only calls when you ask"}</p>
              </div>
              <Toggle on={daily} onChange={toggleDaily} label="Call every day" />
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Select label="Time (India)" value={callTime} onChange={(e) => setCallTime(e.target.value)}>
                {!known.includes(callTime) ? <option>{callTime}</option> : null}
                {callTimeGroups.map((g) => (
                  <optgroup key={g.part} label={g.part}>
                    {g.times.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </optgroup>
                ))}
              </Select>
              <div>
                <p className="mb-1.5 px-1 text-[13px] font-semibold text-body">Length</p>
                <Segment options={lengths} value={length} onChange={setLength} label={(m) => `${m} min`} />
              </div>
            </div>
            <p className="mt-4 text-[13.5px] leading-[1.55] text-body">
              {daily
                ? `Kin rings ${shown} every day at ${callTime} (${partOfDay(callTime).toLowerCase()}, India time) from ${kinNumber}. If they don't answer, Kin tries twice more, 20 minutes apart.`
                : `Turn on once ${shown} knows Kin will call.`}{" "}
              {p.consentAt ? `${shown} said yes to Kin's calls on ${formatDay(p.consentAt)}.` : `Kin will ask ${shown} on the first call; if they ever say no, daily calls switch off and you're told.`}
            </p>
            <p className="mt-2 text-[12.5px] text-faint">
              A {length}-minute call costs about ₹{length === 1 ? "4" : length === 3 ? "11–12" : "18–19"}.
            </p>
          </Card>
        </div>
      </div>
      <Modal open={asking} onClose={() => setAsking(false)} title={`Does ${shown} know?`}>
        <p className="text-[15px] leading-[1.5] text-body">
          Kin will ring {shown} every day. Tell them first that Kin, an AI assistant, will call for a short chat. On the first call Kin asks if that&apos;s all right, and stops at once if they say no.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="soft" onClick={() => setAsking(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setDaily(true);
              setAsking(false);
            }}
          >
            {shown} knows
          </Button>
        </div>
      </Modal>
    </>
  );
}
