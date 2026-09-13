import { apiFetch } from "./client";

export type Review = {
  id: number;
  rating: number;
  comment: string;
  created_at: string;
};

/** A parent may leave more than one review over time — this is a log, not
 * a single editable "my review" row. */
export function getMyReviews(): Promise<Review[]> {
  return apiFetch<Review[]>("/api/feedback/review/");
}

export function submitReview(rating: number, comment: string): Promise<Review> {
  return apiFetch<Review>("/api/feedback/review/", {
    method: "POST",
    body: JSON.stringify({ rating, comment }),
  });
}
