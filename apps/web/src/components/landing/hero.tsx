import { Phone } from "../app/phone";
import { CallScreen, LockScreen, TodayScreen } from "../app/screens";
import { PhoneGlyph, PlayGlyph, WashPill } from "../ui/wash-pill";

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-bottom"
        style={{ backgroundImage: "url(/art/hero-sky.svg)" }}
      />
      <div className="relative mx-auto flex max-w-[1200px] flex-col items-center px-4 pt-32 text-center sm:px-8 sm:pt-36">
        <h1 className="display max-w-4xl text-[48px] sm:text-[68px] lg:text-[80px]">
          A daily call for the parent who lives alone
        </h1>
        <p className="mt-6 max-w-[760px] text-lg leading-[1.3] text-balance text-body sm:text-2xl">
          Kin phones your parent every evening in their own language, then sends you one card
          about what changed.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <WashPill href="/try" tone="dark" icon={<PhoneGlyph />}>
            Get a demo call
          </WashPill>
          <WashPill href="#call" icon={<PlayGlyph />}>
            Hear a call
          </WashPill>
        </div>

        <div className="relative mt-14 h-[540px] w-full max-w-[1100px] sm:h-[620px]">
          {/* back left: the evening push */}
          <div className="absolute top-16 left-1/2 hidden -translate-x-[calc(50%+215px)] md:block">
            <Phone width={260} label="Kin app: lock screen with the evening card notification">
              <LockScreen />
            </Phone>
          </div>

          {/* back right: a live call */}
          <div className="absolute top-16 left-1/2 hidden -translate-x-[calc(50%-215px)] md:block">
            <Phone width={260} tone="dark" label="Kin app: a live call with Amma in Hindi">
              <CallScreen />
            </Phone>
          </div>

          {/* front: today */}
          <div className="absolute top-0 left-1/2 z-10 -translate-x-1/2">
            <Phone width={310} label="Kin app: Amma's day, a normal day with medicine taken and knee pain to watch">
              <TodayScreen />
            </Phone>
          </div>

          {/* floating chips */}
          <FloatChip className="top-[360px] left-0 z-20 hidden xl:flex" delay="0s">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/avatars/amma.svg" alt="" width={36} height={36} className="rounded-full" />
            <span className="text-left">
              <span className="block text-[15px] font-semibold">Kin is calling Amma</span>
              <span className="block text-[13px] text-body">Every day · 7:10 pm</span>
            </span>
          </FloatChip>
          <FloatChip className="top-[200px] right-0 z-20 hidden xl:flex" delay="1.5s">
            <span className="font-deva text-[15px]">नमस्ते अम्मा, आज नींद कैसी आई?</span>
          </FloatChip>

          <div className="absolute inset-x-0 bottom-0 z-30 h-40 bg-gradient-to-t from-paper to-transparent" />
        </div>
      </div>
    </section>
  );
}

function FloatChip({
  className = "",
  delay,
  children,
}: {
  className?: string;
  delay: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`absolute animate-float items-center gap-3 rounded-[20px] bg-white/90 px-4 py-3 shadow-chip backdrop-blur ${className}`}
      style={{ animationDelay: delay }}
    >
      {children}
    </div>
  );
}
