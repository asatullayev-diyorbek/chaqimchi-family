"use client";

/**
 * Last resort: this replaces the root layout, so it cannot use any of the
 * app's CSS, fonts or components — everything has to be inline.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="uz">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#eef1fb",
          color: "#1f2b3a",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, marginBottom: 12 }}>Ilova ishga tushmadi</h1>
          <p style={{ fontSize: 14, color: "#7a8698", marginBottom: 20, lineHeight: 1.6 }}>
            Kutilmagan xatolik yuz berdi. Sahifani yangilang yoki birozdan keyin qayta urinib ko&apos;ring.
          </p>
          {error.digest && (
            <p style={{ fontSize: 12, color: "#7a8698", marginBottom: 20 }}>Xato kodi: {error.digest}</p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              border: "none",
              borderRadius: 12,
              padding: "12px 20px",
              background: "#2563eb",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Qayta urinish
          </button>
        </div>
      </body>
    </html>
  );
}
