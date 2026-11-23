"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { joinWaitlist, type WaitlistState } from "@/app/actions/waitlist";

type Role = "family" | "centre" | "insurer";

const roles: { id: Role; label: string }[] = [
  { id: "family", label: "A family" },
  { id: "centre", label: "A care centre or NGO" },
  { id: "insurer", label: "An insurer or hospital" },
];

const languages = ["Hindi", "Tamil", "Malayalam", "Bengali", "English", "Other"];

const field =
  "h-12 w-full rounded-[14px] border bg-white/90 px-4 text-[16px] text-ink outline-none transition-colors placeholder:text-faint focus:border-ink";

/**
 * Waitlist form. Any link to `#waitlist`, `#waitlist-centre` or
 * `#waitlist-insurer` scrolls here, pre-selects who is signing up and focuses
 * the first field.
 */
export function WaitlistForm() {
  const [state, action, pending] = useActionState<WaitlistState, FormData>(joinWaitlist, { status: "idle" });
  const [role, setRole] = useState<Role>("family");
  const nameRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const open = (hash: string) => {
      if (!hash.startsWith("#waitlist")) return false;
      const r = hash.replace("#waitlist", "").replace("-", "");
      if (r === "centre" || r === "insurer") setRole(r);
      else setRole("family");
      boxRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => nameRef.current?.focus({ preventScroll: true }), 500);
      return true;
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#waitlist"]');
      if (!a) return;
      e.preventDefault();
      const hash = a.getAttribute("href") ?? "#waitlist";
      history.replaceState(null, "", "#waitlist");
      open(hash);
    };
    open(window.location.hash);
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const err = state.status === "error" ? state.fields : {};
  // React resets forms after an action; refill what the person typed.
  const v: Record<string, string> = state.status === "error" ? state.values : {};

  if (state.status === "ok") {
    return (
      <div ref={boxRef} className="glass flex flex-col items-center gap-4 rounded-[28px] px-8 py-12 text-center" role="status">
        <span className="grid size-16 place-items-center rounded-full bg-ok text-white shadow-[0_10px_24px_-8px_rgba(35,163,0,0.6)]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        </span>
        <h3 className="text-[28px] font-semibold tracking-[-0.03em]">You&apos;re on the list, {state.name}</h3>
        <p className="max-w-sm text-[17px] leading-[1.4] text-body">
          We&apos;ll write to {state.email} when there is a place for your family. Thank you for waiting with us.
        </p>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="glass rounded-[28px] p-6 text-left sm:p-8">
      <form action={action} noValidate className="flex flex-col gap-5">
        {/* who is signing up */}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[15px] font-semibold">I&apos;m signing up as</legend>
          <div className="flex flex-wrap gap-2">
            {roles.map((r) => (
              <label
                key={r.id}
                className={`cursor-pointer rounded-full border px-4 py-2 text-[15px] font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink ${
                  role === r.id ? "border-ink bg-ink text-white" : "border-line bg-white/80 text-ink hover:border-ink/40"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={r.id}
                  checked={role === r.id}
                  onChange={() => setRole(r.id)}
                  className="sr-only"
                />
                {r.label}
              </label>
            ))}
          </div>
          {err.role ? <p className="text-[14px] text-alert">{err.role}</p> : null}
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Your name" error={err.name}>
            <input
              ref={nameRef}
              name="name"
              defaultValue={v.name}
              autoComplete="name"
              required
              className={`${field} ${err.name ? "border-alert" : "border-line"}`}
              placeholder="Neha Sharma"
            />
          </Field>
          <Field label="Email" error={err.email}>
            <input
              name="email"
              defaultValue={v.email}
              type="email"
              autoComplete="email"
              required
              className={`${field} ${err.email ? "border-alert" : "border-line"}`}
              placeholder="neha@example.com"
            />
          </Field>
          <Field label="WhatsApp number" hint="Optional. Include the country code." error={err.phone}>
            <input
              name="phone"
              defaultValue={v.phone}
              type="tel"
              autoComplete="tel"
              className={`${field} ${err.phone ? "border-alert" : "border-line"}`}
              placeholder="+65 8123 4567"
            />
          </Field>
          <Field label={role === "family" ? "Your city" : "Organisation and city"} error={err.city}>
            <input
              name="city"
              defaultValue={v.city}
              autoComplete="address-level2"
              className={`${field} border-line`}
              placeholder={role === "family" ? "Singapore" : "Asha Care, Lucknow"}
            />
          </Field>
          {role === "family" ? (
            <Field label="Language your parent speaks at home" error={err.language} wide>
              <select name="language" defaultValue={v.language || "Hindi"} className={`${field} border-line appearance-none`}>
                {languages.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </Field>
          ) : null}
        </div>

        <label className="flex items-start gap-3 text-[15px] leading-snug text-body">
          <input name="consent" type="checkbox" defaultChecked={v.consent === "on"} className="mt-[3px] size-5 shrink-0 accent-ink" />
          <span>
            Kin may contact me about the pilot. My details are used for nothing else.
            {err.consent ? <span className="mt-1 block text-[14px] text-alert">{err.consent}</span> : null}
          </span>
        </label>

        {state.status === "error" ? (
          <p role="alert" className="rounded-[14px] bg-alert-soft px-4 py-3 text-[15px] text-alert">
            {state.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-13 items-center justify-center gap-2 rounded-[128px] bg-charcoal px-7 text-[17px] font-medium text-cloud transition-[background,transform] hover:bg-black active:scale-[0.98] disabled:opacity-60"
        >
          {pending ? "Saving…" : "Join the waitlist"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  wide,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-2 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-[15px] font-semibold">{label}</span>
      {children}
      {error ? (
        <span className="text-[14px] text-alert">{error}</span>
      ) : hint ? (
        <span className="text-[13px] text-body">{hint}</span>
      ) : null}
    </label>
  );
}
