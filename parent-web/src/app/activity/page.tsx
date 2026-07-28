"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import BarChart from "@/components/BarChart";
import { getAccessToken } from "@/api/client";
import { Device, DeviceSummary, SummaryRange, getDevices, getSummary } from "@/api/tracking";

const RANGE_LABELS: Record<SummaryRange, string> = {
  day: "Bugun",
  week: "Hafta",
  month: "Oy",
};

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}d`;
  return `${hours}s ${mins}d`;
}

function shortDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" });
}

function ActivityContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deviceId = searchParams.get("device");

  const [devices, setDevices] = useState<Device[] | null>(null);
  const [range, setRange] = useState<SummaryRange>("day");
  const [summary, setSummary] = useState<DeviceSummary | null>(null);
  const [tab, setTab] = useState<"apps" | "sites">("apps");
  const [sortDesc, setSortDesc] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    getDevices()
      .then(setDevices)
      .catch((err) => setError(err instanceof Error ? err.message : "Xatolik"));
  }, [router]);

  const activeDeviceId = deviceId ?? devices?.find((d) => d.status === "linked")?.id ?? null;

  useEffect(() => {
    if (!activeDeviceId) return;
    (async () => {
      try {
        setError(null);
        setSummary(await getSummary(activeDeviceId, { range }));
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Ma'lumotlar yangilanmadi, birozdan keyin qayta urinib ko'ring"
        );
      }
    })();
  }, [activeDeviceId, range]);

  const sortedApps = summary
    ? [...summary.top_apps].sort((a, b) => (sortDesc ? b.minutes - a.minutes : a.minutes - b.minutes))
    : [];

  return (
    <AppShell>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Faoliyat</h1>

      {devices !== null && devices.length === 0 && (
        <p style={{ color: "var(--muted)" }}>Hali bog&apos;langan qurilma yo&apos;q</p>
      )}

      {activeDeviceId && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {(Object.keys(RANGE_LABELS) as SummaryRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                style={{
                  border: "1px solid var(--glass-border)",
                  background: range === r ? "var(--accent-dark)" : "rgba(255, 255, 255, 0.6)",
                  color: range === r ? "#fff" : "var(--foreground)",
                  borderRadius: 8,
                  padding: "6px 14px",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {RANGE_LABELS[r]}
              </button>
            ))}
          </div>

          {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

          {summary && (
            <>
              <div
                className="glass"
                style={{
                  padding: 24,
                  marginBottom: 24,
                  maxWidth: 640,
                }}
              >
                <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>
                  Jami ekran vaqti ({RANGE_LABELS[range].toLowerCase()})
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 16 }}>
                  {formatMinutes(summary.total_screen_minutes)}
                </div>
                {summary.breakdown.length > 1 ? (
                  <BarChart
                    data={summary.breakdown.map((b) => ({
                      label: shortDay(b.date),
                      value: b.total_minutes,
                    }))}
                  />
                ) : (
                  <p style={{ fontSize: 13, color: "var(--muted)" }}>
                    Kunlik ko&apos;rinishda grafik yo&apos;q — soatlik taqsimot hali qo&apos;llab-quvvatlanmaydi
                    (server hozircha faqat kunlik yig&apos;indini beradi).
                  </p>
                )}
              </div>

              <div style={{ display: "flex", gap: 16, marginBottom: 12, borderBottom: "1px solid var(--border)" }}>
                <button
                  onClick={() => setTab("apps")}
                  style={tabStyle(tab === "apps")}
                >
                  Ilovalar
                </button>
                <button
                  onClick={() => setTab("sites")}
                  style={tabStyle(tab === "sites")}
                >
                  Saytlar
                </button>
              </div>

              {tab === "apps" && (
                <div className="glass-solid-well" style={{ maxWidth: 640, padding: "4px 16px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Ilova</th>
                        <th
                          style={{ ...thStyle, textAlign: "right", cursor: "pointer" }}
                          onClick={() => setSortDesc((v) => !v)}
                        >
                          Vaqt {sortDesc ? "↓" : "↑"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedApps.map((app) => (
                        <tr key={app.app}>
                          <td style={tdStyle}>{app.app}</td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>{formatMinutes(app.minutes)}</td>
                        </tr>
                      ))}
                      {sortedApps.length === 0 && (
                        <tr>
                          <td colSpan={2} style={{ ...tdStyle, color: "var(--muted)" }}>
                            Bu davrda ma&apos;lumot yo&apos;q
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {tab === "sites" && (
                <p style={{ color: "var(--muted)", fontSize: 14, maxWidth: 480 }}>
                  Saytlar ro&apos;yxati hali mavjud emas — agent hozircha faqat ilova
                  ishlatilishini (app_usage) yuboradi, sayt darajasidagi kuzatuv
                  (browser_domain) hali qo&apos;shilmagan va real ma&apos;lumot bilan
                  tekshirilmagan. Bo&apos;sh ma&apos;lumot bilan to&apos;ldirish o&apos;rniga
                  shu holat aniq ko&apos;rsatilyapti.
                </p>
              )}
            </>
          )}
        </>
      )}
    </AppShell>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 4px",
  fontSize: 12,
  color: "var(--muted)",
  borderBottom: "1px solid var(--border)",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 4px",
  fontSize: 14,
  borderBottom: "1px solid var(--border)",
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    background: "transparent",
    border: "none",
    borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
    color: active ? "var(--foreground)" : "var(--muted)",
    fontWeight: active ? 600 : 400,
    fontSize: 14,
    padding: "8px 4px",
    cursor: "pointer",
  };
}

export default function ActivityPage() {
  return (
    <Suspense fallback={null}>
      <ActivityContent />
    </Suspense>
  );
}
