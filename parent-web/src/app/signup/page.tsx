import { redirect } from "next/navigation";

/**
 * Registration happens through Telegram (login -> bot -> /telegram/complete),
 * so there is no email/password sign-up form. The route is kept as a redirect
 * rather than deleted so older links and bookmarks land somewhere useful
 * instead of on a 404.
 */
export default function SignupPage() {
  redirect("/login");
}
