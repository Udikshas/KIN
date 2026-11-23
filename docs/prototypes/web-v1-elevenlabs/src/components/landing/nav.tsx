import { PillLink } from "../ui/pill-link";

const links = [
  { href: "#how", label: "How it works" },
  { href: "#signals", label: "Signals" },
  { href: "#privacy", label: "Privacy" },
  { href: "#plans", label: "Plans" },
];

export function Nav() {
  return (
    <header className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-6 px-4 sm:px-8 lg:px-16">
      <div className="flex items-center gap-10">
        <a href="#top" className="text-[22px] font-semibold tracking-[-0.04em]" aria-label="Kin home">
          Kin
        </a>
        <nav aria-label="Main" className="hidden items-center gap-7 text-sm text-graphite md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-ink">
              {l.label}
            </a>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden sm:block">
          <PillLink href="#plans" variant="outline">
            For care centres
          </PillLink>
        </span>
        <PillLink href="#plans">Start the calls</PillLink>
      </div>
    </header>
  );
}
