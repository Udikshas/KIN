import { Section, SectionHead, StatusDot } from "../ui/section";

const rungs = [
  {
    tone: "ok" as const,
    level: "Green",
    title: "Kin handles it",
    when: "A normal day",
    items: ["Reminders and reassurance", "Orientation for memory loss", "Evening card to the family"],
  },
  {
    tone: "watch" as const,
    level: "Amber",
    title: "Family alerted",
    when: "A trend over several days",
    items: ["Push alert with the evidence", "Missed doses, worse sleep, slower speech", "A suggested question for your next call"],
  },
  {
    tone: "alert" as const,
    level: "Red",
    title: "A person joins",
    when: "Concern, or no answer",
    items: ["Kin connects your parent to you on the spot", "Teleconsult opens with a 30-day summary", "Three missed calls in a row"],
  },
];

export function Ladder() {
  return (
    <Section>
      <SectionHead
        eyebrow="The escalation ladder"
        title="Alerts come from trends over days, never from one sentence. Every red goes to a person."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {rungs.map((r) => (
          <div key={r.level} className="flex min-w-0 flex-col gap-4 rounded-card bg-taupe p-7 sm:p-8">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-hairline bg-eggshell px-3 py-1 text-[13px]">
              <StatusDot tone={r.tone} />
              {r.level}
            </span>
            <div>
              <h3 className="text-[26px] leading-tight font-light tracking-[-0.02em]">{r.title}</h3>
              <p className="mt-1 font-mono text-[12px] text-smoke">{r.when}</p>
            </div>
            <ul className="flex flex-col gap-2 border-t border-stone pt-4 text-[15px] text-graphite">
              {r.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}
