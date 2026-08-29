"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Device, DeviceSummary, getDevices, getSummary } from "@/api/tracking";
import { getDailyLimitMinutes, getRules, Rule } from "@/api/rules";
import { Alert, getAlerts } from "@/api/alerts";
import { toast } from "react-hot-toast";
import AppIcon from "@/components/AppIcon";
import CategoryDonut from "@/components/CategoryDonut";
import { appDisplay, CATEGORY_META } from "@/lib/appDisplay";
import { uzTime } from "@/lib/uzDate";

const WEEKDAYS_UZ = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours && !mins) return `${hours} soat`;
  return hours ? `${hours} soat ${mins} min` : `${mins} min`;
}

function shortDay(date: string) {
  return WEEKDAYS_UZ[new Date(`${date}T00:00:00`).getDay()];
}

function formatLastSync(value: string | null): string {
  if (!value) return "Hali yo'q";
  const min = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (min < 1) return "Hozirgina";
  if (min < 60) return `${min} daqiqa oldin`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} soat oldin`;
  return `${Math.floor(hr / 24)} kun oldin`;
}

function OverviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedDeviceId = searchParams.get("device");
  const requestedChildId = searchParams.get("child");
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [summary, setSummary] = useState<DeviceSummary | null>(null);
  const [weekSummary, setWeekSummary] = useState<DeviceSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [rules, setRules] = useState<Rule[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  useEffect(() => {
    (async () => {
      try {
        setSummaryLoading(true);
        const deviceList = await getDevices();
        setDevices(deviceList);
        const device = deviceList.find((item) => item.id === requestedDeviceId) ?? deviceList.find((item) => item.child_id === requestedChildId && item.status === "linked") ?? (requestedChildId ? undefined : deviceList.find((item) => item.status === "linked"));
        if (!device) {
          setSummary(null);
          setWeekSummary(null);
          setSummaryLoading(false);
          return;
        }
        const [day, week, deviceRules, deviceAlerts] = await Promise.all([
          getSummary(device.id), getSummary(device.id, { range: "week" }), getRules(device.id), getAlerts(device.id),
        ]);
        setSummary(day);
        setWeekSummary(week);
        setRules(deviceRules);
        setAlerts(deviceAlerts);
        setSummaryLoading(false);
      } catch (reason) {
        toast.error(reason instanceof Error ? reason.message : "Ma'lumotlar yangilanmadi.");
        setSummaryLoading(false);
      }
    })();
  }, [requestedChildId, requestedDeviceId, router]);

  if (devices === null) return <><p>Yuklanmoqda...</p></>;
  const totalToday = summary?.total_screen_minutes ?? 0;
  const limitMinutes = getDailyLimitMinutes(rules);
  const isOnline = summary?.device_status === "online";
  
  const appTotal = summary?.top_apps?.reduce((total, app) => total + app.minutes, 0) ?? 0;
  const byCategory = new Map<string, number>();
  for (const app of summary?.top_apps ?? []) {
    const cat = appDisplay(app.app).category;
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + app.minutes);
  }
  const categories = [...byCategory.entries()]
    .map(([cat, minutes]) => {
      const meta = CATEGORY_META[cat as keyof typeof CATEGORY_META];
      return {
        label: meta.label,
        minutes,
        color: meta.color,
        percent: appTotal ? Math.round((minutes / appTotal) * 100) : 0,
      };
    })
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 4);
  
  // Server breakdown is already the last 7 calendar days in the account's
  // timezone — use it directly instead of rebuilding dates client-side (which
  // would be in UTC and drift near midnight).
  const weekDays = (weekSummary?.breakdown ?? []).slice(-7);

  const hasLimitRule = limitMinutes !== null;
  const blockedAppCount = rules.filter((r) => r.rule_type === "blocked_app").length;

  const showEmptyState = !summaryLoading && (!devices?.length || !summary);

  return (
    <>
      {showEmptyState && (
        <div className="card" style={{ marginBottom: 24, background: "var(--brand-blue)", color: "#fff", border: "none" }}>
          <div style={{ padding: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ fontSize: 20, marginBottom: 8, color: "#fff" }}>Xush kelibsiz! Dashboardni boshlash uchun qurilma ulang</h2>
              <p style={{ opacity: 0.9, fontSize: 14, margin: 0 }}>Farzandingiz qurilmasidagi faoliyatni kuzatish uchun uni tizimga biriktiring.</p>
            </div>
            <Link href="/devices" className="btn btn-outline" style={{ background: "rgba(255,255,255,0.2)", color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}>
              Qurilma qo'shish →
            </Link>
          </div>
        </div>
      )}
      {/* Stats */}
      <section className="stats-grid">
        <div className="stat-card">
          <div className="icon green">
            <iconify-icon icon="solar:clock-circle-linear"></iconify-icon>
          </div>
          <div>
            <span>Ekran vaqti</span>
            <h2>{formatMinutes(totalToday)}</h2>
            <small>{limitMinutes ? `Limit: ${formatMinutes(limitMinutes)}` : "Limit belgilanmagan"}</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="icon blue">
            <iconify-icon icon="solar:widget-2-linear"></iconify-icon>
          </div>
          <div>
            <span>Ilovalar</span>
            <h2>{summary?.top_apps.length ?? 0} ta</h2>
            <small>Bugun ishlatilgan</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="icon orange">
            <iconify-icon icon="solar:danger-triangle-linear"></iconify-icon>
          </div>
          <div>
            <span>Ogohlantirish</span>
            <h2>{alerts.length} ta</h2>
            <small><Link href={`/alerts?device=${summary?.device_id ?? ""}`}>Batafsil →</Link></small>
          </div>
        </div>

        <div className="stat-card">
          <div className={`icon ${isOnline ? "green" : "slate"}`}>
            <iconify-icon icon={isOnline ? "solar:verified-check-linear" : "solar:close-circle-linear"}></iconify-icon>
          </div>
          <div>
            <span>Qurilma holati</span>
            <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className={`status ${isOnline ? "online" : "offline"}`}></span>
              {isOnline ? "Onlayn" : "Oflayn"}
            </h2>
            <small>Oxirgi aloqa: {formatLastSync(summary?.last_sync ?? null)}</small>
          </div>
        </div>
      </section>

      {/* Main */}
      <section className="dashboard-grid">
        {/* Activity */}
        <div className="card large">
          <div className="card-header">
            <h3>Faoliyat kategoriyalari</h3>
            <Link href={`/activity?device=${summary?.device_id ?? ""}`}>Barchasi →</Link>
          </div>
          
          <CategoryDonut slices={categories} totalMinutes={totalToday} />
        </div>

        {/* Recent */}
        <div className="card">
          <div className="card-header">
            <h3>So'nggi faoliyat</h3>
            <Link href={`/activity?device=${summary?.device_id ?? ""}`}>Barchasi</Link>
          </div>



          {(summary?.top_apps ?? []).slice(0, 4).map((app) => {
            const d = appDisplay(app.app);
            return (
              <div className="activity-item" key={app.app}>
                <AppIcon appId={app.app} icon={app.icon} size={34} />
                <span>{d.label}</span>
                <em className="cat-tag" style={{color: d.color, background: d.bg}}>{d.categoryLabel}</em>
                <small>{app.last_used_at ? uzTime(new Date(app.last_used_at)) : "Bugun"}</small>
              </div>
            );
          })}
          {!summary?.top_apps.length && <p style={{color: "var(--muted)", fontSize: 13}}>Hali ma'lumot kelmadi.</p>}
        </div>

        {/* Chart */}
        <div className="card large">
          <div className="card-header">
            <h3>7 kunlik statistika</h3>
          </div>
          
          <svg className="graph" viewBox="0 0 560 190" preserveAspectRatio="xMidYMid meet">
            <g stroke="rgba(37,99,235,.08)" strokeWidth="1">
              <line x1="40" y1="10" x2="540" y2="10"/>
              <line x1="40" y1="46" x2="540" y2="46"/>
              <line x1="40" y1="82" x2="540" y2="82"/>
              <line x1="40" y1="118" x2="540" y2="118"/>
              <line x1="40" y1="154" x2="540" y2="154"/>
            </g>
            <g fontFamily="Inter" fontSize="10" fill="#9aa6b6">
              <text x="8" y="14">5s</text>
              <text x="8" y="50">4s</text>
              <text x="8" y="86">3s</text>
              <text x="8" y="122">2s</text>
              <text x="8" y="158">0</text>
            </g>
            <g>
              {weekDays.map((day, index, arr) => {
                 const minutes = day.total_minutes || 0;
                 const maxMins = 5 * 60; // 5 hours max on graph
                 const cappedMins = Math.min(minutes, maxMins);
                 const height = (cappedMins / maxMins) * (154 - 10);
                 const y = 154 - height;
                 return (
                   <rect key={day.date} x={60 + index * 70} y={y} width="30" height={Math.max(height, 2)} rx="8" fill={index === arr.length - 1 ? "#2563eb" : "#60a5fa"}/>
                 );
              })}
            </g>
            <g fontFamily="Inter" fontSize="11" fontWeight="600" fill="#7a8698" textAnchor="middle">
              {weekDays.map((day, index) => (
                <text key={day.date} x={75 + index * 70} y="174">{shortDay(day.date)}</text>
              ))}
            </g>
          </svg>
        </div>

        {/* Rules */}
        <div className="card">
          <div className="card-header">
            <h3>Qoidalar</h3>
            <Link href={`/rules?device=${summary?.device_id ?? ""}`}>Barchasi →</Link>
          </div>

          <div className="rule">
            <span className="rule-icon">
              <iconify-icon icon="solar:clock-circle-linear"></iconify-icon>
            </span>
            <div className="rule-info">
              <span>Ekran vaqti limiti</span>
              <small>{limitMinutes ? `${limitMinutes} min/kun` : "Belgilanmagan"}</small>
            </div>
            <input type="checkbox" readOnly checked={hasLimitRule} />
          </div>

          <div className="rule">
            <span className="rule-icon">
              <iconify-icon icon="solar:lock-keyhole-linear"></iconify-icon>
            </span>
            <div className="rule-info">
              <span>Bloklangan ilovalar</span>
              <small>{blockedAppCount ? `${blockedAppCount} ta` : "Yo'q"}</small>
            </div>
            <input type="checkbox" readOnly checked={blockedAppCount > 0} />
          </div>

          <Link href={`/rules?device=${summary?.device_id ?? ""}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 14, color: "var(--brand-blue)", fontWeight: 600, textDecoration: "none", padding: "0 4px" }}>
            <iconify-icon icon="solar:settings-linear"></iconify-icon>
            Qoidalarni sozlash
          </Link>
        </div>
      </section>
    </>
  );
}

export default function OverviewPage() {
  return <Suspense fallback={<><p>Yuklanmoqda...</p></>}><OverviewContent /></Suspense>;
}
