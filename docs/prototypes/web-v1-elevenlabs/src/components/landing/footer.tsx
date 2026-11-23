export function Footer() {
  return (
    <footer className="border-t border-stone bg-eggshell">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-8 lg:px-16">
        <div>
          <p className="text-[22px] font-semibold tracking-[-0.04em]">Kin</p>
          <p className="mt-1 font-mono text-[12px] text-smoke">India · Singapore</p>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-graphite">
          <strong className="font-medium text-ink">Kin is not an emergency service.</strong> In an
          emergency, call 108 in India or 995 in Singapore.
        </p>
        <p className="font-mono text-[12px] text-smoke">Singapore India Hackathon 2026</p>
      </div>
    </footer>
  );
}
