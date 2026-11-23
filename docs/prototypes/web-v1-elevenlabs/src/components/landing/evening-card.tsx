import { Section, StatusDot } from "../ui/section";

const rows = [
  { label: "Medicine", value: "2 of 2 taken", detail: "She confirmed the white tablet after breakfast" },
  { label: "Sleep", value: "About 6 hours", detail: "1 hour less than her usual" },
  { label: "Mood", value: "Cheerful", detail: "Talked about buying a sari for Diwali" },
];

export function EveningCard() {
  return (
    <Section band>
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div className="flex flex-col gap-6">
          <p className="font-mono text-[13px] text-smoke">What you hear on the phone</p>
          <p className="text-[56px] leading-none font-light tracking-[-0.03em] sm:text-[80px]">
            “I am fine.”
          </p>
          <p className="max-w-md text-lg leading-relaxed text-graphite">
            Every call home gets the same answer. Kin hears the rest and sends it to you each
            evening, in a card you can read in ten seconds.
          </p>
        </div>

        <article
          aria-label="Example evening card"
          className="flex flex-col gap-5 rounded-panel bg-eggshell p-6 shadow-lift sm:p-8"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-medium">Amma&apos;s day</h3>
              <p className="mt-1 font-mono text-[13px] text-smoke">Thursday 9 October · call 3 min 40 s</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-ok-soft px-3 py-1 text-[13px] font-medium text-ok">
              <StatusDot tone="ok" />
              Normal day
            </span>
          </div>
          <dl className="divide-y divide-stone border-t border-stone">
            {rows.map((r) => (
              <div key={r.label} className="grid gap-1 py-3.5 sm:grid-cols-[120px_1fr] sm:gap-4">
                <dt className="pt-0.5 font-mono text-[12px] tracking-wide text-smoke uppercase">{r.label}</dt>
                <dd>
                  <span className="text-[15px]">{r.value}</span>
                  <span className="block text-[13px] text-smoke">{r.detail}</span>
                </dd>
              </div>
            ))}
            <div className="grid gap-1 py-3.5 sm:grid-cols-[120px_1fr] sm:gap-4">
              <dt className="pt-0.5 font-mono text-[12px] tracking-wide text-smoke uppercase">Watch</dt>
              <dd>
                <span className="inline-flex items-center gap-2 text-[15px] font-medium text-watch">
                  <StatusDot tone="watch" />
                  Knee pain, third day in a row
                </span>
                <span className="block text-[13px] text-smoke">Worse than yesterday, by her own account</span>
              </dd>
            </div>
          </dl>
          <p className="text-[15px] text-graphite">She asked if you can call on Sunday.</p>
        </article>
      </div>
    </Section>
  );
}
