"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[parent-web] unhandled render error:", error);
  }, [error]);

  return (
    <div className="auth-page">
      <div className="auth-shell" style={{ justifyContent: "center" }}>
        <div className="auth-card" style={{ maxWidth: 460, textAlign: "center", gap: "1.25rem" }}>
          <div
            style={{
              width: 64,
              height: 64,
              margin: "0 auto",
              display: "grid",
              placeItems: "center",
              borderRadius: 20,
              background: "var(--cat-amber-bg)",
              color: "var(--warning)",
            }}
          >
            <iconify-icon icon="solar:danger-triangle-linear" style={{ fontSize: 30 }}></iconify-icon>
          </div>

          <div className="auth-form-heading">
            <h2>Nimadir xato ketdi</h2>
            <p>Sahifani ko&apos;rsatishda kutilmagan xatolik yuz berdi. Qayta urinib ko&apos;ring.</p>
          </div>

          {/* The raw message can leak internals, so it's shown only in dev.
              The digest is safe and is what maps to a server-side log line. */}
          {process.env.NODE_ENV !== "production" && (
            <pre
              style={{
                textAlign: "left",
                fontSize: 12,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: "var(--muted)",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 12,
                margin: 0,
              }}
            >
              {error.message}
            </pre>
          )}
          {error.digest && (
            <p style={{ fontSize: 12, color: "var(--muted)" }}>Xato kodi: {error.digest}</p>
          )}

          <button type="button" onClick={reset} className="btn-primary auth-submit">
            <iconify-icon icon="solar:refresh-linear"></iconify-icon>
            Qayta urinish
          </button>
          <Link href="/overview" style={{ fontSize: 13, color: "var(--brand-blue)", fontWeight: 600 }}>
            Bosh sahifaga qaytish
          </Link>
        </div>
      </div>
    </div>
  );
}
