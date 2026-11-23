"use client";

// Building blocks for the family dashboard (/dashboard): the same Bevel tokens
// as the landing page (globals.css) and the same glass cards, rings and pills
// as the Kin app, laid out for a desktop browser.

import Link from "next/link";
import { useEffect, useRef, type ComponentProps, type ReactNode } from "react";

export { Ring, Rings } from "@/components/app/kit";

export const icon = {
  today: "M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z",
  calls: "M4 6h16M4 12h16M4 18h10",
  trends: "M4 18 9 12l4 3 7-9",
  family: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9c0-3.3 2.7-6 6-6s6 2.7 6 6M16.5 10.5a3 3 0 1 0 0-6M18 14c2 .6 3.5 2.6 3.5 5",
  pill: "M10.5 20.5 3.5 13.5a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7ZM8.5 8.5l7 7",
  basket: "M5 9h14l-1.5 10a1 1 0 0 1-1 .9h-9a1 1 0 0 1-1-.9zM9 9l3-5 3 5",
  message: "M4 5h16v11H8l-4 4z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c0-3.9 3.1-7 7-7s7 3.1 7 7",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4.9a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.5a7 7 0 0 0-2 1.2l-2.4-.9-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-.9a7 7 0 0 0 2 1.2L10 21h4l.5-2.5a7 7 0 0 0 2-1.2l2.4.9 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",
  phone: "M6.6 3.5h2.8l1.4 4-2 1.3a11 11 0 0 0 6.4 6.4l1.3-2 4 1.4v2.8c0 1-.8 1.8-1.8 1.8C10.8 19.2 4.8 13.2 4.8 5.3c0-1 .8-1.8 1.8-1.8Z",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 21h4",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z",
  chevron: "M9 6l6 6-6 6",
  back: "M15 5l-7 7 7 7",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6 6 18",
  check: "m5 12.5 4.5 4.5L19 7",
  doc: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  out: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
  menu: "M4 7h16M4 12h16M4 17h16",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  cart: "M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6M9 20h.01M17 20h.01",
};

