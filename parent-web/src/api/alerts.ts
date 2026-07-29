import { apiFetch } from "./client";

export type AlertType = "limit_reached" | "blocked_app_opened";

export type Alert = {
  id: string;
  device: string;
  alert_type: AlertType;
  payload: Record<string, unknown>;
  triggered_at: string;
  seen: boolean;
};

export async function getAlerts(deviceId: string): Promise<Alert[]> {
  return apiFetch(`/api/alerts/${deviceId}/`);
}
