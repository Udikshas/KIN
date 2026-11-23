import { PillLink } from "../ui/pill-link";
import { PhoneGlyph, WashPill } from "../ui/wash-pill";

const columns = [
  {
    title: "Kin",
    links: [
      { href: "#app", label: "The app" },
      { href: "#features", label: "Memory and alerts" },
      { href: "#call", label: "Hear a call" },
      { href: "#more", label: "More features" },
      { href: "/dashboard", label: "Family dashboard (sign in)" },
      { href: "/impact", label: "Kin so far (live numbers)" },
    ],
  },
  {
    title: "Trust",
    links: [
      { href: "#privacy", label: "Privacy and consent" },
      { href: "#privacy", label: "Not a doctor" },
      { href: "#languages", label: "Languages" },
    ],
  },
  {
    title: "Plans",
    links: [
      { href: "#plans", label: "Pricing" },
      { href: "#waitlist", label: "Families waitlist" },
      { href: "#waitlist-centre", label: "Senior centres and NGOs" },
      { href: "#waitlist-insurer", label: "Insurers and health systems" },
    ],
  },
];

const languages = [
  { label: "हिन्दी", font: "font-deva" },
  { label: "தமிழ்", font: "font-tamil" },
  { label: "മലയാളം", font: "font-sans" },
  { label: "বাংলা", font: "font-sans" },
  { label: "English", font: "font-sans" },
];

export function Footer() {
  return (
    <footer className="px-3 pb-3 sm:px-6 sm:pb-6">
      <div
        className="relative overflow-hidden rounded-[32px] bg-cloud"
        style={{
          // Same soft washes as the app screens (mesh-light), pooled at the bottom.
          backgroundImage: [
            "radial-gradient(45% 55% at 0% 100%, rgb(203 189 255 / 0.75) 0%, transparent 70%)",
            "radial-gradient(40% 50% at 100% 100%, rgb(191 226 255 / 0.85) 0%, transparent 70%)",
            "radial-gradient(35% 40% at 55% 105%, rgb(255 210 194 / 0.6) 0%, transparent 70%)",
            "radial-gradient(30% 30% at 100% 0%, rgb(255 240 181 / 0.45) 0%, transparent 70%)",
          ].join(","),
        }}
      >
        <div className="mx-auto max-w-[1200px] px-6 pt-12 sm:px-12 sm:pt-16">
          <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr] lg:gap-16">
            {/* brand */}
            <div className="flex flex-col items-start">
              <a href="#top" aria-label="Kin home">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/kin-logo.svg" alt="Kin" width={106} height={32} />
              </a>
              <p className="mt-5 max-w-sm text-[17px] leading-[1.4] text-body">
                A daily call for the parent who lives alone, in the language they speak at home.
              </p>
              <ul aria-label="Languages" className="mt-4 flex flex-wrap items-center gap-x-2 text-[15px] text-ink">
                {languages.map((l, i) => (
                  <li key={l.label} className="flex items-center gap-2">
                    {i > 0 ? <span aria-hidden className="text-faint">·</span> : null}
                    <span className={l.font}>{l.label}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-7 flex flex-wrap gap-2">
                <PillLink href="#waitlist">Join the waitlist</PillLink>
                <WashPill href="/try" size="md" icon={<PhoneGlyph />}>
                  Get a demo call
                </WashPill>
              </div>
            </div>

            {/* link columns */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3">
              {columns.map((c, i) => (
                <nav
                  key={c.title}
                  aria-label={c.title}
                  className={`flex flex-col gap-4 ${i === columns.length - 1 ? "col-span-2 sm:col-span-1" : ""}`}
                >
                  <p className="text-[15px] font-semibold">{c.title}</p>
                  <ul className="flex flex-col gap-3">
                    {c.links.map((l) => (
                      <li key={l.label}>
                        <a href={l.href} className="text-[15px] text-body transition-colors hover:text-ink">
                          {l.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              ))}
            </div>
          </div>

          {/* emergency notice */}
          <div className="mt-12 flex items-start gap-3 rounded-[24px] bg-paper px-5 py-4 sm:items-center sm:px-6">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-alert-soft text-alert">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 3 2.5 20h19L12 3ZM12 10v4M12 17.5v.01" />
              </svg>
            </span>
            <p className="pt-1.5 text-[15px] leading-snug text-body sm:pt-0">
              <strong className="font-semibold text-ink">Kin is not an emergency service.</strong> In an emergency,
              call <strong className="font-semibold text-ink">108</strong> in India or{" "}
              <strong className="font-semibold text-ink">995</strong> in Singapore.
            </p>
          </div>

          {/* bottom row */}
          <div className="mt-8 border-t border-line py-6 text-[14px] text-body">
            <p>© 2026 Kin. Built by team Rocket.</p>
          </div>
        </div>

        {/* oversized wordmark, sunk into the bottom edge */}
        <p
          aria-hidden
          className="pointer-events-none -mt-[0.06em] -mb-[0.26em] text-center text-[38vw] leading-none font-semibold tracking-[-0.06em] text-transparent select-none lg:text-[340px]"
          style={{ backgroundImage: "linear-gradient(180deg, #ffffff 15%, rgb(255 255 255 / 0.25) 85%)", backgroundClip: "text", WebkitBackgroundClip: "text" }}
        >
          Kin
        </p>
      </div>
    </footer>
  );
}
