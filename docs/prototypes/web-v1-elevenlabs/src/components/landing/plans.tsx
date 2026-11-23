import { PillLink } from "../ui/pill-link";
import { Section, SectionHead } from "../ui/section";

const plans = [
  {
    name: "Families",
    price: "₹599",
    unit: "/ month",
    note: "S$39 a month when you live in Singapore and your parent lives in India.",
    items: ["One call a day, in their language", "Evening card in the Kin app", "Amber and red alerts"],
    cta: "Set up calls for a parent",
    main: true,
  },
  {
    name: "Senior centres and NGOs",
    price: "Per senior",
    unit: "licence",
    note: "Reach every senior on your list, with one console for the whole centre.",
    items: ["Bulk onboarding", "Staff alerts and call notes", "Monthly wellbeing reports"],
    cta: "Talk to us",
    main: false,
  },
  {
    name: "Insurers and health systems",
    price: "Pilots",
    unit: "open",
    note: "Catch a decline weeks before it becomes an admission.",
    items: ["Consented, anonymised trends", "Teleconsult handoff", "Outcome reporting"],
    cta: "Start a pilot",
    main: false,
  },
];

export function Plans() {
  return (
    <Section id="plans">
      <SectionHead
        eyebrow="Pilot pricing"
        title="Less than a day of paid care, for a month of daily calls."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.name}
            className={`flex min-w-0 flex-col gap-5 rounded-panel p-7 sm:p-8 ${
              p.main ? "bg-ink text-eggshell" : "bg-taupe text-ink"
            }`}
          >
            <h3 className="font-medium">{p.name}</h3>
            <p className="text-[44px] leading-none font-light tracking-[-0.03em] tabular-nums">
              {p.price}
              <span className={`ml-2 text-base tracking-normal ${p.main ? "text-ash" : "text-smoke"}`}>{p.unit}</span>
            </p>
            <p className={`text-[15px] leading-relaxed ${p.main ? "text-stone" : "text-graphite"}`}>{p.note}</p>
            <ul
              className={`flex flex-col gap-2 border-t pt-4 text-[15px] ${
                p.main ? "border-white/15 text-stone" : "border-stone text-graphite"
              }`}
            >
              {p.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
            <PillLink href="#top" variant={p.main ? "inverse" : "outline"} className="mt-auto w-fit">
              {p.cta}
            </PillLink>
          </div>
        ))}
      </div>
    </Section>
  );
}
