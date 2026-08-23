import { apiFetch } from "./client";

export type Child = { id: string; name: string; birth_date: string | null; photo_url: string; created_at: string; device_count: number };
export type ChildInput = { name: string; birth_date?: string; photo?: File | null };

export function getChildren(): Promise<Child[]> {
  return apiFetch("/api/children/");
}

export function createChild(input: ChildInput): Promise<Child> {
  const body = new FormData(); body.append("name", input.name); if (input.birth_date) body.append("birth_date", input.birth_date); if (input.photo) body.append("photo", input.photo);
  return apiFetch("/api/children/", { method: "POST", body });
}

export function updateChild(id: string, input: Partial<ChildInput> & { remove_photo?: boolean }): Promise<Child> {
  if (input.photo instanceof File) { const body = new FormData(); if (input.name) body.append("name", input.name); if (input.birth_date) body.append("birth_date", input.birth_date); body.append("photo", input.photo); return apiFetch(`/api/children/${id}/`, { method: "PATCH", body }); }
  return apiFetch(`/api/children/${id}/`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteChild(id: string): Promise<void> {
  return apiFetch(`/api/children/${id}/`, { method: "DELETE" });
}
