import { apiFetch } from "./client";

export type AlertPref = {
  alert_type: string;
  label: string;
  via_telegram: boolean;
};

export type NotificationPrefs = {
  telegram: { linked: boolean; username: string };
  alerts: AlertPref[];
};

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  return apiFetch("/api/alerts/preferences/", { noCache: true });
}

export async function updateNotificationPrefs(
  alerts: { alert_type: string; via_telegram: boolean }[],
): Promise<NotificationPrefs> {
  return apiFetch("/api/alerts/preferences/", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alerts }),
  });
}

export async function telegramLinkStart(): Promise<{ token: string; bot_url: string }> {
  return apiFetch("/api/auth/telegram/link/start/", { method: "POST" });
}

export async function telegramLinkStatus(
  token: string,
): Promise<{ status: "pending" | "linked" | "rejected" | "expired" }> {
  return apiFetch(`/api/auth/telegram/link/status/${token}/`, { noCache: true });
}

export async function telegramUnlink(): Promise<{ status: string }> {
  return apiFetch("/api/auth/telegram/unlink/", { method: "POST" });
}
