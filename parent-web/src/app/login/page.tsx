"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { login } from "@/api/auth";
import { getAccessToken } from "@/api/client";
import { toast } from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (getAccessToken()) {
      router.replace("/overview");
    }
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.replace("/overview");
    } catch (err) {
      if (err instanceof Error && err.message.includes("401")) {
        setError("Email yoki parol noto'g'ri.");
        toast.error("Email yoki parol noto'g'ri.");
      } else {
        const message = err instanceof Error ? err.message : "Xatolik yuz berdi";
        setError(message);
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }

  function onGoogleLogin() {
    toast("Google orqali kirish tez orada mavjud bo‘ladi.");
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <section className="auth-visual" aria-label="ChaqimchiAI Family haqida">
          <div className="auth-brand">
            <Image className="auth-brand-logo" src="/assets/chaqimchi-family-logo.png" alt="ChaqimchiAI Family" width={420} height={202} priority />
          </div>
          <div className="auth-copy">
            <h1>Farzandingizning<br />raqamli dunyosida<br /><em>xavfsiz hamrohingiz</em></h1>
          </div>
          <div className="auth-illustration" aria-hidden="true">
            <Image className="auth-hero-image" src="/assets/login-hero.png" alt="Raqamli xavfsizlik va oila himoyasi" width={1024} height={1024} priority />
          </div>
          <div className="auth-benefits">
            <div><iconify-icon icon="lucide:shield-check" /><span><b>Xavfsiz</b>Ma'lumotlar himoyasi</span></div>
            <div><iconify-icon icon="lucide:users" /><span><b>Ishonchli</b>Shaffof nazorat</span></div>
            <div><iconify-icon icon="lucide:sparkles" /><span><b>Aqlli</b>Oson boshqaruv</span></div>
          </div>
        </section>

        <form onSubmit={onSubmit} className="auth-card">
          <div className="auth-form-heading">
            <h2>Tizimga kirish</h2>
            <p>Hisobingizga kirish uchun ma'lumotlaringizni kiriting</p>
          </div>

          <div className="edit-field">
            <label htmlFor="login-email">Email manzil</label>
            <div className="auth-input-wrap"><iconify-icon icon="lucide:mail" />
              <input id="login-email" type="email" required autoFocus inputMode="email" autoComplete="username" placeholder="youremail@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="edit-field">
            <div className="auth-field-heading"><label htmlFor="login-password">Parol</label><span className="auth-help-text">Parolni tiklash</span></div>
            <div className="auth-input-wrap"><iconify-icon icon="lucide:lock-keyhole" />
              <input id="login-password" type={showPassword ? "text" : "password"} required autoComplete="current-password" placeholder="Parolingizni kiriting" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}><iconify-icon icon={showPassword ? "lucide:eye-off" : "lucide:eye"} /></button>
            </div>
          </div>

          <div className="auth-options"><label><input type="checkbox" defaultChecked /> <span>Meni eslab qol</span></label><span>Yordam kerakmi?</span></div>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button type="submit" className="btn-primary auth-submit" disabled={loading} aria-busy={loading}>{loading && <span className="auth-spinner" aria-hidden="true" />}{loading ? "Kirilmoqda..." : "Kirish"}<iconify-icon icon="lucide:arrow-right" /></button>

          <div className="auth-divider"><span>yoki</span></div>
          <button type="button" className="google-login-button" onClick={onGoogleLogin}>
            <svg className="google-mark" aria-hidden="true" viewBox="0 0 24 24" role="img">
              <path fill="#4285F4" d="M21.35 12.27c0-.71-.06-1.39-.18-2.04H12v3.86h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.21Z" />
              <path fill="#34A853" d="M12 21.75c2.63 0 4.84-.87 6.45-2.35l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.75 9.75 0 0 0 12 21.75Z" />
              <path fill="#FBBC05" d="M6.54 13.84A5.86 5.86 0 0 1 6.23 12c0-.64.11-1.26.31-1.84V7.63H3.3A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.05 1.05 4.37l3.24-2.53Z" />
              <path fill="#EA4335" d="M12 6.13c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.22 14.63 2.25 12 2.25a9.75 9.75 0 0 0-8.7 5.38l3.24 2.53C7.31 7.85 9.46 6.13 12 6.13Z" />
            </svg>
            Google orqali kirish
          </button>

          <p className="auth-signup">Hisobingiz yo'qmi? <Link href="/signup">Ro'yxatdan o'ting</Link></p>
        </form>
      </div>
    </div>
  );
}
