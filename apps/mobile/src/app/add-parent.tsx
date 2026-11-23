import { useState } from "react";
import { Text } from "react-native";

import { AvatarSheet, InputRow, NavAction, NavBar, PhoneRow, PickerSheet, ProfileHero, Section, ValueRow } from "@/components/form";
import { goBack, Screen } from "@/components/screen";
import { parentLanguages } from "@/lib/data";
import { useKin } from "@/lib/kin";
import { color } from "@/lib/theme";
import { cleanName, INDIA, nameError, phoneError, toE164 } from "@/lib/validate";

/** Add another parent Kin calls (e.g. father as well as mother). Each has their own calls, trends and memory. */
export default function AddParent() {
  const { family, addParent } = useKin();
  const [name, setName] = useState("");
  const [digits, setDigits] = useState("");
  const [touched, setTouched] = useState({ name: false, phone: false });
  const [city, setCity] = useState(family.parent.city);
  const [language, setLanguage] = useState<string>(family.parent.language);
  const [avatar, setAvatar] = useState<string | undefined>();
  const [sheet, setSheet] = useState<"avatar" | "language" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Kin calls parents in India only (v1), so the code is fixed to +91.
  const phone = toE164(digits, INDIA);
  const taken = family.parents.find((p) => p.phone.replace(/\s/g, "") === phone);
  const nameErr = nameError(name);
  const phoneErr = phoneError(digits, INDIA) || (taken ? `${taken.name} already has this number.` : "");
  const cityErr = nameError(city, false) ? "Check the city name." : "";
  const valid = !nameErr && !phoneErr && !cityErr;
  const shown = cleanName(name) || "New member";
  // Show a problem once they leave the field, or as soon as the number is full length.
  const showName = touched.name && Boolean(nameErr);
  const showPhone = (touched.phone || digits.length === INDIA.length) && Boolean(phoneErr);
  const problem = [showName && nameErr, showPhone && phoneErr, cityErr].filter(Boolean).join(" ");

  async function save() {
    if (!valid) return setTouched({ name: true, phone: true });
    setBusy(true);
    setError("");
    try {
      await addParent({ name: cleanName(name), phone, city: cleanName(city) || undefined, language, avatar });
      goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add them.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen tabs={false} sheet>
      <NavBar
        sheet
        title="Add a parent"
        right={
          <NavAction onPress={save} disabled={!valid || busy}>
            {busy ? "Adding" : "Add"}
          </NavAction>
        }
      />
      <ProfileHero avatar={avatar} name={shown} sub={cleanName(city) || "Kin calls them on their own number"} onEdit={() => setSheet("avatar")} />

      {error ? <Text style={{ paddingHorizontal: 32, paddingBottom: 12, fontSize: 14, color: color.alert }}>{error}</Text> : null}

      <Section
        title="Who Kin calls"
        footer={problem || "An Indian mobile number. Kin keeps their calls, trends and memory separate; tap the name at the top to switch."}
        footerTone={problem ? "alert" : undefined}
      >
        <InputRow
          label="Name"
          value={name}
          onChangeText={setName}
          onBlur={() => {
            setName(cleanName);
            setTouched((t) => ({ ...t, name: true }));
          }}
          placeholder="Papa"
          autoFocus
          autoCapitalize="words"
          autoCorrect={false}
          textContentType="name"
          maxLength={40}
          returnKeyType="next"
          style={showName ? { color: color.alert } : undefined}
        />
        <PhoneRow digits={digits} country={INDIA} onChange={setDigits} invalid={showPhone} onBlur={() => setTouched((t) => ({ ...t, phone: true }))} />
        <InputRow label="City" value={city} onChangeText={setCity} placeholder="Lucknow" autoCapitalize="words" textContentType="addressCity" maxLength={40} />
        <ValueRow label="Language" value={language} onPress={() => setSheet("language")} />
      </Section>

      <AvatarSheet visible={sheet === "avatar"} name={shown} value={avatar} onChange={setAvatar} onClose={() => setSheet(null)} />
      <PickerSheet visible={sheet === "language"} title="Language" options={parentLanguages} value={language} onChange={setLanguage} onClose={() => setSheet(null)} />
    </Screen>
  );
}
