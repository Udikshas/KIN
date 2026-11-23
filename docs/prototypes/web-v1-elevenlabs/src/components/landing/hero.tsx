import { PillLink } from "../ui/pill-link";
import { CallDemo } from "./call-demo";

const languages = [
  { label: "हिन्दी", font: "font-deva" },
  { label: "தமிழ்", font: "font-tamil" },
  { label: "മലയാളം", font: "font-sans" },
  { label: "বাংলা", font: "font-sans" },
  { label: "मराठी", font: "font-deva" },
  { label: "English", font: "font-sans" },
];

export function Hero() {
  return (
    <section id="top" className="mx-auto max-w-[1280px] px-4 pt-12 pb-20 sm:px-8 sm:pt-20 lg:px-16">
      <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-7">
          <p className="mb-6 font-mono text-[13px] text-smoke">A daily call for parents who live alone</p>
          <h1 className="text-[40px] leading-[1.08] font-light tracking-[-0.02em] sm:text-[52px] lg:text-[60px]">
            Kin calls your parent every evening, in the language they speak at home.
          </h1>
        </div>
        <div className="flex flex-col gap-6 lg:col-span-5 lg:pb-2">
          <p className="text-lg leading-relaxed text-graphite">
            One short phone call. Kin asks how they slept, checks they took their medicine,
            remembers what they said last week, and sends you one card about what changed.
          </p>
          <div className="flex flex-wrap gap-2">
            <PillLink href="#plans">Set up calls for a parent</PillLink>
            <PillLink href="#how" variant="outline">
              How a call works
            </PillLink>
          </div>
        </div>
      </div>

      <ul aria-label="Languages" className="mt-10 mb-8 flex flex-wrap gap-2">
        {languages.map((l) => (
          <li
            key={l.label}
            className={`rounded-full border border-hairline bg-eggshell px-3.5 py-1.5 text-sm text-graphite ${l.font}`}
          >
            {l.label}
          </li>
        ))}
        <li className="px-2 py-1.5 font-mono text-[13px] text-ash">Works on any phone, landline included</li>
      </ul>

      <CallDemo />
    </section>
  );
}
