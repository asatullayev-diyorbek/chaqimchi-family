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
  return new Intl.DateTimeFormat("uz-UZ", { day: "numeric", month: "long" }).format(new Date(iso + "T00:00:00"));
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

const PAGE_SIZE = 10;

function formatActivityTime(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("uz-UZ", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function ActivityContent() {

  const { device, childDevices, allDevices } = useSelectedDevice();
  const [range, setRange] = useState<SummaryRange>("week");
  const [summaryRetry, setSummaryRetry] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [appsPage, setAppsPage] = useState(0);
  const [sitesPage, setSitesPage] = useState(0);
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
  const summaryLoading = summaryQuery.loading;
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
  const historyLoading = historyQuery.loading;
  const historyError = historyQuery.error !== null;

  // Sites are device-scoped like everything else: two devices browsing the
  // same site in the same hour must not be summed into one bogus total.
  const sitesQuery = useApiQuery(
    () => getSites(activeDeviceId!, { range }),
    [activeDeviceId, range],
    { enabled: Boolean(activeDeviceId) && tab === "sites" },
  );
  const sites: SiteUsage[] = sitesQuery.data?.results ?? [];
  const sitesLoading = sitesQuery.loading;
  const sitesError = sitesQuery.error !== null;

  const timelineQuery = useApiQuery(
    () => getActivityTimeline(activeDeviceId!, { date: historyDate }),
    [activeDeviceId, historyDate],
    { enabled: Boolean(activeDeviceId) && onHistoryTab },
  );
  const timeline: TimelineSegment[] = timelineQuery.data?.segments ?? [];
  const timelineLoading = timelineQuery.loading;

  useEffect(() => {
    if (summaryQuery.error) toast.error(summaryQuery.error.message);
  }, [summaryQuery.error]);

  const sortedApps = summary ? [...summary.top_apps].sort((a, b) => b.minutes - a.minutes) : [];
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

      <section className="tab-content active" data-tab-panel={tab}>
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
                    dateSubtitle={new Intl.DateTimeFormat("uz-UZ", { day: "numeric", month: "long", weekday: "long" }).format(new Date(historyDate + "T00:00:00"))}
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
              const dayLabel = activeDay === todayISO() ? "Bugungi" : activeDay === shiftISO(todayISO(), -1) ? "Kechagi" : new Intl.DateTimeFormat("uz-UZ", { day: "numeric", month: "long" }).format(new Date(activeDay + "T00:00:00"));

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
                  <span className="muted-sm">{RANGE_LABELS[range]} · {sortedApps.length} ta</span>
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
              <div className="card">
                <div className="card-header">
                  <h3>Web-saytlar</h3>
                  <span className="muted-sm">{RANGE_LABELS[range]} · {sites.length} ta</span>
                </div>

                {sitesLoading && <p className="muted">Saytlar yuklanmoqda...</p>}
                {sitesError && (
                  <p className="error-text">
                    Saytlarni yuklab bo&apos;lmadi. Qayta urinib ko&apos;ring.
                  </p>
                )}
                {!sitesLoading && !sitesError && sites.length === 0 && (
                  <p className="muted">
                    Bu davrda sayt tashrifi qayd etilmagan.
                  </p>
                )}
                {!sitesLoading && !sitesError && sites.length > 0 && (
                  <div className="stack">
                    {sites.slice(sitesPageC * PAGE_SIZE, sitesPageC * PAGE_SIZE + PAGE_SIZE).map((site) => (
                      <div
                        key={site.domain}
                        className="data-row"
                      >
                        <span className="site-badge" aria-hidden="true">
                          <iconify-icon icon="solar:global-linear"></iconify-icon>
                        </span>
                        <span className="data-row-body">
                          <span className="data-row-title">
                            {site.domain}
                          </span>
                          <span className="data-row-sub muted">{site.visits} marta</span>
                        </span>
                        <em className="data-row-value">
                          {formatMinutes(site.minutes)}
                        </em>
                      </div>
                    ))}
                  </div>
                )}
                {!sitesLoading && !sitesError && sites.length > PAGE_SIZE && (
                  <div className="pager">
                    <button className="btn-view" disabled={sitesPageC === 0} onClick={() => setSitesPage(sitesPageC - 1)}>← Oldingi</button>
                    <span className="muted-sm">{sitesPageC + 1} / {Math.ceil(sites.length / PAGE_SIZE)}</span>
                    <button className="btn-view" disabled={(sitesPageC + 1) * PAGE_SIZE >= sites.length} onClick={() => setSitesPage(sitesPageC + 1)}>Keyingi →</button>
                  </div>
                )}
              </div>
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
