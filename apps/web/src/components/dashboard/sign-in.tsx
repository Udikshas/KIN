"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { resendCode, sendCode, verifyCode, type CodeRequest } from "@/lib/kin/api";
import { useKin } from "@/lib/kin/kin";
import { metric } from "@/lib/kin/theme";
import { cleanEmail, emailError } from "@/lib/kin/validate";

import { Avatar, Button, ErrorText, Icon, icon, Input, Ring } from "./ui";

/**
 * The same sign-in as the app (an emailed one-time code, SuperTokens passwordless),
 * next to a large "Look around" panel so anyone can try Kin without an account.
 */
export function SignIn() {
  const { signedIn, trySample } = useKin();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [req, setReq] = useState<CodeRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const clean = cleanEmail(email);
    const bad = emailError(clean, true);
    if (bad) return setError(bad);
    setBusy(true);
    setError("");
    try {
      setReq(await sendCode(clean));
      setEmail(clean);
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!req) return;
    setBusy(true);
    setError("");
    try {
      await verifyCode(req, code.trim());
      signedIn(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
      setBusy(false);
    }
  }

  async function resend() {
    if (!req) return;
    setError("");
    try {
      await resendCode(req);
      setNote("A new code is on its way.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send a new code.");
    }
  }

  return (
    <main className="mesh-light min-h-dvh px-4 py-6 sm:px-8">
      <header className="mx-auto flex w-full max-w-[1120px] items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/kin-mark.svg" alt="" width={32} height={32} />
          <span className="text-[21px] font-semibold tracking-[-0.03em]">Kin</span>
        </Link>
        <Link href="/" className="text-[14.5px] font-medium text-body hover:text-ink">
          Back to the site
        </Link>
      </header>

      <div className="mx-auto mt-8 grid w-full max-w-[1120px] grid-cols-1 items-center gap-6 lg:mt-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-10">
        {/* Look around: the easy way in, first on every screen size. */}
        <section className="order-1">
          <p className="inline-flex items-center gap-2 rounded-full bg-paper/80 px-3 py-1 text-[13px] font-semibold text-body shadow-[0_0_0_1px_var(--color-line)]">
            <i className="block size-2 rounded-full bg-green" />
            No account needed
          </p>
          <h1 className="display mt-4 text-[40px] sm:text-[56px]">
            See how Kin looks
            <br className="hidden sm:block" /> after a week of calls.
          </h1>
          <p className="mt-4 max-w-[520px] text-[17px] leading-[1.55] text-body sm:text-[19px]">
            Look around with a sample family: Amma&apos;s evening calls, trends, medicines and groceries. Nothing you change is saved.
          </p>

          <button
            type="button"
            onClick={trySample}
            className="group mt-6 block w-full max-w-[560px] cursor-pointer rounded-[32px] bg-paper/70 p-3 text-left shadow-[0_30px_60px_-30px_rgb(40_50_110/0.45),0_0_0_1px_rgb(255_255_255/0.8)] backdrop-blur-xl transition-transform hover:-translate-y-0.5"
          >
            <SamplePreview />
            <span className="mt-3 flex h-14 items-center justify-between gap-3 rounded-full bg-charcoal pr-2 pl-5 sm:pl-6 text-white transition-colors group-hover:bg-black">
              <span className="text-[15px] font-semibold whitespace-nowrap sm:text-[17px]">Look around with a sample family</span>
              <span className="grid size-10 place-items-center rounded-full bg-white text-ink transition-transform group-hover:translate-x-0.5">
                <Icon d={icon.chevron} size={18} width={2.4} />
              </span>
            </span>
          </button>
        </section>

        {/* Sign in with the Kin app's account. */}
        <section className="order-2">
          <div className="glass rounded-[32px] p-7 sm:p-9">
            <p className="text-[14px] font-medium text-body">Already use Kin?</p>
            <h2 className="display mt-1 text-[34px]">{req ? "Check your email" : "Sign in"}</h2>
            <p className="mt-3 text-[15.5px] leading-[1.5] text-body">
              {req ? (
                <>
                  We sent a 6-digit code to <b className="font-semibold text-ink">{email}</b>.
                </>
              ) : (
                "Use the email from the Kin app. We'll send a one-time code, no password needed."
              )}
            </p>

            {req ? (
              <form onSubmit={verify} className="mt-6 space-y-4">
                <Input
                  ref={codeRef}
                  label="Code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  className="[&_input]:h-14 [&_input]:text-center [&_input]:text-[24px] [&_input]:tracking-[0.4em] [&_input]:tabular-nums"
                />
                <ErrorText>{error}</ErrorText>
                {note && !error ? <p className="text-[14px] text-body">{note}</p> : null}
                <Button type="submit" className="h-12 w-full" disabled={busy || code.length < 6}>
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
                <div className="flex justify-between text-[14px]">
                  <button type="button" onClick={() => (setReq(null), setCode(""), setError(""))} className="cursor-pointer text-body hover:text-ink">
                    Use another email
                  </button>
                  <button type="button" onClick={resend} className="cursor-pointer font-medium text-ink hover:underline">
                    Send a new code
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={send} className="mt-6 space-y-4">
                <Input
                  label="Email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="[&_input]:h-12"
                />
                <ErrorText>{error}</ErrorText>
                <Button type="submit" className="h-12 w-full" disabled={busy || !email.trim()}>
                  {busy ? "Sending…" : "Email me a code"}
                </Button>
              </form>
            )}
            <p className="mt-6 border-t border-ink/10 pt-5 text-[14px] text-body">
              New to Kin?{" "}
              <Link href="/#waitlist" className="font-semibold text-ink hover:underline">
                Join the waitlist
              </Link>{" "}
              or{" "}
              <Link href="/try" className="font-semibold text-ink hover:underline">
                get a demo call
              </Link>
              .
            </p>
          </div>
          <p className="mt-4 px-2 text-center text-[13px] text-body">Same account as the Kin app on your phone.</p>
        </section>
      </div>
    </main>
  );
}

