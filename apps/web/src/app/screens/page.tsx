import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Phone } from "@/components/app/phone";
import {
  AlertScreen,
  CallScreen,
  FamilyScreen,
  GroceriesScreen,
  IntroScreen,
  LockScreen,
  MedicinesScreen,
  MemoryScreen,
  ScamScreen,
  TodayScreen,
  TrendsScreen,
} from "@/components/app/screens";

// Design contact sheet for local review only: 404 on the deployed site.
export const metadata: Metadata = { title: "Kin app screens", robots: { index: false, follow: false } };

const screens = [
  { name: "Today", node: <TodayScreen /> },
  { name: "Live call", node: <CallScreen />, dark: true },
  { name: "Evening push", node: <LockScreen /> },
  { name: "Trends", node: <TrendsScreen /> },
  { name: "Memory", node: <MemoryScreen /> },
  { name: "Amber alert", node: <AlertScreen /> },
  { name: "Medicines", node: <MedicinesScreen /> },
  { name: "Groceries", node: <GroceriesScreen /> },
  { name: "Family", node: <FamilyScreen /> },
  { name: "Scam warning", node: <ScamScreen /> },
  { name: "Introduction call", node: <IntroScreen /> },
];

/** Contact sheet of every Kin app mockup, for design review and screenshots. */
export default function Screens() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="min-h-screen bg-cloud px-6 py-16">
      <h1 className="display text-center text-[48px]">Kin app screens</h1>
      <div className="mx-auto mt-14 flex max-w-[1400px] flex-wrap justify-center gap-x-10 gap-y-14">
        {screens.map((s) => (
          <figure key={s.name} className="flex flex-col items-center gap-4">
            <Phone width={360} tone={s.dark ? "dark" : "light"} label={s.name}>
              {s.node}
            </Phone>
            <figcaption className="text-[15px] font-medium text-body">{s.name}</figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}
