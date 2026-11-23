"use client";

import { useEffect, useState } from "react";

const links = [
  { href: "#app", label: "The app" },
  { href: "#call", label: "Hear a call" },
  { href: "#privacy", label: "Privacy" },
  { href: "#plans", label: "Plans" },
];

export function Nav() {
  // Slide out of view while scrolling down, back in on any scroll up.
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (Math.abs(y - last) < 6) return;
        setHidden(y > last && y > 80);
        last = y;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <header
      className={`pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4 transition-transform duration-300 ease-out focus-within:translate-y-0 motion-reduce:transition-none ${
        hidden ? "-translate-y-[calc(100%+24px)]" : "translate-y-0"
      }`}
    >
      <div className="pointer-events-auto flex h-14 items-center gap-6 rounded-[32px] border border-white/70 bg-white/75 py-2 pr-2 pl-5 shadow-chip backdrop-blur-xl">
        <a href="#top" aria-label="Kin home" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/kin-mark.svg" alt="" width={26} height={26} />
          <span className="text-lg font-semibold tracking-[-0.03em]">Kin</span>
        </a>
        <nav aria-label="Main" className="hidden items-center gap-6 text-[15px] text-body md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-ink">
              {l.label}
            </a>
          ))}
        </nav>
        <a href="/dashboard" className="inline-flex h-10 items-center rounded-[128px] bg-charcoal px-5 text-[15px] font-medium text-cloud transition-colors hover:bg-black">
          Sign in
        </a>
      </div>
    </header>
  );
}
