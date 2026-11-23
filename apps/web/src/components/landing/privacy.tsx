import { Section, SectionHead } from "../ui/section";

const promises = [
  {
    icon: "M4 6h16M4 12h10M4 18h7",
    title: "Summaries, never recordings",
    body: "The family gets a short card. No one reads a raw transcript or listens to the call.",
  },
  {
    icon: "M8 5v14M16 5v14",
    title: "They can pause Kin any time",
    body: "Say “not today” and Kin calls tomorrow. Say “stop” and the calls stop.",
  },
  {
    icon: "M8 8.5a4 4 0 1 1 5.6 3.7c-1 .4-1.6 1.3-1.6 2.4V15.5M12 19.5v.01",
    title: "When Kin isn't sure, it asks",
    body: "It repeats back what it heard. Unclear moments go to a person instead of a guess.",
  },
  {
    icon: "M12 20s-8-4.9-8-10.6A4.4 4.4 0 0 1 12 6.8a4.4 4.4 0 0 1 8 2.6C20 15.1 12 20 12 20ZM7.5 12.5h2.3l1.3-2.3 1.8 4.3 1.3-2h2.3",
    title: "A wellbeing check, not a doctor",
    body: "Kin doesn't diagnose or prescribe. It helps the people who do arrive with a clearer picture.",
  },
];

export function Privacy() {
  return (
    <Section id="privacy">
      <SectionHead title="Your parent decides what you see" lede="Built for dignity first. Consent is spoken, logged, and can be taken back on any call." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {promises.map((p) => (
          <div key={p.title} className="flex flex-col gap-4 rounded-[24px] bg-cloud p-8">
            <span className="grid size-12 place-items-center rounded-full bg-white">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d={p.icon} />
              </svg>
            </span>
            <h3 className="text-xl font-semibold tracking-[-0.02em]">{p.title}</h3>
            <p className="text-[17px] leading-[1.35] text-body">{p.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
