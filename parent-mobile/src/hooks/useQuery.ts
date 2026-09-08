import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client";

type State<T> = {
  data: T | null;
  error: ApiError | Error | null;
  /** True only on the first load — a background refetch never blanks the screen. */
  loading: boolean;
  refreshing: boolean;
};

type Options = { enabled?: boolean };

/**
 * Minimal async data hook. Re-runs when a dependency in `deps` changes,
 * de-dupes against stale responses, and exposes `refetch` for pull-to-refresh.
 */
export function useQuery<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList,
  { enabled = true }: Options = {},
) {
  const [state, setState] = useState<State<T>>({
    data: null,
    error: null,
    loading: enabled,
    refreshing: false,
  });
  const runId = useRef(0);
  const hasData = useRef(false);

  const run = useCallback(
    async (mode: "initial" | "refresh") => {
      if (!enabled) return;
      const id = ++runId.current;
      setState((s) => ({
        ...s,
        loading: mode === "initial" && !hasData.current,
        refreshing: mode === "refresh",
        error: null,
      }));
      try {
        const data = await fetcher();
        if (id !== runId.current) return;
        hasData.current = true;
        setState({ data, error: null, loading: false, refreshing: false });
      } catch (err) {
        if (id !== runId.current) return;
        setState((s) => ({
          ...s,
          error: err instanceof Error ? err : new Error(String(err)),
          loading: false,
          refreshing: false,
        }));
      }
    },
    // Note: `fetcher` identity is intentionally NOT a dependency — many call
    // sites pass an inline arrow. List every value the fetcher closes over in
    // `deps` instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, ...deps],
  );

  useEffect(() => {
    hasData.current = false;
    if (enabled) run("initial");
    else setState({ data: null, error: null, loading: false, refreshing: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  return {
    ...state,
    refetch: () => run("refresh"),
    reload: () => run("initial"),
  };
}
