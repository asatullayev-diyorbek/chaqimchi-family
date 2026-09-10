"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getCurrentUser } from "@/api/auth";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "https://t.me/ChaqimchiGuardBot";

/**
 * Full-page gate shown while the account still owes a phone number
 * (onboarding_required). The parent finishes in the bot; "Tekshirish"
 * re-fetches and, once cleared, reloads into the app. Also re-checks
 * whenever the tab regains focus.
 */
export default function OnboardingGate({ onDone }: { onDone?: () => void }) {
  const [checking, setChecking] = useState(false);

  const recheck = async () => {
    setChecking(true);
    try {
      const me = await getCurrentUser();
      if (!me.onboarding_required) {
        if (onDone) onDone();
        else window.location.reload();
      }
    } catch {
      /* keep the gate up */
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") recheck();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="auth-page">
      <div className="auth-shell auth-shell--doc">
        <div className="auth-card" style={{ maxWidth: 460, textAlign: "center", gap: "1.25rem" }}>
          <Image
            src="/bot/onboarding-reminder.png"
            alt=""
            width={360}
            height={450}
            style={{ width: "min(100%, 260px)", height: "auto", margin: "0 auto" }}
            priority
          />
          <div className="auth-form-heading">
            <h2>Deyarli tayyor</h2>
            <p>
              Davom etish uchun Telegram botiga qayting va telefon raqamingizni
              yuboring. Bu hisobingizni himoyalaydi va boshqa hech kimga
              berilmaydi.
            </p>
          </div>

          <a
            href={BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary auth-submit"
            style={{ textDecoration: "none" }}
          >
            <iconify-icon icon="lucide:send" />
            Telegram botni ochish
          </a>

          <button
            type="button"
            className="add-device-btn outline"
            onClick={recheck}
            disabled={checking}
          >
            <iconify-icon icon="lucide:refresh-cw" />
            {checking ? "Tekshirilmoqda…" : "Tekshirish"}
          </button>
        </div>
      </div>
    </div>
  );
}
