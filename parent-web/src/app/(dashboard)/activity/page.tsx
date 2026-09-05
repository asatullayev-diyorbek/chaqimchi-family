"use client";

import { Suspense, useEffect, useState } from "react";
import { ActivityHistoryItem, SiteUsage, SummaryRange, TimelineSegment, getActivityHistory, getActivityTimeline, getSites, getSummary } from "@/api/tracking";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useSelectedDevice } from "@/hooks/useSelectedDevice";
import { toast } from "react-hot-toast";
import AppIcon from "@/components/AppIcon";
import DayTimeline from "@/components/DayTimeline";
import DeviceSelector from "@/components/DeviceSelector";
import ScreenTimeChart from "@/components/ScreenTimeChart";
import { getRules, getDailyLimitMinutes, Rule } from "@/api/rules";
import { appDisplay } from "@/lib/appDisplay";
import { uzDayMonth, uzTime, uzWeekdayDayMonth } from "@/lib/uzDate";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function humanDay(iso: string): string {
  if (iso === todayISO()) return "Bugun";
  if (iso === shiftISO(todayISO(), -1)) return "Kecha";
  return uzDayMonth(new Date(iso + "T00:00:00"));
}

const RANGE_LABELS: Record<SummaryRange, string> = {
  day: "Bugun",
  week: "7 kun",
  month: "30 kun",
};

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  return `${hours} soat ${mins} min`;
}

function exportAppsCsv(apps: { app: string; minutes: number; last_used_at: string | null }[], rangeLabel: string) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = [
    ["Ilova", "Kategoriya", "Daqiqa", "Oxirgi ishlatilgan"],
    ...apps.map((a) => {
      const d = appDisplay(a.app);
      return [d.label, d.categoryLabel, String(a.minutes), a.last_used_at ?? ""];
    }),
  ];
  const csv = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `chaqimchi-faoliyat-${rangeLabel.replace(/\s+/g, "-")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

const PAGE_SIZE = 10;

const BROWSER_META: Record<string, { label: string; icon: string; color: string }> = {
  chrome: { label: "Chrome", icon: "logos:chrome", color: "#4285F4" },
  edge: { label: "Edge", icon: "logos:microsoft-edge", color: "#0F7EBD" },
  firefox: { label: "Firefox", icon: "logos:firefox", color: "#FF7139" },
  brave: { label: "Brave", icon: "logos:brave", color: "#FB542B" },
  opera: { label: "Opera", icon: "logos:opera", color: "#FF1B2D" },
  vivaldi: { label: "Vivaldi", icon: "logos:vivaldi-icon", color: "#EF3939" },
  boshqa: { label: "Boshqa", icon: "solar:global-linear", color: "#7a8698" },
};
const browserMeta = (b: string) => BROWSER_META[b] ?? BROWSER_META.boshqa;

// Known sites get a real brand mark; everything else keeps a clean globe.
// Keyed on the registrable host the agent sends (already lowercased, no www.).
const SITE_ICONS: Record<string, string> = {
  "youtube.com": "logos:youtube-icon",
  "google.com": "logos:google-icon",
  "github.com": "logos:github-icon",
  "chatgpt.com": "simple-icons:openai",
  "openai.com": "simple-icons:openai",
  "telegram.org": "logos:telegram",
  "t.me": "logos:telegram",
  "web.telegram.org": "logos:telegram",
  "x.com": "simple-icons:x",
  "twitter.com": "simple-icons:x",
  "facebook.com": "logos:facebook",
  "instagram.com": "logos:instagram-icon",
  "wikipedia.org": "logos:wikipedia",
  "reddit.com": "logos:reddit-icon",
  "discord.com": "logos:discord-icon",
  "twitch.tv": "logos:twitch",
  "wokwi.com": "solar:cpu-bolt-linear",
  "figma.com": "logos:figma",
  "notion.so": "logos:notion-icon",
  "stackoverflow.com": "logos:stackoverflow-icon",
  "linkedin.com": "logos:linkedin-icon",
  "netflix.com": "logos:netflix-icon",
  "spotify.com": "logos:spotify-icon",
  "canva.com": "logos:canva",
  "gmail.com": "logos:google-gmail",
  "mail.google.com": "logos:google-gmail",
};
function siteIconFor(domain: string): { icon: string; mono: boolean } {
  const d = domain.toLowerCase();
  const hit = SITE_ICONS[d] ?? SITE_ICONS[d.split(".").slice(-2).join(".")];
  if (hit) return { icon: hit, mono: hit.startsWith("simple-icons:") };
  return { icon: "solar:global-linear", mono: true };
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "hozirgina";
  if (m < 60) return `${m} daqiqa oldin`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} soat oldin`;
  const days = Math.round(h / 24);
  return `${days} kun oldin`;
}

