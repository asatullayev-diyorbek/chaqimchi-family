import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useApiQuery } from "./useApiQuery";

describe("useApiQuery", () => {
  it("starts loading and resolves with data", async () => {
    const { result } = renderHook(() => useApiQuery(() => Promise.resolve({ n: 1 }), []));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ n: 1 });
    expect(result.current.error).toBeNull();
  });

  it("settles loading to false when the fetch rejects", async () => {
    // The bug the setTimeout(fn, 0) workaround caused was a stuck spinner, so
    // this is the property that matters most: loading always settles.
    const { result } = renderHook(() => useApiQuery(() => Promise.reject(new Error("boom")), []));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.message).toBe("boom");
  });

  it("settles loading even when the promise resolves immediately", async () => {
    // A cached apiFetch response resolves on the microtask queue — earlier
    // than a 0ms macrotask. That ordering is what left the tab stuck.
    const { result } = renderHook(() => useApiQuery(async () => "cached", []));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe("cached");
  });

  it("refetches when a dep changes", async () => {
    const fetcher = vi.fn().mockResolvedValue("x");
    const { result, rerender } = renderHook(({ id }) => useApiQuery(() => fetcher(id), [id]), {
      initialProps: { id: "a" },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetcher).toHaveBeenCalledTimes(1);

    rerender({ id: "b" });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(fetcher).toHaveBeenLastCalledWith("b");
  });

  it("does not refetch when only the fetcher identity changes", async () => {
    // Pages pass an inline arrow, so the function is new on every render.
    const fetcher = vi.fn().mockResolvedValue("x");
    const { result, rerender } = renderHook(() => useApiQuery(() => fetcher(), []));
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender();
    rerender();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("refetch() triggers a new request", async () => {
    const fetcher = vi.fn().mockResolvedValue("x");
    const { result } = renderHook(() => useApiQuery(() => fetcher(), []));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.refetch());
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });

  it("keeps previous data visible while refetching", async () => {
    const fetcher = vi.fn().mockResolvedValue("first");
    const { result } = renderHook(() => useApiQuery(() => fetcher(), []));
    await waitFor(() => expect(result.current.data).toBe("first"));

    fetcher.mockResolvedValue("second");
    act(() => result.current.refetch());
    // Mid-flight: still showing the old value rather than blanking out.
    expect(result.current.data).toBe("first");
    await waitFor(() => expect(result.current.data).toBe("second"));
  });

  it("ignores a response that lands after unmount", async () => {
    let settle: (v: string) => void = () => {};
    const { result, unmount } = renderHook(() =>
      useApiQuery(() => new Promise<string>((res) => { settle = res; }), []),
    );
    unmount();
    settle("late");
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current.data).toBeNull();
  });

  it("does not fetch at all when disabled", async () => {
    const fetcher = vi.fn().mockResolvedValue("x");
    const { result } = renderHook(() => useApiQuery(() => fetcher(), [], { enabled: false }));
    await new Promise((r) => setTimeout(r, 10));
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });
});
