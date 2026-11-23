import type { ReactNode } from "react";

// Screens are designed at iPhone logical size (393 × 852) and scaled with CSS
// zoom, so every screen can be written with real iOS type sizes. The frame is
// /art/iphone-frame.webp (979 × 2000, screen punched out); the screen sits in
// the measured opening underneath and the frame, Dynamic Island included, is
// laid over the top.
const SCREEN_W = 393;
const SCREEN_H = 852;
const OPENING = { left: 0.053, top: 0.025, width: 0.894, height: 0.95 };
const FRAME_RATIO = 2000 / 979;
// The screen background bleeds this far (fraction of frame width) under the
// opaque bezel, so sub-pixel rounding never leaves a light seam at the edges.
const BLEED = 0.006;

export function Phone({
  width = 300,
  tone = "light",
  className = "",
  children,
  label,
}: {
  width?: number;
  tone?: "light" | "dark";
  className?: string;
  children: ReactNode;
  label?: string;
}) {
  const screenW = width * OPENING.width;
  const bleed = width * BLEED;
  const boxW = screenW + bleed * 2;
  const boxH = width * FRAME_RATIO * OPENING.height + bleed * 2;
  const zoom = screenW / SCREEN_W;
  return (
    <div
      role="img"
      aria-label={label}
      className={`relative shrink-0 drop-shadow-[0_30px_40px_rgba(20,30,60,0.22)] ${className}`}
      style={{ width, height: width * FRAME_RATIO }}
    >
      <div
        className={`absolute overflow-hidden ${tone === "dark" ? "bg-charcoal" : "mesh-light"}`}
        style={{
          left: width * OPENING.left - bleed,
          top: width * FRAME_RATIO * OPENING.top - bleed,
          width: boxW,
          height: boxH,
          borderRadius: "17% / 8%",
        }}
      >
        <div
          aria-hidden
          className={`relative text-left ${tone === "dark" ? "text-white" : "text-ink"}`}
          // Stretch to the whole (bled) opening so full-bleed screens reach every edge.
          style={{ width: boxW / zoom, height: Math.max(SCREEN_H, boxH / zoom), zoom }}
        >
          <StatusBar tone={tone} />
          {children}
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- static frame overlay */}
      <img
        src="/art/iphone-frame.webp"
        alt=""
        className="pointer-events-none absolute inset-0 size-full select-none"
        draggable={false}
      />
    </div>
  );
}

// iOS status bar: the time and the system icons each sit centred in the
// "ears" either side of the Dynamic Island (iPhone 15/16 Pro geometry).
function StatusBar({ tone }: { tone: "light" | "dark" }) {
  const c = tone === "dark" ? "#fff" : "#000";
  return (
    <div className="absolute inset-x-0 top-0 z-20 flex h-[54px] items-center pt-[6px]" style={{ color: c }}>
      <span className="flex flex-1 justify-center pl-[14px]">
        <span className="text-[17px] leading-[22px] font-semibold tracking-[-0.41px]">9:41</span>
      </span>
      <span className="w-[125px] shrink-0" />
      <span className="flex flex-1 items-center justify-center gap-[7px] pr-[14px]">
        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor" aria-hidden>
          <rect x="0" y="7.5" width="3.2" height="4.5" rx="1" />
          <rect x="4.8" y="5.2" width="3.2" height="6.8" rx="1" />
          <rect x="9.6" y="2.7" width="3.2" height="9.3" rx="1" />
          <rect x="14.4" y="0" width="3.2" height="12" rx="1" />
        </svg>
        <svg width="16" height="12" viewBox="-0.5 -0.6 16.3 12.2" fill="currentColor" stroke="currentColor" strokeWidth="0.6" strokeLinejoin="round" aria-hidden>
          <path d="M7.65 10.9L5.22 8.38A3.5 3.5 0 0 1 10.08 8.38Z" />
          <path d="M2.37 5.43A7.6 7.6 0 0 1 12.93 5.43L11.26 7.16A5.2 5.2 0 0 0 4.04 7.16Z" />
          <path d="M0.08 3.06A10.9 10.9 0 0 1 15.22 3.06L14.04 4.28A9.2 9.2 0 0 0 1.26 4.28Z" />
        </svg>
        <svg width="27" height="13" viewBox="0 0 27 13" aria-hidden>
          <rect x=".5" y=".5" width="24" height="12" rx="3.8" fill="none" stroke="currentColor" strokeOpacity=".35" />
          <rect x="2" y="2" width="21" height="9" rx="2.4" fill="currentColor" />
          <path d="M25.8 4.4v4.2a2.2 2.2 0 0 0 0-4.2Z" fill="currentColor" fillOpacity=".4" />
        </svg>
      </span>
    </div>
  );
}
