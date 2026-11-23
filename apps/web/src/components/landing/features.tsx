import type { ReactNode } from "react";
import { Phone } from "../app/phone";
import { AlertScreen, MemoryScreen } from "../app/screens";
import { StatusDot } from "../ui/section";

function FeaturePanel({
  title,
  body,
  wash,
  reverse = false,
  visual,
}: {
  title: ReactNode;
  body: string;
  wash: string;
  reverse?: boolean;
  visual: ReactNode;
}) {
  return (
    <article
      className="relative overflow-hidden rounded-[32px] bg-cloud bg-cover bg-center"
      style={{ backgroundImage: `url(${wash})` }}
    >
      <div
        className={`grid items-center gap-6 px-8 pt-12 sm:px-14 lg:min-h-[640px] lg:grid-cols-2 lg:pt-0 ${
          reverse ? "lg:[&>*:first-child]:order-2" : ""
        }`}
      >
        <div className="flex max-w-md flex-col gap-4">
          <h3 className="display text-[40px] sm:text-[56px] lg:text-[64px]">{title}</h3>
          <p className="text-lg leading-[1.3] text-body sm:text-2xl">{body}</p>
        </div>
        <div className="relative flex h-[520px] justify-center lg:h-[640px]">{visual}</div>
      </div>
    </article>
  );
}

function Chip({ className, children, delay = "0s" }: { className: string; children: ReactNode; delay?: string }) {
  return (
    <div
      className={`absolute z-10 flex animate-float items-center gap-2 rounded-2xl bg-white px-4 py-3 text-[15px] shadow-chip ${className}`}
      style={{ animationDelay: delay }}
    >
      {children}
    </div>
  );
}

const rungs = [
  { tone: "ok" as const, label: "Green", text: "Kin handles it" },
  { tone: "watch" as const, label: "Amber", text: "Family alerted with evidence" },
  { tone: "alert" as const, label: "Red", text: "A person joins the call" },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-24 py-20">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 sm:px-8">
        <FeaturePanel
          title={
            <>
              Remembers
              <br />
              what she said
            </>
          }
          body="Last week's knee, the grandson's exams, the sari for Diwali. Kin picks up the thread so every call feels like the same friend calling back."
          wash="/art/wash-lilac.svg"
          visual={
            <>
              <div className="absolute top-14 lg:top-20">
                <Phone width={300} label="Memory screen: what Kin remembers about Amma">
                  <MemoryScreen />
                </Phone>
              </div>
              <Chip className="top-24 left-0 hidden sm:flex" delay="0.4s">
                <i aria-hidden className="block size-2 rounded-full bg-blue" /> Aarav&apos;s board exams
              </Chip>
              <Chip className="top-64 right-0 hidden sm:flex" delay="1.2s">
                <i aria-hidden className="block size-2 rounded-full bg-gold" /> Left knee, since Tue
              </Chip>
              <Chip className="bottom-28 left-2 hidden sm:flex" delay="2s">
                <i aria-hidden className="block size-2 rounded-full bg-coral" /> Green silk sari
              </Chip>
            </>
          }
        />

        <FeaturePanel
          reverse
          title={
            <>
              Alerts from
              <br />
              trends, not words
            </>
          }
          body="One bad sentence never raises an alarm. Slower speech, worse sleep or missed doses over several days do, with the evidence and a question to ask."
          wash="/art/wash-sky.svg"
          visual={
            <>
              <div className="absolute top-14 lg:top-20">
                <Phone width={300} label="Amber alert screen: Amma is speaking more slowly this week">
                  <AlertScreen />
                </Phone>
              </div>
              <div className="absolute right-0 bottom-24 z-10 hidden w-60 animate-float flex-col gap-3 rounded-[24px] bg-white p-5 shadow-chip sm:flex">
                <p className="text-sm font-semibold">Escalation ladder</p>
                {rungs.map((r) => (
                  <div key={r.label} className="flex items-center gap-3 text-[14px]">
                    <StatusDot tone={r.tone} />
                    <span className="w-14 font-medium">{r.label}</span>
                    <span className="text-body">{r.text}</span>
                  </div>
                ))}
              </div>
            </>
          }
        />
      </div>
    </section>
  );
}
