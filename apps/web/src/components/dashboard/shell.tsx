"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { parentLanguages } from "@/lib/kin/data";
import { useKin } from "@/lib/kin/kin";
import { cleanName, INDIA, nameError, phoneError, toE164 } from "@/lib/kin/validate";

import { CallNow } from "./call-now";
import { PhoneField } from "./phone-field";
import { Setup } from "./setup";
import { SignIn } from "./sign-in";
import { Avatar, Button, ErrorText, Icon, icon, Input, Modal, Select } from "./ui";

const nav = [
  { href: "/dashboard", label: "Today", d: icon.today },
  { href: "/dashboard/calls", label: "Calls", d: icon.calls },
  { href: "/dashboard/trends", label: "Trends", d: icon.trends },
  { href: "/dashboard/medicines", label: "Medicines", d: icon.pill },
  { href: "/dashboard/groceries", label: "Groceries", d: icon.basket },
  { href: "/dashboard/messages", label: "Messages", d: icon.message },
  { href: "/dashboard/family", label: "Family", d: icon.family },
  { href: "/dashboard/profile", label: "Profile", d: icon.user },
  { href: "/dashboard/settings", label: "Settings", d: icon.settings },
] as const;

/** Signed out → sign in; no family → set up; else the dashboard with its sidebar. */
export function Shell({ children }: { children: ReactNode }) {
  const { mode, familyState, error, refresh } = useKin();
  if (mode === "loading" || (mode === "signed-in" && familyState === "loading")) return <Loading />;
  if (mode === "signed-out") return <SignIn />;
  if (mode === "signed-in" && familyState === "none") return <Setup />;
  if (mode === "signed-in" && familyState === "error")
    return (
      <main className="grid min-h-dvh place-items-center px-4">
        <div className="max-w-[400px] text-center">
          <h1 className="display text-[32px]">Can&apos;t load your family</h1>
          <p className="mt-3 text-body">{error}</p>
          <Button className="mt-5" onClick={refresh}>
            Try again
          </Button>
        </div>
      </main>
    );
  return <Frame>{children}</Frame>;
}

