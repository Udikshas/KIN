// Copied from apps/mobile/src/lib/theme.ts. Kin design tokens, the same as apps/web/src/app/globals.css.

export const color = {
  paper: "#ffffff",
  cloud: "#ebf0f8",
  mist: "#f4f7fb",
  line: "#e3e8f0",
  ink: "#222326",
  charcoal: "#1f2025",
  body: "#747679",
  faint: "#a3a6ab",
  ok: "#23a300",
  okSoft: "#e6f7df",
  watch: "#c77700",
  watchSoft: "#fff4d6",
  alert: "#e5484d",
  alertSoft: "#fde8e8",
};

/** Metric colours (app kit, deeper variants). Product visuals only, never buttons. */
export const metric = {
  green: "#31ce01",
  blue: "#415eee",
  lilac: "#9d86ff",
  coral: "#ff8f70",
  gold: "#ffb800",
};

export const radius = { card: 28, tile: 24, input: 14, pill: 128 };

/** Large-title style used at the top of every screen. */
export const display = {
  fontWeight: "600" as const,
  letterSpacing: -1.3,
  color: color.ink,
};

/** iOS-like soft glass: translucent white, bright hairline, tinted shadow. */
export const glass = {
  backgroundColor: "rgba(255,255,255,0.62)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.85)",
  shadowColor: "#28326e",
  shadowOpacity: 0.12,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 10 },
  elevation: 2,
};

export const glassDark = {
  backgroundColor: "rgba(255,255,255,0.1)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.16)",
};
