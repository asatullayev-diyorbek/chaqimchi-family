import { apiFetch, setAccessToken } from "./client";

export async function signup(email: string, password: string) {
  return apiFetch("/api/auth/signup/", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email: string, password: string) {
  const tokens = await apiFetch("/api/auth/login/", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setAccessToken(tokens.access);
  return tokens as { access: string; refresh: string };
}

export function logout() {
  setAccessToken(null);
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
