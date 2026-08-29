"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { telegramComplete } from "@/api/auth";
import { getAccessToken } from "@/api/client";
import TransparencyTable from "@/components/TransparencyTable";
import { toast } from "react-hot-toast";

const PREFILL_KEY = "telegram_prefill";

/** Name/username the bot already knows, stashed by the login page. */
function readPrefill(): { username?: string; full_name?: string } {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(sessionStorage.getItem(PREFILL_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export default function TelegramCompletePage() {
  const router = useRouter();
  // Lazy initialisers instead of setting state from an effect: the prefill is
  // already in sessionStorage when this page mounts, so there is nothing to
  // wait for and the fields render filled on the first paint.
  const [username, setUsername] = useState(() => readPrefill().username ?? "");
  const [fullName, setFullName] = useState(() => readPrefill().full_name ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getAccessToken()) router.replace("/login");
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    if (password !== confirmPassword) {
      setError("Parollar bir xil emas.");
      return;
    }
    setLoading(true);
    try {
      await telegramComplete({ username, full_name: fullName, password });
      sessionStorage.removeItem(PREFILL_KEY);
      router.replace("/overview");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Xatolik yuz berdi";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <section className="auth-visual" aria-label="ChaqimchiAI Family haqida">
          <div className="auth-brand">
            <Image className="auth-brand-logo" src="/assets/chaqimchi-family-logo.png" alt="ChaqimchiAI Family" width={420} height={202} priority />
          </div>
          <div className="auth-copy">
            <h1>Ro'yxatdan o'tishni<br />yakunlang</h1>
          </div>
          <div className="auth-illustration" aria-hidden="true">
            <Image className="auth-hero-image" src="/assets/login-hero.png" alt="Raqamli xavfsizlik va oila himoyasi" width={1024} height={1024} priority />
          </div>
        </section>

        <form onSubmit={onSubmit} className="auth-card">
          <div className="auth-form-heading">
            <h2>Ro'yxatdan o'tishni yakunlang</h2>
            <p>Telegram orqali bog'landingiz. Endi hisobingiz uchun parol o'rnating.</p>
          </div>

          <div className="edit-field">
            <label htmlFor="tg-username">Foydalanuvchi nomi</label>
            <div className="auth-input-wrap"><iconify-icon icon="lucide:user" />
              <input id="tg-username" type="text" required autoFocus placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
          </div>

          <div className="edit-field">
            <label htmlFor="tg-full-name">To'liq ism</label>
            <div className="auth-input-wrap"><iconify-icon icon="lucide:id-card" />
              <input id="tg-full-name" type="text" placeholder="Ism Familiya" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
          </div>

          <div className="edit-field">
            <label htmlFor="tg-password">Parol</label>
            <div className="auth-input-wrap"><iconify-icon icon="lucide:lock-keyhole" />
              <input id="tg-password" type={showPassword ? "text" : "password"} required minLength={8} autoComplete="new-password" placeholder="Kamida 8 ta belgi" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}><iconify-icon icon={showPassword ? "lucide:eye-off" : "lucide:eye"} /></button>
            </div>
          </div>

          <div className="edit-field">
            <label htmlFor="tg-password-confirm">Parolni tasdiqlang</label>
            <div className="auth-input-wrap"><iconify-icon icon="lucide:lock-keyhole" />
              <input id="tg-password-confirm" type={showPassword ? "text" : "password"} required minLength={8} autoComplete="new-password" placeholder="Parolni qayta kiriting" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
          </div>

          {/* Shown at the one moment a parent is actually signing up, which
              is what the design docs ask for — it used to sit on the unused
              email/password signup page instead. */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
            <TransparencyTable />
          </div>

          {error && <div className="auth-error" role="alert">{error}</div>}
          <button type="submit" className="btn-primary auth-submit" disabled={loading} aria-busy={loading}>{loading && <span className="auth-spinner" aria-hidden="true" />}{loading ? "Saqlanmoqda..." : "Yakunlash"}<iconify-icon icon="lucide:arrow-right" /></button>
        </form>
      </div>
    </div>
  );
}
