"use client";

// Family (apps/mobile/src/app/(tabs)/family.tsx + member.tsx + memory.tsx): who
// is in the family, who gets red alerts, the parents Kin calls and what Kin remembers.

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PhoneField } from "@/components/dashboard/phone-field";
import { Avatar, avatarNames, Button, ButtonLink, Card, CardTitle, ErrorText, Icon, icon, Input, Modal, PageHead, Select, StatusPill } from "@/components/dashboard/ui";
import { kinNumber, type Member } from "@/lib/kin/data";
import { useKin } from "@/lib/kin/kin";
import { cleanEmail, cleanName, countries, emailError, INDIA, nameError, phoneError, splitPhone, toE164, type Country } from "@/lib/kin/validate";

const relations = ["Daughter", "Son", "Daughter-in-law", "Son-in-law", "Grandchild", "Sibling", "Neighbour", "Family doctor"];

export default function FamilyPage() {
  const { family, switchParent } = useKin();
  const router = useRouter();
  const [editing, setEditing] = useState<Member | "new" | null>(null);

  return (
    <>
      <PageHead kicker={family.name} title="Family" right={<Button onClick={() => setEditing("new")}>Add someone</Button>} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardTitle right={`${family.members.length} ${family.members.length === 1 ? "person" : "people"}`}>People</CardTitle>
            <div className="space-y-1">
              {family.members.map((m) => (
                <button key={m.id} type="button" onClick={() => setEditing(m)} className="flex w-full cursor-pointer items-center gap-3 rounded-[18px] px-3 py-2.5 text-left hover:bg-paper/80">
                  <Avatar name={m.avatar} label={m.name} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[15.5px] font-semibold">
                        {m.name}
                        {m.id === family.meId ? <span className="font-normal text-body"> (you)</span> : null}
                      </span>
                      {m.role === "Red alerts" ? <StatusPill tone="alert">Red alerts</StatusPill> : m.role ? <StatusPill tone="plain">{m.role}</StatusPill> : null}
                    </span>
                    <span className="block truncate text-[13px] text-body">
                      {[m.relation, m.city, m.linked ? "uses Kin" : m.email ? "invited" : ""].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <Icon d={icon.chevron} size={16} className="text-faint" />
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <span id="memory" className="block scroll-mt-24" />
            <CardTitle right="Carried into the next call">What Kin remembers</CardTitle>
            {family.memories.length ? (
              <div className="space-y-2">
                {family.memories.map((m, i) => (
                  <div key={i} className="flex gap-3 rounded-[18px] bg-paper px-4 py-3">
                    <span className="shrink-0 rounded-full bg-cloud px-2.5 py-0.5 text-[12px] font-semibold text-body">{m.tag}</span>
                    <span className="flex-1 text-[14.5px] leading-[1.5]">{m.text}</span>
                    <span className="shrink-0 text-[12.5px] text-faint">{m.when}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[14px] text-body">After each call, Kin keeps a short summary and brings it up gently next time.</p>
            )}
            {family.nextQuestion ? (
              <div className="mt-3 flex items-start gap-3 rounded-[18px] bg-blue/8 px-4 py-3">
                <Icon d={icon.bulb} size={18} className="mt-0.5 text-blue" />
                <p className="text-[14.5px] leading-[1.5]">{family.nextQuestion}</p>
              </div>
            ) : null}
            {family.topicsAvoid.length ? (
              <p className="mt-3 text-[13.5px] text-body">
                Kin never brings up: <span className="font-medium text-ink">{family.topicsAvoid.join(", ")}</span>.{" "}
                <a href="/dashboard/profile" className="underline">
                  Change
                </a>
              </p>
            ) : null}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardTitle>Parents Kin calls</CardTitle>
            <div className="space-y-1">
              {family.parents.map((p) => (
                <button
                  key={p.phone}
                  type="button"
                  onClick={async () => {
                    if (p.phone !== family.parent.phone) await switchParent(p.phone);
                    router.push("/dashboard/profile");
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-[18px] px-3 py-2.5 text-left hover:bg-paper/80"
                >
                  <Avatar name={p.avatar} label={p.name} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{p.name}</span>
                    <span className="block text-[13px] text-body tabular-nums">{p.phone}</span>
                  </span>
                  <span className="text-[13px] font-semibold text-blue">Edit profile</span>
                </button>
              ))}
            </div>
          </Card>
          <Card tone="white">
            <CardTitle>Introduce Kin</CardTitle>
            <p className="text-[14px] leading-[1.55] text-body">
              Call {family.parent.name} from your phone, add a call to Kin&apos;s number <b className="font-semibold text-ink">{kinNumber}</b> and merge. Kin recognises your number, introduces
              itself, and asks {family.parent.name} if it may call every day.
            </p>
            <ButtonLink href="/dashboard/profile" variant="soft" size="sm" className="mt-3">
              Daily call settings
            </ButtonLink>
          </Card>
          <Card tone="white">
            <p className="text-[13.5px] leading-[1.55] text-body">Kin is not an emergency service. In India call 108, in Singapore call 995.</p>
          </Card>
        </div>
      </div>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add someone" : editing?.id === family.meId ? "You" : "Family member"} wide>
        {editing ? <MemberForm key={editing === "new" ? "new" : editing.id} existing={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} /> : null}
      </Modal>
    </>
  );
}

function MemberForm({ existing, onClose }: { existing?: Member; onClose: () => void }) {
  const { family, addMember, updateMember, removeMember } = useKin();
  const isSelf = existing?.id === family.meId;
  const start = splitPhone(existing?.phone);
  const [name, setName] = useState(existing?.name ?? "");
  const [avatar, setAvatar] = useState(existing?.avatar);
  const [relation, setRelation] = useState(existing?.relation ?? "Daughter");
  const [city, setCity] = useState(existing?.city ?? "");
  const [digits, setDigits] = useState(start.digits);
  const [country, setCountry] = useState<Country>(start.country);
  const [email, setEmail] = useState(existing?.email ?? "");
  const [emergency, setEmergency] = useState(Boolean(existing?.is_emergency));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const options = relations.includes(relation) ? relations : [relation, ...relations];
  const errs = {
    name: nameError(name),
    city: nameError(city, false) && "Check the city name.",
    phone: start.other && !digits ? "" : phoneError(digits, country, emergency),
    email: isSelf || existing?.linked ? "" : emailError(cleanEmail(email)),
  };

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (Object.values(errs).some(Boolean)) return;
    const m = {
      name: cleanName(name),
      avatar,
      relation,
      city: cleanName(city) || undefined,
      phone: digits ? toE164(digits, country) : start.other || undefined,
      email: isSelf || existing?.linked ? existing?.email : cleanEmail(email) || undefined,
      is_emergency: emergency,
    };
    void run(() => (existing ? updateMember(existing.id, m) : addMember(m)));
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <p className="mb-1.5 px-1 text-[13px] font-semibold text-body">Picture</p>
        <div className="flex flex-wrap gap-1.5">
          {avatarNames.map((a) => (
            <button key={a} type="button" onClick={() => setAvatar(a)} aria-pressed={avatar === a} className={`cursor-pointer rounded-full p-0.5 ${avatar === a ? "ring-2 ring-ink" : "opacity-80 hover:opacity-100"}`}>
              <Avatar name={a} size={36} />
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Rahul" maxLength={40} error={tried ? errs.name : ""} />
        <Select label={`Relation to ${family.parent.name}`} value={relation} onChange={(e) => setRelation(e.target.value)}>
          {options.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Pune" maxLength={40} error={tried ? errs.city : ""} />
        {isSelf || existing?.linked ? (
          <Input label="Email" value={existing?.email ?? ""} disabled />
        ) : (
          <Input label="Email" hint="invites them to Kin" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="rahul@example.com" error={tried ? errs.email : ""} />
        )}
      </div>
      <PhoneField label={`Phone${emergency ? "" : " (optional)"}`} digits={digits} country={country} onChange={setDigits} onCountry={(c) => setCountry(countries.find((x) => x.id === c.id) ?? INDIA)} error={tried ? errs.phone : ""} />
      <label className="flex cursor-pointer items-start gap-3 rounded-[18px] bg-alert-soft/60 px-4 py-3">
        <input type="checkbox" checked={emergency} onChange={(e) => setEmergency(e.target.checked)} className="mt-1 size-[18px] accent-[#e5484d]" />
        <span>
          <span className="block text-[15px] font-semibold">Red alerts go to them</span>
          <span className="block text-[13px] leading-[1.45] text-body">In an emergency Kin connects {family.parent.name} to this person. One person at a time; their number is never read out on calls.</span>
        </span>
      </label>
      <ErrorText>{error}</ErrorText>
      <div className="flex flex-wrap justify-between gap-2">
        {existing && !isSelf && existing.role !== "Owner" ? (
          <Button variant="danger" disabled={busy} onClick={() => void run(() => removeMember(existing.id))}>
            Remove from the family
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="soft" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : existing ? "Save" : "Add"}
          </Button>
        </div>
      </div>
    </form>
  );
}
