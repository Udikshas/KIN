"use client";

// Medicines (apps/mobile/src/app/medicines.tsx): what Kin asks about on every
// call, how much is left at home, reminder calls and the 30-day calendar.

import { useState } from "react";

import { MedicineCalendar, ReminderCalls, ReorderModal, StockModal, stockLine } from "@/components/dashboard/medicines";
import { PhoneField } from "@/components/dashboard/phone-field";
import { Button, Card, CardTitle, Empty, ErrorText, Icon, icon, Input, PageHead } from "@/components/dashboard/ui";
import { medColors, type Medicine } from "@/lib/kin/data";
import { useKin } from "@/lib/kin/kin";
import { INDIA, phoneError, splitPhone, toE164 } from "@/lib/kin/validate";

export default function Medicines() {
  const { family, saveMedicines } = useKin();
  const { parent } = family;
  const [stockFor, setStockFor] = useState<string | null>(null);
  const [reorder, setReorder] = useState(false);
  const [name, setName] = useState("");
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const low = (parent.stock ?? []).filter((s) => s.low);

  async function save(meds: Medicine[]) {
    setBusy(true);
    setError("");
    try {
      await saveMedicines(meds);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    if (family.medicines.some((m) => m.name.toLowerCase() === n.toLowerCase())) return setError(`${n} is already on the list.`);
    const h = hint.trim();
    const next = [...family.medicines, { name: n, hint: h ? h.charAt(0).toUpperCase() + h.slice(1) : "Kin asks about it on every call", color: medColors[family.medicines.length % medColors.length], takenToday: null }];
    if (await save(next)) {
      setName("");
      setHint("");
    }
  }

  return (
    <>
      <PageHead
        kicker={`${family.medicines.length} ${family.medicines.length === 1 ? "medicine" : "medicines"}${low.length ? ` · ${low.length} running low` : ""}`}
        title="Medicines"
        right={family.medicines.length ? <Button onClick={() => setReorder(true)}>{low.length ? `Reorder ${low.length} running low` : "Reorder"}</Button> : null}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardTitle right="Kin asks about each one by name">On every call</CardTitle>
            {family.medicines.length ? (
              <div className="space-y-2">
                {family.medicines.map((m) => {
                  const s = parent.stock?.find((x) => x.name.toLowerCase() === m.name.toLowerCase());
                  return (
                    <div key={m.name} className="flex items-center gap-3 rounded-[18px] bg-paper px-3.5 py-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full" style={{ backgroundColor: m.color + "22", color: m.color }}>
                        <Icon d={icon.pill} size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15.5px] font-semibold">{m.name}</span>
                        <span className={`block truncate text-[13px] ${s?.low ? "font-medium text-alert" : "text-body"}`}>{s ? stockLine(s) : m.hint}</span>
                      </span>
                      {m.takenToday !== null ? (
                        <span className={`hidden text-[12.5px] font-semibold sm:block ${m.takenToday ? "text-ok" : "text-watch"}`}>{m.takenToday ? "Taken today" : "Not yet"}</span>
                      ) : null}
                      <Button variant={s?.low ? "filled" : "soft"} size="sm" onClick={() => setStockFor(m.name)}>
                        {s ? (s.low ? "Reorder" : "Stock") : "Count"}
                      </Button>
                      <button
                        type="button"
                        aria-label={`Remove ${m.name}`}
                        disabled={busy}
                        onClick={() => save(family.medicines.filter((x) => x.name !== m.name))}
                        className="grid size-8 cursor-pointer place-items-center rounded-full text-faint hover:bg-alert-soft hover:text-alert"
                      >
                        <Icon d={icon.trash} size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty title="No medicines yet">Add each one with when it&apos;s taken. Kin asks {parent.name} about them by name on every call.</Empty>
            )}
            <form onSubmit={add} className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Input label="Add a medicine" value={name} onChange={(e) => setName(e.target.value)} placeholder="Amlodipine 5 mg" maxLength={60} />
              <Input label="When" hint="optional" value={hint} onChange={(e) => setHint(e.target.value)} placeholder="after breakfast" maxLength={40} />
              <Button type="submit" disabled={busy || !name.trim()}>
                Add
              </Button>
            </form>
            <div className="mt-3">
              <ErrorText>{error}</ErrorText>
            </div>
          </Card>
          {parent.medicine ? <MedicineCalendar history={parent.medicine} name={parent.name} /> : null}
        </div>
        <div className="space-y-4">
          <ReminderCalls />
          <Chemist />
        </div>
      </div>
      <StockModal medicine={stockFor} onClose={() => setStockFor(null)} />
      <ReorderModal open={reorder} onClose={() => setReorder(false)} />
    </>
  );
}

function Chemist() {
  const { family, saveParent } = useKin();
  const saved = splitPhone(family.parent.chemistPhone, [INDIA]).digits;
  const [digits, setDigits] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const err = phoneError(digits, INDIA, false);
  return (
    <Card>
      <CardTitle>Local chemist</CardTitle>
      <p className="-mt-1 mb-3 text-[14px] leading-[1.5] text-body">Their WhatsApp number, so a reorder goes out as one message with the list written out.</p>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <PhoneField label="WhatsApp (India)" digits={digits} country={INDIA} onChange={(d) => (setDigits(d), setMsg(""))} indiaOnly error={err} />
        </div>
        <Button
          variant="white"
          disabled={busy || Boolean(err) || digits === saved}
          onClick={async () => {
            setBusy(true);
            try {
              await saveParent({ chemistPhone: digits ? toE164(digits, INDIA) : "" });
              setMsg("Saved.");
            } catch (e) {
              setMsg(e instanceof Error ? e.message : "Could not save.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Save
        </Button>
      </div>
      {msg ? <p className="mt-2 px-1 text-[13px] text-body">{msg}</p> : null}
    </Card>
  );
}
