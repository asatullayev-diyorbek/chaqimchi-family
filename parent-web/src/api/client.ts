export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
export function mediaUrl(path: string): string {
  if (!path) return "";
  try {
    const parsed = new URL(path, API_BASE_URL);
    if (parsed.pathname.startsWith("/media/")) return parsed.pathname;
  } catch { /* fall through to the API URL */ }
  return /^https?:\/\//i.test(path) ? path : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

const TOKEN_KEY = "chaqimchi_access_token";
const REFRESH_TOKEN_KEY = "chaqimchi_refresh_token";

export function setAccessToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

export function setTokens(access: string, refresh: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, access);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
}

export function clearTokens() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getAccessToken(): string | null {
	if (typeof window === "undefined") return null;
	const token = window.localStorage.getItem(TOKEN_KEY);
	if (!token) return null;

	// Keep an expired but well-formed token until apiFetch can exchange the
	// stored refresh token. This prevents route guards from sending a parent to
	// login during an otherwise recoverable access-token refresh.
	try {
		const payload = JSON.parse(atob(token.split(".")[1]));
		if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) {
			return token;
		}
	} catch {
		return null;
	}
	return token;
}

function isTokenExpired(token: string | null): boolean {
	if (!token) return true;
	try {
		const payload = JSON.parse(atob(token.split(".")[1]));
		// Treat a token that dies within 30s as already expired so we refresh
		// once up front instead of eating a 401 round trip mid-request.
		return typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now() + 30_000;
	} catch {
		return true;
	}
}

type ApiFetchOptions = RequestInit & { skipAuth?: boolean };

const GET_CACHE_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 25_000;
const getCache = new Map<string, { expiresAt: number; value: unknown }>();
const inFlightGets = new Map<string, Promise<unknown>>();

function clearApiCache() {
  getCache.clear();
}

function cacheKey(path: string, token: string | null): string {
  return `${token ?? "anonymous"}:${path}`;
}

function requestHeaders(options: RequestInit, token: string | null): Record<string, string> {
  const headers: Record<string, string> = { ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...(options.headers as Record<string, string> | undefined) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (API_BASE_URL.includes("ngrok-free.dev") || API_BASE_URL.includes("ngrok-free.app")) headers["ngrok-skip-browser-warning"] = "true";
  return headers;
}

let inFlightRefresh: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  // Parallel requests (the dashboard fires several at once) must share a
  // single refresh call — otherwise each one POSTs the refresh token and
  // hammers the single-worker backend, and the responses race.
  if (inFlightRefresh) return inFlightRefresh;
  const refresh = getRefreshToken();
  if (!refresh) return null;
  inFlightRefresh = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login/refresh/`, { method: "POST", headers: requestHeaders({}, null), body: JSON.stringify({ refresh }) });
      if (!response.ok) throw new Error("Refresh token invalid");
      const data = await response.json() as { access: string };
      setAccessToken(data.access);
      return data.access;
    } catch {
      clearTokens();
      return null;
    } finally {
      inFlightRefresh = null;
    }
  })();
  return inFlightRefresh;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function apiFetch(path: string, { skipAuth = false, ...options }: ApiFetchOptions = {}) {
  const method = (options.method ?? "GET").toUpperCase();
  let token = skipAuth ? null : getAccessToken();
  // Refresh up front when the token is missing or (nearly) expired, so a
  // burst of parallel requests doesn't each trigger its own 401 → refresh.
  if (!skipAuth && isTokenExpired(token)) token = await refreshAccessToken();
  const isGet = method === "GET";
  const key = isGet ? cacheKey(path, token) : "";
  if (isGet) {
    const cached = getCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const pending = inFlightGets.get(key);
    if (pending) return pending;
  }

  const request = (async () => {
    let response: Response;
    try {
      response = await fetchWithTimeout(`${API_BASE_URL}${path}`, { ...options, method, headers: requestHeaders(options, token) });
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "AbortError";
      const friendly = new Error("So‘rov javob bermadi. Internet aloqasini tekshiring va qayta urinib ko‘ring.");
      // Timeout or network drop. GETs are safe to retry once — the free host
      // occasionally stalls a request while it wakes a worker.
      if (!isGet) throw timedOut ? friendly : err;
      try {
        response = await fetchWithTimeout(`${API_BASE_URL}${path}`, { ...options, method, headers: requestHeaders(options, token) });
      } catch (retryErr) {
        throw retryErr instanceof Error && retryErr.name === "AbortError" ? friendly : retryErr;
      }
    }
    if (response.status === 401 && !skipAuth) {
      const refreshed = await refreshAccessToken();
      if (refreshed) response = await fetchWithTimeout(`${API_BASE_URL}${path}`, { ...options, method, headers: requestHeaders(options, refreshed) });
    }
    if (!response.ok) {
      const bodyText = await response.text();
      let errorMessage = `Xatolik yuz berdi (${response.status})`;
      try {
        const bodyJson = JSON.parse(bodyText);
        if (bodyJson.detail) {
          errorMessage = bodyJson.detail;
        } else if (bodyJson.non_field_errors && bodyJson.non_field_errors.length > 0) {
          errorMessage = bodyJson.non_field_errors[0];
        } else {
          const firstKey = Object.keys(bodyJson)[0];
          if (firstKey && Array.isArray(bodyJson[firstKey])) {
            errorMessage = bodyJson[firstKey][0];
          } else if (typeof bodyJson === 'string') {
            errorMessage = bodyJson;
          } else if (typeof bodyJson.error === 'string') {
            errorMessage = bodyJson.error;
          }
        }
      } catch {
        if (bodyText) errorMessage = bodyText;
      }
      throw new Error(errorMessage);
    }
    const value = response.status === 204 ? null : await response.json();
    if (isGet) getCache.set(key, { expiresAt: Date.now() + GET_CACHE_TTL_MS, value });
    else clearApiCache();
    return value;
  })();

  if (isGet) {
    inFlightGets.set(key, request);
    request.then(
      () => inFlightGets.delete(key),
      () => inFlightGets.delete(key),
    );
  }
  return request;
}
