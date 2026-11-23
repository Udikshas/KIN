import type { ComponentProps, ReactNode } from "react";

/*
  Pill with an icon disc: white with a Charcoal disc, or (tone="dark") Charcoal
  with a white disc. Discs are opaque so the wash never shows through them.
  `plain` turns off the hover wash and disc zoom (the nav button). On hover a blurred wash of the hero-sky
  colours rises into its bottom 40% and drifts sideways (`.sky-wash` in
  globals.css). Used for the hero "Hear a call" and the nav and footer "Try it out".
*/
const sizes = {
  sm: "h-10 pr-4 pl-1 text-[15px]",
  md: "h-11 pr-5 pl-1.5 text-base",
  lg: "h-13 pr-7 pl-2.5 text-[17px]",
};

const tones = {
  light: { pill: "bg-paper text-ink", disc: "bg-charcoal text-cloud" },
  dark: { pill: "bg-charcoal text-cloud transition-colors hover:bg-black", disc: "bg-paper text-ink" },
};

export function WashPill({
  icon,
  size = "lg",
  tone = "light",
  plain = false,
  children,
  className = "",
  ...props
}: ComponentProps<"a"> & {
  icon: ReactNode;
  size?: keyof typeof sizes;
  tone?: keyof typeof tones;
  /** No hover wash and no disc zoom. */
  plain?: boolean;
}) {
  return (
    <a
      className={`group relative isolate inline-flex items-center justify-center gap-2 overflow-hidden rounded-[128px] font-medium shadow-chip ${tones[tone].pill} ${sizes[size]} ${className}`}
      {...props}
    >
      {/* Own clip box: Safari ignores overflow+radius for blurred/blended children. */}
      {plain ? null : (
        <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit] [clip-path:inset(0_round_9999px)]">
          <span className="sky-wash" />
        </span>
      )}
      <span aria-hidden className={`grid size-8 place-items-center rounded-full ${plain ? "" : "transition-transform group-hover:scale-110"} ${tones[tone].disc}`}>
        {icon}
      </span>
      {children}
    </a>
  );
}

export function PlayGlyph() {
  return (
    <svg width="11" height="12" viewBox="0 0 16 18" aria-hidden>
      <path d="M2 1.5v15l13-7.5z" fill="currentColor" />
    </svg>
  );
}

export function PhoneGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M6.6 10.8a15.2 15.2 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.1.37 2.3.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1l-2.2 2.23Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
