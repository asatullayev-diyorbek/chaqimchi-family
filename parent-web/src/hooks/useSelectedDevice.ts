"use client";

import { useSearchParams } from "next/navigation";
import { Device, getDevices } from "@/api/tracking";
import { useApiQuery } from "./useApiQuery";

/**
 * The device a page should show, and the list to choose from.
 *
 * The same fallback chain — explicit ?device, then the linked device for
 * ?child, then any linked device, then whatever exists — was written out by
 * hand in four pages. Now there is one copy, so a change to how a device is
 * picked can't apply to only three of them.
 */
export function useSelectedDevice() {
  const searchParams = useSearchParams();
  const requestedDeviceId = searchParams.get("device");
  const requestedChildId = searchParams.get("child");

  const { data: devices, loading, error, refetch } = useApiQuery(() => getDevices(), []);

  const list: Device[] = devices ?? [];
  const device =
    list.find((d) => d.id === requestedDeviceId) ??
    list.find((d) => d.child_id === requestedChildId && d.status === "linked") ??
    list.find((d) => d.status === "linked") ??
    list[0] ??
    null;

  return { devices: list, device, deviceId: device?.id ?? "", loading, error, refetch };
}
