"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import OnboardingGate from "@/components/OnboardingGate";
import { getAccessToken } from "@/api/client";
import { getCurrentUser } from "@/api/auth";

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

  // undefined = not checked yet, null = check failed / no answer
  const [onboardingRequired, setOnboardingRequired] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    // Read the token fresh rather than trusting `signedIn` from this render.
    // On a page load the first client render still holds the *server*
    // snapshot (false), and this effect runs in that same commit — using it
    // would bounce every refresh through /login and straight back.
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    let alive = true;
    getCurrentUser()
      .then((me) => alive && setOnboardingRequired(me.onboarding_required))
      .catch(() => alive && setOnboardingRequired(false));
    return () => {
      alive = false;
    };
  }, [signedIn, router]);

  // Render nothing without a token — otherwise a logged-out visitor sees a
  // flash of the dashboard before the redirect lands.
  if (!signedIn) return null;
  if (onboardingRequired === undefined) return null; // brief: waiting on /me/
  if (onboardingRequired) return <OnboardingGate onDone={() => setOnboardingRequired(false)} />;

  return <AppShell>{children}</AppShell>;
}
