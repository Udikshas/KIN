import type { ReactNode } from "react";

// Building blocks for the Kin app mockups, in the iOS 26 "Liquid Glass"
// idiom: a soft mesh wallpaper (set by <Phone>), translucent glass cards with
// a specular top edge, glass toolbar buttons and a floating glass tab bar.

export const metric = {
  green: "#31ce01",
  blue: "#415eee",
  lilac: "#9d86ff",
  coral: "#ff8f70",
  gold: "#ffb800",
};

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/avatars/${name}.svg`} alt="" width={size} height={size} className="shrink-0 rounded-full" />
  );
}

/** Concentric progress rings, Apple-Fitness style. Values are 0–1. */
export function Rings({
  size = 120,
  stroke = 12,
  gap = 3,
  rings,
}: {
  size?: number;
  stroke?: number;
  gap?: number;
  rings: { value: number; color: string; to?: string }[];
}) {
  const c = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 overflow-visible">
      <defs>
        {rings.map((r, i) => (
          <linearGradient key={i} id={`rg-${r.color.slice(1)}-${i}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={r.to ?? r.color} />
            <stop offset="1" stopColor={r.color} />
          </linearGradient>
        ))}
      </defs>
      {rings.map((r, i) => {
        const radius = c - stroke / 2 - i * (stroke + gap);
        const len = 2 * Math.PI * radius;
        return (
          <g key={i}>
            <circle cx={c} cy={c} r={radius} fill="none" stroke={r.color} strokeOpacity=".14" strokeWidth={stroke} />
            <circle
              cx={c}
              cy={c}
              r={radius}
              fill="none"
              stroke={`url(#rg-${r.color.slice(1)}-${i})`}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${len * r.value} ${len}`}
              style={{ filter: `drop-shadow(0 0 6px ${r.color}55)` }}
            />
          </g>
        );
      })}
    </svg>
  );
}

export function Ring({
  value,
  color,
  size = 54,
  stroke = 6,
  children,
  textClass = "text-[13px]",
}: {
  value: number;
  color: string;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  textClass?: string;
}) {
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <div className="absolute inset-0">
        <Rings size={size} stroke={stroke} rings={[{ value, color }]} />
      </div>
      <span className={`relative font-semibold tracking-[-0.03em] ${textClass}`}>{children}</span>
    </div>
  );
}

export function Pill({ tone, children }: { tone: "ok" | "watch" | "alert" | "plain"; children: ReactNode }) {
  const styles = {
    ok: "text-ok",
    watch: "text-watch",
    alert: "text-alert",
    plain: "text-ink",
  }[tone];
  return (
    <span className={`glass inline-flex items-center gap-[6px] rounded-full px-[11px] py-[5px] text-[13px] font-semibold ${styles}`}>
      {tone !== "plain" ? <i className="block size-[7px] rounded-full bg-current shadow-[0_0_6px_currentColor]" /> : null}
      {children}
    </span>
  );
}

export function GlassButton({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`glass grid size-[44px] shrink-0 place-items-center rounded-full text-ink ${className}`}>
      {children}
    </span>
  );
}

export const icon = {
  bell: "M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 21h4",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  back: "M15 5l-7 7 7 7",
  plus: "M12 5v14M5 12h14",
  share: "M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6",
  phone:
    "M6.6 3.5h2.8l1.4 4-2 1.3a11 11 0 0 0 6.4 6.4l1.3-2 4 1.4v2.8c0 1-.8 1.8-1.8 1.8C10.8 19.2 4.8 13.2 4.8 5.3c0-1 .8-1.8 1.8-1.8Z",
};

export function Icon({ d, size = 20, width = 2 }: { d: string; size?: number; width?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

/** iOS 26 style: glass toolbar buttons on top, large title underneath. */
export function ScreenHeader({ kicker, title, right }: { kicker?: string; title: string; right?: ReactNode }) {
  return (
    <div className="px-[18px] pt-[58px]">
      <div className="flex items-center justify-between">
        <span className="glass flex items-center gap-[8px] rounded-full py-[4px] pr-[14px] pl-[4px]">
          <Avatar name="amma" size={36} />
          <span className="text-[15px] font-semibold">Amma</span>
        </span>
        <div className="flex items-center gap-[8px]">
          {right}
          <GlassButton>
            <Icon d={icon.more} width={3} />
          </GlassButton>
        </div>
      </div>
      <div className="px-[4px] pt-[14px] pb-[14px]">
        {kicker ? <p className="text-[14px] font-medium text-body">{kicker}</p> : null}
        <h2 className="mt-[2px] text-[34px] leading-none font-semibold tracking-[-0.035em]">{title}</h2>
      </div>
    </div>
  );
}

const tabs = [
  { id: "today", label: "Today" },
  { id: "calls", label: "Calls" },
  { id: "trends", label: "Trends" },
  { id: "family", label: "Family" },
] as const;
type TabId = (typeof tabs)[number]["id"];

/**
 * The app's own tab icons (apps/mobile/src/components/tab-icons.tsx). Inactive:
 * thin outline. Active: the same shape with a soft tint, a firmer stroke and its
 * detail in solid colour.
 */
function TabIcon({ id, on }: { id: TabId; on: boolean }) {
  const stroke = { stroke: "currentColor", strokeWidth: on ? 2 : 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const fill = on ? { fill: "currentColor", fillOpacity: 0.2 } : { fill: "none" };
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden>
      {id === "today" ? (
        <>
          <rect x="3.5" y="5" width="17" height="15.5" rx="4" {...fill} {...stroke} />
          <path d="M8 3v3.5M16 3v3.5M3.5 10h17" fill="none" {...stroke} />
          <path d="m9 15 2 2 4-4" fill="none" {...stroke} strokeWidth={on ? 2.2 : 1.7} />
        </>
      ) : id === "calls" ? (
        <path
          d="M7.4 3.5c.6 0 1.1.4 1.3.9l1.3 3.2c.2.6.1 1.2-.4 1.6l-1.5 1.3a12 12 0 0 0 5.4 5.4l1.3-1.5c.4-.5 1-.6 1.6-.4l3.2 1.3c.5.2.9.7.9 1.3V19c0 .8-.7 1.5-1.5 1.5C10.6 20.5 3.5 13.4 3.5 5c0-.8.7-1.5 1.5-1.5Z"
          {...fill}
          {...stroke}
        />
      ) : id === "trends" ? (
        <>
          <rect x="3.5" y="13" width="4.5" height="7.5" rx="1.6" {...fill} {...stroke} />
          <rect x="9.75" y="8.5" width="4.5" height="12" rx="1.6" {...fill} {...stroke} />
          <rect x="16" y="4" width="4.5" height="16.5" rx="1.6" fill={on ? "currentColor" : "none"} {...stroke} />
        </>
      ) : (
        <>
          <circle cx="9" cy="8" r="3.3" {...fill} {...stroke} />
          <path d="M3 19.5c0-3.3 2.7-5.8 6-5.8s6 2.5 6 5.8z" {...fill} {...stroke} />
          <path d="M15.5 4.9a3.2 3.2 0 0 1 0 6.2M17.5 14c2 .7 3.5 2.8 3.5 5.5" fill="none" {...stroke} />
        </>
      )}
    </svg>
  );
}

/** Floating glass tab bar with the call button split off, as in the iOS 26 app. */
export function TabBar({ active }: { active: TabId }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 px-[14px] pb-[10px]">
      <div className="flex items-center gap-[10px]">
        <div className="flex flex-1 rounded-full border border-white/90 bg-white/80 p-[5px] shadow-[inset_0_1px_1px_rgb(255_255_255),0_18px_36px_-16px_rgb(40_50_110/0.35)] backdrop-blur-xl">
          {tabs.map((t) => {
            const on = t.id === active;
            return (
              <div
                key={t.id}
                className={`flex h-[54px] flex-1 flex-col items-center justify-center gap-[2px] rounded-full ${
                  on ? "bg-ink/[0.07] text-blue" : "text-ink/60"
                }`}
              >
                <TabIcon id={t.id} on={on} />
                <span className={`text-[10.5px] ${on ? "font-bold" : "font-medium"}`}>{t.label}</span>
              </div>
            );
          })}
        </div>
        <span className="grid size-[64px] shrink-0 place-items-center rounded-full border border-white/15 bg-gradient-to-br from-[#3d3f4a] to-charcoal text-white shadow-[0_8px_14px_-4px_rgb(31_32_37/0.45)]">
          <Icon d="M6.6 5.5h2.8l1.4 4-2 1.3a11 11 0 0 0 6.4 6.4l1.3-2 4 1.4v2.8c0 1-.8 1.8-1.8 1.8C10.8 21.2 4.8 15.2 4.8 7.3c0-1 .8-1.8 1.8-1.8ZM15 3a6 6 0 0 1 6 6M15 6.5A2.5 2.5 0 0 1 17.5 9" size={25} />
        </span>
      </div>
      <div className="mx-auto mt-[12px] h-[5px] w-[134px] rounded-full bg-black" />
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`glass rounded-[28px] p-[16px] ${className}`}>{children}</div>;
}

export function Check({ done = true }: { done?: boolean }) {
  return done ? (
    <span className="grid size-[26px] place-items-center rounded-full bg-gradient-to-b from-[#4ade1a] to-ok text-white shadow-[0_4px_10px_-3px_rgba(35,163,0,0.6)]">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="m2.5 6.3 2.3 2.2 4.7-5" />
      </svg>
    </span>
  ) : (
    <span className="size-[26px] rounded-full border-2 border-ink/15 bg-white/40" />
  );
}
