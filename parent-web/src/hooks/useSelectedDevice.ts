"use client";

import { useSearchParams } from "next/navigation";
import { Device, getDevices } from "@/api/tracking";
import { useApiQuery } from "./useApiQuery";

/**
 * Child is the primary object; a device is one source inside it.
 *
 * A child can have a laptop, a phone and a tablet linked at once, so the UI
 * never substitutes a device for the child. `?child` picks whose data we are
 * looking at; `?device` narrows it to one of that child's devices, and its
 * absence means "all devices".
 *
 * Detail views stay device-scoped on purpose: summing screen time across
 * devices would double-count the hours a child spent on two of them at once,
 * so "all devices" shows the fleet rather than a fabricated total.
 */
export function useSelectedDevice() {
  const searchParams = useSearchParams();
  const requestedDeviceId = searchParams.get("device");
  const requestedChildId = searchParams.get("child");

  const { data, loading, error, refetch } = useApiQuery(() => getDevices(), []);
  const all: Device[] = data ?? [];
  const linked = all.filter((d) => d.status === "linked");

  // Which child are we looking at? An explicit ?child wins; otherwise infer
  // it from ?device, then fall back to whoever owns the first linked device.
  const childId =
    requestedChildId ??
    linked.find((d) => d.id === requestedDeviceId)?.child_id ??
    linked[0]?.child_id ??
    null;

  const childDevices = childId ? linked.filter((d) => d.child_id === childId) : linked;

  // A device is only "selected" when it belongs to the current child —
  // otherwise a stale ?device from another child would silently win.
  const device = childDevices.find((d) => d.id === requestedDeviceId) ?? null;

  // With a single device there is no meaningful "all" mode: the fleet view
  // and the device view would show the same thing, so detail pages just use it.
  const effectiveDevice = device ?? (childDevices.length === 1 ? childDevices[0] : null);

  return {
    devices: all,
    /** Every linked device belonging to the selected child. */
    childDevices,
    childId,
    /** The explicitly selected device, or null in "all devices" mode. */
    device: effectiveDevice,
    deviceId: effectiveDevice?.id ?? "",
    /** True when no single device is chosen and the child owns more than one. */
    allDevices: effectiveDevice === null && childDevices.length > 1,
    loading,
    error,
    refetch,
  };
}