function Loading() {
  return (
    <main className="mesh-light grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/kin-mark.svg" alt="" width={44} height={44} className="animate-breathe" />
        <p className="text-[14px] text-body">Loading your family…</p>
      </div>
    </main>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const { mode, family, refreshing, refresh, signOut } = useKin();
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const unread = family.messages.filter((m) => m.direction === "from_parent" && !m.done).length;
  const active = (href: string) => (href === "/dashboard" ? path === href : path.startsWith(href));

  const links = (
    <nav className="space-y-0.5">
      {nav.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          aria-current={active(n.href) ? "page" : undefined}
          className={`flex h-10 items-center gap-3 rounded-full px-3.5 text-[14.5px] font-medium transition-colors ${
            active(n.href) ? "bg-charcoal text-white" : "text-ink/80 hover:bg-cloud hover:text-ink"
          }`}
        >
          <Icon d={n.d} size={18} />
          <span className="flex-1">{n.label}</span>
          {n.label === "Messages" && unread ? (
            <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold ${active(n.href) ? "bg-white text-ink" : "bg-coral text-white"}`}>{unread}</span>
          ) : null}
          {n.label === "Today" && family.alert ? <i className={`block size-2 rounded-full ${family.alert.level === "red" ? "bg-alert" : "bg-gold"}`} /> : null}
        </Link>
      ))}
    </nav>
  );

  const side = (
    <div className="flex h-full flex-col gap-5 p-4">
      <Link href="/" className="flex items-center gap-2 px-2 pt-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/kin-mark.svg" alt="" width={28} height={28} />
        <span className="text-[19px] font-semibold tracking-[-0.03em]">Kin</span>
        <span className="ml-1 rounded-full bg-cloud px-2 py-0.5 text-[11.5px] font-semibold text-body">{family.name}</span>
      </Link>
      <ParentSwitcher />
      {links}
      <div className="mt-auto space-y-3">
        <CallNow compact />
        <div className="flex items-center justify-between gap-2 px-2 text-[13px] text-body">
          <button type="button" onClick={refresh} disabled={refreshing || mode !== "signed-in"} className="flex cursor-pointer items-center gap-1.5 hover:text-ink disabled:opacity-50">
            <Icon d={icon.refresh} size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
          <button type="button" onClick={signOut} className="flex cursor-pointer items-center gap-1.5 hover:text-ink">
            <Icon d={icon.out} size={14} />
            {mode === "sample" ? "Sign in" : "Sign out"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-paper">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] border-r border-line bg-mist/60 lg:block">{side}</aside>

      {/* Phone / tablet: a top bar and a slide-in menu with the same sidebar. */}
      <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-paper/85 px-4 py-2.5 backdrop-blur-md lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/kin-mark.svg" alt="" width={26} height={26} />
          <span className="flex items-center gap-2 text-[15px] font-semibold">
            <Avatar name={family.parent.avatar} label={family.parent.name} size={26} />
            {family.parent.name}
          </span>
        </Link>
        <button type="button" onClick={() => setMenu(true)} aria-label="Menu" className="grid size-10 cursor-pointer place-items-center rounded-full bg-cloud">
          <Icon d={icon.menu} size={18} />
        </button>
      </div>
      {menu ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal>
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-charcoal/40" onClick={() => setMenu(false)} />
          <aside
            className="absolute inset-y-0 left-0 w-[86%] max-w-[320px] overflow-y-auto bg-paper"
            onClick={(e) => (e.target as HTMLElement).closest("a") && setMenu(false)}
          >
            {side}
          </aside>
        </div>
      ) : null}

      <main className="lg:pl-[272px]">
        {mode === "sample" ? (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-charcoal px-4 py-2 text-center text-[13.5px] text-white/80">
            You&apos;re looking at a sample family. Changes here aren&apos;t saved.
            <button type="button" onClick={signOut} className="cursor-pointer font-semibold text-white underline-offset-2 hover:underline">
              Sign in
            </button>
          </div>
        ) : null}
        <div className="mx-auto w-full max-w-[1160px] px-4 py-7 sm:px-8 sm:py-10">{children}</div>
      </main>
    </div>
  );
}

function ParentSwitcher() {
  const { family, switchParent } = useKin();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const p = family.parent;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-3 rounded-[20px] bg-paper p-2.5 text-left shadow-[0_0_0_1px_var(--color-line)] hover:shadow-[0_0_0_1px_rgb(34_35_38/0.2)]"
      >
        <Avatar name={p.avatar} label={p.name} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{p.name}</span>
          <span className="block truncate text-[12.5px] text-body">{[p.city, p.language].filter(Boolean).join(" · ")}</span>
        </span>
        <Icon d="m7 10 5 5 5-5" size={16} className={`text-faint transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="absolute inset-x-0 top-[calc(100%+6px)] z-20 rounded-[20px] bg-paper p-1.5 shadow-[0_20px_40px_-16px_rgb(20_30_60/0.35),0_0_0_1px_var(--color-line)]">
          {family.parents.map((x) => (
            <button
              key={x.phone}
              type="button"
              onClick={() => {
                setOpen(false);
                if (x.phone !== p.phone) switchParent(x.phone);
              }}
              className="flex w-full cursor-pointer items-center gap-3 rounded-[14px] px-2 py-2 text-left hover:bg-cloud"
            >
              <Avatar name={x.avatar} label={x.name} size={32} />
              <span className="flex-1 text-[14.5px] font-medium">{x.name}</span>
              {x.alert ? <i className={`block size-2 rounded-full ${x.alert === "red" ? "bg-alert" : "bg-gold"}`} /> : null}
              {x.phone === p.phone ? <Icon d={icon.check} size={16} className="text-ok" /> : null}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setAdding(true);
            }}
            className="flex w-full cursor-pointer items-center gap-3 rounded-[14px] px-2 py-2 text-left text-[14.5px] font-medium hover:bg-cloud"
          >
            <span className="grid size-8 place-items-center rounded-full bg-cloud">
              <Icon d={icon.plus} size={16} />
            </span>
            Add a parent
          </button>
        </div>
      ) : null}
      <AddParent open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function AddParent({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mode, addParent } = useKin();
  const [name, setName] = useState("");
  const [digits, setDigits] = useState("");
  const [city, setCity] = useState("");
  const [language, setLanguage] = useState("Hindi");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const errs = { name: nameError(name), phone: phoneError(digits, INDIA), city: nameError(city, false) && "Check the city name." };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (Object.values(errs).some(Boolean)) return;
    setBusy(true);
    setError("");
    try {
      await addParent({ name: cleanName(name), phone: toE164(digits, INDIA), city: cleanName(city) || undefined, language });
      setName("");
      setDigits("");
      setCity("");
      setTried(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add them.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a parent">
      {mode !== "signed-in" ? (
        <p className="text-[15px] text-body">Sign in to add a parent of your own.</p>
      ) : (
        <form onSubmit={save} className="space-y-4">
          <p className="text-[14px] leading-[1.5] text-body">Kin calls each parent on their own number, with their own memory and trends.</p>
          <Input label="What the family calls them" value={name} onChange={(e) => setName(e.target.value)} placeholder="Papa" maxLength={40} error={tried ? errs.name : ""} />
          <PhoneField label="Their mobile number (India)" digits={digits} country={INDIA} onChange={setDigits} indiaOnly error={tried ? errs.phone : ""} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Lucknow" maxLength={40} error={tried ? errs.city : ""} />
            <Select label="Language" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {parentLanguages.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </Select>
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="flex justify-end gap-2">
            <Button variant="soft" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Adding…" : "Add"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
