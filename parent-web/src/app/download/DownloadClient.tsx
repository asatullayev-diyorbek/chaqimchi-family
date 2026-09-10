"use client";

import { useState } from "react";
// release.json is written by scripts/windows/build-guard-setup.ps1 from the
// artifact it just produced, so the version, size and hash shown here cannot
// drift from the file being served. Never edit it by hand.
//
// test-release.json is the rougher cross-compiled build (no Inno wrapper) for
// hand testing on a borrowed Windows machine.
import RELEASE from "./release.json";
import TEST_RELEASE from "./test-release.json";

const mb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

type Tab = "exe" | "zip";

export default function DownloadClient() {
  const [tab, setTab] = useState<Tab>("exe");

  return (
    <div className="auth-page">
      <div className="auth-shell auth-shell--doc">
        <div className="auth-card" style={{ maxWidth: 500, gap: "1.5rem" }}>
          <div className="auth-form-heading">
            <h2>Spino24 · Windows</h2>
            <p>
              Windows uchun nazorat dasturini yuklab oling va farzandingiz
              qurilmasiga o&apos;rnating.
            </p>
          </div>

          <div
            className="activity-tabs"
            role="tablist"
            style={{ margin: "0 auto" }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "exe"}
              className={`tab ${tab === "exe" ? "active" : ""}`}
              onClick={() => setTab("exe")}
            >
              <iconify-icon icon="lucide:package-check" />
              Rasmiy o&apos;rnatuvchi
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "zip"}
              className={`tab ${tab === "zip" ? "active" : ""}`}
              onClick={() => setTab("zip")}
            >
              <iconify-icon icon="lucide:flask-conical" />
              Beta (.zip)
            </button>
          </div>

          {tab === "exe" ? <ExePanel /> : <ZipPanel />}
        </div>
      </div>
    </div>
  );
}

function Meta({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
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
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "contents" }}>
          <dt style={{ fontWeight: 600 }}>{k}</dt>
          <dd style={{ margin: 0, wordBreak: "break-all" }}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function ExePanel() {
  return (
    <div className="tab-content active" style={{ display: "grid", gap: "1.5rem" }}>
      <a
        href={`/downloads/${RELEASE.file}`}
        download
        className="btn-primary auth-submit"
        style={{ textDecoration: "none" }}
      >
        <iconify-icon icon="lucide:download" />
        Yuklab olish (Windows 10/11, .exe)
      </a>

      <Meta
        rows={[
          ["Versiya", RELEASE.version],
          ["Nashr sanasi", RELEASE.date],
          ["Hajmi", `${mb(RELEASE.bytes)} MB`],
          ["Noshir", RELEASE.publisher],
          [
            "SHA-256",
            <span key="h" style={{ fontFamily: "monospace" }}>
              {RELEASE.sha256}
            </span>,
          ],
        ]}
      />

      <div style={{ textAlign: "left", fontSize: "0.875rem", opacity: 0.8, lineHeight: 1.6 }}>
        <p>
          <b>O&apos;rnatish tartibi:</b>
        </p>
        <ol style={{ paddingLeft: "1.25rem", margin: "0.5rem 0" }}>
          <li>Yuklab olingan faylni ishga tushiring.</li>
          <li>
            Dastur hali kod bilan imzolanmagan — Windows SmartScreen
            &quot;Noma&apos;lum noshir&quot; ogohlantirishi chiqishi mumkin.
            &quot;More info&quot; → &quot;Run anyway&quot;ni bosing. Defender,
            SmartScreen yoki UAC&apos;ni o&apos;chirish shart emas va tavsiya
            qilinmaydi.
          </li>
          <li>Shaffoflik va rozilik oynasini o&apos;qib, tasdiqlang.</li>
          <li>
            Ekranda chiqadigan QR kodni Spino24 mobil ilovasi orqali skanerlang
            (yoki 6 xonali kodni qo&apos;lda kiriting).
          </li>
          <li>Bog&apos;lash tasdiqlangach, kuzatuv xizmati avtomatik o&apos;rnatiladi.</li>
        </ol>
      </div>
    </div>
  );
}

function ZipPanel() {
  return (
    <div className="tab-content active" style={{ display: "grid", gap: "1.25rem" }}>
      <div
        style={{
          textAlign: "left",
          fontSize: "0.8125rem",
          lineHeight: 1.6,
          padding: "12px 14px",
          borderRadius: 12,
          background: "rgba(242, 138, 58, 0.1)",
          border: "1px solid rgba(242, 138, 58, 0.28)",
          color: "var(--foreground)",
        }}
      >
        <b>Sinovchilar uchun.</b> Bu — Inno Setup o&apos;ramisiz, qo&apos;lda
        sinash uchun build. Agent kodi bir xil (ikkalasi ham ishga tushgach
        avtomatik yangilanadi), lekin bu <b>&quot;Dasturlarni o&apos;chirish&quot;</b>{" "}
        ro&apos;yxatida ko&apos;rinmaydi — o&apos;chirish qo&apos;lda (arxiv ichidagi{" "}
        <code>O&apos;QING.txt</code>). Umumiy foydalanish uchun{" "}
        <b>rasmiy o&apos;rnatuvchini</b> tanlang.
      </div>

      <a
        href={`/downloads/${TEST_RELEASE.file}`}
        download
        className="btn-primary auth-submit"
        style={{ textDecoration: "none" }}
      >
        <iconify-icon icon="lucide:file-archive" />
        Beta arxivni yuklab olish (.zip)
      </a>

      <Meta
        rows={[
          ["Versiya", TEST_RELEASE.version],
          ["Sana", TEST_RELEASE.date],
          ["Hajmi", `${mb(TEST_RELEASE.bytes)} MB`],
          [
            "SHA-256",
            <span key="h" style={{ fontFamily: "monospace" }}>
              {TEST_RELEASE.sha256}
            </span>,
          ],
        ]}
      />

      {"note" in TEST_RELEASE && TEST_RELEASE.note ? (
        <p style={{ textAlign: "left", fontSize: "0.8125rem", opacity: 0.7, margin: 0, lineHeight: 1.6 }}>
          {TEST_RELEASE.note as string}
        </p>
      ) : null}
    </div>
  );
}
