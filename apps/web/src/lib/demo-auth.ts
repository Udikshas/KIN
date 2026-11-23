// Server-only helpers for the password-protected /try demo.
// The cookie is signed with DEMO_PASSWORD, so changing the password logs
// everyone out. Never import this from a client component.
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const DEMO_COOKIE = "kin_demo";
export const DEMO_COOKIE_MAX_AGE = 12 * 60 * 60; // 12 hours

function sign(password: string) {
  return createHmac("sha256", password).update("kin-demo-v1").digest("hex");
}

function equal(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function demoEnabled() {
  return Boolean(process.env.DEMO_PASSWORD && process.env.WEB_API_TOKEN);
}

export function passwordMatches(input: string) {
  const password = process.env.DEMO_PASSWORD ?? "";
  return Boolean(password) && equal(sign(input), sign(password));
}

// Cookie value is "<expiry ms>.<hmac(expiry)>", so the server enforces the
// 12-hour lifetime even if the cookie is copied out of the browser.
export function demoCookieValue() {
  const exp = String(Date.now() + DEMO_COOKIE_MAX_AGE * 1000);
  return `${exp}.${mac(exp)}`;
}

export async function isUnlocked() {
  if (!demoEnabled()) return false;
  const value = (await cookies()).get(DEMO_COOKIE)?.value ?? "";
  const [exp, sig] = value.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  return equal(sig, mac(exp));
}

function mac(exp: string) {
  return createHmac("sha256", process.env.DEMO_PASSWORD ?? "").update(`kin-demo-v2:${exp}`).digest("hex");
}
