// The family dashboard's door to the Kin API. The browser talks only to this
// route; it signs in with SuperTokens email OTP in header mode (the same flow
// as the Expo app, apps/mobile/src/lib/session.ts) and keeps the tokens in
// httpOnly cookies, so no token is ever readable by page scripts and the API
// needs no CORS entry for the website.

import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

const API = (process.env.KIN_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
const ACCESS = "kin_at";
const REFRESH = "kin_rt";
const EMAIL = "kin_email";

// Only what the dashboard needs: the sign-in steps and the family's own routes.
const AUTH = new Set(["auth/signinup/code", "auth/signinup/code/resend", "auth/signinup/code/consume"]);
const allowed = (path: string) => AUTH.has(path) || path === "auth/signout" || path === "me" || path.startsWith("me/");

const cookieOpts = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

type Jar = Awaited<ReturnType<typeof cookies>>;

/** Saves new tokens from an API answer; returns the new access token, if any. */
function keepTokens(jar: Jar, res: Response) {
  const access = res.headers.get("st-access-token");
  const refresh = res.headers.get("st-refresh-token");
  if (access) jar.set(ACCESS, access, cookieOpts(60 * 60 * 24 * 100));
  if (refresh) jar.set(REFRESH, refresh, cookieOpts(60 * 60 * 24 * 100));
  return access;
}

function clear(jar: Jar) {
  for (const k of [ACCESS, REFRESH, EMAIL]) jar.delete(k);
}

async function refresh(jar: Jar) {
  const token = jar.get(REFRESH)?.value;
  if (!token) return null;
  const res = await fetch(`${API}/auth/session/refresh`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "st-auth-mode": "header" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return keepTokens(jar, res);
}

/** Copies the API's answer without its token headers. */
async function pass(res: Response) {
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json", "cache-control": "no-store" },
  });
}

async function handle(req: NextRequest, ctx: RouteContext<"/kin-api/[...path]">) {
  const path = (await ctx.params).path.join("/");
  if (!allowed(path)) return Response.json({ detail: "Not found" }, { status: 404 });
  const jar = await cookies();
  const query = req.nextUrl.search;
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();

  // Sign-in steps: no session yet. A successful consume sets the cookies.
  if (AUTH.has(path)) {
    const res = await fetch(`${API}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", rid: "passwordless", "st-auth-mode": "header" },
      body,
      cache: "no-store",
    });
    if (path.endsWith("consume") && res.ok) {
      const data = await res.clone().json().catch(() => null);
      if (data?.status === "OK") {
        keepTokens(jar, res);
        if (data.user?.emails?.[0]) jar.set(EMAIL, data.user.emails[0], cookieOpts(60 * 60 * 24 * 100));
      }
    }
    return pass(res);
  }

  let access = jar.get(ACCESS)?.value ?? "";
  const go = () =>
    fetch(`${API}/${path}${query}`, {
      method: req.method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${access}`,
        "st-auth-mode": "header",
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

  if (path === "auth/signout") {
    await go().catch(() => null);
    clear(jar);
    return Response.json({ ok: true });
  }

  if (!access && !jar.get(REFRESH)) return Response.json({ detail: "Signed out" }, { status: 401 });
  let res: Response;
  try {
    res = await go();
    if (res.status === 401) {
      const fresh = await refresh(jar);
      if (fresh) {
        access = fresh;
        res = await go();
      }
    }
  } catch {
    return Response.json({ detail: "Can't reach Kin right now. Try again in a minute." }, { status: 502 });
  }
  if (res.status === 401) clear(jar);
  return pass(res);
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
