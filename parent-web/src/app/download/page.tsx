import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Yuklab olish — ChaqimchiAI Guard",
  description: "ChaqimchiAI Guard Windows dasturini yuklab olish.",
};

// Kept in sync with releases/windows/ChaqimchiAI Guard Setup.exe on every
// Windows RC build (scripts/windows/build-guard-setup.ps1). Only the single
// GUI installer is published — never the internal agent/bootstrap binaries.
const RELEASE = {
  version: "0.4.0-rc.1",
  file: "ChaqimchiAI-Guard-Setup.exe",
  sizeMB: "21.4",
  sha256: "4D8A9235BD083E99DE434F4EB16F42D46ECE6500D94EA57FA090277D6E63D148",
  date: "2026-08-28",
  publisher: "ChaqimchiAI (imzolanmagan — MVP/Beta)",
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
            href={`/downloads/${RELEASE.file}`}
            download
            className="btn-primary auth-submit"
            style={{ textDecoration: "none" }}
          >
            <iconify-icon icon="lucide:download" />
            Yuklab olish (Windows 10/11, .exe)
          </a>

          <dl
            style={{
              textAlign: "left",
              fontSize: "0.8125rem",
              opacity: 0.85,
              lineHeight: 1.6,
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "0.25rem 0.75rem",
              margin: 0,
            }}
          >
            <dt style={{ fontWeight: 600 }}>Versiya</dt>
            <dd style={{ margin: 0 }}>{RELEASE.version}</dd>
            <dt style={{ fontWeight: 600 }}>Nashr sanasi</dt>
            <dd style={{ margin: 0 }}>{RELEASE.date}</dd>
            <dt style={{ fontWeight: 600 }}>Hajmi</dt>
            <dd style={{ margin: 0 }}>{RELEASE.sizeMB} MB</dd>
            <dt style={{ fontWeight: 600 }}>Noshir</dt>
            <dd style={{ margin: 0 }}>{RELEASE.publisher}</dd>
            <dt style={{ fontWeight: 600 }}>SHA-256</dt>
            <dd style={{ margin: 0, wordBreak: "break-all", fontFamily: "monospace" }}>{RELEASE.sha256}</dd>
          </dl>

          <div style={{ textAlign: "left", fontSize: "0.875rem", opacity: 0.8, lineHeight: 1.6 }}>
            <p><b>O&apos;rnatish tartibi:</b></p>
            <ol style={{ paddingLeft: "1.25rem", margin: "0.5rem 0" }}>
              <li>Yuklab olingan faylni ishga tushiring.</li>
              <li>
                Dastur hali kod bilan imzolanmagan — Windows SmartScreen &quot;Noma&apos;lum
                noshir&quot; ogohlantirishi chiqishi mumkin. &quot;More info&quot; → &quot;Run
                anyway&quot;ni bosing. Defender, SmartScreen yoki UAC&apos;ni o&apos;chirish
                shart emas va tavsiya qilinmaydi.
              </li>
              <li>Shaffoflik va rozilik oynasini o&apos;qib, tasdiqlang.</li>
              <li>Ekranda chiqadigan QR kodni ChaqimchiAI Family mobil ilovasi orqali skanerlang (yoki 6 xonali kodni qo&apos;lda kiriting).</li>
              <li>Bog&apos;lash tasdiqlangach, Guard xizmati avtomatik o&apos;rnatiladi.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
