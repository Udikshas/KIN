import { Section, SectionHead } from "../ui/section";

const promises = [
  {
    title: "Summaries, never recordings",
    body: "The family gets a short card. No one reads a raw transcript or listens to the call.",
  },
  {
    title: "They can pause Kin any time",
    body: "Say “not today” and Kin calls tomorrow. Say “stop” and the calls stop.",
  },
  {
    title: "When Kin isn't sure, it asks",
    body: "If it didn't catch a word, Kin repeats back what it heard. Unclear moments go to a person instead of a guess.",
  },
  {
    title: "A wellbeing check, not a doctor",
    body: "Kin doesn't diagnose or prescribe. It helps the people who do arrive with a clearer picture.",
  },
];

export function Privacy() {
  return (
    <Section id="privacy" band>
      <SectionHead eyebrow="Dignity and privacy" title="Your parent decides what you see." />
      <div className="grid gap-x-16 md:grid-cols-2">
        {promises.map((p) => (
          <div key={p.title} className="flex flex-col gap-2 border-t border-stone py-6">
            <h3 className="font-medium">{p.title}</h3>
            <p className="text-[15px] leading-relaxed text-graphite">{p.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
