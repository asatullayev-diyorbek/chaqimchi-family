import { useCallback, useEffect, useState } from "react";
import { getAlerts } from "../../api/alerts";
import { getRules, getDailyLimitMinutes } from "../../api/rules";
import { DayBreakdown, DeviceSummary, getSummary } from "../../api/tracking";
import { useFamily } from "../../state/family";

export type ChildGlance = {
  childId: string;
  name: string;
  photoUrl: string;
  hasDevice: boolean;
  deviceCount: number;
  online: boolean;
  /** The child's most-active device today — what the card headlines. */
  primaryDeviceId: string | null;
  todayMinutes: number;
  limitMinutes: number | null;
  currentApp: string | null;
  unseenAlerts: number;
  weekMinutes: number;
  /** Primary device's last-7-days breakdown (for the single-child trend). */
  weekBreakdown: DayBreakdown[];
};

/**
 * Home aggregates per child. Screen time is taken from the child's single
 * most-active device today — never summed across devices, which would
 * double-count time on two devices at once (see the audit / useSelectedDevice).
 */
export function useHomeData() {
  const { children, linkedDevices, loading: familyLoading, reload: reloadFamily } = useFamily();
  const [glances, setGlances] = useState<ChildGlance[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const build = useCallback(async () => {
    try {
      setError(null);
      const result = await Promise.all(
        children.map(async (child): Promise<ChildGlance> => {
          const own = linkedDevices.filter((d) => d.child_id === child.id);
          const [summaries, weekSummaries, alertLists] = await Promise.all([
            Promise.all(own.map((d) => getSummary(d.id).catch(() => null))),
            Promise.all(own.map((d) => getSummary(d.id, { range: "week" }).catch(() => null))),
            Promise.all(own.map((d) => getAlerts(d.id).catch(() => []))),
          ]);
          const valid = summaries.filter((s): s is DeviceSummary => s != null);
          const primary =
            valid.slice().sort((a, b) => b.total_screen_minutes - a.total_screen_minutes)[0] ?? null;
          const primaryRules = primary
            ? await getRules(primary.device_id).catch(() => [])
            : [];
          const validWeeks = weekSummaries.filter((s): s is DeviceSummary => s != null);
          const week = validWeeks.reduce(
            (max, s) => Math.max(max, (s.breakdown ?? []).reduce((t, b) => t + (b.total_minutes || 0), 0)),
            0,
          );
          const primaryWeek =
            (primary && validWeeks.find((s) => s.device_id === primary.device_id)) ??
            validWeeks[0] ??
            null;
          return {
            childId: child.id,
            name: child.name,
            photoUrl: child.photo_url,
            hasDevice: own.length > 0,
            deviceCount: own.length,
            online: valid.some((s) => s.device_status === "online"),
            primaryDeviceId: primary?.device_id ?? null,
            todayMinutes: primary?.total_screen_minutes ?? 0,
            limitMinutes: getDailyLimitMinutes(primaryRules),
            currentApp:
              primary && primary.device_status === "online" ? primary.top_apps[0]?.app ?? null : null,
            unseenAlerts: alertLists.flat().filter((a) => !a.seen).length,
            weekMinutes: week,
            weekBreakdown: (primaryWeek?.breakdown ?? []).slice(-7),
          };
        }),
      );
      setGlances(result);
    } catch (e: any) {
      setError(e?.message ?? "Ma'lumot yuklanmadi");
    }
  }, [children, linkedDevices]);

  useEffect(() => {
    if (!familyLoading) build();
  }, [familyLoading, build]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await reloadFamily();
    await build();
    setRefreshing(false);
  }, [reloadFamily, build]);

  return {
    glances,
    loading: familyLoading || glances === null,
    refreshing,
    error,
    refresh,
    hasChildren: children.length > 0,
    hasAnyDevice: linkedDevices.length > 0,
  };
}
