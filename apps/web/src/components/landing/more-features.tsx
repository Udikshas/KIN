import type { ReactNode } from "react";
import { Phone } from "../app/phone";
import { FamilyScreen, GroceriesScreen, IntroScreen, MedicinesScreen, ScamScreen } from "../app/screens";

type Item = { id: string; title: ReactNode; body: string; wash: string; screen: ReactNode };

const items: Item[] = [
  {
    id: "intro",
    title: (
      <>
        Starts with
        <br />
        you on the line
      </>
    ),
    body: "Call your parent, add the Kin number, tap Merge. Kin says hello with you there and asks for their OK.",
    wash: "radial-gradient(70% 90% at 85% 20%, #d9cfff 0%, transparent 60%), radial-gradient(60% 70% at 70% 100%, #ffd9cc 0%, transparent 60%), #ebf0f8",
    screen: <IntroScreen />,
  },
  {
    id: "meds",
    title: (
      <>
        Medicine,
        <br />
        in her words
      </>
    ),
    body: "Kin asks about each tablet the way your parent knows it, rings at tablet time if you like, and tells you before a strip runs out. Reorder in one tap.",
    wash: "radial-gradient(70% 90% at 85% 15%, #d6f5c9 0%, transparent 60%), radial-gradient(60% 70% at 65% 100%, #cfe6ff 0%, transparent 60%), #ebf0f8",
    screen: <MedicinesScreen />,
  },
  {
    id: "groceries",
    title: (
      <>
        The monthly shopping,
        <br />
        sorted
      </>
    ),
    body: "Atta, dal, tea, each on its own cycle. When they're due, one tap fills a single Amazon cart or sends the local kirana the whole list on WhatsApp.",
    wash: "radial-gradient(70% 90% at 85% 20%, #fff0b5 0%, transparent 60%), radial-gradient(60% 70% at 70% 100%, #d6f5c9 0%, transparent 60%), #ebf0f8",
    screen: <GroceriesScreen />,
  },
  {
    id: "family",
    title: (
      <>
        The whole family,
        <br />
        one view
      </>
    ),
    body: "Brothers, sisters and the family doctor share the evening card. When Amma asks Kin to tell you something, you get it; your reply reaches her on the next call.",
    wash: "radial-gradient(70% 90% at 85% 20%, #ffe7c2 0%, transparent 60%), radial-gradient(60% 70% at 65% 100%, #ffd6cc 0%, transparent 60%), #ebf0f8",
    screen: <FamilyScreen />,
  },
  {
    id: "scam",
    title: (
      <>
        A guard against
        <br />
        scam calls
      </>
    ),
    body: "If your parent mentions a caller asking for an OTP, a KYC update or money, Kin calmly tells them to hang up, and you're warned at once.",
    wash: "radial-gradient(70% 90% at 85% 20%, #ffe2b8 0%, transparent 60%), radial-gradient(60% 70% at 70% 100%, #ffd6cc 0%, transparent 60%), #ebf0f8",
    screen: <ScamScreen />,
  },
];

const PHONE_W = 300;
const PHONE_H = (PHONE_W * 2000) / 979;

/**
 * Bevel-style scroll story. Every panel holds its own copy of the phone,
 * position: fixed at the same spot in the viewport, and clips it with
 * clip-path. The phone looks pinned while each panel acts as a window onto
 * its own screen, so the next screen slides up as the next panel arrives.
 * Pure CSS: no scroll listeners.
 */
export function MoreFeatures() {
  return (
    <section id="more" className="scroll-mt-24 py-20">
      <div className="mx-auto mb-14 flex max-w-3xl flex-col items-center gap-5 px-4 text-center">
        <h2 className="display text-[40px] sm:text-[56px] lg:text-[64px]">And that&apos;s not all</h2>
        <p className="text-lg leading-[1.3] text-body sm:text-2xl">
          Everything around the call, for families who live far apart. In the app, and on the web when you&apos;re at your desk.
        </p>
      </div>

      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 sm:px-8">
        {items.map((it) => (
          <article
            key={it.id}
            className="relative flex min-h-[560px] flex-col overflow-hidden rounded-[32px] lg:h-[680px] lg:flex-row lg:items-center lg:overflow-visible lg:[clip-path:inset(0_round_32px)]"
            style={{ background: it.wash }}
          >
            <div className="flex max-w-xl flex-col gap-4 px-8 pt-12 sm:px-14 lg:w-[52%] lg:pt-0">
              <h3 className="display text-[40px] sm:text-[52px] lg:text-[56px]">{it.title}</h3>
              <p className="text-lg leading-[1.3] text-body sm:text-2xl">{it.body}</p>
            </div>

            {/* small screens: a normal phone inside the panel */}
            <div className="mt-10 flex justify-center lg:hidden">
              <div className="-mb-[180px]">
                <Phone width={280} label={`Kin app screen: ${it.id}`}>
                  {it.screen}
                </Phone>
              </div>
            </div>

            {/* large screens: the pinned phone, clipped by this panel */}
            <div
              className="pointer-events-none fixed hidden lg:block"
              style={{
                top: `calc(50vh - ${PHONE_H / 2}px)`,
                left: `calc(50% + ${284 - PHONE_W / 2}px)`,
              }}
            >
              <Phone width={PHONE_W} label={`Kin app screen: ${it.id}`}>
                {it.screen}
              </Phone>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
