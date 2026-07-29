"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { getAccessToken } from "@/api/client";
import { getCurrentUser } from "@/api/auth";
import { Device, DeviceSummary, getDevices, getSummary } from "@/api/tracking";
import { Rule, getDailyLimitMinutes, getRules } from "@/api/rules";
import { Alert, getAlerts } from "@/api/alerts";

// "X soat Y min" — matches the design source's unit labels (it uses "min",
// not the app's older "daq" abbreviation).
function formatMinutes(minutes: number): { hours: number; mins: number } {
  return { hours: Math.floor(minutes / 60), mins: minutes % 60 };
}

function formatCompact(minutes: number): string {
  const { hours, mins } = formatMinutes(minutes);
  if (hours === 0) return `${mins}min`;
  return `${hours}soat ${mins}min`;
}

const MONTHS_UZ = ["Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"];
const WEEKDAYS_UZ = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];

function todayLabel(): string {
  const d = new Date();
  return `${d.getDate()} ${MONTHS_UZ[d.getMonth()]}, ${d.getFullYear()}`;
}

function shortDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${WEEKDAYS_UZ[d.getDay()]}`;
}

function dayMonthLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()} ${MONTHS_UZ[d.getMonth()]}`;
}

// Category breakdown has no backend source (Bosqich 1/2 track raw app
// names only, no category field) — these numbers are illustrative,
// carried over verbatim from the design source at the user's explicit
// "zero differences" instruction. Flagged here, not on-screen, per that
// instruction; see chat summary for the tradeoff this represents.
const CATEGORIES = [
  { label: "Ta'lim", percent: 49, minutes: 100, color: "var(--cat-teal)" },
  { label: "Dasturlash", percent: 32, minutes: 70, color: "var(--cat-blue)" },
  { label: "O'yinlar", percent: 12, minutes: 25, color: "var(--cat-amber)" },
  { label: "Video va ko'ngil ochish", percent: 4, minutes: 9, color: "var(--cat-purple)" },
  { label: "Boshqalar", percent: 3, minutes: 0, color: "var(--cat-slate)" },
];

