import { useState } from "react";
import { Text } from "react-native";

import {
  AddRow, AvatarSheet, formatPhone, InputRow, NavAction, NavBar, PhoneRow, PickerSheet, ProfileHero, RemovableRow, Section, SegmentRow, ToggleRow, ValueRow,
} from "@/components/form";
import { goBack, Screen } from "@/components/screen";
import { callTimes, parentLanguages, partOfDay, to24h } from "@/lib/data";
import { confirm } from "@/components/kin-call";
import { useKin } from "@/lib/kin";
import { color } from "@/lib/theme";
import { cleanName, INDIA, nameError, phoneError, splitPhone, toE164 } from "@/lib/validate";

const lengths = [1, 3, 5] as const;
// Topics Kin avoids go to the agent as one line; the API keeps up to 200 characters.
const MAX_TOPICS = 6;
const TOPICS_CHARS = 200;

export default function ParentProfile() {
  const { family, saveParent } = useKin();
  const p = family.parent;
  // A time set elsewhere (e.g. by the team) stays selectable, in its place in the day.
  const times = callTimes.includes(p.callTime) ? callTimes : [...callTimes, p.callTime].sort((a, b) => to24h(a).localeCompare(to24h(b)));
  const [name, setName] = useState(p.name);
  const [avatar, setAvatar] = useState(p.avatar);
  const [city, setCity] = useState(p.city);
  const [digits, setDigits] = useState(() => splitPhone(p.phone, [INDIA]).digits);
  const [language, setLanguage] = useState<string>(p.language);
  const [callTime, setCallTime] = useState(p.callTime);
  const [length, setLength] = useState(p.callLengthMinutes);
  const [daily, setDaily] = useState(p.dailyCalls);
  const [topics, setTopics] = useState(family.topicsAvoid);
  const topicsTooLong = topics.join(", ").length > TOPICS_CHARS;
  const [sheet, setSheet] = useState<"avatar" | "language" | "time" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const shown = cleanName(name) || p.name;
  const nameErr = nameError(name);
  const cityErr = nameError(city, false) ? "Check the city name." : "";
  // A new number moves the parent and everything Kin keeps about them (PUT /me/family/parents/{phone}/phone).
  const phone = toE164(digits, INDIA);
  const otherParent = family.parents.find((x) => x.phone !== p.phone && x.phone.replace(/\s/g, "") === phone);
  const phoneErr = phoneError(digits, INDIA) || (otherParent ? `${otherParent.name} already has this number.` : "");

  const who = shown;

  // Consent: daily calls are for a parent who knows Kin will ring. Kin asks on the first call,
  // and if they ever say no, the API switches daily calls off and tells the family.
  function toggleDaily(on: boolean) {
    if (!on || p.consentAt) return setDaily(on);
    confirm(
      `Does ${who} know?`,
      `Kin will ring ${who} every evening. Tell them first that Kin, an AI assistant, will call for a short chat. On the first call Kin asks if that's all right, and stops at once if they say no.`,
      `${who} knows`,
      () => setDaily(true),
    );
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      await saveParent({
        name: cleanName(name), avatar, city: cleanName(city), language, callTime, callLengthMinutes: length, dailyCalls: daily, topicsAvoid: topics,
        ...(phone !== p.phone && { phone }),
      });
      goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen tabs={false}>
      <NavBar
        title="Profile"
        right={
          <NavAction onPress={save} disabled={Boolean(nameErr || cityErr || phoneErr) || topicsTooLong || busy}>
            {busy ? "Saving" : "Save"}
          </NavAction>
        }
      />
      <ProfileHero avatar={avatar} name={shown} sub={[formatPhone(phoneErr ? p.phone : phone), cleanName(city)].filter(Boolean).join(" · ")} onEdit={() => setSheet("avatar")} />

      {error ? <Text style={{ paddingHorizontal: 32, paddingBottom: 12, fontSize: 14, color: color.alert }}>{error}</Text> : null}

      <Section
        title="Who Kin calls"
        footer={
          [nameErr, digits.length === INDIA.length || !digits ? phoneErr : "", cityErr].filter(Boolean).join(" ") ||
          (phone !== p.phone ? `Kin will call ${shown} on the new number. Their calls, memory and reminders move with them.` : undefined)
        }
        footerTone={nameErr || phoneErr || cityErr ? "alert" : undefined}
      >
        <InputRow
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Amma"
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={40}
          style={nameErr ? { color: color.alert } : undefined}
        />
        <PhoneRow label="Mobile" digits={digits} country={INDIA} onChange={setDigits} invalid={Boolean(phoneErr) && digits.length === INDIA.length} />
        <InputRow label="City" value={city} onChangeText={setCity} placeholder="Lucknow" autoCapitalize="words" textContentType="addressCity" maxLength={40} />
        <ValueRow label="Language" value={language} onPress={() => setSheet("language")} />
      </Section>

      <Section
        title="Daily call"
        footer={
          (daily
            ? `Kin rings ${shown} every day at ${callTime} India time. If they don't answer, Kin tries twice more, 20 minutes apart.`
            : `Off: Kin only calls when you ask. Turn on once ${shown} knows Kin will call.`) +
          (p.consentAt
            ? ` ${shown} said yes to Kin's calls.`
            : ` Kin will ask ${shown} on the first call; if they ever say no, daily calls switch off and you're told.`)
        }
      >
        <ToggleRow label="Call every day" value={daily} onValueChange={toggleDaily} />
        <ValueRow label="Time (India)" value={`${partOfDay(callTime)} · ${callTime}`} onPress={() => setSheet("time")} />
        <SegmentRow label="Length" options={lengths} value={length} onChange={setLength} render={(m) => `${m} min`} />
      </Section>

      <Section
        title="Topics Kin avoids"
        footer={
          topicsTooLong
            ? "That's too much to keep. Shorten or remove a topic."
            : `Kin never brings these up and never says it was asked not to. If ${shown} raises one, Kin listens kindly and gently moves on.`
        }
        footerTone={topicsTooLong ? "alert" : undefined}
      >
        {topics.map((t) => (
          <RemovableRow key={t} label={t} onRemove={() => setTopics(topics.filter((x) => x !== t))} />
        ))}
        {topics.length < MAX_TOPICS ? (
          <AddRow
            placeholder={topics.length ? "Add another" : "A person, a loss, a dispute…"}
            maxLength={60}
            onAdd={(t) => setTopics(topics.some((x) => x.toLowerCase() === t.toLowerCase()) ? topics : [...topics, t.replace(/[,;]/g, " ")])}
          />
        ) : null}
      </Section>

      <AvatarSheet visible={sheet === "avatar"} name={shown} value={avatar} onChange={setAvatar} onClose={() => setSheet(null)} />
      <PickerSheet visible={sheet === "time"} title="Call time (India)" options={times} value={callTime} onChange={setCallTime} onClose={() => setSheet(null)} group={partOfDay} />
      <PickerSheet visible={sheet === "language"} title="Language" options={parentLanguages} value={language} onChange={setLanguage} onClose={() => setSheet(null)} />
    </Screen>
  );
}
