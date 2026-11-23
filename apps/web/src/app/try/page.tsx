import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { lockDemo } from "@/app/actions/demo";
import { DemoConsole } from "@/components/try/demo-console";
import { PasswordForm } from "@/components/try/password-form";
import { demoEnabled, isUnlocked } from "@/lib/demo-auth";

export const metadata: Metadata = {
  title: "Try Kin",
  description: "Place a real Kin call and see what the family receives.",
  robots: { index: false, follow: false },
};

export default function TryPage() {
  return (
    <main className="mesh-light min-h-dvh">
      <header className="mx-auto flex max-w-[1100px] items-center justify-between px-4 pt-8 sm:px-8">
        <Link href="/" aria-label="Kin home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/kin-logo.svg" alt="Kin" width={106} height={32} />
        </Link>
        <Link
          href="/"
          className="group inline-flex h-10 items-center gap-2 rounded-[128px] bg-paper pr-4 pl-3 text-[15px] font-medium text-ink shadow-chip transition-colors hover:bg-cloud"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="transition-transform group-hover:-translate-x-0.5" aria-hidden>
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          Back to the site
        </Link>
      </header>

      {/* The session cookie is read at request time, so it streams in behind Suspense. */}
      <Suspense fallback={<p className="px-4 py-24 text-center text-body">Loading…</p>}>
        <Gate />
      </Suspense>
    </main>
  );
}

async function Gate() {
  // DEMO_* are runtime env vars (set in Coolify, not at build), so never prerender this.
  await connection();
  if (!demoEnabled()) {
    return (
      <section className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="display text-[40px]">Demo is resting</h1>
        <p className="mt-4 text-[17px] text-body">The live demo is not switched on right now. Please check back soon.</p>
      </section>
    );
  }
  if (!(await isUnlocked())) return <PasswordForm />;
  return (
    <>
      <DemoConsole />
      <form action={lockDemo} className="pb-10 text-center">
        <button className="text-[14px] text-body underline-offset-4 hover:text-ink hover:underline">Lock the demo</button>
      </form>
    </>
  );
}
