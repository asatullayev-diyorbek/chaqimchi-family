"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { login, signup } from "@/api/auth";
import TransparencyTable from "@/components/TransparencyTable";
import { toast } from "react-hot-toast";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) return;
    setLoading(true);
    try {
      await signup(email, password);
      await login(email, password);
      router.push("/overview");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      padding: "24px"
    }}>
      <form onSubmit={onSubmit} className="card" style={{
        width: "100%",
        maxWidth: "400px",
        padding: "40px 32px",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}>
        <div style={{ textAlign: "center" }}>
          <div className="logo" style={{ justifyContent: "center", marginBottom: "16px" }}>
            <Image src="/assets/logo.png" alt="ChaqimchiAI" width={48} height={48} priority style={{ width: 48, height: 48 }} />
            <div style={{ textAlign: "left" }}>
              <h3 style={{ margin: 0, fontSize: "20px", color: "var(--foreground)" }}>ChaqimchiAI</h3>
              <span style={{ fontSize: "13px", color: "var(--brand-blue)", fontWeight: 700 }}>Family</span>
            </div>
          </div>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "14px", fontWeight: 500 }}>
            Yangi oilaviy hisob yarating
          </p>
        </div>

        <div className="edit-field">
          <label>Email manzil</label>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="otaona@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="edit-field">
          <label>Parol</label>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Kamyida 8 ta belgi"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px" }}>
          <TransparencyTable />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", color: "var(--foreground)", cursor: "pointer", fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            style={{ width: "18px", height: "18px", accentColor: "var(--brand-blue)", cursor: "pointer" }}
          />
          <span style={{ paddingTop: "2px" }}>Shartlarni o'qidim va roziman</span>
        </label>

        
        <button 
          type="submit" 
          className="btn-primary" 
          disabled={!agreed || loading} 
          style={{ 
            width: "100%", 
            padding: "12px", 
            fontSize: "14px", 
            marginTop: "8px",
            opacity: !agreed || loading ? 0.6 : 1,
            cursor: !agreed || loading ? "not-allowed" : "pointer"
          }}
        >
          {loading ? "Yaratilmoqda..." : "Hisob yaratish"}
        </button>

        <p style={{ fontSize: "13px", textAlign: "center", marginTop: "8px", color: "var(--muted)", fontWeight: 600 }}>
          Hisobingiz bormi?{" "}
          <Link href="/login" style={{ color: "var(--brand-blue)", textDecoration: "none" }}>
            Kiring
          </Link>
        </p>
      </form>
    </div>
  );
}
