import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Yuklab olish — ChaqimchiAI Guard",
  description: "ChaqimchiAI Guard Windows dasturini yuklab olish.",
};

// release.json is written by scripts/windows/build-guard-setup.ps1 from the
// artifact it just produced, so the version, size and hash shown here cannot
// drift from the file being served. Never edit it by hand.
//
// test-release.json is the rougher cross-compiled build (no Inno wrapper) for
// hand testing on a borrowed Windows machine — kept in a separate section and
// separate file so it never gets mistaken for the real installer.
import RELEASE from "./release.json";
import TEST_RELEASE from "./test-release.json";

const mb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

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
            <dd style={{ margin: 0 }}>{mb(RELEASE.bytes)} MB</dd>
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

          <details style={{ textAlign: "left", fontSize: "0.8125rem", opacity: 0.75, borderTop: "1px solid var(--border, rgba(0,0,0,.1))", paddingTop: "1rem" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>Sinovchilar uchun build ({TEST_RELEASE.version})</summary>
            <p style={{ margin: "0.75rem 0" }}>
              Bu — Inno Setup o&apos;ramisiz, qo&apos;lda sinash uchun build. Yangiroq agent
              kodi, lekin &quot;Dasturlarni o&apos;chirish&quot; ro&apos;yxatida
              ko&apos;rinmaydi — o&apos;chirish qo&apos;lda (ichidagi <code>O&apos;QING.txt</code>).
              Umumiy foydalanish uchun emas.
            </p>
            <a href={`/downloads/${TEST_RELEASE.file}`} download style={{ fontWeight: 600 }}>
              ↓ {TEST_RELEASE.file} ({mb(TEST_RELEASE.bytes)} MB)
            </a>
            <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.2rem 0.6rem", margin: "0.75rem 0 0", lineHeight: 1.5 }}>
              <dt style={{ fontWeight: 600 }}>Versiya</dt>
              <dd style={{ margin: 0 }}>{TEST_RELEASE.version}</dd>
              <dt style={{ fontWeight: 600 }}>Sana</dt>
              <dd style={{ margin: 0 }}>{TEST_RELEASE.date}</dd>
              <dt style={{ fontWeight: 600 }}>SHA-256</dt>
              <dd style={{ margin: 0, wordBreak: "break-all", fontFamily: "monospace" }}>{TEST_RELEASE.sha256}</dd>
            </dl>
          </details>
        </div>
      </div>
    </div>
  );
}