function exportSitesCsv(sites: SiteUsage[], rangeLabel: string) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = [
    ["Sayt", "Tashriflar", "Daqiqa", "Brauzerlar", "Oxirgi tashrif"],
    ...sites.map((s) => [
      s.domain,
      String(s.visits),
      String(s.minutes),
      (s.browsers ?? []).map((b) => `${browserMeta(b.browser).label} (${b.visits})`).join("; "),
      s.last_visited_at ?? "",
    ]),
  ];
  const csv = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `chaqimchi-saytlar-${rangeLabel.replace(/\s+/g, "-")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function formatActivityTime(value: string | null): string {
  if (!value) return "—";
  return uzTime(new Date(value));
}

function ActivityContent() {

  const { device, childDevices, allDevices } = useSelectedDevice();
  const [range, setRange] = useState<SummaryRange>("week");
  const [summaryRetry, setSummaryRetry] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [appsPage, setAppsPage] = useState(0);
  const [appSort, setAppSort] = useState<"minutes" | "name" | "recent">("minutes");
  const [sitesPage, setSitesPage] = useState(0);
  const [siteSort, setSiteSort] = useState<"recent" | "visits" | "domain">("recent");
  const [tab, setTab] = useState<"screen" | "history" | "sites">("screen");
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyDate, setHistoryDate] = useState(todayISO);

  // Null in "all devices" mode: with several devices linked there is no
  // honest single number to show, so the tabs ask which one instead.
  const activeDeviceId = device?.id ?? null;
  const onSummaryTab = tab === "screen";
  const onHistoryTab = tab === "history";

  const summaryQuery = useApiQuery(
    () => getSummary(activeDeviceId!, { range }),
    [activeDeviceId, range, summaryRetry],
    { enabled: Boolean(activeDeviceId) && onSummaryTab },
  );
  const summary = summaryQuery.data;
  const summaryLoading = summaryQuery.isInitialLoad;
  const summaryError = summaryQuery.error !== null;

  // Daily limit, for the screen-time cards' progress bars.
  const rulesQuery = useApiQuery(
    () => getRules(activeDeviceId!),
    [activeDeviceId, summaryRetry],
    { enabled: Boolean(activeDeviceId) && tab === "screen" },
  );
  const rules: Rule[] = rulesQuery.data ?? [];

  const historyQuery = useApiQuery(
    () => getActivityHistory(activeDeviceId!, { date: historyDate, limit: PAGE_SIZE, offset: historyOffset }),
    [activeDeviceId, historyDate, historyOffset],
    { enabled: Boolean(activeDeviceId) && onHistoryTab },
  );
  const history: ActivityHistoryItem[] = historyQuery.data?.results ?? [];
  const historyCount = historyQuery.data?.count ?? 0;
  const historyNextOffset = historyQuery.data?.next_offset ?? null;
  const historyLoading = historyQuery.isInitialLoad;
  const historyError = historyQuery.error !== null;

  // Sites are device-scoped like everything else: two devices browsing the
  // same site in the same hour must not be summed into one bogus total.
  const sitesQuery = useApiQuery(
    () => getSites(activeDeviceId!, { range }),
    [activeDeviceId, range, summaryRetry],
    { enabled: Boolean(activeDeviceId) && tab === "sites" },
  );
  const rawSites: SiteUsage[] = sitesQuery.data?.results ?? [];
  const byBrowser = sitesQuery.data?.by_browser ?? [];
  const sitesTotalMinutes = sitesQuery.data?.total_minutes ?? rawSites.reduce((n, s) => n + s.minutes, 0);
  const totalVisits = sitesQuery.data?.total_visits ?? rawSites.reduce((n, s) => n + s.visits, 0);
  const sites: SiteUsage[] = [...rawSites].sort((a, b) => {
    if (siteSort === "domain") return a.domain.localeCompare(b.domain);
    if (siteSort === "visits") return b.visits - a.visits || b.minutes - a.minutes;
    // "recent": most recently visited first, then earlier visits following.
    return (b.last_visited_at ?? "").localeCompare(a.last_visited_at ?? "") || b.minutes - a.minutes;
  });
  // Real-data derived views for the redesigned tab — no fabricated metrics.
  const topSite = [...rawSites].sort((a, b) => b.minutes - a.minutes || b.visits - a.visits)[0] ?? null;
  const siteBarMax = Math.max(1, ...rawSites.map((s) => s.minutes || s.visits));
  const recentSites = [...rawSites]
    .filter((s) => s.last_visited_at)
    .sort((a, b) => (b.last_visited_at ?? "").localeCompare(a.last_visited_at ?? ""))
    .slice(0, 6);
  const sitesLoading = sitesQuery.isInitialLoad;
  const sitesError = sitesQuery.error !== null;

  const timelineQuery = useApiQuery(
    () => getActivityTimeline(activeDeviceId!, { date: historyDate }),
    [activeDeviceId, historyDate],
    { enabled: Boolean(activeDeviceId) && onHistoryTab },
  );
  const timeline: TimelineSegment[] = timelineQuery.data?.segments ?? [];
  const timelineLoading = timelineQuery.isInitialLoad;

  useEffect(() => {
    if (summaryQuery.error) toast.error(summaryQuery.error.message);
  }, [summaryQuery.error]);

  const sortedApps = summary
    ? [...summary.top_apps].sort((a, b) => {
        if (appSort === "name") return appDisplay(a.app).label.localeCompare(appDisplay(b.app).label);
        if (appSort === "recent") return (b.last_used_at ?? "").localeCompare(a.last_used_at ?? "");
        return b.minutes - a.minutes;
      })
    : [];
  const appsPageC = Math.min(appsPage, Math.max(0, Math.ceil(sortedApps.length / PAGE_SIZE) - 1));
  // Clamp rather than reset on change: switching range shortens the list,
  // and a stale page index would otherwise render an empty table.
  const sitesPageC = Math.min(sitesPage, Math.max(0, Math.ceil(sites.length / PAGE_SIZE) - 1));

  return (
    <>
      {/* One context row for the whole section. Each tab used to carry its
          own time control in its own shape — a dropdown inside the chart
          card, a day stepper inside the timeline, a chip row inside the
          sites card — so the same question was asked three different ways,
          and the apps list answered none of them: its minutes were a 7-day
          total that read like today's. Device and period now live here, in
          one place, and every panel below inherits them. */}
      <div className="activity-context">
        <div className="activity-tabs">
          <button className={`tab ${tab === "screen" ? "active" : ""}`} onClick={() => setTab("screen")}>
            <iconify-icon icon="solar:clock-circle-linear"></iconify-icon>
            <span>Ekran vaqti</span>
          </button>
          <button className={`tab ${tab === "history" ? "active" : ""}`} onClick={() => { setHistoryOffset(0); setTab("history"); }}>
            <iconify-icon icon="solar:list-linear"></iconify-icon>
            <span>Faoliyat tarixi</span>
          </button>
          <button className={`tab ${tab === "sites" ? "active" : ""}`} onClick={() => setTab("sites")}>
            <iconify-icon icon="solar:global-linear"></iconify-icon>
            <span>Web-saytlar</span>
          </button>
        </div>

        <div className="activity-context-right">
          <DeviceSelector devices={childDevices} selectedId={activeDeviceId ?? ""} />
          {/* The history tab is a single day, the others are a range. Same
              slot, so the control never moves — only what it asks changes. */}
          {tab === "history" ? (
            <div className="day-nav" role="group" aria-label="Kun tanlash">
              <button
                className="btn-view"
                onClick={() => { setHistoryOffset(0); setHistoryDate((d) => shiftISO(d, -1)); }}
                aria-label="Oldingi kun"
              >‹</button>
              <span className="day-nav-label">{humanDay(historyDate)}</span>
              <button
                className="btn-view"
                disabled={historyDate >= todayISO()}
                onClick={() => { setHistoryOffset(0); setHistoryDate((d) => shiftISO(d, 1)); }}
                aria-label="Keyingi kun"
              >›</button>
            </div>
          ) : (
            <div className="range-switch" role="group" aria-label="Davr tanlash">
              {(["week", "month"] as SummaryRange[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`range-chip ${range === r ? "active" : ""}`}
                  aria-pressed={range === r}
                  onClick={() => setRange(r)}
                >
                  {RANGE_LABELS[r]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <section key={tab} className="tab-content active tab-transition" data-tab-panel={tab}>
        {allDevices ? (
          // Deliberately not an aggregate: two devices used in the same hour
          // would double-count, so we ask rather than invent a total.
          <div className="card device-pick-prompt">
            <strong>Qaysi qurilmani ko&apos;rmoqchisiz?</strong>
            <p>
              Bu farzandda {childDevices.length} ta qurilma bor. Faoliyat ma&apos;lumoti har bir
              qurilma uchun alohida yuritiladi — yuqoridan birini tanlang.
            </p>
          </div>
        ) : !activeDeviceId ? (
          <div className="card" style={{ marginBottom: 24, background: "var(--brand-blue)", color: "#fff", border: "none" }}>
            <div style={{ padding: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
              <div>
                <h2 style={{ fontSize: 20, marginBottom: 8, color: "#fff" }}>Ma'lumotlar yo'q</h2>
                <p style={{ opacity: 0.9, fontSize: 14, margin: 0 }}>Farzandingiz qurilmasidagi faoliyatni kuzatish uchun uni tizimga biriktiring.</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {tab === "history" && (
              <>
              <div className="card" style={{ marginBottom: 16 }}>
                {timelineLoading ? (
                  <p style={{ color: "var(--muted)", padding: "20px 0" }}>Yuklanmoqda...</p>
                ) : (
                  <DayTimeline
                    segments={timeline}
                    isToday={historyDate === todayISO()}
                    dateISO={historyDate}
                    dateTitle={humanDay(historyDate)}
                    dateSubtitle={uzWeekdayDayMonth(new Date(historyDate + "T00:00:00"))}
                  />
                )}
              </div>

              <div className="card">
                <div className="card-header">
                  <h3>Faoliyat tarixi</h3>
                  <span className="muted-sm">{historyCount} ta event</span>
                </div>
                {historyLoading && <p className="muted">Faoliyat yuklanmoqda...</p>}
                {historyError && <p className="error-text">Faoliyatni yuklab bo‘lmadi. Qayta urinib ko‘ring.</p>}
                {!historyLoading && !historyError && history.length === 0 && <p className="muted">Hali faoliyat mavjud emas.</p>}
                {!historyLoading && !historyError && history.length > 0 && (
                  <div className="stack">
                    {history.map((item) => (
                      <div key={item.id} className="data-row">
                        <time className="data-row-time">{formatActivityTime(item.started_at || item.created_at)}</time>
                        <AppIcon appId={item.app_id} appName={item.app_name} icon={item.icon} size={30} />
                        <span style={{ flex: 1, fontWeight: 700, color: "var(--foreground)" }}>{appDisplay(item.app_id, item.app_name).label}</span>
                        <span className="muted-sm">{item.duration_seconds == null ? "—" : formatMinutes(Math.round(item.duration_seconds / 60))}</span>
                      </div>
                    ))}
                  </div>
                )}
                {!historyLoading && !historyError && historyCount > PAGE_SIZE && (
                  <div className="pager">
                    <button className="btn-view" disabled={historyOffset === 0} onClick={() => setHistoryOffset(Math.max(0, historyOffset - PAGE_SIZE))}>← Oldingi</button>
                    <span className="muted-sm">{Math.floor(historyOffset / PAGE_SIZE) + 1} / {Math.ceil(historyCount / PAGE_SIZE)}</span>
                    <button className="btn-view" disabled={historyNextOffset === null} onClick={() => historyNextOffset !== null && setHistoryOffset(historyNextOffset)}>Keyingi →</button>
                  </div>
                )}
              </div>
              </>
            )}

            {tab === "screen" && summaryLoading && (
              <div className="card loading-state" aria-live="polite">
                <div className="skeleton skeleton-title"></div>
                <div className="skeleton skeleton-block"></div>
                <p>Ma’lumotlar yuklanmoqda...</p>
              </div>
            )}
            {tab === "screen" && !summaryLoading && summaryError && (
              <div className="card loading-state" role="alert">
                <p>Ma’lumotlarni yuklab bo‘lmadi.</p>
                <button className="btn-view" onClick={() => setSummaryRetry((value) => value + 1)}>Qayta urinib ko‘ring</button>
              </div>
            )}
            {tab === "screen" && !summaryLoading && !summaryError && summary && (() => {
              const days = summary.breakdown;
              const activeDay = selectedDay && days.some((d) => d.date === selectedDay) ? selectedDay : days[days.length - 1]?.date ?? "";
              const dayMin = days.find((d) => d.date === activeDay)?.total_minutes ?? 0;
              const limit = getDailyLimitMinutes(rules);
              const avg = days.length ? Math.round(days.reduce((s, d) => s + d.total_minutes, 0) / days.length) : 0;
              const limitPct = limit ? Math.round((dayMin / limit) * 100) : null;
              const remaining = limit != null ? limit - dayMin : null;
              const dayLabel = activeDay === todayISO() ? "Bugungi" : activeDay === shiftISO(todayISO(), -1) ? "Kechagi" : uzDayMonth(new Date(activeDay + "T00:00:00"));

              const limitCard = (tone: string, icon: string, label: string, value: string, pct: number | null, barGradient: string) => (
                <div className="stat-card stat-card-limit">
                  <div className={`icon ${tone}`}><iconify-icon icon={icon}></iconify-icon></div>
                  <div className="stat-card-limit-body">
                    <small>{label}</small>
                    <h2>{value}</h2>
                    {pct !== null && (
                      <>
                        <small>{pct}% {label === "Kunlik limit" ? "ishlatilgan" : "limit ishlatilgan"}</small>
                        <div className="progress" style={{ width: "100%" }}>
                          <div style={{ width: `${Math.min(100, pct)}%`, background: pct >= 100 ? "#dc2626" : barGradient }} />
                        </div>
                        <small>{remaining != null && remaining >= 0 ? `${formatMinutes(remaining)} qoldi` : `${formatMinutes(Math.abs(remaining ?? 0))} oshib ketdi`}</small>
                      </>
                    )}
                  </div>
                </div>
              );

              return (
                <div className="screen-layout">
                  <div className="card chart-card">
                    <div className="card-header">
                      <h3>{range === "month" ? "30 kunlik" : "7 kunlik"} ekran vaqti</h3>
                    </div>
                    <ScreenTimeChart data={days} selected={activeDay} onSelect={setSelectedDay} />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {limitCard("green", "solar:clock-circle-linear", `${dayLabel} ekran vaqti`, formatMinutes(dayMin), limitPct, "linear-gradient(90deg,#4ade80,#16a34a)")}
                    {limitCard("purple", "solar:shield-check-linear", "Kunlik limit", limit ? formatMinutes(limit) : "Belgilanmagan", limitPct, "linear-gradient(90deg,#a78bfa,#7c3aed)")}
                    <div className="stat-card stat-card-limit">
                      <div className="icon orange"><iconify-icon icon="solar:graph-up-linear"></iconify-icon></div>
                      <div className="stat-card-limit-body">
                        <small>{days.length} kunlik o&apos;rtacha</small>
                        <h2>{formatMinutes(avg)}</h2>
                        <small>Oxirgi {days.length} kun bo&apos;yicha</small>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {tab === "screen" && !summaryLoading && !summaryError && summary && (
              <div className="card" style={{ marginTop: 16 }}>
                <div className="card-header">
                  <h3>Ilovalar bo'yicha foydalanish</h3>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="muted-sm">{RANGE_LABELS[range]} · {sortedApps.length} ta</span>
                    {sortedApps.length > 1 && (
                      <select
                        value={appSort}
                        onChange={(e) => { setAppSort(e.target.value as typeof appSort); setAppsPage(0); }}
                        className="btn-view"
                        style={{ fontSize: 12 }}
                      >
                        <option value="minutes">Vaqt bo&apos;yicha</option>
                        <option value="name">Nomi bo&apos;yicha</option>
                        <option value="recent">Oxirgi ishlatilgan</option>
                      </select>
                    )}
                    {sortedApps.length > 0 && (
                      <button
                        className="btn-view"
                        onClick={() => exportAppsCsv(sortedApps, RANGE_LABELS[range])}
                        style={{ fontSize: 12 }}
                      >
                        ↓ CSV
                      </button>
                    )}
                  </span>
                </div>
                <div className="stack">
                  {sortedApps.slice(appsPageC * PAGE_SIZE, appsPageC * PAGE_SIZE + PAGE_SIZE).map((app) => {
                    const d = appDisplay(app.app);
                    return (
                    // Left inline on purpose. This row carries the legacy
                    // .activity-item rules, whose `img` and `span` selectors
                    // (0,1,1) outrank the .data-row-* classes (0,1,0) and
                    // would silently shrink the app name to 13px. The shared
                    // classes are only safe where .activity-item is absent.
                    <div
                      className="activity-item"
                      key={app.app}
                      style={{ padding: "12px 0", borderBottom: "1px solid rgba(37,99,235,.08)" }}
                    >
                       <AppIcon appId={app.app} icon={app.icon} size={34} />
                       <span style={{ flex: 1, minWidth: 0 }}>
                         <span style={{ display: "block", fontWeight: 700, fontSize: 14, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
                         <span style={{ fontSize: 12, color: d.color }}>{d.categoryLabel}</span>
                       </span>
                       <em style={{ color: "var(--muted)", fontStyle: "normal", fontSize: 13, fontWeight: 600 }}>{formatMinutes(app.minutes)}</em>
                    </div>
                    );
                  })}
                  {sortedApps.length === 0 && <p className="muted-sm" style={{ margin: "10px 0" }}>Bu davrda ma'lumot yo'q</p>}
                </div>
                {sortedApps.length > PAGE_SIZE && (
                  <div className="pager">
                    <button className="btn-view" disabled={appsPageC === 0} onClick={() => setAppsPage(appsPageC - 1)}>← Oldingi</button>
                    <span className="muted-sm">{appsPageC + 1} / {Math.ceil(sortedApps.length / PAGE_SIZE)}</span>
                    <button className="btn-view" disabled={(appsPageC + 1) * PAGE_SIZE >= sortedApps.length} onClick={() => setAppsPage(appsPageC + 1)}>Keyingi →</button>
                  </div>
                )}
              </div>
            )}

            {tab === "sites" && (
              <>
                {sitesLoading && (
                  <div className="site-grid-summary">
                    {[0, 1, 2].map((i) => <div key={i} className="card site-summary skel" />)}
                  </div>
                )}

                {sitesError && (
                  <div className="card site-empty">
                    <iconify-icon icon="solar:cloud-cross-linear"></iconify-icon>
                    <p>Faoliyat ma&apos;lumotlarini yuklab bo&apos;lmadi.</p>
                    <button className="btn-view" onClick={() => setSummaryRetry((n) => n + 1)}>Qayta urinish</button>
                  </div>
                )}

                {!sitesLoading && !sitesError && rawSites.length === 0 && (
                  <div className="card site-empty">
                    <iconify-icon icon="solar:global-linear"></iconify-icon>
                    <p>Bu davrda web-faoliyat topilmadi.</p>
                  </div>
                )}

                {!sitesLoading && !sitesError && rawSites.length > 0 && (
                  <>
                    {/* ---- summary cards (all real data) ---- */}
                    <div className="site-grid-summary">
                      <div className="card site-summary reveal-up">
                        <span className="site-summary-ico blue"><iconify-icon icon="solar:global-linear"></iconify-icon></span>
                        <div>
                          <span className="site-summary-k">Umumiy web-faoliyat</span>
                          <strong className="site-summary-v">{formatMinutes(sitesTotalMinutes)}</strong>
                          <span className="site-summary-sub">{RANGE_LABELS[range]} · {rawSites.length} ta sayt</span>
                        </div>
                      </div>
                      <div className="card site-summary reveal-up" style={{ animationDelay: "60ms" }}>
                        <span className="site-summary-ico violet"><iconify-icon icon="solar:cursor-linear"></iconify-icon></span>
                        <div>
                          <span className="site-summary-k">Tashriflar soni</span>
                          <strong className="site-summary-v">{totalVisits}</strong>
                          <span className="site-summary-sub">{RANGE_LABELS[range]} bo&apos;yicha</span>
                        </div>
                      </div>
                      {topSite && (
                        <div className="card site-summary reveal-up" style={{ animationDelay: "120ms" }}>
                          <span className="site-summary-ico amber"><iconify-icon icon="solar:cup-star-linear"></iconify-icon></span>
                          <div style={{ minWidth: 0 }}>
                            <span className="site-summary-k">Eng ko&apos;p tashrif</span>
                            <strong className="site-summary-v trunc" title={topSite.domain}>{topSite.domain}</strong>
                            <span className="site-summary-sub">
                              {formatMinutes(topSite.minutes)}
                              {sitesTotalMinutes > 0 && ` · ${Math.round((topSite.minutes / sitesTotalMinutes) * 100)}% ulush`}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ---- browser breakdown (full width) ---- */}
                    {byBrowser.length > 0 && (
                      <div className="card reveal-up" style={{ marginTop: 16 }}>
                        <div className="card-header">
                          <h3>Brauzerlar bo&apos;yicha</h3>
                          <span className="muted-sm">{RANGE_LABELS[range]} · {totalVisits} tashrif</span>
                        </div>
                        <div className="browser-bar">
                          {byBrowser.map((b) => (
                            <span key={b.browser} className="browser-seg" title={`${browserMeta(b.browser).label}: ${b.visits}`}
                              style={{ flex: b.visits, background: browserMeta(b.browser).color }} />
                          ))}
                        </div>
                        <div className="browser-legend">
                          {byBrowser.map((b) => {
                            const m = browserMeta(b.browser);
                            const pct = totalVisits ? Math.round((b.visits / totalVisits) * 100) : 0;
                            return (
                              <span key={b.browser} className="browser-legend-item">
                                <iconify-icon icon={m.icon} style={{ fontSize: 18, color: m.color }}></iconify-icon>
                                <b>{m.label}</b>
                                <span className="muted-sm">{b.visits} · {pct}%</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ---- main list + recent visits ---- */}
                    <div className="site-grid-main">
                      <div className="card reveal-up">
                        <div className="card-header">
                          <h3>Web-saytlar</h3>
                          <span style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <span className="muted-sm">{RANGE_LABELS[range]} · {sites.length} ta</span>
                            {sites.length > 1 && (
                              <select value={siteSort} onChange={(e) => { setSiteSort(e.target.value as typeof siteSort); setSitesPage(0); }} className="btn-view" style={{ fontSize: 12 }}>
                                <option value="recent">Vaqt bo&apos;yicha</option>
                                <option value="visits">Tashriflar soni bo&apos;yicha</option>
                                <option value="domain">Nomi bo&apos;yicha</option>
                              </select>
                            )}
                            <button className="btn-view" onClick={() => exportSitesCsv(sites, RANGE_LABELS[range])} style={{ fontSize: 12 }}>↓ CSV</button>
                          </span>
                        </div>

                        <div className="site-list">
                          {sites.slice(sitesPageC * PAGE_SIZE, sitesPageC * PAGE_SIZE + PAGE_SIZE).map((site, idx) => {
                            const rank = sitesPageC * PAGE_SIZE + idx + 1;
                            const si = siteIconFor(site.domain);
                            const barW = Math.max(4, ((site.minutes || site.visits) / siteBarMax) * 100);
                            const share = sitesTotalMinutes > 0 ? Math.round((site.minutes / sitesTotalMinutes) * 100) : 0;
                            return (
                              <div key={site.domain} className="site-row reveal-up" style={{ animationDelay: `${Math.min(idx, 8) * 35}ms` }}>
                                <span className="site-rank">{String(rank).padStart(2, "0")}</span>
                                <span className={`site-ico${si.mono ? " mono" : ""}`}>
                                  <iconify-icon icon={si.icon}></iconify-icon>
                                </span>
                                <span className="site-row-body">
                                  <span className="site-row-domain trunc" title={site.domain}>{site.domain}</span>
                                  <span className="site-row-meta">
                                    <span>{site.visits} marta · {formatMinutes(site.minutes)}</span>
                                    {(site.browsers ?? []).slice(0, 3).map((b) => {
                                      const m = browserMeta(b.browser);
                                      return (
                                        <iconify-icon key={b.browser} icon={m.icon} title={`${m.label}: ${b.visits}`}
                                          style={{ fontSize: 13, color: m.color }}></iconify-icon>
                                      );
                                    })}
                                  </span>
                                  <span className="site-row-bar">
                                    <span style={{ width: `${barW}%` }} />
                                  </span>
                                </span>
                                <span className="site-row-share">{share ? `${share}%` : "—"}</span>
                              </div>
                            );
                          })}
                        </div>

                        {sites.length > PAGE_SIZE && (
                          <div className="pager">
                            <button className="btn-view" disabled={sitesPageC === 0} onClick={() => setSitesPage(sitesPageC - 1)}>← Oldingi</button>
                            <span className="muted-sm">{sitesPageC + 1} / {Math.ceil(sites.length / PAGE_SIZE)}</span>
                            <button className="btn-view" disabled={(sitesPageC + 1) * PAGE_SIZE >= sites.length} onClick={() => setSitesPage(sitesPageC + 1)}>Keyingi →</button>
                          </div>
                        )}
                      </div>

                      {recentSites.length > 0 && (
                        <div className="card reveal-up" style={{ animationDelay: "80ms" }}>
                          <div className="card-header">
                            <h3>So&apos;nggi tashriflar</h3>
                          </div>
                          <div className="recent-list">
                            {recentSites.map((s) => {
                              const si = siteIconFor(s.domain);
                              return (
                                <div key={s.domain} className="recent-row">
                                  <span className={`site-ico sm${si.mono ? " mono" : ""}`}>
                                    <iconify-icon icon={si.icon}></iconify-icon>
                                  </span>
                                  <span className="recent-domain trunc" title={s.domain}>{s.domain}</span>
                                  <span className="recent-ago muted-sm">{timeAgo(s.last_visited_at)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </section>
    </>
  );
}

export default function ActivityPage() {
  return (
    <Suspense fallback={null}>
      <ActivityContent />
    </Suspense>
  );
}
