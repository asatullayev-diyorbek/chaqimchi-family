"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";

/**
 * One place for the fetch-into-state pattern every page was hand-rolling:
 * loading flag, error capture, cancel-on-unmount, and a refetch trigger.
 *
 * Why a reducer rather than three useStates: the lint rule
 * react-hooks/set-state-in-effect forbids setting state synchronously from an
 * effect, and the pages worked around it with `setTimeout(fn, 0)`. That hack
 * already produced one real bug — a fast/cached response resolved before the
 * 0ms timer, so the timer then flipped `loading` back to true with nothing
 * left to clear it, and the tab sat on "yuklanmoqda" forever. A dispatch
 * carries no such ordering trap.
 */

type State<T> = { data: T | null; loading: boolean; error: Error | null };

type Action<T> =
  | { type: "start" }
  | { type: "success"; data: T }
  | { type: "failure"; error: Error };

function reducer<T>(state: State<T>, action: Action<T>): State<T> {
  switch (action.type) {
    case "start":
      // Keep the previous data visible while refetching — swapping to a
      // spinner on every poll makes the page flicker.
      return { ...state, loading: true, error: null };
    case "success":
      return { data: action.data, loading: false, error: null };
    case "failure":
      return { ...state, loading: false, error: action.error };
  }
}

export type ApiQuery<T> = State<T> & { refetch: () => void };

export function useApiQuery<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
  options: { enabled?: boolean } = {},
): ApiQuery<T> {
  const enabled = options.enabled !== false;
  const [state, dispatch] = useReducer(reducer<T>, {
    data: null,
    loading: enabled,
    error: null,
  });
  const [nonce, bump] = useReducer((n: number) => n + 1, 0);

  // The fetcher is usually an inline arrow, so it changes identity every
  // render; the caller's `deps` decide when to refetch, not the function.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    dispatch({ type: "start" });
    fetcherRef
      .current()
      .then((data) => {
        if (active) dispatch({ type: "success", data });
      })
      .catch((cause) => {
        if (active) dispatch({ type: "failure", error: cause instanceof Error ? cause : new Error(String(cause)) });
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled]);

  return { ...state, refetch: useCallback(() => bump(), []) };
}
