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
 * Home is scoped to ONE child (chosen in the header) and ONE device scope
 * (chosen in the devices section). Screen time is never silently summed:
 * "Barcha qurilmalar" adds the devices' minutes only with an explicit
 * "N qurilmada jami" label and drops the per-device limit/progress.
 */
export function useHomeData() {
  const {
    selectedChild,
    childDevices,
    activeDevice,
    allDevices,
    loading: familyLoading,
    reload: reloadFamily,
  } = useFamily();

  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  const deviceKey = childDevices.map((d) => d.id).join(",");
  const scopeKey = activeDevice?.id ?? (allDevices ? "all" : "none");

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

      const scopeDevices = activeDevice ? rows.filter((r) => r.device.id === activeDevice.id) : rows;
      const scopeMinutes = scopeDevices.reduce((t, r) => t + r.todayMinutes, 0);
      const scopeLimit = activeDevice ? scopeDevices[0]?.limitMinutes ?? null : null;

      // Week breakdown: the scoped device, or the most-active one in "all".
      const weekTarget =
        activeDevice?.id ??
        rows.slice().sort((a, b) => b.todayMinutes - a.todayMinutes)[0]?.device.id ??
        null;
      const week = weekTarget
        ? await getSummary(weekTarget, { range: "week" }).catch(() => null)
        : null;
      const weekBreakdown = (week?.breakdown ?? []).slice(-7);
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

      if (mounted.current) {
        setData({
          scopeMinutes,
          scopeLimit,
          isAllScope: allDevices,
          devices: rows,
          weekBreakdown,
          weekAverage,
          unseenAlerts: alertLists.flat().filter((a) => !a.seen).length,
          lastApp,
        });
      }
    } catch (e: any) {
      if (mounted.current) setError(e?.message ?? "Ma'lumot yuklanmadi");
    }
  }, [deviceKey, scopeKey, activeDevice, allDevices, childDevices]);

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
  };
}
