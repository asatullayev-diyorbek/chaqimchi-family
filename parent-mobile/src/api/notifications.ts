import { apiFetch } from "./client";

export type AlertPref = { alert_type: string; label: string; via_telegram: boolean };

export type NotificationPrefs = {
  telegram: { linked: boolean; username: string };
  alerts: AlertPref[];
};

export function getNotificationPrefs(): Promise<NotificationPrefs> {
  return apiFetch("/api/alerts/preferences/");
}

export function updateNotificationPrefs(
  alerts: { alert_type: string; via_telegram: boolean }[],
): Promise<NotificationPrefs> {
  return apiFetch("/api/alerts/preferences/", {
    method: "PUT",
    body: JSON.stringify({ alerts }),
  });
}

export function telegramLinkStart(): Promise<{ token: string; bot_url: string }> {
  return apiFetch("/api/auth/telegram/link/start/", { method: "POST" });
}

export function telegramLinkStatus(
  token: string,
): Promise<{ status: "pending" | "linked" | "rejected" | "expired" }> {
  return apiFetch(`/api/auth/telegram/link/status/${token}/`);
}

export function telegramUnlink(): Promise<{ status: string }> {
  return apiFetch("/api/auth/telegram/unlink/", { method: "POST" });
}
