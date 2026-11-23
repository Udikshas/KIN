import type { ReactNode } from "react";
import { Phone } from "../app/phone";
import { CallScreen, LockScreen, TrendsScreen } from "../app/screens";
import { Section, SectionHead } from "../ui/section";

const cards: { title: string; body: string; phone: ReactNode; tint: string }[] = [
  {
    title: "Calls",
    body: "Two to four minutes every evening, at the time your parent picks. Sleep, pain, mood, medicine.",
    phone: (
      <Phone width={250} tone="dark" label="Live call screen">
        <CallScreen />
      </Phone>
    ),
    tint: "from-[#ffe4da]",
  },
  {
    title: "Evening card",
    body: "One push at the end of the day. Read it in ten seconds; open it when something changed.",
    phone: (
      <Phone width={250} label="Lock screen with Kin's evening card notification">
        <LockScreen notifications="high" />
      </Phone>
    ),
    tint: "from-[#e6defd]",
  },
  {
    title: "Trends",
    body: "Today is compared with your parent's own last 30 days, never with a population average.",
    phone: (
      <Phone width={250} label="Trends screen: doses, sleep and speech rate over 30 calls">
        <TrendsScreen />
      </Phone>
    ),
    tint: "from-[#dcecff]",
  },
];

export function Bento() {
  return (
    <Section id="app">
      <SectionHead
        title={
          <>
            Know how they
            <br />
            really are
          </>
        }
        lede="Every call home gets the same answer: “I am fine.” Kin hears the rest."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <article
            key={c.title}
            className="relative flex h-[560px] flex-col overflow-hidden rounded-[32px] bg-cloud px-8 pt-8"
          >
            <div className={`absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t ${c.tint} to-transparent`} />
            <h3 className="relative text-[32px] font-semibold tracking-[-0.03em] sm:text-[40px]">{c.title}</h3>
            <p className="relative mt-3 text-lg leading-[1.3] text-body">{c.body}</p>
            <div className="relative mt-8 flex justify-center">{c.phone}</div>
          </article>
        ))}
      </div>
    </Section>
  );
}