const APP_ICON_COLORS = ["var(--cat-teal)", "var(--cat-blue)", "var(--cat-amber)", "var(--cat-purple)", "var(--cat-slate)"];

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
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20, color: "#1f2b3a" }}>Bosh sahifa</h1>
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
  const totalSplit = formatMinutes(totalToday);

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

  const topApps = (summary?.top_apps ?? []).slice(0, 5);

  return (
    <AppShell>
      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "6px 2px 0", flexWrap: "wrap", gap: 14 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 26, color: "#1f2b3a" }}>
            Xush kelibsiz{firstName ? `, ${capitalize(firstName)}` : ""}! 👋
          </div>
          <div style={{ fontSize: 15, color: "#7a8698", marginTop: 6 }}>Farzandingizning raqamli faoliyati nazoratda.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            title={unseenAlerts > 0 ? `${unseenAlerts} ko'rilmagan ogohlantirish` : "Ogohlantirish yo'q"}
            style={{
              position: "relative",
              width: 48,
              height: 48,
              background: "#fff",
              border: "1px solid rgba(0,0,0,.05)",
              borderRadius: 15,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(90,120,170,.1)",
            }}
          >
            <svg width={21} height={21} viewBox="0 0 24 24" fill="none">
              <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" stroke="#5a6879" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 19a2 2 0 0 0 4 0" stroke="#5a6879" strokeWidth="1.9" strokeLinecap="round" />
            </svg>
            {unseenAlerts > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "#f5455a",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid #eef1fb",
                }}
              >
                {unseenAlerts}
              </span>
            )}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "#fff",
              border: "1px solid rgba(0,0,0,.05)",
              borderRadius: 15,
              padding: "12px 16px",
              boxShadow: "0 4px 12px rgba(90,120,170,.1)",
            }}
          >
            <svg width={19} height={19} viewBox="0 0 24 24" fill="none">
              <rect x="3" y="5" width="18" height="16" rx="3" stroke="#5a6879" strokeWidth="1.8" />
              <path d="M3 9h18M8 3v4M16 3v4" stroke="#5a6879" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span style={{ fontWeight: 600, fontSize: 15, color: "#2b3849" }}>{todayLabel()}</span>
          </div>
        </div>
      </div>

      {/* stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginTop: 18 }}>
        <StatCard iconGradient="linear-gradient(145deg,#3ad0b3,#22b39c)" iconShadow="rgba(45,190,165,.35)" label="Bugungi ekran vaqti"
          icon={
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="8" stroke="#fff" strokeWidth="1.9" />
              <path d="M12 8v4l3 2" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        >
          <div style={{ marginTop: 12, fontSize: 15, color: "#8593a4" }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: "#1f2b3a" }}>{totalSplit.hours}</span> soat{" "}
            <span style={{ fontSize: 26, fontWeight: 800, color: "#1f2b3a" }}>{totalSplit.mins}</span> min
          </div>
          {limitMinutes !== null ? (
            <>
              <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#8593a4", marginBottom: 7 }}>
                <span>Limit: {formatCompact(limitMinutes)}</span>
                <span style={{ fontWeight: 700, color: "#2b3849" }}>{limitPercent}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 6, background: "rgba(120,140,170,.16)", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${limitPercent}%`,
                    height: "100%",
                    borderRadius: 6,
                    background: (limitPercent ?? 0) >= 100 ? "var(--danger)" : "linear-gradient(90deg,#3ad0b3,#2fbfa6)",
                  }}
                />
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12.5, color: "#8593a4", marginTop: 10 }}>Limit belgilanmagan</div>
          )}
        </StatCard>

        <StatCard iconGradient="linear-gradient(145deg,#6b9bf5,#4f7cf0)" iconShadow="rgba(79,124,240,.35)" label="Faoliyat balli"
          icon={
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <path d="M6 15v3M12 10v8M18 6v12" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          }
        >
          <div style={{ marginTop: 12 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: "#1f2b3a" }}>85</span>{" "}
            <span style={{ fontSize: 15, color: "#8593a4" }}> / 100</span>
          </div>
          <div style={{ marginTop: 12, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13.5, color: "#3ba88f", fontWeight: 700 }}>Ajoyib! 🎉</span>
            <svg width={110} height={34} viewBox="0 0 110 34" fill="none">
              <path d="M2 26C12 26 16 14 26 16s10 8 20 4 12-14 22-12 8 12 18 8 8-8 16-10" stroke="#3ad0b3" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </StatCard>

        <StatCard iconGradient="linear-gradient(145deg,#f9b24d,#f28a3a)" iconShadow="rgba(242,138,58,.35)" label="Ogohlantirishlar"
          icon={
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <path d="M12 4l9 16H3z" stroke="#fff" strokeWidth="1.9" strokeLinejoin="round" />
              <path d="M12 10v4M12 17h.01" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
            </svg>
          }
        >
          <div style={{ marginTop: 12 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: "#1f2b3a" }}>{alerts.length}</span>{" "}
            <span style={{ fontSize: 15, color: "#8593a4" }}>ta</span>
          </div>
          <div style={{ marginTop: 20 }}>
            <span style={{ fontSize: 14, color: "#e88a2f", fontWeight: 700, cursor: "not-allowed" }} title="Alertlar ekrani keyingi bosqichda">
              Ko&apos;rish →
            </span>
          </div>
        </StatCard>

        <StatCard iconGradient="linear-gradient(145deg,#a78bfa,#8b5cf6)" iconShadow="rgba(139,92,246,.35)" label="Qurilmalar"
          icon={
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        >
          <div style={{ marginTop: 12 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: "#1f2b3a" }}>{devices.length}</span>{" "}
            <span style={{ fontSize: 15, color: "#8593a4" }}>ta</span>
          </div>
          <div style={{ marginTop: 20 }}>
            <Link href="/devices" style={{ fontSize: 14, color: "#8b5cf6", fontWeight: 700 }}>
              Barchasini ko&apos;rish →
            </Link>
          </div>
        </StatCard>
      </div>

      {/* middle row */}
      <div style={{ display: "grid", gridTemplateColumns: "1.32fr 1fr", gap: 18, marginTop: 18, alignItems: "start" }}>
        <div className="glass" style={{ padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#1f2b3a" }}>Faoliyat kategoriyalari</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid rgba(0,0,0,.06)", borderRadius: 11, padding: "8px 12px", fontSize: 13.5, fontWeight: 600, color: "#5a6879" }}>
              Bugun
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <path d="M6 9l6 6 6-6" stroke="#9aa6b6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 26, flexWrap: "wrap" }}>
            <CategoryDonut total={totalCompact(totalToday)} />
            <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 15 }}>
              {CATEGORIES.map((c) => (
                <div key={c.label} style={{ display: "flex", alignItems: "center", fontSize: 14 }}>
                  <span style={{ width: 11, height: 11, borderRadius: 3, background: c.color, marginRight: 11, flexShrink: 0 }} />
                  <span style={{ flex: 1, color: "#34414f", fontWeight: 600 }}>{c.label}</span>
                  <span style={{ color: "#8593a4", width: 88, textAlign: "right" }}>{c.minutes ? formatCompact(c.minutes) : "—"}</span>
                  <span style={{ color: "#2b3849", fontWeight: 700, width: 42, textAlign: "right" }}>{c.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="glass" style={{ padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#1f2b3a" }}>Eng ko&apos;p ishlatilgan</div>
            <Link href="/activity" style={{ fontSize: 14, fontWeight: 700, color: "var(--brand-blue)" }}>
              Barchasi →
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {topApps.map((app, i) => (
              <div key={app.app} style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 0", borderBottom: i === topApps.length - 1 ? "none" : "1px solid rgba(0,0,0,.05)" }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    flexShrink: 0,
                    borderRadius: 9,
                    background: APP_ICON_COLORS[i % APP_ICON_COLORS.length],
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                  aria-hidden
                >
                  {app.app[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, fontWeight: 700, fontSize: 14.5, color: "#22303f" }}>{app.app}</div>
                <span style={{ background: "#eef2f7", color: "#5a6879", fontSize: 12, fontWeight: 600, padding: "4px 11px", borderRadius: 8 }}>Bugun</span>
                <div style={{ textAlign: "right", minWidth: 68 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#2b3849" }}>{formatCompact(app.minutes)}</div>
                </div>
              </div>
            ))}
            {topApps.length === 0 && <p style={{ fontSize: 13, color: "var(--muted)" }}>Bugun ma&apos;lumot yo&apos;q</p>}
          </div>
        </div>
      </div>

      {/* bottom row */}
      <div style={{ display: "grid", gridTemplateColumns: "1.32fr 1fr", gap: 18, marginTop: 18, alignItems: "start" }}>
        <div className="glass" style={{ padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#1f2b3a" }}>Ekran vaqti – 7 kunlik statistika</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid rgba(0,0,0,.06)", borderRadius: 11, padding: "8px 12px", fontSize: 13.5, fontWeight: 600, color: "#5a6879" }}>
              7 kun
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <path d="M6 9l6 6 6-6" stroke="#9aa6b6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          {weekSummary && (
            <WeeklyChart
              data={weekSummary.breakdown.map((b) => ({ label: shortDay(b.date), dateLabel: dayMonthLabel(b.date), minutes: b.total_minutes }))}
              limitMinutes={limitMinutes}
            />
          )}
        </div>

        <div className="glass" style={{ padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#1f2b3a" }}>Qoidalar</div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--sidebar-disabled)", cursor: "not-allowed" }} title="Qoidalar ekrani keyingi bosqichda">
              Barcha qoidalar →
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 0", borderBottom: "1px solid rgba(0,0,0,.05)" }}>
              <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 11, background: "#eef2f7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width={19} height={19} viewBox="0 0 24 24" fill="none">
                  <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" stroke="#6b7688" strokeWidth="1.7" strokeLinejoin="round" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: "#22303f" }}>Ekran vaqti limiti (kuniga)</div>
                <div style={{ fontSize: 12.5, color: "#8593a4", marginTop: 2 }}>{limitMinutes !== null ? formatCompact(limitMinutes) : "Belgilanmagan"}</div>
              </div>
              {limitMinutes !== null && (
                <div style={{ textAlign: "right", minWidth: 120 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#2b3849", marginBottom: 6 }}>
                    {formatCompact(totalToday)} / {formatCompact(limitMinutes)}
                  </div>
                  <div style={{ height: 6, borderRadius: 4, background: "rgba(120,140,170,.16)", overflow: "hidden" }}>
                    <div style={{ width: `${limitPercent}%`, height: "100%", background: "linear-gradient(90deg,#3ad0b3,#2fbfa6)" }} />
                  </div>
                </div>
              )}
            </div>
            <ToggleRow label="Tungi rejim" sublabel="Tez orada" />
            <ToggleRow label="Nojo'ya kontent filtri" sublabel="Tez orada" last />
          </div>
        </div>
      </div>

      {/* banner */}
      <div className="glass" style={{ marginTop: 18, padding: "16px 22px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div
          style={{
            width: 48,
            height: 48,
            flexShrink: 0,
            borderRadius: 14,
            background: "linear-gradient(145deg,#3ad0b3,#2aa9c9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 6px 14px rgba(45,180,190,.3)",
          }}
        >
          <svg width={24} height={24} viewBox="0 0 24 24" fill="#fff">
            <path d="M12 3l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9 6.8 19l1-5.8L3.6 9.1l5.8-.8z" />
          </svg>
        </div>
        <div style={{ flex: 1, lineHeight: 1.45 }}>
          <div style={{ fontSize: 15.5, color: "#2b3849" }}>{bannerMessage}</div>
          <div style={{ fontSize: 15, color: "#5a6879" }}>Davom eting! 💚</div>
        </div>
        <button
          disabled
          title="Hisobot eksporti keyingi bosqichda qo'shiladi"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            background: "#fff",
            border: "1px solid rgba(0,0,0,.08)",
            borderRadius: 13,
            padding: "12px 18px",
            fontFamily: "inherit",
            fontWeight: 700,
            fontSize: 14,
            color: "#2b3849",
            cursor: "not-allowed",
            boxShadow: "0 4px 12px rgba(90,120,170,.1)",
          }}
        >
          Hisobotni yuklab olish
          <svg width={17} height={17} viewBox="0 0 24 24" fill="none">
            <path d="M12 4v11M7 11l5 5 5-5M5 20h14" stroke="#2b3849" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </AppShell>
  );
}

function totalCompact(minutes: number): string {
  const { hours, mins } = formatMinutes(minutes);
  return `${hours}soat ${mins}min`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function StatCard({
  icon,
  iconGradient,
  iconShadow,
  label,
  children,
}: {
  icon: React.ReactNode;
  iconGradient: string;
  iconShadow: string;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="glass" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
        <div
          style={{
            width: 48,
            height: 48,
            flexShrink: 0,
            borderRadius: 14,
            background: iconGradient,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 6px 14px ${iconShadow}`,
          }}
        >
          {icon}
        </div>
        <div style={{ fontSize: 14, color: "#7a8698", fontWeight: 600 }}>{label}</div>
      </div>
      {children}
    </div>
  );
}

function CategoryDonut({ total }: { total: string }) {
  return (
    <div style={{ position: "relative", width: 184, height: 184, flexShrink: 0 }}>
      <svg width={184} height={184} viewBox="0 0 184 184">
        <g transform="rotate(-90 92 92)" fill="none" strokeWidth={27}>
          <circle cx={92} cy={92} r={70} stroke="#c7cfd8" strokeDasharray="13.2 426.6" />
          <circle cx={92} cy={92} r={70} stroke="#a78bfa" strokeDasharray="17.6 422.2" strokeDashoffset={-13.2} />
          <circle cx={92} cy={92} r={70} stroke="#f5c04e" strokeDasharray="52.8 387" strokeDashoffset={-30.8} />
          <circle cx={92} cy={92} r={70} stroke="#6f97f0" strokeDasharray="140.7 299.1" strokeDashoffset={-83.6} />
          <circle cx={92} cy={92} r={70} stroke="#2fc8ad" strokeDasharray="215.5 224.3" strokeDashoffset={-224.3} />
        </g>
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1.05 }}>
        <div style={{ fontWeight: 800, fontSize: 22, color: "#1f2b3a" }}>{total}</div>
        <div style={{ fontSize: 13, color: "#93a0b0", marginTop: 3 }}>Jami</div>
      </div>
    </div>
  );
}

function WeeklyChart({
  data,
  limitMinutes,
}: {
  data: { label: string; dateLabel: string; minutes: number }[];
  limitMinutes: number | null;
}) {
  const maxMinutes = Math.max(60, limitMinutes ?? 0, ...data.map((d) => d.minutes)) * 1.15;
  const chartTop = 20;
  const chartBottom = 210;
  const chartHeight = chartBottom - chartTop;
  const barWidth = 34;
  const gap = 80;
  const startX = 88;
  const width = Math.max(640, startX + data.length * gap + 20);

  const yToPx = (minutes: number) => chartBottom - (minutes / maxMinutes) * chartHeight;
  const limitY = limitMinutes ? yToPx(limitMinutes) : null;
  const gridSteps = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg width="100%" viewBox={`0 0 ${width} 250`} style={{ display: "block" }}>
      <g fontFamily="Plus Jakarta Sans, sans-serif" fontSize={12} fill="#9aa6b6">
        {gridSteps.map((f) => (
          <text key={f} x={14} y={yToPx(maxMinutes * f) + 4} textAnchor="start">
            {f === 0 ? "0" : `${Math.round((maxMinutes * f) / 60)}soat`}
          </text>
        ))}
      </g>
      <g stroke="rgba(120,140,170,.12)" strokeWidth={1}>
        {gridSteps.map((f) => (
          <line key={f} x1={60} y1={yToPx(maxMinutes * f)} x2={width - 10} y2={yToPx(maxMinutes * f)} />
        ))}
      </g>
      {limitY !== null && (
        <>
          <line x1={60} y1={limitY} x2={width - 10} y2={limitY} stroke="#2fc8ad" strokeWidth={1.6} strokeDasharray="6 5" />
          <text x={width - 60} y={limitY - 8} fontFamily="Plus Jakarta Sans, sans-serif" fontSize={12} fontWeight={600} fill="#2fc8ad" textAnchor="end">
            Kunlik limit
          </text>
        </>
      )}
      <g>
        {data.map((d, i) => {
          const x = startX + i * gap;
          const y = yToPx(d.minutes);
          const isLast = i === data.length - 1;
          return (
            <rect
              key={d.dateLabel + i}
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(chartBottom - y, 2)}
              rx={8}
              fill={isLast ? "#1fa98f" : "#3ad0b3"}
            />
          );
        })}
      </g>
      <g fontFamily="Plus Jakarta Sans, sans-serif" fontSize={12.5} fill="#7a8698" textAnchor="middle" fontWeight={600}>
        {data.map((d, i) => (
          <text key={d.dateLabel + i} x={startX + i * gap + barWidth / 2} y={234}>
            {d.dateLabel}
          </text>
        ))}
      </g>
    </svg>
  );
}

function ToggleRow({ label, sublabel, last }: { label: string; sublabel: string; last?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 0", borderBottom: last ? "none" : "1px solid rgba(0,0,0,.05)" }} aria-disabled="true">
      <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 11, background: "#eef2f7", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width={19} height={19} viewBox="0 0 24 24" fill="none">
          <path d="M20 13a8 8 0 1 1-9-9 6 6 0 0 0 9 9z" stroke="#6b7688" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--muted)" }}>{label}</div>
        <div style={{ fontSize: 12.5, color: "#8593a4", marginTop: 2 }}>{sublabel}</div>
      </div>
      <div
        style={{ width: 46, height: 26, borderRadius: 14, background: "#d5dbe3", position: "relative", flexShrink: 0 }}
        title="Bu qoida turi hali qo'llab-quvvatlanmaydi"
      >
        <span style={{ position: "absolute", top: 3, left: 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
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
        background: "rgba(255, 255, 255, 0.5)",
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
