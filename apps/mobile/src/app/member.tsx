import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";

import { ActionRow, AvatarSheet, InputRow, NavAction, NavBar, PhoneRow, PickerSheet, ProfileHero, Section, ToggleRow, ValueRow } from "@/components/form";
import { confirm, dial } from "@/components/kin-call";
import { goBack, Screen } from "@/components/screen";
import { useKin } from "@/lib/kin";
import { color } from "@/lib/theme";
import { cleanEmail, cleanName, emailError, nameError, phoneError, splitPhone, toE164 } from "@/lib/validate";

const relations = ["Daughter", "Son", "Grandchild", "Sibling", "Neighbour", "Family doctor"];

/** Add someone to the family, or (with ?id=) edit, call or remove them. */
export default function MemberScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { family, addMember, updateMember, removeMember } = useKin();
  const existing = id ? family.members.find((m) => m.id === id) : undefined;
  const selfId = family.meId ?? family.members.find((m) => m.role === "Owner")?.id;
  const isSelf = Boolean(existing && existing.id === selfId);

  const [name, setName] = useState(existing?.name ?? "");
  const [avatar, setAvatar] = useState(existing?.avatar);
  const [relation, setRelation] = useState(existing?.relation ?? "Daughter");
  const [city, setCity] = useState(existing?.city ?? "");
  const saved = splitPhone(existing?.phone);
  const [country, setCountry] = useState(saved.country);
  const [digits, setDigits] = useState(saved.digits);
  const [touched, setTouched] = useState({ name: false, phone: false, email: false });
  const [email, setEmail] = useState(existing?.email ?? "");
  const [emergency, setEmergency] = useState(Boolean(existing?.is_emergency));
  const [sheet, setSheet] = useState<"avatar" | "relation" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // A relation typed elsewhere (e.g. "Self" from setup) stays selectable.
  const options = relations.includes(relation) ? relations : [relation, ...relations];
  // A saved number from a country not in the list stays as it is until they type a new one.
  const phone = digits ? toE164(digits, country) : (saved.other ?? "");
  const nameErr = nameError(name);
  const cityErr = nameError(city, false) ? "Check the city name." : "";
  // Optional, unless they are the red alert contact (Kin has to be able to ring them).
  const phoneErr = saved.other && !digits ? "" : phoneError(digits, country, emergency);
  const emailErr = emailError(email);
  const sameNumber = phone && phone === family.parent.phone.replace(/\s/g, "") ? `That is ${family.parent.name}'s number.` : "";
  const valid = !nameErr && !cityErr && !phoneErr && !emailErr && !sameNumber;
  const showName = touched.name && Boolean(nameErr);
  const showPhone = (touched.phone || digits.length === country.length) && Boolean(phoneErr || sameNumber);
  const showEmail = touched.email && Boolean(emailErr);
  const touch = (k: keyof typeof touched) => () => setTouched((t) => ({ ...t, [k]: true }));

  if (id && !existing) {
    return (
      <Screen tabs={false} sheet>
        <NavBar title="Not found" sheet />
        <Text style={{ paddingHorizontal: 20, fontSize: 15, color: color.body }}>This person is no longer in the family.</Text>
      </Screen>
    );
  }

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
      goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    valid ? run(async () => {
      const m = {
        name: cleanName(name),
        avatar,
        relation,
        city: cleanName(city) || undefined,
        phone: phone || undefined,
        email: cleanEmail(email) || undefined,
        is_emergency: emergency,
      };
      if (existing) await updateMember(existing.id, m);
      else await addMember(m);
    }) : setTouched({ name: true, phone: true, email: true });

  const remove = () =>
    existing &&
    confirm(
      `Remove ${existing.name}?`,
      `${existing.name} will no longer be in ${family.parent.name}'s circle${existing.linked ? " or see their calls in the app" : ""}.`,
      "Remove",
      () => run(() => removeMember(existing.id)),
    );

  const parent = family.parent.name;
  const shown = cleanName(name) || (existing ? existing.name : "New person");
  const footerHints = [
    "Never read out on calls.",
    isSelf || existing?.linked ? "" : cleanEmail(email) && !emailErr ? `When they sign in to Kin with this email, they see ${parent}'s calls too.` : "Add an email to invite them to the Kin app.",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Screen tabs={false} sheet>
      <NavBar
        sheet
        title={existing ? (isSelf ? "You" : "Family member") : "Add someone"}
        right={
          <NavAction onPress={save} disabled={!valid || busy}>
            {busy ? "Saving" : existing ? "Save" : "Add"}
          </NavAction>
        }
      />
      <ProfileHero
        avatar={avatar}
        name={shown}
        sub={[relation, cleanName(city)].filter(Boolean).join(" · ")}
        onEdit={() => setSheet("avatar")}
      />

      {error ? <Text style={{ paddingHorizontal: 32, paddingBottom: 12, fontSize: 14, color: color.alert }}>{error}</Text> : null}

      <Section title="Details" footer={[showName && nameErr, cityErr].filter(Boolean).join(" ") || undefined} footerTone="alert">
        <InputRow
          label="Name"
          value={name}
          onChangeText={setName}
          onBlur={() => {
            setName(cleanName);
            touch("name")();
          }}
          placeholder="Rahul"
          autoFocus={!existing}
          autoCapitalize="words"
          autoCorrect={false}
          textContentType="name"
          maxLength={40}
          style={showName ? { color: color.alert } : undefined}
        />
        <ValueRow label="Relation" value={relation} onPress={() => setSheet("relation")} />
        <InputRow label="City" value={city} onChangeText={setCity} placeholder="Pune" autoCapitalize="words" textContentType="addressCity" maxLength={40} />
      </Section>

      <Section
        title="Contact"
        footer={[showPhone && (phoneErr || sameNumber), showEmail && emailErr].filter(Boolean).join(" ") || footerHints}
        footerTone={showPhone || showEmail ? "alert" : undefined}
      >
        <PhoneRow
          digits={digits}
          country={country}
          onChange={setDigits}
          onCountry={setCountry}
          invalid={showPhone}
          onBlur={touch("phone")}
          placeholder={saved.other}
        />
        <InputRow
          label="Email"
          value={email}
          onChangeText={(v) => setEmail(v.replace(/\s/g, ""))}
          onBlur={touch("email")}
          keyboardType="email-address"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          maxLength={254}
          placeholder="rahul@example.com"
          editable={!existing?.linked}
          style={showEmail ? { color: color.alert } : undefined}
        />
      </Section>

      <Section footer={`Kin connects ${parent} to this person in an emergency.${emergency && !phone ? " Add a phone number first." : ""}`}>
        <ToggleRow label="Red alert contact" value={emergency} onValueChange={setEmergency} />
      </Section>

      {existing && !isSelf ? (
        <Section>
          {existing.phone ? <ActionRow label={`Call ${existing.name}`} onPress={() => dial(existing.phone!)} /> : null}
          <ActionRow label="Remove from family" tone="alert" onPress={remove} disabled={busy} />
        </Section>
      ) : null}

      <AvatarSheet visible={sheet === "avatar"} name={shown} value={avatar} onChange={setAvatar} onClose={() => setSheet(null)} />
      <PickerSheet visible={sheet === "relation"} title="Relation" options={options} value={relation} onChange={setRelation} onClose={() => setSheet(null)} />
    </Screen>
  );
}
