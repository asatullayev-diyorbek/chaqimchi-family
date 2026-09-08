// HTTP client for the Spino24 backend.
//
// Mirrors parent-web/src/api/client.ts: tokens persisted (SecureStore on
// native, localStorage on web — see ../platform/storage), a single shared
// refresh call for a burst of parallel requests, one retry for a stalled
// GET, and backend error bodies turned into a readable Uzbek message.

import { storageDelete, storageGet, storageSet } from "../platform/storage";

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? "https://api.guard.chaqimchi-ai.uz"
).replace(/\/$/, "");

const ACCESS_KEY = "spino24_access_token";
const REFRESH_KEY = "spino24_refresh_token";

// Storage is async; keep an in-memory mirror so request headers can be
// built synchronously and the very first paint doesn't wait on it.
let accessToken: string | null = null;
let refreshToken: string | null = null;
let hydrated = false;

export async function hydrateTokens(): Promise<boolean> {
  try {
    accessToken = await storageGet(ACCESS_KEY);
    refreshToken = await storageGet(REFRESH_KEY);
  } catch {
    accessToken = null;
    refreshToken = null;
  }
  hydrated = true;
  return Boolean(refreshToken);
}

export function isHydrated() {
  return hydrated;
}

export async function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  try {
    await storageSet(ACCESS_KEY, access);
    await storageSet(REFRESH_KEY, refresh);
  } catch {
    /* in-memory copy still works for this session */
  }
}

export async function setAccessToken(access: string) {
  accessToken = access;
  try {
    await storageSet(ACCESS_KEY, access);
  } catch {
    /* ignore */
  }
}

export async function clearTokens() {
  accessToken = null;
  refreshToken = null;
  try {
    await storageDelete(ACCESS_KEY);
    await storageDelete(REFRESH_KEY);
  } catch {
    /* ignore */
  }
}

export function hasSession() {
  return Boolean(refreshToken);
}

function decodeExp(token: string | null): number | null {
  if (!token) return null;
  try {
    const [, payload] = token.split(".");
    const json = JSON.parse(
      decodeURIComponent(
        atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join(""),
      ),
    );
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

function isExpired(token: string | null): boolean {
  const exp = decodeExp(token);
  if (exp === null) return true;
  // Refresh a little early so a burst of requests doesn't each eat a 401.
  return exp * 1000 <= Date.now() + 30_000;
}

let inFlightRefresh: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (inFlightRefresh) return inFlightRefresh;
  if (!refreshToken) return null;
  inFlightRefresh = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: refreshToken }),
      });
      if (!res.ok) throw new Error("refresh failed");
      const data = (await res.json()) as { access: string };
      await setAccessToken(data.access);
      return data.access;
    } catch {
      await clearTokens();
      onSessionExpired?.();
      return null;
    } finally {
      inFlightRefresh = null;
    }
  })();
  return inFlightRefresh;
}

// RootNavigator registers this so a dead refresh token kicks the user to the
// auth stack instead of leaving every screen stuck on an error.
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(fn: (() => void) | null) {
  onSessionExpired = fn;
}

const TIMEOUT_MS = 20_000;
const NETWORK_MESSAGE =
  "So‘rov javob bermadi. Internet aloqasini tekshirib, qayta urinib ko‘ring.";

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type Options = RequestInit & { skipAuth?: boolean };

async function readError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (typeof json === "string") return json;
    if (json.detail) return json.detail;
    if (Array.isArray(json.non_field_errors) && json.non_field_errors[0])
      return json.non_field_errors[0];
    const first = Object.keys(json)[0];
    if (first && Array.isArray(json[first]) && json[first][0]) return json[first][0];
    if (typeof json.error === "string") return json.error;
  } catch {
    if (text) return text;
  }
  return `Xatolik yuz berdi (${res.status})`;
}

export async function apiFetch<T = any>(
  path: string,
  { skipAuth = false, ...options }: Options = {},
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const isGet = method === "GET";

  let token = skipAuth ? null : accessToken;
  if (!skipAuth && isExpired(token)) token = await refreshAccessToken();

  const buildHeaders = (t: string | null): Record<string, string> => {
    const h: Record<string, string> = {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers as Record<string, string> | undefined),
    };
    if (t) h.Authorization = `Bearer ${t}`;
    if (API_BASE_URL.includes("ngrok-free")) h["ngrok-skip-browser-warning"] = "true";
    return h;
  };

  const send = (t: string | null) =>
    fetchWithTimeout(`${API_BASE_URL}${path}`, {
      ...options,
      method,
      headers: buildHeaders(t),
    });

  let res: Response;
  try {
    res = await send(token);
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    if (!isGet) throw aborted ? new ApiError(NETWORK_MESSAGE, 0) : err;
    try {
      res = await send(token); // one retry — the free host stalls while waking a worker
    } catch (retryErr) {
      throw retryErr instanceof Error && retryErr.name === "AbortError"
        ? new ApiError(NETWORK_MESSAGE, 0)
        : retryErr;
    }
  }

  if (res.status === 401 && !skipAuth) {
    const fresh = await refreshAccessToken();
    if (fresh) res = await send(fresh);
  }

  if (!res.ok) throw new ApiError(await readError(res), res.status);
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}
