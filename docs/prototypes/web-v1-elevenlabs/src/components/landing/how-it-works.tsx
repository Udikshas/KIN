import { Section, SectionHead } from "../ui/section";

const steps = [
  {
    title: "Talks",
    body: "Kin calls in the language or dialect they speak at home. The first call starts with you on the line, so they know who sent it.",
  },
  {
    title: "Checks",
    body: "Pain, sleep, appetite, mood and who visited. Each answer is compared with what they said last week.",
  },
  {
    title: "Reminds",
    body: "“Amma, did you take the white tablet?” Kin confirms she did, instead of only sounding an alarm.",
  },
  {
    title: "Remembers",
    body: "For memory loss, Kin answers the fortieth question as patiently as the first.",
  },
  {
    title: "Reports",
    body: "One card reaches the family each evening. No dashboard to learn.",
  },
];

export function HowItWorks() {
  return (
    <Section id="how">
      <SectionHead
        eyebrow="How a call works"
        title="Two to four minutes, once a day, at the time your parent chooses."
      />
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((s, i) => (
          <li key={s.title} className="flex min-w-0 flex-col gap-3 rounded-card bg-taupe p-6 sm:p-7">
            <span className="font-mono text-[13px] text-ash">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="text-xl font-medium tracking-[-0.01em]">{s.title}</h3>
            <p className="text-[15px] leading-relaxed text-graphite">{s.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
