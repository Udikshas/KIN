"use client";

// Monthly groceries (apps/mobile/src/app/groceries.tsx + components/grocery-order.tsx):
// each item comes due on its own cycle; what's due goes out as one order.

import { useState } from "react";

import { PhoneField } from "@/components/dashboard/phone-field";
import { Button, Card, CardTitle, Empty, ErrorText, Icon, icon, Input, Modal, OutLink, PageHead, Select, StatusPill } from "@/components/dashboard/ui";
import { amazonCartUrl, formatDay, USUAL_GROCERIES, type GroceryItem } from "@/lib/kin/data";
import { useKin } from "@/lib/kin/kin";
import { INDIA, phoneError, splitPhone, toE164 } from "@/lib/kin/validate";

const EVERY = [7, 14, 21, 30, 60] as const;
const everyLabel = (d: number) => (d === 7 ? "Every week" : d === 14 ? "Every 2 weeks" : d === 21 ? "Every 3 weeks" : d === 30 ? "Every month" : "Every 2 months");
const SHOPS = [
  { name: "Blinkit", url: (q: string) => `https://blinkit.com/s/?q=${encodeURIComponent(q)}` },
  { name: "Zepto", url: (q: string) => `https://www.zeptonow.com/search?query=${encodeURIComponent(q)}` },
  { name: "BigBasket", url: (q: string) => `https://www.bigbasket.com/ps/?q=${encodeURIComponent(q)}` },
  { name: "Instamart", url: (q: string) => `https://www.swiggy.com/instamart/search?query=${encodeURIComponent(q)}` },
];
const label = (g: GroceryItem) => (g.qty ? `${g.name}, ${g.qty}` : g.name);

