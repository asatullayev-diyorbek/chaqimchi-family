import { apiFetch } from "./client";

export type TaskType = "channel_join" | "referral" | "instagram_story" | "telegram_story";
export type TaskStatus = "pending" | "approved" | "rejected" | null;

export type TaskItem = {
  type: TaskType;
  title: string;
  description: string;
  reward_uzs: number;
  target_url: string;
  status: TaskStatus;
  note: string;
};

export type TaskBoard = {
  balance_uzs: number;
  short_id: string;
  referral_link: string;
  tasks: TaskItem[];
};

export function getTasks(): Promise<TaskBoard> {
  return apiFetch("/api/tasks/");
}

export function checkChannelMembership(): Promise<{ member: boolean; status?: TaskStatus }> {
  return apiFetch("/api/tasks/channel/check/", { method: "POST" });
}
