"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login } from "@/api/auth";
import { inputStyle, primaryButtonStyle } from "@/components/formStyles";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
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
          width: 360,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 32,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Kirish</h1>
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
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />
        {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}
        <button type="submit" disabled={loading} style={primaryButtonStyle}>
          {loading ? "Kirilmoqda..." : "Kirish"}
        </button>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            alert("Parolni tiklash hozircha mavjud emas — birozdan keyin qayta urinib ko'ring.");
          }}
          style={{ fontSize: 13, color: "var(--muted)", textAlign: "center" }}
        >
          Parolni unutdingizmi?
        </a>
        <p style={{ fontSize: 13, textAlign: "center", marginTop: 8 }}>
          Hisobingiz yo&apos;qmi?{" "}
          <Link href="/signup" style={{ color: "var(--accent-dark)", fontWeight: 600 }}>
            Ro&apos;yxatdan o&apos;ting
          </Link>
        </p>
      </form>
    </div>
  );
}