/** A small evening card from the sample family, so the button shows what's behind it. */
function SamplePreview() {
  return (
    <span className="block rounded-[24px] bg-gradient-to-br from-[#efeaff] via-[#f5f7fc] to-[#ffefe8] p-4 sm:p-5">
      <span className="flex items-center gap-3">
        <Avatar name="amma" size={46} />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-body">Amma · Lucknow · tonight, 7:14 pm</span>
          <span className="block text-[17px] font-semibold tracking-[-0.02em] sm:text-[19px]">A normal day, knee pain on day 3</span>
        </span>
      </span>
      <span className="mt-4 grid grid-cols-3 gap-2">
        {[
          { c: metric.green, v: 1, value: "All", label: "Medicine" },
          { c: metric.lilac, v: 0.8, value: "6 h", label: "Sleep" },
          { c: metric.blue, v: 0.88, value: "Good", label: "Mood" },
        ].map((s) => (
          <span key={s.label} className="flex items-center gap-2.5 rounded-[18px] bg-paper/85 px-3 py-2.5">
            <span className="hidden sm:block">
              <Ring value={s.v} color={s.c} size={30} stroke={4} />
            </span>
            <span className="min-w-0">
              <span className="block text-[11.5px] font-medium text-body">{s.label}</span>
              <span className="block text-[15px] font-semibold">{s.value}</span>
            </span>
          </span>
        ))}
      </span>
      <span className="mt-3 flex items-start gap-2 rounded-[16px] bg-paper/70 px-3.5 py-2.5 text-[13.5px] leading-[1.45]">
        <i className="mt-1.5 block size-2 shrink-0 rounded-full bg-gold" />
        <span>
          <b className="font-semibold">Try this:</b> <span className="text-body">call on Sunday as she asked, and ask whether the knee needs a doctor.</span>
        </span>
      </span>
    </span>
  );
}
