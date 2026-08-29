"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Device } from "@/api/tracking";

const PLATFORM_ICON: Record<string, string> = {
  windows: "logos:microsoft-windows-icon",
  android: "logos:android-icon",
  ios: "logos:apple-app-store",
};

export function deviceLabel(device: Device): string {
  if (device.platform === "windows") return "Windows";
  if (device.platform === "android") return "Android";
  if (device.platform === "ios") return "iPad / iPhone";
  return device.platform;
}

/**
 * Sits under the child selector: which of this child's devices are we looking
 * at? Hidden when the child owns a single device, where the choice is empty.
 *
 * The selection lives in ?device so it survives a reload and a shared link,
 * and so every page reads it from one place.
 */
export default function DeviceSelector({
  devices,
  selectedId,
}: {
  devices: Device[];
  selectedId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (devices.length < 2) return null;

  function select(deviceId: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (deviceId) params.set("device", deviceId);
    else params.delete("device");
    router.replace(`${window.location.pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
  }

  return (
    <div className="device-selector" role="group" aria-label="Qurilma tanlash">
      <button
        type="button"
        className={`device-chip ${!selectedId ? "active" : ""}`}
        aria-pressed={!selectedId}
        onClick={() => select(null)}
      >
        <iconify-icon icon="solar:devices-linear"></iconify-icon>
        Barcha qurilmalar
      </button>

      {devices.map((device) => (
        <button
          key={device.id}
          type="button"
          className={`device-chip ${selectedId === device.id ? "active" : ""}`}
          aria-pressed={selectedId === device.id}
          onClick={() => select(device.id)}
        >
          <iconify-icon icon={PLATFORM_ICON[device.platform] ?? "solar:smartphone-linear"}></iconify-icon>
          {deviceLabel(device)}
        </button>
      ))}
    </div>
  );
}
