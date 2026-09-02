import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

export const alt = `${SITE.name} — oila uchun ochiq ekran-vaqt qoidalari`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #d6f3ee 0%, #e4f0fb 40%, #f3ecfb 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: "linear-gradient(140deg, #3b82f6, #2563eb 55%, #2fbfa6)",
              color: "#fff",
              fontSize: 38,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            C
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, color: "#1f2b3a" }}>ChaqimchiAI Family</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 68, fontWeight: 800, color: "#1f2b3a", lineHeight: 1.08, letterSpacing: -2 }}>
            <span>Oila uchun ochiq</span>
            <span>ekran-vaqt qoidalari</span>
          </div>
          <div style={{ fontSize: 30, color: "#4c5d78", maxWidth: 900 }}>
            Kunlik limit, dam olish soatlari, ilova cheklovlari va faoliyat — yashirin kuzatuv emas.
          </div>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          {["Windows 10/11", "Beta’da bepul", "Offline barqaror"].map((t) => (
            <div
              key={t}
              style={{
                fontSize: 24,
                fontWeight: 600,
                color: "#1d4ed8",
                background: "rgba(37,99,235,0.1)",
                border: "1px solid rgba(37,99,235,0.18)",
                borderRadius: 999,
                padding: "10px 22px",
                display: "flex",
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
