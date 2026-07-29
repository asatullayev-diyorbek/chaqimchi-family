"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import BarChart from "@/components/BarChart";
import DonutChart from "@/components/DonutChart";
import { getAccessToken } from "@/api/client";
import { getCurrentUser } from "@/api/auth";
import { Device, DeviceSummary, getDevices, getSummary } from "@/api/tracking";
import { Rule, getDailyLimitMinutes, getRules } from "@/api/rules";
import { Alert, getAlerts } from "@/api/alerts";

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} daq`;
  return `${hours} soat ${mins} daq`;
}

function shortDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" });
}

function todayLabel(): string {
  return new Date().toLocaleDateString("uz-UZ", { day: "numeric", month: "long", year: "numeric" });
}

// Fixed, deliberately not derived from any real total — see .sample-tag on
// the card itself. app-categorization doesn't exist in the backend yet
// (Bosqich 1/2 only track raw app names, not a category field).
const SAMPLE_CATEGORIES = [
  { label: "Ta'lim", percent: 49, color: "var(--cat-teal)" },
  { label: "Dasturlash", percent: 32, color: "var(--cat-blue)" },
  { label: "O'yinlar", percent: 12, color: "var(--cat-amber)" },
  { label: "Video va ko'ngil ochish", percent: 4, color: "var(--cat-purple)" },
  { label: "Boshqalar", percent: 3, color: "var(--cat-slate)" },
];

export default function OverviewPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [summary, setSummary] = useState<DeviceSummary | null>(null);
  const [weekSummary, setWeekSummary] = useState<DeviceSummary | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }

    (async () => {
      try {
        setError(null);
        const [user, deviceList] = await Promise.all([getCurrentUser(), getDevices()]);
        setFirstName(user.email.split("@")[0]);
        setDevices(deviceList);

        const primary = deviceList.find((d) => d.status === "linked");
        if (!primary) return;

        const [daySum, weekSum, deviceRules, deviceAlerts] = await Promise.all([
          getSummary(primary.id),
          getSummary(primary.id, { range: "week" }),
          getRules(primary.id),
          getAlerts(primary.id),
        ]);
        setSummary(daySum);
        setWeekSummary(weekSum);
        setRules(deviceRules);
        setAlerts(deviceAlerts);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Ma'lumotlar yangilanmadi, birozdan keyin qayta urinib ko'ring"
        );
      }
    })();
  }, [router]);

  if (devices === null && !error) {
    return (
      <AppShell>
        <p style={{ color: "var(--muted)" }}>Yuklanmoqda...</p>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <p style={{ color: "var(--danger)" }}>{error}</p>
      </AppShell>
    );
  }

  // Empty state per the desktop doc's 7-bo'lim: only the add-device card,
  // nothing else (no empty charts/placeholders).
  if (!devices || devices.length === 0) {
    return (
      <AppShell>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Bosh sahifa</h1>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, maxWidth: 700 }}>
          <AddDeviceCard />
        </div>
      </AppShell>
    );
  }

  const limitMinutes = getDailyLimitMinutes(rules);
  const totalToday = summary?.total_screen_minutes ?? 0;
  const limitPercent = limitMinutes ? Math.min(100, Math.round((totalToday / limitMinutes) * 100)) : null;
  const unseenAlerts = alerts.filter((a) => !a.seen).length;

  let bannerMessage = "Ma'lumotlar yuklanmoqda...";
  if (summary) {
    if (limitMinutes === null) {
      bannerMessage = "Hali kunlik limit belgilanmagan. Qoidalar bo'limida sozlashingiz mumkin.";
    } else if (totalToday <= limitMinutes) {
      bannerMessage = "Ajoyib ish! Farzandingiz bugun belgilangan limit ichida qoldi.";
    } else {
      bannerMessage = "Bugungi ekran vaqti limitdan oshdi — birga suhbatlashish yaxshi fursat bo'lishi mumkin.";
    }
  }

  return (
    <AppShell>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>
            Xush kelibsiz{firstName ? `, ${capitalize(firstName)}` : ""}! 👋
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 4 }}>
            Farzandingizning raqamli faoliyati nazoratda.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            title={unseenAlerts > 0 ? `${unseenAlerts} ko'rilmagan ogohlantirish` : "Ogohlantirish yo'q"}
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              fontSize: 16,
            }}
          >
            🔔
            {unseenAlerts > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  background: "var(--danger)",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 3px",
                }}
              >
                {unseenAlerts}
              </span>
            )}
          </div>
          <div
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              fontSize: 13,
              color: "var(--muted)",
            }}
          >
            {todayLabel()}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
        <StatCard
          icon="⏱️"
          iconBg="var(--cat-teal-bg)"
          iconColor="var(--cat-teal)"
          label="Bugungi ekran vaqti"
          value={formatMinutes(totalToday)}
        >
          {limitMinutes !== null ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ height: 6, borderRadius: 4, background: "var(--border)", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${limitPercent}%`,
                    background: (limitPercent ?? 0) >= 100 ? "var(--danger)" : "var(--cat-teal)",
                    borderRadius: 4,
                  }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                <span>Limit: {formatMinutes(limitMinutes)}</span>
                <span>{limitPercent}%</span>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>Limit belgilanmagan</div>
          )}
        </StatCard>

        <StatCard icon="📊" iconBg="var(--cat-blue-bg)" iconColor="var(--cat-blue)" label="Faoliyat balli" value="85 / 100">
          <span className="sample-tag" style={{ marginTop: 8 }}>Namuna</span>
        </StatCard>

        <StatCard icon="⚠️" iconBg="var(--cat-amber-bg)" iconColor="var(--cat-amber)" label="Ogohlantirishlar" value={`${alerts.length} ta`}>
          <span style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, display: "inline-block" }} title="Alertlar ekrani keyingi bosqichda">
            Ko&apos;rish (tez orada)
          </span>
        </StatCard>

        <StatCard icon="🖥️" iconBg="var(--cat-purple-bg)" iconColor="var(--cat-purple)" label="Qurilmalar" value={`${devices.length} ta`}>
          <Link href="/devices" style={{ fontSize: 12, color: "var(--accent-dark)", fontWeight: 600, marginTop: 8, display: "inline-block" }}>
            Barchasini ko&apos;rish →
          </Link>
        </StatCard>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 20, alignItems: "start" }}>
        {/* Category donut — sample */}
        <div className="glass" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Faoliyat kategoriyalari</h2>
              <span className="sample-tag">Namuna</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap" }}>
            <DonutChart
              slices={SAMPLE_CATEGORIES.map((c) => ({ label: c.label, minutes: c.percent, color: c.color }))}
              totalLabel="100%"
              totalSubLabel="Namuna"
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minWidth: 180 }}>
              {SAMPLE_CATEGORIES.map((c) => (
                <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color, display: "inline-block", flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{c.label}</span>
                  <span style={{ color: "var(--muted)" }}>{c.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Most-used apps today — real data, honestly relabeled (not a
            timestamped "recent activity" feed, since the backend only
            exposes per-app daily totals, not individual event timestamps). */}
        <div className="glass-solid-well" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Eng ko&apos;p ishlatilgan</h2>
          <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>Bugungi ma&apos;lumot</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {(summary?.top_apps ?? []).slice(0, 5).map((app) => (
              <div key={app.app} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: "var(--cat-teal-bg)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    flexShrink: 0,
                  }}
                >
                  📱
                </span>
                <span style={{ flex: 1, fontSize: 13 }}>{app.app}</span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{formatMinutes(app.minutes)}</span>
              </div>
            ))}
            {(summary?.top_apps ?? []).length === 0 && (
              <p style={{ fontSize: 13, color: "var(--muted)" }}>Bugun ma&apos;lumot yo&apos;q</p>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 20, alignItems: "start" }}>
        {/* 7-day chart — real */}
        <div className="glass" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Ekran vaqti — 7 kunlik statistika</h2>
          {weekSummary && (
            <BarChart
              data={weekSummary.breakdown.map((b) => ({ label: shortDay(b.date), value: b.total_minutes }))}
              limitMinutes={limitMinutes}
            />
          )}
        </div>

        {/* Rules summary — real daily limit, unbuilt rule types clearly disabled */}
        <div className="glass-solid-well" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Qoidalar</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Ekran vaqti limiti (kuniga)</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                {limitMinutes !== null ? formatMinutes(limitMinutes) : "Belgilanmagan"}
              </div>
              {limitMinutes !== null && (
                <div style={{ height: 6, borderRadius: 4, background: "var(--border)", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${limitPercent}%`,
                      background: "var(--cat-teal)",
                      borderRadius: 4,
                    }}
                  />
                </div>
              )}
            </div>
            <DisabledToggleRow label="Tungi rejim" sublabel="Tez orada" />
            <DisabledToggleRow label="Nojo'ya kontent filtri" sublabel="Tez orada" />
          </div>
        </div>
      </div>

      {/* Bottom banner — real, computed from real numbers */}
      <div
        className="glass"
        style={{
          padding: "18px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }} aria-hidden>💚</span>
          <p style={{ fontSize: 14 }}>{bannerMessage}</p>
        </div>
        <button
          disabled
          title="Hisobot eksporti keyingi bosqichda qo'shiladi"
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--muted)",
            borderRadius: 10,
            padding: "10px 16px",
            fontSize: 13,
            cursor: "not-allowed",
          }}
        >
          Hisobotni yuklab olish
        </button>
      </div>
    </AppShell>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function StatCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  children,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="glass" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: iconBg,
            color: iconColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            flexShrink: 0,
          }}
          aria-hidden
        >
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{label}</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function DisabledToggleRow({ label, sublabel }: { label: string; sublabel: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }} aria-disabled="true">
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>{label}</div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>{sublabel}</div>
      </div>
      <div
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          background: "var(--border)",
          position: "relative",
          flexShrink: 0,
        }}
        title="Bu qoida turi hali qo'llab-quvvatlanmaydi"
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#fff",
            position: "absolute",
            top: 2,
            left: 2,
          }}
        />
      </div>
    </div>
  );
}

function AddDeviceCard() {
  return (
    <Link
      href="/devices"
      style={{
        border: "1px dashed var(--glass-border)",
        borderRadius: 20,
        background: "rgba(255, 255, 255, 0.3)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        padding: 20,
        minHeight: 110,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--muted)",
        fontSize: 14,
      }}
    >
      + Qurilma qo&apos;shish
    </Link>
  );
}
