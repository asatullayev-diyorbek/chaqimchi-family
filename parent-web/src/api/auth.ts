import { apiFetch, clearTokens, setTokens } from "./client";

export async function signup(email: string, password: string) {
  return apiFetch("/api/auth/signup/", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    skipAuth: true,
  });
}

export async function login(email: string, password: string) {
  const tokens = await apiFetch("/api/auth/login/", {
    method: "POST",
    body: JSON.stringify({ email, password }),
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
  email: string;
  family: string;
  created_at: string;
};

export async function getCurrentUser(): Promise<CurrentUser> {
  return apiFetch("/api/auth/me/");
}
