import { beforeEach, describe, expect, it, vi } from "vitest";

// Every test gets a fresh module instance, because apiFetch's cache and
// in-flight maps are module-level state.
async function freshClient() {
  vi.resetModules();
  return import("./client");
}

// A factory, not a shared object: a Response body can only be read once,
// so every mocked call needs its own.
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Minimal well-formed JWT — getAccessToken() parses the payload segment. */
function jwt(expSecondsFromNow: number) {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return [b64({ alg: "HS256" }), b64({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow }), "sig"].join(".");
}

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal("window", { localStorage: { getItem: (k: string) => store.get(k) ?? null } });
});

describe("apiFetch caching", () => {
  it("serves a repeated GET from cache instead of refetching", async () => {
    const { apiFetch } = await freshClient();
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse({ status: "ok" }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/api/thing/", { skipAuth: true });
    await apiFetch("/api/thing/", { skipAuth: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never caches a GET marked noCache", async () => {
    // The Telegram login regression: the page polls this endpoint on a loop,
    // and a cached "pending" hid the state change it existed to detect.
    const { apiFetch } = await freshClient();
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => jsonResponse({ status: "pending" }))
      .mockImplementationOnce(async () => jsonResponse({ status: "linked" }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await apiFetch("/api/poll/", { skipAuth: true, noCache: true });
    const second = await apiFetch("/api/poll/", { skipAuth: true, noCache: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(first).toEqual({ status: "pending" });
    expect(second).toEqual({ status: "linked" });
  });

  it("does not wipe the cache when a noCache GET completes", async () => {
    // A polled GET is still a read. If it fell into the mutation branch it
    // would call clearApiCache() on every tick and evict everyone else.
    const { apiFetch } = await freshClient();
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/api/cached/", { skipAuth: true });
    await apiFetch("/api/poll/", { skipAuth: true, noCache: true });
    await apiFetch("/api/cached/", { skipAuth: true });

    // /api/cached/ once, /api/poll/ once — the third call was still cached.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("clears cached reads after a mutation", async () => {
    const { apiFetch } = await freshClient();
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/api/list/", { skipAuth: true });
    await apiFetch("/api/list/", { method: "POST", skipAuth: true, body: "{}" });
    await apiFetch("/api/list/", { skipAuth: true });

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("dedupes concurrent identical GETs into one request", async () => {
    const { apiFetch } = await freshClient();
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([
      apiFetch("/api/same/", { skipAuth: true }),
      apiFetch("/api/same/", { skipAuth: true }),
      apiFetch("/api/same/", { skipAuth: true }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("getAccessToken", () => {
  it("returns null when there is no token", async () => {
    const { getAccessToken } = await freshClient();
    expect(getAccessToken()).toBeNull();
  });

  it("keeps an expired but well-formed token so apiFetch can refresh it", async () => {
    const { getAccessToken } = await freshClient();
    const expired = jwt(-100);
    store.set("chaqimchi_access_token", expired);
    expect(getAccessToken()).toBe(expired);
  });

  it("rejects a malformed token", async () => {
    const { getAccessToken } = await freshClient();
    store.set("chaqimchi_access_token", "not-a-jwt");
    expect(getAccessToken()).toBeNull();
  });
});

describe("error surfacing", () => {
  it("prefers the server's detail message", async () => {
    const { apiFetch } = await freshClient();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => jsonResponse({ detail: "Qurilma topilmadi" }, 404)));
    await expect(apiFetch("/api/x/", { skipAuth: true })).rejects.toThrow("Qurilma topilmadi");
  });

  it("falls back to a field error when there is no detail", async () => {
    const { apiFetch } = await freshClient();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => jsonResponse({ code: ["Kod noto'g'ri"] }, 400)));
    await expect(apiFetch("/api/x/", { skipAuth: true })).rejects.toThrow("Kod noto'g'ri");
  });
});
