import { apiFetch } from "./client";

export async function verifyCode(code: string) {
  return apiFetch("/api/enroll/verify-code/", {
    method: "POST",
    body: JSON.stringify({ code }),
  }) as Promise<{ device_id: string; status: string }>;
}
