"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login, signup } from "@/api/auth";
import { inputStyle, primaryButtonStyle } from "@/components/formStyles";
import TransparencyTable from "@/components/TransparencyTable";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) return;
    setError(null);
    setLoading(true);
    try {
      await signup(email, password);
      await login(email, password);
      router.push("/overview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--background)",
        padding: 24,
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          width: 480,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 32,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Ro&apos;yxatdan o&apos;tish</h1>
        <label style={{ fontSize: 13, color: "var(--muted)" }}>Email</label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <label style={{ fontSize: 13, color: "var(--muted)" }}>Parol</label>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        <div style={{ marginTop: 8 }}>
          <TransparencyTable />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginTop: 8 }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          O&apos;qidim va roziman
        </label>

        {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}

        <button
          type="submit"
          disabled={!agreed || loading}
          style={{
            ...primaryButtonStyle,
            opacity: !agreed || loading ? 0.5 : 1,
            cursor: !agreed || loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Yaratilmoqda..." : "Hisob yaratish"}
        </button>

        <p style={{ fontSize: 13, textAlign: "center", marginTop: 4 }}>
          Hisobingiz bormi?{" "}
          <Link href="/login" style={{ color: "var(--accent-dark)", fontWeight: 600 }}>
            Kiring
          </Link>
        </p>
      </form>
    </div>
  );
}
