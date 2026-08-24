import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Yuklab olish — ChaqimchiAI Guard",
  description: "ChaqimchiAI Guard Windows dasturini yuklab olish.",
};

export default function DownloadPage() {
  return (
    <div className="auth-page">
      <div className="auth-shell" style={{ justifyContent: "center" }}>
        <div className="auth-card" style={{ maxWidth: 480, textAlign: "center", gap: "1.5rem" }}>
          <div className="auth-form-heading">
            <h2>ChaqimchiAI Guard</h2>
            <p>Windows uchun nazorat dasturini yuklab oling va farzandingiz qurilmasiga o&apos;rnating.</p>
          </div>

          <a
            href="/downloads/ChaqimchiAI-Guard-Installer.exe"
            download
            className="btn-primary auth-submit"
            style={{ textDecoration: "none" }}
          >
            <iconify-icon icon="lucide:download" />
            Yuklab olish (Windows, .exe)
          </a>

          <div style={{ textAlign: "left", fontSize: "0.875rem", opacity: 0.8, lineHeight: 1.6 }}>
            <p><b>O&apos;rnatish tartibi:</b></p>
            <ol style={{ paddingLeft: "1.25rem", margin: "0.5rem 0" }}>
              <li>Yuklab olingan faylni ishga tushiring.</li>
              <li>Windows &quot;Noma&apos;lum noshir&quot; ogohlantirishi chiqsa — &quot;More info&quot; → &quot;Run anyway&quot;ni bosing.</li>
              <li>Ekranda chiqadigan QR kodni ChaqimchiAI Family mobil ilovasi orqali skanerlang.</li>
              <li>Bog&apos;lash tasdiqlangach, dastur avtomatik o&apos;rnatiladi.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
