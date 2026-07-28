import { apiFetch } from "./client";

export type TopApp = {
  app: string;
  minutes: number;
};

export type DeviceSummary = {
  device_id: string;
  date: string;
  total_screen_minutes: number;
  top_apps: TopApp[];
  device_status: "online" | "offline";
  last_sync: string | null;
};

export type Device = {
  id: string;
  child_name: string;
  status: "unlinked" | "linked";
  last_sync: string | null;
};

export async function getDevices(): Promise<Device[]> {
  return apiFetch("/api/devices/");
}

// Where to land right after login/signup: Home if the family already has a
// linked device, otherwise the enrollment (QR scan) screen.
export async function resolvePostLoginRoute(): Promise<"Home" | "QRScan"> {
  const devices = await getDevices();
  return devices.some((d) => d.status === "linked") ? "Home" : "QRScan";
}

export async function getSummary(deviceId: string, date?: string): Promise<DeviceSummary> {
  const query = date ? `?date=${date}` : "";
  return apiFetch(`/api/tracking/summary/${deviceId}/${query}`);
}
