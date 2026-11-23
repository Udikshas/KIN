import type { ReactNode } from "react";

export function Section({
  id,
  band = false,
  children,
  className = "",
}: {
  id?: string;
  band?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`${band ? "bg-taupe" : "bg-eggshell"} py-20 sm:py-28 ${className}`}
    >
      <div className="mx-auto max-w-[1280px] px-4 sm:px-8 lg:px-16">{children}</div>
    </section>
  );
}

export function SectionHead({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
}) {
  return (
    <div className="mb-12 flex max-w-3xl flex-col gap-4 sm:mb-16">
      <p className="font-mono text-[13px] text-smoke">{eyebrow}</p>
      <h2 className="text-[32px] leading-[1.12] font-light tracking-[-0.02em] sm:text-[40px]">
        {title}
      </h2>
      {lede ? <p className="max-w-2xl text-lg leading-relaxed text-graphite">{lede}</p> : null}
    </div>
  );
}

export function StatusDot({ tone }: { tone: "ok" | "watch" | "alert" }) {
  const color = { ok: "bg-ok", watch: "bg-watch", alert: "bg-alert" }[tone];
  return <span aria-hidden className={`inline-block size-2 shrink-0 rounded-full ${color}`} />;
}
