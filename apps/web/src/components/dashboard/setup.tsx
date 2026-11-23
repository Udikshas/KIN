"use client";

import { useState } from "react";

import { callTimeGroups, parentLanguages, to24h } from "@/lib/kin/data";
import { useKin } from "@/lib/kin/kin";
import { cleanName, INDIA, nameError, phoneError, toE164, type Country } from "@/lib/kin/validate";

import { PhoneField } from "./phone-field";
import { Button, ErrorText, Input, Select } from "./ui";

const relations = ["Daughter", "Son", "Daughter-in-law", "Son-in-law", "Grandchild", "Other"] as const;

/** First sign-in with no family yet: the same questions as the app's Set up screen. */
export function Setup() {
  const { email, setupFamily, signOut } = useKin();
  const [myName, setMyName] = useState("");
  const [relation, setRelation] = useState<string>("Daughter");
  const [myDigits, setMyDigits] = useState("");
  const [myCountry, setMyCountry] = useState<Country>(INDIA);
  const [myCity, setMyCity] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentDigits, setParentDigits] = useState("");
  const [parentCity, setParentCity] = useState("");
  const [language, setLanguage] = useState("Hindi");
  const [callTime, setCallTime] = useState("7:15 pm");
  const [medicines, setMedicines] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const errors = {
    myName: nameError(myName),
    myPhone: phoneError(myDigits, myCountry, false),
    myCity: nameError(myCity, false) && "Check the city name.",
    parentName: nameError(parentName),
    parentPhone: phoneError(parentDigits, INDIA) || (parentDigits && toE164(parentDigits, INDIA) === toE164(myDigits, myCountry) ? "That's your own number." : ""),
    parentCity: nameError(parentCity, false) && "Check the city name.",
  };
  const valid = Object.values(errors).every((e) => !e);
  const show = (k: keyof typeof errors) => (tried ? errors[k] : "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!valid) return;
    setBusy(true);
    setError("");
    try {
      await setupFamily({
        name: `${cleanName(parentName)}'s family`,
        me: { name: cleanName(myName), relation, phone: toE164(myDigits, myCountry) || null, city: cleanName(myCity) || null },
        parent_phone: toE164(parentDigits, INDIA),
        parent: {
          parent_name: cleanName(parentName),
          language,
          city: cleanName(parentCity) || null,
          call_time: to24h(callTime),
          call_length_minutes: 3,
          medicines: medicines.trim() || null,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Try again.");
      setBusy(false);
    }
  }

  return (
    <main className="mesh-light min-h-dvh px-4 py-10">
      <form onSubmit={submit} className="mx-auto w-full max-w-[640px]">
        <p className="text-[14px] font-medium text-body">Signed in as {email}</p>
        <h1 className="display mt-1 text-[44px]">Set up Kin</h1>
        <p className="mt-3 text-[17px] leading-[1.5] text-body">Tell us who you are and who Kin should call. You can change all of this later, here or in the app.</p>

        <div className="glass mt-8 space-y-4 rounded-[32px] p-6 sm:p-7">
          <h2 className="text-[18px] font-semibold">You</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Your name" value={myName} onChange={(e) => setMyName(e.target.value)} placeholder="Neha" maxLength={40} error={show("myName")} />
            <Select label="You are their" value={relation} onChange={(e) => setRelation(e.target.value)}>
              {relations.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </div>
          <PhoneField label="Your phone (so Kin knows you on the introduction call)" digits={myDigits} country={myCountry} onChange={setMyDigits} onCountry={setMyCountry} error={show("myPhone")} />
          <Input label="Your city" value={myCity} onChange={(e) => setMyCity(e.target.value)} placeholder="Singapore" maxLength={40} error={show("myCity")} />
        </div>

        <div className="glass mt-4 space-y-4 rounded-[32px] p-6 sm:p-7">
          <h2 className="text-[18px] font-semibold">Your parent</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="What the family calls them" value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Amma" maxLength={40} error={show("parentName")} />
            <Input label="Their city" value={parentCity} onChange={(e) => setParentCity(e.target.value)} placeholder="Lucknow" maxLength={40} error={show("parentCity")} />
          </div>
          <PhoneField label="Their mobile number (India)" digits={parentDigits} country={INDIA} onChange={setParentDigits} indiaOnly error={show("parentPhone")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Language Kin speaks" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {parentLanguages.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </Select>
            <Select label="Daily call time (India)" value={callTime} onChange={(e) => setCallTime(e.target.value)}>
              {callTimeGroups.map((g) => (
                <optgroup key={g.part} label={g.part}>
                  {g.times.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>
          <Input label="Medicines" hint="optional" value={medicines} onChange={(e) => setMedicines(e.target.value)} placeholder="Amlodipine 5 mg after breakfast, Metformin after lunch" maxLength={300} />
          <p className="px-1 text-[13px] leading-[1.5] text-body">Daily calls stay off until you turn them on, after {parentName.trim() || "your parent"} knows Kin will ring.</p>
        </div>

        <div className="mt-5 space-y-3">
          <ErrorText>{error}</ErrorText>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={signOut} className="cursor-pointer text-[14px] text-body hover:text-ink">
              Sign out
            </button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Create the family"}
            </Button>
          </div>
        </div>
      </form>
    </main>
  );
}
