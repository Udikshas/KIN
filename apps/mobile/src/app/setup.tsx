import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";

import { Choice, Field } from "@/components/field";
import { PhoneInput } from "@/components/form";
import { Button } from "@/components/kit";
import { Screen } from "@/components/screen";
import { callTimeGroups, partOfDay, to24h } from "@/lib/data";
import { useKin } from "@/lib/kin";
import { color, display, glass, radius } from "@/lib/theme";
import { cleanName, INDIA, nameError, phoneError, toE164, type Country } from "@/lib/validate";

const relations = ["Daughter", "Son", "Daughter-in-law", "Son-in-law", "Grandchild", "Other"] as const;
const languages = ["Hindi", "English", "Tamil", "Malayalam", "Bengali", "Telugu", "Kannada", "Marathi", "Gujarati", "Punjabi", "Odia"] as const;

/** First sign-in with no family: who you are, and the parent Kin should call. */
export default function Setup() {
  const { email, setupFamily, signOut } = useKin();
  const [myName, setMyName] = useState("");
  const [relation, setRelation] = useState<(typeof relations)[number]>("Daughter");
  // Children often live abroad (e.g. Singapore); parents are in India.
  const [myCountry, setMyCountry] = useState<Country>(INDIA);
  const [myDigits, setMyDigits] = useState("");
  const [myCity, setMyCity] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentDigits, setParentDigits] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [parentCity, setParentCity] = useState("");
  const [language, setLanguage] = useState<(typeof languages)[number]>("Hindi");
  const [callTime, setCallTime] = useState("7:15 pm");
  const part = partOfDay(callTime);
  const partTimes = callTimeGroups.find((g) => g.part === part)?.times ?? [];
  const [medicines, setMedicines] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const errors = {
    myName: nameError(myName),
    myPhone: phoneError(myDigits, myCountry, false),
    myCity: nameError(myCity, false) && "Check the city name.",
    parentName: nameError(parentName),
    parentPhone:
      phoneError(parentDigits, INDIA) ||
      (parentDigits && myDigits && toE164(parentDigits, INDIA) === toE164(myDigits, myCountry) ? "This is the same as your number." : ""),
    parentCity: nameError(parentCity, false) && "Check the city name.",
  };
  type Key = keyof typeof errors;
  const valid = Object.values(errors).every((e) => !e);
  // Phone numbers are judged once complete; everything once the field is left.
  const shownError = (k: Key) =>
    (touched[k] || (k === "myPhone" && myDigits.length === myCountry.length) || (k === "parentPhone" && parentDigits.length === INDIA.length)) && errors[k]
      ? errors[k]
      : "";
  const touch = (k: Key) => () => setTouched((t) => ({ ...t, [k]: true }));

  async function submit() {
    if (!valid) return setTouched(Object.fromEntries(Object.keys(errors).map((k) => [k, true])));
    setBusy(true);
    setError("");
    try {
      await setupFamily({
        name: `${parentName.trim()}'s family`,
        me: { name: cleanName(myName), relation, phone: toE164(myDigits, myCountry) || null, city: cleanName(myCity) || null },
        parent_phone: toE164(parentDigits, INDIA),
        parent: {
          parent_name: cleanName(parentName),
          language,
          city: cleanName(parentCity) || null,
          call_time: to24h(callTime),
          call_length_minutes: 3,
          medicines: medicines || null,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen tabs={false}>
        <View style={styles.head}>
          <Text style={styles.kicker}>Signed in as {email}</Text>
          <Text style={[display, styles.title]}>Set up Kin</Text>
          <Text style={styles.lead}>Tell us who you are and who Kin should call. You can change all of this later.</Text>
        </View>
        <View style={styles.form}>
          <Text style={styles.section}>You</Text>
          <Field label="Your name" value={myName} onChangeText={setMyName} onBlur={touch("myName")} placeholder="Neha" autoCapitalize="words" autoCorrect={false} textContentType="name" maxLength={40} />
          <FieldError text={shownError("myName")} />
          <Choice label="You are their" options={relations} value={relation} onChange={setRelation} />
          <PhoneField
            label="Your phone (so Kin knows you on the introduction call)"
            digits={myDigits}
            country={myCountry}
            onChange={setMyDigits}
            onCountry={setMyCountry}
            onBlur={touch("myPhone")}
            error={shownError("myPhone")}
          />
          <Field label="Your city" value={myCity} onChangeText={setMyCity} onBlur={touch("myCity")} placeholder="Singapore" autoCapitalize="words" maxLength={40} />
          <FieldError text={shownError("myCity")} />

          <Text style={styles.section}>Your parent</Text>
          <Field label="What the family calls them" value={parentName} onChangeText={setParentName} onBlur={touch("parentName")} placeholder="Amma" autoCapitalize="words" autoCorrect={false} maxLength={40} />
          <FieldError text={shownError("parentName")} />
          <PhoneField
            label="Their mobile number (India)"
            digits={parentDigits}
            country={INDIA}
            onChange={setParentDigits}
            onBlur={touch("parentPhone")}
            error={shownError("parentPhone")}
          />
          <Field label="Their city" value={parentCity} onChangeText={setParentCity} onBlur={touch("parentCity")} placeholder="Lucknow" autoCapitalize="words" maxLength={40} />
          <FieldError text={shownError("parentCity")} />
          <Choice label="Language" options={languages} value={language} onChange={setLanguage} />
          <Choice
            label="Daily call (India time)"
            options={callTimeGroups.map((g) => g.part)}
            value={part}
            // Switching part of the day picks its middle time; the row below fine-tunes it.
            onChange={(p) => {
              const g = callTimeGroups.find((x) => x.part === p)!;
              setCallTime(g.times[Math.floor((g.times.length - 1) / 2)]);
            }}
          />
          <Choice label="At" options={partTimes} value={callTime} onChange={setCallTime} />
          <Text style={styles.note}>
            Daily calls start when you turn them on in {parentName.trim() || "your parent"}&apos;s settings, once they know Kin will call.
          </Text>
          <Field
            label="Medicines (optional)"
            value={medicines}
            onChangeText={setMedicines}
            placeholder="Amlodipine 5 mg after breakfast, Metformin after lunch"
            multiline
            style={styles.multiline}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button onPress={submit} disabled={busy}>
            {busy ? "Saving…" : "Save and continue"}
          </Button>
          <Button variant="soft" onPress={signOut}>
            Sign out
          </Button>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function FieldError({ text }: { text: string }) {
  return text ? <Text style={styles.fieldError}>{text}</Text> : null;
}

/** Label above a glass box with the country code chip and the number. */
function PhoneField({
  label,
  error,
  ...props
}: { label: string; error: string } & Omit<Parameters<typeof PhoneInput>[0], "label" | "invalid" | "align">) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[glass, styles.phoneBox, error ? { borderColor: color.alert } : null]}>
        <PhoneInput label={label} invalid={Boolean(error)} align="left" {...props} />
      </View>
      <FieldError text={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { paddingHorizontal: 4, fontSize: 13, fontWeight: "600", color: color.body },
  fieldError: { marginTop: -8, paddingHorizontal: 4, fontSize: 13, color: color.alert },
  phoneBox: { height: 50, borderRadius: radius.input, paddingHorizontal: 10, justifyContent: "center", backgroundColor: "rgba(255,255,255,0.85)" },
  head: { paddingHorizontal: 22, paddingTop: 24, gap: 6 },
  kicker: { fontSize: 14, fontWeight: "500", color: color.body },
  title: { fontSize: 36, lineHeight: 40 },
  lead: { fontSize: 16, lineHeight: 22, color: color.body },
  form: { paddingHorizontal: 16, paddingTop: 18, gap: 14 },
  section: { paddingHorizontal: 4, paddingTop: 6, fontSize: 20, fontWeight: "600", letterSpacing: -0.4, color: color.ink },
  multiline: { height: 84, paddingTop: 12, textAlignVertical: "top" },
  error: { paddingHorizontal: 4, fontSize: 14, color: color.alert },
  note: { marginTop: -6, paddingHorizontal: 4, fontSize: 13, lineHeight: 18, color: color.body },
});