export default function Groceries() {
  const { family, addGroceries, updateGrocery, removeGrocery, groceriesBought } = useKin();
  const { parent } = family;
  const list = parent.groceries ?? [];
  const due = list.filter((g) => g.due);
  const later = list.filter((g) => !g.due);
  const [order, setOrder] = useState(false);
  const [amazonFor, setAmazonFor] = useState<GroceryItem | null>(null);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [every, setEvery] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
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
    if (!name.trim()) return;
    if (await run(() => addGroceries([{ name: name.trim(), qty: qty.trim() || null, everyDays: every }]))) {
      setName("");
      setQty("");
    }
  }

  const row = (g: GroceryItem) => (
    <div key={g.id} className="flex flex-wrap items-center gap-3 rounded-[18px] bg-paper px-3.5 py-3 sm:flex-nowrap">
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[15.5px] font-semibold">{g.name}</span>
          {g.qty ? <span className="text-[13.5px] text-body">{g.qty}</span> : null}
          {g.amazonAsin ? <span className="rounded-full bg-cloud px-2 py-0.5 text-[11px] font-semibold text-body">Amazon</span> : null}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-body">
          {g.overdue ? <StatusPill tone="alert">Overdue since {formatDay(g.dueOn)}</StatusPill> : g.due ? <StatusPill tone="watch">Due {formatDay(g.dueOn) === "Today" ? "today" : formatDay(g.dueOn)}</StatusPill> : `Next ${formatDay(g.dueOn)}`}
          {g.lastBoughtOn ? <span>· bought {formatDay(g.lastBoughtOn)}</span> : null}
        </span>
      </span>
      <select
        aria-label={`How often for ${g.name}`}
        value={g.everyDays}
        disabled={busy}
        onChange={(e) => void run(() => updateGrocery(g.id, { everyDays: Number(e.target.value) }))}
        className="h-9 cursor-pointer rounded-full border border-line bg-paper px-3 text-[13px] font-medium"
      >
        {EVERY.map((d) => (
          <option key={d} value={d}>
            {everyLabel(d)}
          </option>
        ))}
      </select>
      <Button variant="soft" size="sm" disabled={busy} onClick={() => setAmazonFor(g)}>
        <Icon d={icon.link} size={15} />
      </Button>
      <Button variant={g.due ? "filled" : "soft"} size="sm" disabled={busy} onClick={() => void run(() => groceriesBought([g.id]))}>
        Bought
      </Button>
      <button type="button" aria-label={`Remove ${g.name}`} disabled={busy} onClick={() => void run(() => removeGrocery(g.id))} className="grid size-8 cursor-pointer place-items-center rounded-full text-faint hover:bg-alert-soft hover:text-alert">
        <Icon d={icon.trash} size={16} />
      </button>
    </div>
  );

  return (
    <>
      <PageHead
        kicker={list.length ? `${list.length} items · ${due.length} due this week` : `${parent.name}'s home`}
        title="Groceries"
        right={due.length ? <Button onClick={() => setOrder(true)}>Order {due.length} due</Button> : null}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {!list.length ? (
            <Card>
              <Empty
                title="No groceries yet"
                action={
                  <Button disabled={busy} onClick={() => void run(() => addGroceries(USUAL_GROCERIES))}>
                    Add the usual list
                  </Button>
                }
              >
                Start from the usual monthly staples (atta, rice, dal, oil and more) and change what you need. Each comes due on its own cycle.
              </Empty>
            </Card>
          ) : (
            <>
              {due.length ? (
                <Card>
                  <CardTitle right={<button type="button" disabled={busy} onClick={() => void run(() => groceriesBought(due.map((g) => g.id)))} className="cursor-pointer font-semibold text-ink hover:underline">Mark all {due.length} bought</button>}>Due this week</CardTitle>
                  <div className="space-y-2">{due.map(row)}</div>
                </Card>
              ) : null}
              {later.length ? (
                <Card>
                  <CardTitle>Later</CardTitle>
                  <div className="space-y-2">{later.map(row)}</div>
                </Card>
              ) : null}
            </>
          )}
          <ErrorText>{error}</ErrorText>
        </div>
        <div className="space-y-4">
          <Card>
            <CardTitle>Add an item</CardTitle>
            <form onSubmit={add} className="space-y-3">
              <div className="grid grid-cols-[1fr_110px] gap-2">
                <Input label="Item" value={name} onChange={(e) => setName(e.target.value)} placeholder="Basmati rice" maxLength={60} />
                <Input label="How much" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="5 kg" maxLength={20} />
              </div>
              <Select label="How often" value={every} onChange={(e) => setEvery(Number(e.target.value))}>
                {EVERY.map((d) => (
                  <option key={d} value={d}>
                    {everyLabel(d)}
                  </option>
                ))}
              </Select>
              <Button type="submit" className="w-full" disabled={busy || !name.trim()}>
                Add
              </Button>
            </form>
            {list.length ? (
              <button type="button" disabled={busy} onClick={() => void run(() => addGroceries(USUAL_GROCERIES.filter((u) => !list.some((g) => g.name.toLowerCase() === u.name.toLowerCase()))))} className="mt-3 w-full cursor-pointer text-center text-[13.5px] font-medium text-body hover:text-ink">
                Add the rest of the usual list
              </button>
            ) : null}
          </Card>
          <Kirana />
        </div>
      </div>
      <Modal open={order} onClose={() => setOrder(false)} title="Order groceries" wide>
        {order ? <Order items={due} onClose={() => setOrder(false)} /> : null}
      </Modal>
      <Modal open={amazonFor !== null} onClose={() => setAmazonFor(null)} title={amazonFor ? `${amazonFor.name} on Amazon` : ""}>
        {amazonFor ? <AmazonLink item={amazonFor} onClose={() => setAmazonFor(null)} /> : null}
      </Modal>
    </>
  );
}

