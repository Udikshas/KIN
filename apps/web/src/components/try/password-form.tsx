"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { unlockDemo, type UnlockState } from "@/app/actions/demo";

const field =
  "h-12 w-full rounded-[14px] border bg-white/90 px-4 pr-20 text-[16px] text-ink outline-none transition-colors placeholder:text-faint focus:border-ink";

const steps = [
  { title: "Tell Kin who to call", text: "A name, a number and tonight's medicines, in Hindi or English." },
  { title: "Kin rings them", text: "A short, warm check-in from +91 79714 13869." },
  { title: "See the evening card", text: "Sleep, pain, mood, medicines and a short summary." },
];

export function PasswordForm() {
  const [state, action, pending] = useActionState<UnlockState, FormData>(unlockDemo, {});
  const [show, setShow] = useState(false);

  return (
    <section className="mx-auto grid max-w-[1100px] items-center gap-10 px-4 py-16 sm:px-8 lg:min-h-[calc(100dvh-96px)] lg:grid-cols-[1fr_1fr] lg:gap-14 lg:py-12">
      <div className="flex flex-col items-start">
        <h1 className="display text-[40px] sm:text-[56px]">
          Hear Kin call,
          <br />
          for real
        </h1>
        <p className="mt-5 max-w-md text-lg leading-[1.3] text-body sm:text-2xl">
          Place a real call from Kin and see the evening card the family gets.
        </p>

        <ol className="mt-10 flex flex-col gap-5">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-paper text-[15px] font-semibold text-ink shadow-chip">
                {i + 1}
              </span>
              <div className="pt-1">
                <p className="text-[17px] font-semibold text-ink">{s.title}</p>
                <p className="mt-0.5 text-[15px] leading-[1.4] text-body">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="glass rounded-[28px] p-6 text-left sm:p-8">
        <h2 className="text-[28px] font-semibold tracking-[-0.03em] text-ink">Unlock the demo</h2>
        <p className="mt-2 text-[17px] leading-[1.4] text-body">Enter the access code the Kin team shared with you.</p>

        <form action={action} className="mt-6 flex flex-col gap-5">
          <label className="flex flex-col gap-2">
            <span className="text-[15px] font-semibold">Access code</span>
            <span className="relative">
              <input
                name="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                required
                autoFocus
                aria-invalid={Boolean(state.error)}
                className={`${field} ${state.error ? "border-alert" : "border-line"}`}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute inset-y-0 right-2 my-auto h-8 rounded-[128px] px-3 text-[14px] font-medium text-body transition-colors hover:bg-cloud hover:text-ink"
              >
                {show ? "Hide" : "Show"}
              </button>
            </span>
            {state.error ? <span role="alert" className="text-[14px] text-alert">{state.error}</span> : null}
          </label>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-13 items-center justify-center rounded-[128px] bg-charcoal px-7 text-[17px] font-medium text-cloud transition-colors hover:bg-black disabled:opacity-60"
          >
            {pending ? "Checking…" : "Unlock"}
          </button>
        </form>

        <p className="mt-6 border-t border-line pt-5 text-[15px] text-body">
          No access code?{" "}
          <Link href="/#waitlist" className="font-medium text-ink underline-offset-4 hover:underline">
            Join the waitlist
          </Link>
        </p>
      </div>
    </section>
  );
}
