import { apiFetch, clearTokens, setTokens } from "./client";

export type CurrentUser = {
  id: number;
  email: string | null;
  username: string | null;
  full_name: string;
  telegram_username: string;
  telegram_linked: boolean;
  has_password: boolean;
  family: string;
  created_at: string;
};

export async function signup(email: string, password: string): Promise<void> {
  await apiFetch("/api/auth/signup/", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    skipAuth: true,
  });
}

export async function login(identifier: string, password: string): Promise<void> {
  const tokens = await apiFetch<{ access: string; refresh: string }>("/api/auth/login/", {
    method: "POST",
    // Backend matches this against both username and email columns.
    body: JSON.stringify({ username: identifier, password }),
    skipAuth: true,
  });
  await setTokens(tokens.access, tokens.refresh);
}

export async function logout(): Promise<void> {
  await clearTokens();
}

export function getCurrentUser(): Promise<CurrentUser> {
  return apiFetch("/api/auth/me/");
}

export function updateProfile(full_name: string): Promise<CurrentUser> {
  return apiFetch("/api/auth/me/", {
    method: "PATCH",
    body: JSON.stringify({ full_name }),
  });
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  await apiFetch("/api/auth/password/change/", {
    method: "POST",
    body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
  });
}

// Password reset is delivered over Telegram (the backend has no email on the
// free host) — the UI copy must say so.
export async function resetPasswordStart(username: string): Promise<void> {
  await apiFetch("/api/auth/password/reset/start/", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ username }),
  });
}

export async function resetPasswordVerify(
  username: string,
  code: string,
  newPassword: string,
): Promise<void> {
  await apiFetch("/api/auth/password/reset/verify/", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ username, code, new_password: newPassword }),
  });
}

// --- Telegram login (bridge a browser-less deep link) ---

export function telegramStart(): Promise<{ token: string; bot_url: string }> {
  return apiFetch("/api/auth/telegram/start/", { method: "POST", skipAuth: true });
}

export type TelegramStatus =
  | { status: "pending" | "expired" | "rejected" }
  | {
      status: "linked";
      is_new_user: boolean;
      access: string;
      refresh: string;
      username: string;
      full_name: string;
      telegram_username: string;
    };

/**
 * Telegram Mini App auto-login: hand the backend the signed `initData` string
 * from window.Telegram.WebApp; it verifies the signature and returns JWTs,
 * creating the parent account on first open.
 */
export async function telegramWebAppLogin(
  initData: string,
): Promise<{ is_new_user: boolean }> {
  const res = await apiFetch<{ access: string; refresh: string; is_new_user: boolean }>(
    "/api/auth/telegram/webapp/",
    { method: "POST", body: JSON.stringify({ init_data: initData }), skipAuth: true },
  );
  await setTokens(res.access, res.refresh);
  return { is_new_user: res.is_new_user };
}

export async function telegramStatus(token: string): Promise<TelegramStatus> {
  const result = await apiFetch<TelegramStatus>(`/api/auth/telegram/status/${token}/`, {
    skipAuth: true,
  });
  if (result.status === "linked") await setTokens(result.access, result.refresh);
  return result;
}
