import { apiFetch, clearTokens, setTokens } from "./client";

export async function signup(email: string, password: string) {
  return apiFetch("/api/auth/signup/", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    skipAuth: true,
  });
}

export async function login(username: string, password: string) {
  const tokens = await apiFetch("/api/auth/login/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
    skipAuth: true,
  });
  const typedTokens = tokens as { access: string; refresh: string };
  setTokens(typedTokens.access, typedTokens.refresh);
  return typedTokens;
}

export function logout() {
  clearTokens();
}

export type CurrentUser = {
  id: number;
  email: string | null;
  username: string | null;
  full_name: string;
  telegram_username: string;
  family: string;
  created_at: string;
};

export async function telegramStart(): Promise<{ token: string; bot_url: string }> {
  return apiFetch("/api/auth/telegram/start/", { method: "POST", skipAuth: true }) as Promise<{
    token: string;
    bot_url: string;
  }>;
}

export type TelegramStatus =
  | { status: "pending" }
  | { status: "expired" }
  | { status: "rejected" }
  | {
      status: "linked";
      is_new_user: boolean;
      access: string;
      refresh: string;
      username: string;
      full_name: string;
      telegram_username: string;
    };

export async function telegramStatus(token: string): Promise<TelegramStatus> {
  // Polled on a loop by the login page: must never be served from the GET
  // cache, or the poll keeps seeing the first "pending" until the TTL runs
  // out and the login appears to hang.
  const result = (await apiFetch(`/api/auth/telegram/status/${token}/`, {
    skipAuth: true,
    noCache: true,
  })) as TelegramStatus;
  if (result.status === "linked") {
    setTokens(result.access, result.refresh);
  }
  return result;
}

export async function telegramComplete(data: {
  username: string;
  full_name: string;
  password: string;
}): Promise<CurrentUser> {
  return apiFetch("/api/auth/telegram/complete/", {
    method: "POST",
    body: JSON.stringify(data),
  }) as Promise<CurrentUser>;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  return apiFetch("/api/auth/me/");
}
