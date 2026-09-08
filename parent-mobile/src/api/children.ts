import { apiFetch } from "./client";

export type Child = {
  id: string;
  name: string;
  birth_date: string | null;
  photo_url: string;
  created_at: string;
  device_count: number;
};

export type ChildInput = { name: string; birth_date?: string; photo?: ImageFile | null };

/** A picked image, in the shape React Native's FormData expects. */
export type ImageFile = { uri: string; name: string; type: string };

export function getChildren(): Promise<Child[]> {
  return apiFetch("/api/children/");
}

export function createChild(input: ChildInput): Promise<Child> {
  const body = new FormData();
  body.append("name", input.name);
  if (input.birth_date) body.append("birth_date", input.birth_date);
  if (input.photo) body.append("photo", input.photo as any);
  return apiFetch("/api/children/", { method: "POST", body });
}

export function updateChild(id: string, input: Partial<ChildInput>): Promise<Child> {
  if (input.photo) {
    const body = new FormData();
    if (input.name) body.append("name", input.name);
    if (input.birth_date) body.append("birth_date", input.birth_date);
    body.append("photo", input.photo as any);
    return apiFetch(`/api/children/${id}/`, { method: "PATCH", body });
  }
  return apiFetch(`/api/children/${id}/`, {
    method: "PATCH",
    body: JSON.stringify({ name: input.name, birth_date: input.birth_date }),
  });
}

export async function deleteChild(id: string): Promise<void> {
  await apiFetch(`/api/children/${id}/`, { method: "DELETE" });
}

// --- enrollment (pairing a child's Windows device) ---

/** Called by the parent app with the 6-digit code shown by the installer. */
export function verifyEnrollCode(
  code: string,
  childId?: string,
): Promise<{ device_id: string; status: string }> {
  return apiFetch("/api/enroll/verify-code/", {
    method: "POST",
    body: JSON.stringify({ code, child_id: childId }),
  });
}
