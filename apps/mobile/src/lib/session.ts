import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// SuperTokens passwordless (email OTP) against apps/api, with header-based
// tokens (st-auth-mode: header) as CLAUDE.md prescribes for the Expo app.
// Talks to the SuperTokens frontend API directly so there is no extra SDK.

// In dev (Expo Go / dev client / web) the app talks to the local API
// (apps/api/scripts/dev.sh) on the machine running Metro, so a phone on the
// same Wi-Fi reaches it too. Release builds use the production API.
// EXPO_PUBLIC_API_URL overrides both (e.g. to try prod from dev).
function devApiUrl(): string | undefined {
  if (!__DEV__) return undefined;
  const host = Platform.OS === "web" ? globalThis.location?.hostname : Constants.expoConfig?.hostUri?.split(":")[0];
  return host ? `http://${host}:8000` : undefined;
}

export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? devApiUrl() ?? (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? "https://api.kin.garcade.in";

const KEYS = { access: "kin.access", refresh: "kin.refresh", email: "kin.email", parent: "kin.parent" } as const;

async function get(key: string) {
  if (Platform.OS === "web") {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function set(key: string, value: string | null) {
  if (Platform.OS === "web") {
    try {
      if (value === null) globalThis.localStorage?.removeItem(key);
      else globalThis.localStorage?.setItem(key, value);
    } catch {}
    return;
  }
  if (value === null) await SecureStore.deleteItemAsync(key);
  else await SecureStore.setItemAsync(key, value);
}

/** The parent the user last picked (families with more than one), kept on this device. */
export const shownParent = {
  get: () => get(KEYS.parent),
  set: (phone: string | null) => set(KEYS.parent, phone),
};

export async function loadSession() {
  const [access, email] = await Promise.all([get(KEYS.access), get(KEYS.email)]);
  return access ? { email: email ?? "" } : null;
}

async function saveTokens(res: Response) {
  const access = res.headers.get("st-access-token");
  const refresh = res.headers.get("st-refresh-token");
  if (access) await set(KEYS.access, access);
  if (refresh) await set(KEYS.refresh, refresh);
}

export async function clearSession() {
  await Promise.all([set(KEYS.access, null), set(KEYS.refresh, null), set(KEYS.email, null)]);
}

async function post(path: string, body: unknown, extra: Record<string, string> = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", rid: "passwordless", "st-auth-mode": "header", ...extra },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Kin is not reachable right now (${res.status}). Try again in a minute.`);
  return res;
}

export type CodeRequest = { deviceId: string; preAuthSessionId: string };

/** Emails a one-time code. */
export async function sendCode(email: string): Promise<CodeRequest> {
  const res = await post("/auth/signinup/code", { email });
  const data = await res.json();
  if (data.status !== "OK") throw new Error(data.message ?? "Could not send the code. Check the email address.");
  return { deviceId: data.deviceId, preAuthSessionId: data.preAuthSessionId };
}

/** Emails a fresh code for the same sign-in attempt. */
export async function resendCode(req: CodeRequest) {
  const res = await post("/auth/signinup/code/resend", req);
  const data = await res.json();
  if (data.status !== "OK") throw new Error("Please start again and send a new code.");
}

/** Exchanges the code for a session. Throws a readable message on a wrong code. */
export async function verifyCode(req: CodeRequest, code: string, email: string) {
  const res = await post("/auth/signinup/code/consume", { ...req, userInputCode: code });
  const data = await res.json();
  if (data.status === "OK") {
    await saveTokens(res);
    await set(KEYS.email, email);
    return;
  }
  if (data.status === "INCORRECT_USER_INPUT_CODE_ERROR") {
    const left = data.maximumCodeInputAttempts - data.failedCodeInputAttemptCount;
    throw new Error(`That code is not right. ${left} ${left === 1 ? "try" : "tries"} left.`);
  }
  if (data.status === "EXPIRED_USER_INPUT_CODE_ERROR") throw new Error("That code has expired. Send a new one.");
  throw new Error("Please start again and send a new code.");
}

async function refresh() {
  const token = await get(KEYS.refresh);
  if (!token) return false;
  const res = await fetch(`${API_URL}/auth/session/refresh`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "st-auth-mode": "header" },
  });
  if (!res.ok) return false;
  await saveTokens(res);
  return true;
}

/** Authenticated fetch: adds the access token and refreshes it once on 401. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const go = async () =>
    fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${await get(KEYS.access)}`, "st-auth-mode": "header" },
    });
  let res = await go();
  if (res.status === 401 && (await refresh())) res = await go();
  return res;
}

export async function signOut() {
  try {
    await apiFetch("/auth/signout", { method: "POST" });
  } catch {}
  await clearSession();
}
