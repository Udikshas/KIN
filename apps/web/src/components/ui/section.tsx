import type { ReactNode } from "react";

export function Section({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-24 py-20 ${className}`}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-8">{children}</div>
    </section>
  );
}

export function SectionHead({
  title,
  lede,
  align = "center",
}: {
  title: ReactNode;
  lede?: ReactNode;
  align?: "center" | "left";
}) {
  return (
    <div
      className={`mb-12 flex flex-col gap-5 sm:mb-16 ${
        align === "center" ? "mx-auto max-w-3xl items-center text-center" : "max-w-2xl"
      }`}
    >
      <h2 className="display text-[40px] sm:text-[56px] lg:text-[64px]">{title}</h2>
      {lede ? <p className="max-w-2xl text-lg leading-[1.3] text-body sm:text-2xl">{lede}</p> : null}
    </div>
  );
}

export function StatusDot({ tone }: { tone: "ok" | "watch" | "alert" }) {
  const color = { ok: "bg-ok", watch: "bg-watch", alert: "bg-alert" }[tone];
  return <span aria-hidden className={`inline-block size-2 shrink-0 rounded-full ${color}`} />;
}