export function Icon({ d, size = 20, width = 2, className = "" }: { d: string; size?: number; width?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

const AVATARS = ["amma", "nani", "dadi", "kamala", "aunty", "papa", "dadaji", "joseph", "turban", "neha", "priya", "rahul", "lotus", "chai", "sun"];
export const avatarNames = AVATARS;

/** The app's illustrated avatars, else the first letter on a soft wash. */
export function Avatar({ name, label, size = 40 }: { name?: string; label?: string; size?: number }) {
  if (name && AVATARS.includes(name))
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/avatars/${name}.svg`} alt="" width={size} height={size} className="shrink-0 rounded-full" />;
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#d9cdff] to-[#ffd2c2] font-semibold text-ink"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {(label ?? "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}

export function Card({ children, className = "", tone = "cloud" }: { children: ReactNode; className?: string; tone?: "cloud" | "glass" | "white" }) {
  const t = { cloud: "bg-cloud", glass: "glass", white: "bg-paper border border-line" }[tone];
  return <section className={`rounded-[28px] p-5 ${t} ${className}`}>{children}</section>;
}

export function CardTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h3 className="text-[16px] font-semibold tracking-[-0.01em]">{children}</h3>
      {right ? <div className="text-[13px] text-body">{right}</div> : null}
    </div>
  );
}

type Variant = "filled" | "soft" | "white" | "danger" | "ghost";
const variants: Record<Variant, string> = {
  filled: "bg-charcoal text-cloud hover:bg-black",
  soft: "bg-cloud text-ink hover:bg-line",
  white: "bg-paper text-ink hover:bg-mist border border-line",
  danger: "bg-alert-soft text-alert hover:bg-[#fbd5d5]",
  ghost: "text-ink hover:bg-ink/[0.05]",
};

export function Button({
  variant = "filled",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: "sm" | "md" }) {
  const sizes = { sm: "h-9 px-4 text-[14px]", md: "h-11 px-5 text-[15px]" }[size];
  return (
    <button
      type="button"
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-[128px] font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${sizes} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "filled",
  size = "md",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: "sm" | "md" }) {
  const sizes = { sm: "h-9 px-4 text-[14px]", md: "h-11 px-5 text-[15px]" }[size];
  return (
    <Link
      className={`inline-flex items-center justify-center gap-2 rounded-[128px] font-medium whitespace-nowrap transition-colors ${sizes} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

/** An outside link (WhatsApp, Amazon, shops): opens in a new tab. */
export function OutLink({ variant = "soft", size = "md", className = "", ...props }: ComponentProps<"a"> & { variant?: Variant; size?: "sm" | "md" }) {
  const sizes = { sm: "h-9 px-4 text-[14px]", md: "h-11 px-5 text-[15px]" }[size];
  return (
    <a
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-[128px] font-medium whitespace-nowrap transition-colors ${sizes} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function Dot({ color, className = "" }: { color: string; className?: string }) {
  return <i className={`block size-[9px] shrink-0 rounded-full ${className}`} style={{ backgroundColor: color }} />;
}

export function StatusPill({ tone, children }: { tone: "ok" | "watch" | "alert" | "plain"; children: ReactNode }) {
  const t = { ok: "bg-ok-soft text-ok", watch: "bg-watch-soft text-watch", alert: "bg-alert-soft text-alert", plain: "bg-paper text-ink" }[tone];
  return (
    <span className={`inline-flex items-center gap-[6px] rounded-full px-[10px] py-[3px] text-[12.5px] font-semibold ${t}`}>
      {tone !== "plain" ? <i className="block size-[6px] rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

export function PageHead({ kicker, title, right }: { kicker?: ReactNode; title: ReactNode; right?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {kicker ? <p className="text-[14px] font-medium text-body">{kicker}</p> : null}
        <h1 className="display mt-1 text-[34px] sm:text-[44px]">{title}</h1>
      </div>
      {right ? <div className="flex flex-wrap items-center gap-2">{right}</div> : null}
    </header>
  );
}

export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <span className="mb-1.5 flex items-baseline justify-between gap-2 px-1 text-[13px] font-semibold text-body">
      {children}
      {hint ? <span className="font-normal text-faint">{hint}</span> : null}
    </span>
  );
}

export const inputClass =
  "h-11 w-full rounded-[14px] border border-line bg-paper px-3.5 text-[15px] text-ink outline-none placeholder:text-faint transition-shadow focus:border-ink/50 focus:shadow-[0_0_0_4px_rgb(34_35_38/0.07)] focus:outline-none disabled:opacity-50";

export function Input({ label, hint, error, className = "", ...props }: ComponentProps<"input"> & { label?: ReactNode; hint?: ReactNode; error?: string }) {
  return (
    <label className={`block ${className}`}>
      {label ? <Label hint={hint}>{label}</Label> : null}
      <input className={`${inputClass} ${error ? "border-alert" : ""}`} aria-invalid={Boolean(error)} {...props} />
      {error ? <span className="mt-1 block px-1 text-[13px] text-alert">{error}</span> : null}
    </label>
  );
}

export function Textarea({ label, hint, className = "", ...props }: ComponentProps<"textarea"> & { label?: ReactNode; hint?: ReactNode }) {
  return (
    <label className={`block ${className}`}>
      {label ? <Label hint={hint}>{label}</Label> : null}
      <textarea className={`${inputClass} h-auto min-h-[88px] py-2.5 leading-[1.45]`} {...props} />
    </label>
  );
}

export function Select({ label, className = "", children, ...props }: ComponentProps<"select"> & { label?: ReactNode }) {
  return (
    <label className={`block ${className}`}>
      {label ? <Label>{label}</Label> : null}
      <select className={`${inputClass} cursor-pointer appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9`} style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23747679' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }} {...props}>
        {children}
      </select>
    </label>
  );
}

export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (on: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-[31px] w-[51px] shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-50 ${on ? "bg-ok" : "bg-ink/15"}`}
    >
      <span className={`absolute top-[2px] size-[27px] rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.2)] transition-all ${on ? "left-[22px]" : "left-[2px]"}`} />
    </button>
  );
}

/** Segmented choice (call length, ranges). */
export function Segment<T extends string | number>({ options, value, onChange, label }: { options: readonly T[]; value: T; onChange: (v: T) => void; label?: (v: T) => string }) {
  return (
    <div className="inline-flex rounded-full bg-paper p-1 shadow-[inset_0_0_0_1px_var(--color-line)]">
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          onClick={() => onChange(o)}
          aria-pressed={o === value}
          className={`h-8 cursor-pointer rounded-full px-3.5 text-[13.5px] font-semibold transition-colors ${o === value ? "bg-charcoal text-white" : "text-body hover:text-ink"}`}
        >
          {label ? label(o) : String(o)}
        </button>
      ))}
    </div>
  );
}

/** A centred dialog built on <dialog>: Esc and the backdrop close it. */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`m-auto w-[calc(100%-32px)] rounded-[28px] bg-paper p-0 text-ink shadow-[0_40px_80px_-30px_rgb(20_30_60/0.45)] backdrop:bg-[#1f2025]/40 backdrop:backdrop-blur-[3px] ${wide ? "max-w-[640px]" : "max-w-[480px]"}`}
    >
      {open ? (
        <div className="max-h-[85vh] overflow-y-auto p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-[22px] font-semibold tracking-[-0.02em]">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="-mt-1 -mr-2 grid size-9 cursor-pointer place-items-center rounded-full text-body hover:bg-cloud">
              <Icon d={icon.close} size={18} />
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

export function ErrorText({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="rounded-[14px] bg-alert-soft px-3.5 py-2.5 text-[14px] text-alert">{children}</p>;
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-[24px] border border-dashed border-ink/15 px-6 py-10 text-center">
      <p className="text-[16px] font-semibold">{title}</p>
      {children ? <p className="mx-auto mt-1 max-w-[420px] text-[14px] leading-[1.5] text-body">{children}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** A tappable list row inside a card. */
export function Row({ children, href, onClick, className = "" }: { children: ReactNode; href?: string; onClick?: () => void; className?: string }) {
  const cls = `flex items-center gap-3 rounded-[18px] px-3 py-2.5 transition-colors ${href || onClick ? "cursor-pointer hover:bg-paper/80" : ""} ${className}`;
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={`${cls} w-full text-left`}>
        {children}
      </button>
    );
  return <div className={cls}>{children}</div>;
}
