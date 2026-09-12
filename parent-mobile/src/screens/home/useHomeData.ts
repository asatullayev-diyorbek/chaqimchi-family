import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAlerts } from "../../api/alerts";
import { getDailyLimitMinutes, getRules } from "../../api/rules";
import { DayBreakdown, Device, DeviceSummary, getSummary } from "../../api/tracking";
import { useFamily } from "../../state/family";

export type HomeDevice = {
  device: Device;
  summary: DeviceSummary | null;
  online: boolean;
  todayMinutes: number;
  limitMinutes: number | null;
  battery: number | null;
};

// Home's screen mounts fresh whenever the app remounts the navigator (e.g.
// a dark/light toggle, which repaints every screen by remounting them — see
// App.tsx) even though nothing about the child's data actually changed. A
// short-lived cache keyed by child+device+scope lets the next mount paint
// instantly with the last known numbers instead of a loading skeleton,
// while still kicking off a real fetch behind it to catch up.
const homeCache = new Map<string, { data: HomeData; ts: number }>();
const HOME_CACHE_TTL_MS = 20_000;

export type HomeData = {
  /** Screen-time figure for the current device scope. */
  scopeMinutes: number;
  /** Limit for the current scope — null in "all devices" mode (per-device). */
  scopeLimit: number | null;
  /** True when the scope is "all devices" and the child owns more than one. */
  isAllScope: boolean;
  /** Per-device rows for the devices section. */
  devices: HomeDevice[];
  /** Last-7-days breakdown for the current scope. */
  weekBreakdown: DayBreakdown[];
  weekAverage: number;
  unseenAlerts: number;
  /** Most-recently-used app on the scoped device (by last_used_at). */
  lastApp: string | null;
};

/**
 * Home always shows the selected child's OVERALL numbers — the device a
 * parent last picked on Activity/Rules/Reports is a global pick shared
 * across those screens, but the dashboard must not silently inherit it and
 * start scoping to one device behind the parent's back. So Home only ever
 * narrows to a single device when the child literally owns just one;
 * otherwise it's always "every device", screen time summed with an explicit
 * "N qurilmada jami" label and no per-device limit/progress.
 */
export function useHomeData() {
  const {
    selectedChild,
    childDevices,
    activeDevice: globalActiveDevice,
    loading: familyLoading,
    reload: reloadFamily,
  } = useFamily();

  // Ignore the globally-selected device whenever there's more than one —
  // Home's own scope, never the one Activity/Rules/Reports left behind.
  const scopeDevice = childDevices.length > 1 ? null : globalActiveDevice;

  const deviceKey = childDevices.map((d) => d.id).join(",");
  const scopeKey = scopeDevice?.id ?? "all";
  const cacheKey = `${selectedChild?.id ?? ""}|${deviceKey}|${scopeKey}`;

  const [data, setData] = useState<HomeData | null>(() => {
    const hit = homeCache.get(cacheKey);
    return hit && Date.now() - hit.ts < HOME_CACHE_TTL_MS ? hit.data : null;
  });
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  const build = useCallback(async () => {
    if (childDevices.length === 0) {
      setData(null);
      return;
    }
    try {
      setError(null);
      const rows = await Promise.all(
        childDevices.map(async (device): Promise<HomeDevice> => {
          const [day, rules] = await Promise.all([
            getSummary(device.id).catch(() => null),
            getRules(device.id).catch(() => []),
          ]);
          return {
            device,
            summary: day,
            online: day?.device_status === "online",
            todayMinutes: day?.total_screen_minutes ?? 0,
            limitMinutes: getDailyLimitMinutes(rules),
            battery: typeof day?.battery_percent === "number" ? day.battery_percent : null,
          };
        }),
      );

      const scopeDevices = scopeDevice ? rows.filter((r) => r.device.id === scopeDevice.id) : rows;
      const scopeMinutes = scopeDevices.reduce((t, r) => t + r.todayMinutes, 0);
      const scopeLimit = scopeDevice ? scopeDevices[0]?.limitMinutes ?? null : null;

      // Week breakdown: the scoped device alone, or every device the child
      // owns summed per day — a single device's breakdown would otherwise
      // hide the days the child mainly used a different one.
      let weekBreakdown: DayBreakdown[];
      if (scopeDevice) {
        const week = await getSummary(scopeDevice.id, { range: "week" }).catch(() => null);
        weekBreakdown = (week?.breakdown ?? []).slice(-7);
      } else {
        const weeks = await Promise.all(
          scopeDevices.map((r) => getSummary(r.device.id, { range: "week" }).catch(() => null)),
        );
        const byDate = new Map<string, number>();
        for (const week of weeks) {
          for (const day of (week?.breakdown ?? []).slice(-7)) {
            byDate.set(day.date, (byDate.get(day.date) ?? 0) + (day.total_minutes || 0));
          }
        }
        weekBreakdown = Array.from(byDate, ([date, total_minutes]) => ({ date, total_minutes })).sort(
          (a, b) => a.date.localeCompare(b.date),
        );
      }
      const nonZero = weekBreakdown.map((b) => b.total_minutes || 0).filter((m) => m > 0);
      const weekAverage = nonZero.length ? Math.round(nonZero.reduce((a, b) => a + b, 0) / nonZero.length) : 0;

      const alertLists = await Promise.all(
        childDevices.map((d) => getAlerts(d.id).catch(() => [])),
      );

      // Most-recently-used app across the scoped devices, by last_used_at.
      const apps = scopeDevices
        .flatMap((r) => r.summary?.top_apps ?? [])
        .filter((a) => a.last_used_at);
      apps.sort(
        (a, b) => new Date(b.last_used_at!).getTime() - new Date(a.last_used_at!).getTime(),
      );
      const lastApp = apps[0]?.app ?? null;

      const next: HomeData = {
        scopeMinutes,
        scopeLimit,
        isAllScope: scopeDevice === null,
        devices: rows,
        weekBreakdown,
        weekAverage,
        unseenAlerts: alertLists.flat().filter((a) => !a.seen).length,
        lastApp,
      };
      homeCache.set(cacheKey, { data: next, ts: Date.now() });
      if (mounted.current) setData(next);
    } catch (e: any) {
      if (mounted.current) setError(e?.message ?? "Ma'lumot yuklanmadi");
    }
  }, [deviceKey, scopeKey, scopeDevice, childDevices, cacheKey]);

  useEffect(() => {
    mounted.current = true;
    if (!familyLoading) build();
    return () => {
      mounted.current = false;
    };
  }, [familyLoading, build]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await reloadFamily();
    await build();
    setRefreshing(false);
  }, [reloadFamily, build]);

  return {
    child: selectedChild,
    data,
    loading: familyLoading || (data === null && childDevices.length > 0 && !error),
    refreshing,
    error,
    refresh,
    hasDevice: childDevices.length > 0,
    deviceCount: childDevices.length,
    /** Home's own scope — null unless the child owns exactly one device. */
    scopeDevice,
  };
}
