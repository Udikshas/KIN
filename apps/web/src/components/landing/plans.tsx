import { PillLink } from "../ui/pill-link";
import { Section, SectionHead } from "../ui/section";

const plans = [
  {
    name: "Families",
    price: "₹799",
    unit: "/ month",
    note: "For one parent, wherever you live. Or ₹7,999 a year, two months free.",
    items: ["One call a day, in their language", "Medicine reminder calls", "Evening card in the Kin app", "Amber and red alerts"],
    cta: "Join the waitlist",
    href: "#waitlist",
    main: true,
  },
  {
    name: "Senior centres and NGOs",
    price: "₹349",
    unit: "/ senior / month",
    note: "A licence for each senior on your list: a short daily check-in call, with one console for your staff.",
    items: ["Bulk onboarding from a list", "Staff alerts and call notes", "Monthly wellbeing reports"],
    cta: "Talk to us",
    href: "#waitlist-centre",
    main: false,
  },
  {
    name: "Insurers and health systems",
    price: "Pilot",
    unit: "3 months",
    note: "Start with a group of your members for three months and see what Kin catches. Then ₹599 per member a month.",
    items: ["Consented, anonymised trends", "Teleconsult handoff", "Outcome reporting"],
    cta: "Talk to us",
    href: "#waitlist-insurer",
    main: false,
  },
];

export function Plans() {
  return (
    <Section id="plans">
      <SectionHead title="Less than a day of paid care" lede="That is what a month of daily calls costs." />
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.name}
            className={`flex min-w-0 flex-col gap-5 rounded-[32px] p-8 ${
              p.main ? "bg-charcoal text-white" : "bg-cloud text-ink"
            }`}
          >
            <h3 className="text-lg font-semibold">{p.name}</h3>
            <p className="text-[48px] leading-none font-semibold tracking-[-0.03em] tabular-nums">
              {p.price}
              <span className={`ml-2 text-lg font-normal tracking-normal ${p.main ? "text-white/50" : "text-body"}`}>{p.unit}</span>
            </p>
            <p className={`text-[17px] leading-[1.35] ${p.main ? "text-white/70" : "text-body"}`}>{p.note}</p>
            <ul className={`flex flex-col gap-2.5 border-t pt-5 text-[16px] ${p.main ? "border-white/10 text-white/85" : "border-ink/10"}`}>
              {p.items.map((it) => (
                <li key={it} className="flex items-center gap-2.5">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="shrink-0 opacity-60">
                    <path d="m3.5 8.5 3 3 6-7" />
                  </svg>
                  {it}
                </li>
              ))}
            </ul>
            <PillLink href={p.href} variant={p.main ? "inverse" : "filled"} className="mt-auto w-fit">
              {p.cta}
            </PillLink>
          </div>
        ))}
      </div>
    </Section>
  );
}