function AmazonLink({ item, onClose }: { item: GroceryItem; onClose: () => void }) {
  const { setGroceryAmazon } = useKin();
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(value: string | null) {
    setBusy(true);
    setError("");
    try {
      await setGroceryAmazon(item.id, value);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <p className="text-[14.5px] leading-[1.5] text-body">
        Save the product once, and every order puts it straight into one Amazon cart with the rest.{" "}
        <a href={`https://www.amazon.in/s?k=${encodeURIComponent(item.name)}`} target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline">
          Find {item.name} on Amazon
        </a>
        , then paste its link here.
      </p>
      {item.amazonAsin ? <p className="rounded-[14px] bg-cloud px-3.5 py-2.5 text-[14px]">Saved: product {item.amazonAsin}</p> : null}
      <Input label="Amazon link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://www.amazon.in/dp/… or https://amzn.in/…" autoFocus />
      <ErrorText>{error}</ErrorText>
      <div className="flex justify-between gap-2">
        {item.amazonAsin ? (
          <Button variant="danger" disabled={busy} onClick={() => save(null)}>
            Forget it
          </Button>
        ) : (
          <span />
        )}
        <Button disabled={busy || !link.trim()} onClick={() => save(link.trim())}>
          Save
        </Button>
      </div>
    </div>
  );
}

function Order({ items, onClose }: { items: GroceryItem[]; onClose: () => void }) {
  const { family, groceriesBought } = useKin();
  const { parent } = family;
  const [picked, setPicked] = useState<string[]>(items.map((g) => g.id));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const chosen = items.filter((g) => picked.includes(g.id));
  const message = `Namaste, please send these for ${parent.name}${parent.city ? ` (${parent.city})` : ""}:\n${chosen.map((g, i) => `${i + 1}. ${label(g)}`).join("\n")}\nThank you.`;
  const whatsapp = parent.kiranaPhone ? `https://wa.me/${parent.kiranaPhone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}` : null;
  const onAmazon = chosen.filter((g) => g.amazonAsin);
  const amazonUrl = onAmazon.length ? amazonCartUrl(onAmazon.map((g) => ({ asin: g.amazonAsin!, quantity: 1 }))) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[18px] bg-ok-soft px-4 py-3">
        <span className="text-[14px] font-medium">Bought them? Their cycles start again from today.</span>
        <Button
          size="sm"
          disabled={busy || !chosen.length}
          onClick={async () => {
            setBusy(true);
            await groceriesBought(chosen.map((g) => g.id)).catch(() => null);
            setBusy(false);
            setDone("Marked bought.");
            onClose();
          }}
        >
          Mark {chosen.length} bought
        </Button>
      </div>
      <div className="divide-y divide-ink/10 rounded-[20px] bg-cloud px-2">
        {items.map((g) => (
          <label key={g.id} className="flex cursor-pointer items-center gap-3 px-2 py-2.5">
            <input type="checkbox" checked={picked.includes(g.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, g.id] : p.filter((x) => x !== g.id)))} className="size-[18px] accent-[#1f2025]" />
            <span className="flex-1 text-[15px] font-medium">{label(g)}</span>
            {g.amazonAsin ? <span className="text-[12px] font-semibold text-body">Amazon</span> : null}
          </label>
        ))}
      </div>
      {chosen.length ? (
        <div className="space-y-2">
          {amazonUrl ? (
            <OutLink href={amazonUrl} variant="filled" className="w-full">
              <Icon d={icon.cart} size={17} /> Add {onAmazon.length === chosen.length ? "all" : `${onAmazon.length} of ${chosen.length}`} to the Amazon cart
            </OutLink>
          ) : null}
          {whatsapp ? (
            <OutLink href={whatsapp} variant={amazonUrl ? "soft" : "filled"} className="w-full">
              Send all {chosen.length} to the kirana on WhatsApp
            </OutLink>
          ) : (
            <p className="px-1 text-[13.5px] text-body">Save the kirana&apos;s WhatsApp on this page to send the list in one message.</p>
          )}
          <div className="pt-1">
            <p className="mb-1.5 px-1 text-[13px] font-semibold text-body">Or one at a time on a quick-delivery app (each opens in a new tab)</p>
            <div className="flex flex-wrap gap-2">
              {SHOPS.map((s) => (
                <Button key={s.name} variant="soft" size="sm" onClick={() => chosen.forEach((g) => window.open(s.url(g.name), "_blank", "noopener"))}>
                  {s.name}
                </Button>
              ))}
              <Button variant="soft" size="sm" onClick={() => navigator.clipboard?.writeText(message).then(() => setDone("List copied."))}>
                Copy the list
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-[14px] text-body">Tick what to order.</p>
      )}
      {done ? <p className="text-[14px] font-medium text-ok">{done}</p> : null}
    </div>
  );
}

function Kirana() {
  const { family, saveParent } = useKin();
  const saved = splitPhone(family.parent.kiranaPhone, [INDIA]).digits;
  const [digits, setDigits] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const err = phoneError(digits, INDIA, false);
  return (
    <Card>
      <CardTitle>Local kirana</CardTitle>
      <p className="-mt-1 mb-3 text-[14px] leading-[1.5] text-body">The grocery shop&apos;s WhatsApp, so the whole list goes out in one message.</p>
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
              await saveParent({ kiranaPhone: digits ? toE164(digits, INDIA) : "" });
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
