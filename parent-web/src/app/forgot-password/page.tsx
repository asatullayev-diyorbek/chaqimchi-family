"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { resetPasswordStart, resetPasswordVerify } from "@/api/auth";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"ask" | "verify">("ask");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !username.trim()) return;
    setBusy(true);
    try {
      await resetPasswordStart(username.trim());
      toast.success("Agar Telegram ulangan bo'lsa, kod yuborildi.");
      setStep("verify");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (newPw.length < 8) {
      toast.error("Yangi parol kamida 8 ta belgi.");
      return;
    }
    setBusy(true);
    try {
      await resetPasswordVerify(username.trim(), code.trim(), newPw);
      toast.success("Parol yangilandi. Endi kiring.");
      router.replace("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message.includes("400") ? "Kod noto'g'ri yoki muddati tugagan" : err.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-shell" style={{ justifyContent: "center" }}>
        <form onSubmit={step === "ask" ? sendCode : reset} className="auth-card">
          <div className="auth-form-heading">
            <h2>Parolni tiklash</h2>
            <p>
              {step === "ask"
                ? "Foydalanuvchi nomingizni kiriting. Kod Telegram'ga yuboriladi."
                : "Telegram'ga kelgan kodni va yangi parolni kiriting."}
            </p>
          </div>

          <div className="edit-field">
            <label htmlFor="fp-user">Foydalanuvchi nomi</label>
            <div className="auth-input-wrap"><iconify-icon icon="lucide:user" />
              <input id="fp-user" type="text" required autoFocus value={username} onChange={(e) => setUsername(e.target.value)} disabled={step === "verify"} />
            </div>
          </div>

          {step === "verify" && (
            <>
              <div className="edit-field">
                <label htmlFor="fp-code">Kod</label>
                <div className="auth-input-wrap"><iconify-icon icon="lucide:key-round" />
                  <input id="fp-code" inputMode="numeric" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="6 xonali kod" />
                </div>
              </div>
              <div className="edit-field">
                <label htmlFor="fp-pw">Yangi parol</label>
                <div className="auth-input-wrap"><iconify-icon icon="lucide:lock-keyhole" />
                  <input id="fp-pw" type="password" required autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Kamida 8 ta belgi" />
                </div>
              </div>
            </>
          )}

          <button type="submit" className="btn-primary auth-submit" disabled={busy} aria-busy={busy}>
            {busy && <span className="auth-spinner" aria-hidden="true" />}
            {step === "ask" ? "Kod yuborish" : "Parolni yangilash"}
          </button>

          <a href="/login" className="auth-download-link" style={{ justifyContent: "center" }}>
            <iconify-icon icon="lucide:arrow-left" /> Kirishga qaytish
          </a>
        </form>
      </div>
    </div>
  );
}
