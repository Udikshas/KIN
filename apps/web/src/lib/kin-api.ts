// Server-side calls from kin-web to the Kin API. Adds WEB_API_TOKEN, so the
// token never reaches the browser. Only import this from server code.

const API = (process.env.KIN_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export function apiConfigured() {
  return Boolean(process.env.WEB_API_TOKEN);
}

export function kinApi(path: string, init?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...init,
    cache: "no-store",
    signal: init?.signal ?? AbortSignal.timeout(15_000),
    headers: {
      "content-type": "application/json",
      "x-web-token": process.env.WEB_API_TOKEN ?? "",
      ...init?.headers,
    },
  });
}
