"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { getAccessToken } from "@/api/client";

// The token lives in localStorage, which doesn't exist while rendering on the
// server. useSyncExternalStore is the sanctioned way to read that: it takes a
// separate server snapshot (false) so hydration can't mismatch. No
// subscription is needed — the token only ever changes alongside a navigation.
const noSubscribe = () => () => {};
const hasTokenNow = () => getAccessToken() !== null;
const hasTokenOnServer = () => false;

/**
 * One shell for every dashboard route.
 *
 * AppShell used to be rendered inside each page, which meant Next.js tore the
 * sidebar and header down and rebuilt them on every navigation: the sidebar's
 * fadeUp entry animation replayed on each menu click, and /auth/me, /devices,
 * /children and /alerts were re-fetched each time. As a layout it mounts once
 * and stays put, so switching pages only swaps the content area.
 *
 * The auth check lives here too, instead of being repeated in all six pages.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const signedIn = useSyncExternalStore(noSubscribe, hasTokenNow, hasTokenOnServer);

  useEffect(() => {
    if (!signedIn) router.replace("/login");
  }, [signedIn, router]);

  // Render nothing without a token — otherwise a logged-out visitor sees a
  // flash of the dashboard before the redirect lands.
  if (!signedIn) return null;

  return <AppShell>{children}</AppShell>;
}
