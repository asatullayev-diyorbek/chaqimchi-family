const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (BASE_URL.includes("ngrok-free.dev") || BASE_URL.includes("ngrok-free.app")) {
    headers["ngrok-skip-browser-warning"] = "true";
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status}: ${body}`);
  }
  return response.status === 204 ? null : response.json();
}
