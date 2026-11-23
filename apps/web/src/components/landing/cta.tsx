import { WaitlistForm } from "./waitlist-form";

export function Cta() {
  return (
    <section id="waitlist" className="scroll-mt-24 px-4 pb-20 sm:px-8">
      <div
        className="relative mx-auto grid max-w-[1200px] items-center gap-10 overflow-hidden rounded-[32px] bg-cover bg-bottom px-6 py-16 sm:px-12 lg:grid-cols-[1fr_1.15fr] lg:gap-14 lg:py-20"
        style={{ backgroundImage: "url(/art/hero-sky.svg)" }}
      >
        <div className="flex flex-col items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/app-icon.svg" alt="" width={72} height={72} className="rounded-[18px] shadow-chip" />
          <h2 className="display mt-8 text-[40px] sm:text-[56px]">Be one of the first families</h2>
          <p className="mt-5 max-w-md text-lg leading-[1.3] text-body sm:text-2xl">
            We are opening Kin to a small group of families in India and Singapore. Setup takes five minutes.
          </p>
        </div>
        <WaitlistForm />
      </div>
    </section>
  );
}
