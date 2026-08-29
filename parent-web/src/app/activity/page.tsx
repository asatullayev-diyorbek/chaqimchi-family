"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { getAccessToken } from "@/api/client";
import { ActivityHistoryItem, Device, DeviceSummary, SummaryRange, TimelineSegment, getActivityHistory, getActivityTimeline, getDevices, getSummary } from "@/api/tracking";
import { toast } from "react-hot-toast";
import AppIcon from "@/components/AppIcon";
import DayTimeline from "@/components/DayTimeline";
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

function formatActivityTime(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("uz-UZ", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function ActivityContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deviceId = searchParams.get("device");
  const childId = searchParams.get("child");

  const [devices, setDevices] = useState<Device[] | null>(null);
  const [range, setRange] = useState<SummaryRange>("week");
  const [summary, setSummary] = useState<DeviceSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(false);
  const [summaryRetry, setSummaryRetry] = useState(0);
  const [rules, setRules] = useState<Rule[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [tab, setTab] = useState<"screen" | "apps" | "history" | "sites">("screen");
  const [history, setHistory] = useState<ActivityHistoryItem[]>([]);
  const [historyCount, setHistoryCount] = useState(0);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyNextOffset, setHistoryNextOffset] = useState<number | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [historyDate, setHistoryDate] = useState(todayISO);
  const [timeline, setTimeline] = useState<TimelineSegment[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    getDevices()
      .then(setDevices)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Xatolik"));
  }, [router]);

  const activeDeviceId = deviceId ?? devices?.find((d) => d.child_id === childId && d.status === "linked")?.id ?? devices?.find((d) => d.status === "linked")?.id ?? null;

  const onSummaryTab = tab === "screen" || tab === "apps";
  useEffect(() => {
    if (!activeDeviceId || !onSummaryTab) return;
    let cancelled = false;
    const start = setTimeout(() => {
      if (cancelled) return;
      setSummaryLoading(true);
      setSummaryError(false);
    }, 0);
    (async () => {
      try {
        const data = await getSummary(activeDeviceId, { range });
        if (!cancelled) setSummary(data);
      } catch (err) {
        if (cancelled) return;
        setSummaryError(true);
        toast.error(
          err instanceof Error
            ? err.message
          : "Ma'lumotlar yangilanmadi, birozdan keyin qayta urinib ko'ring"
        );
      } finally {
        // Cancel the pending skeleton flip: a cached/fast response resolves on
        // the microtask queue before this 0ms macrotask fires, and without
        // this the timer would set loading back to true with nothing left to
        // clear it — the "stuck on yuklanmoqda" bug when switching tabs.
        clearTimeout(start);
        if (!cancelled) setSummaryLoading(false);
      }
    })();
    return () => { cancelled = true; clearTimeout(start); };
  }, [activeDeviceId, range, onSummaryTab, summaryRetry]);

  // The device's daily limit, for the screen-time cards' progress bars.
  useEffect(() => {
    if (!activeDeviceId || tab !== "screen") return;
    let cancelled = false;
    getRules(activeDeviceId).then((r) => { if (!cancelled) setRules(r); }).catch(() => {});
    return () => { cancelled = true; };
  }, [activeDeviceId, tab, summaryRetry]);

  useEffect(() => {
    if (!activeDeviceId || tab !== "history") return;
    let cancelled = false;
    const start = setTimeout(() => {
      if (cancelled) return;
      setHistoryLoading(true);
      setHistoryError(false);
    }, 0);
    getActivityHistory(activeDeviceId, { date: historyDate, limit: 50, offset: historyOffset })
      .then((data) => {
        if (cancelled) return;
        setHistory(data.results);
        setHistoryCount(data.count);
        setHistoryNextOffset(data.next_offset);
      })
      .catch(() => {
        if (!cancelled) setHistoryError(true);
      })
      .finally(() => {
        clearTimeout(start);
        if (!cancelled) setHistoryLoading(false);
      });
    return () => { cancelled = true; clearTimeout(start); };
  }, [activeDeviceId, historyOffset, historyDate, tab]);

  useEffect(() => {
    if (!activeDeviceId || tab !== "history") return;
    let cancelled = false;
    const start = setTimeout(() => { if (!cancelled) setTimelineLoading(true); }, 0);
    getActivityTimeline(activeDeviceId, { date: historyDate })
      .then((data) => { if (!cancelled) setTimeline(data.segments); })
      .catch(() => { if (!cancelled) setTimeline([]); })
      .finally(() => { clearTimeout(start); if (!cancelled) setTimelineLoading(false); });
    return () => { cancelled = true; clearTimeout(start); };
  }, [activeDeviceId, historyDate, tab]);

  const sortedApps = summary ? [...summary.top_apps].sort((a, b) => b.minutes - a.minutes) : [];

  return (
    <AppShell>
      {/* Header */}



      {/* Tabs */}
      <div className="tabs-bar">
      <div className="activity-tabs">
        <button className={`tab ${tab === "screen" ? "active" : ""}`} onClick={() => setTab("screen")}>
          <iconify-icon icon="solar:clock-circle-linear"></iconify-icon>
          <span>Ekran vaqti</span>
        </button>
        <button className={`tab ${tab === "apps" ? "active" : ""}`} onClick={() => setTab("apps")}>
          <iconify-icon icon="solar:widget-2-linear"></iconify-icon>
          <span>Ilovalar</span>
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
      </div>

      <section className="tab-content active" data-tab-panel="screen">
        {!activeDeviceId ? (
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
              <div className="card" style={{ padding: 20, marginBottom: 16 }}>
                {timelineLoading ? (
                  <p style={{ color: "var(--muted)", padding: "20px 0" }}>Yuklanmoqda...</p>
                ) : (
                  <DayTimeline
                    segments={timeline}
                    isToday={historyDate === todayISO()}
                    dateISO={historyDate}
                    dateTitle={humanDay(historyDate)}
                    dateSubtitle={new Intl.DateTimeFormat("uz-UZ", { day: "numeric", month: "long", weekday: "long" }).format(new Date(historyDate + "T00:00:00"))}
                    nav={
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <button className="btn-view" style={{ padding: "4px 9px" }} onClick={() => { setHistoryOffset(0); setHistoryDate((d) => shiftISO(d, -1)); }} aria-label="Oldingi kun">‹</button>
                        <span style={{ minWidth: 88, textAlign: "center", fontWeight: 700, fontSize: 13 }}>{humanDay(historyDate)}</span>
                        <button className="btn-view" style={{ padding: "4px 9px" }} disabled={historyDate >= todayISO()} onClick={() => { setHistoryOffset(0); setHistoryDate((d) => shiftISO(d, 1)); }} aria-label="Keyingi kun">›</button>
                      </div>
                    }
                  />
                )}
              </div>

              <div className="card" style={{ padding: 20 }}>
                <div className="card-header" style={{ marginBottom: 14 }}>
                  <h3>Faoliyat tarixi</h3>
                  <span style={{ color: "var(--muted)", fontSize: 13 }}>{historyCount} ta event</span>
                </div>
                {historyLoading && <p style={{ color: "var(--muted)" }}>Faoliyat yuklanmoqda...</p>}
                {historyError && <p style={{ color: "var(--danger, #dc2626)" }}>Faoliyatni yuklab bo‘lmadi. Qayta urinib ko‘ring.</p>}
                {!historyLoading && !historyError && history.length === 0 && <p style={{ color: "var(--muted)" }}>Hali faoliyat mavjud emas.</p>}
                {!historyLoading && !historyError && history.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {history.map((item) => (
                      <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid rgba(37,99,235,.08)" }}>
                        <time style={{ width: 44, color: "var(--muted)", fontSize: 13 }}>{formatActivityTime(item.started_at || item.created_at)}</time>
                        <AppIcon appId={item.app_id} appName={item.app_name} icon={item.icon} size={30} />
                        <span style={{ flex: 1, fontWeight: 700, color: "var(--foreground)" }}>{appDisplay(item.app_id, item.app_name).label}</span>
                        <span style={{ color: "var(--muted)", fontSize: 13 }}>{item.duration_seconds == null ? "—" : formatMinutes(Math.round(item.duration_seconds / 60))}</span>
                      </div>
                    ))}
                  </div>
                )}
                {!historyLoading && !historyError && historyCount > 50 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
                    <button className="btn-view" disabled={historyOffset === 0} onClick={() => setHistoryOffset(Math.max(0, historyOffset - 50))}>Oldingi</button>
                    <span style={{ color: "var(--muted)", fontSize: 13 }}>{Math.floor(historyOffset / 50) + 1} / {Math.ceil(historyCount / 50)}</span>
                    <button className="btn-view" disabled={historyNextOffset === null} onClick={() => historyNextOffset !== null && setHistoryOffset(historyNextOffset)}>Keyingi</button>
                  </div>
                )}
              </div>
              </>
            )}

            {(tab === "screen" || tab === "apps") && summaryLoading && (
              <div className="card loading-state" aria-live="polite">
                <div className="skeleton skeleton-title"></div>
                <div className="skeleton skeleton-block"></div>
                <p>Ma’lumotlar yuklanmoqda...</p>
              </div>
            )}
            {(tab === "screen" || tab === "apps") && !summaryLoading && summaryError && (
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

              const dropdown = (
                <div className="dropdown-wrap" style={{ position: "relative" }}>
                  <button onClick={(e) => { const t = e.currentTarget.nextElementSibling as HTMLElement; t.style.display = t.style.display === "block" ? "none" : "block"; }}>
                    {RANGE_LABELS[range]}
                    <iconify-icon icon="solar:alt-arrow-down-linear"></iconify-icon>
                  </button>
                  <div className="profile-dropdown" style={{ display: "none", position: "absolute", right: 0, top: "100%", minWidth: 100, zIndex: 10, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 8 }}>
                    {(["week", "month"] as SummaryRange[]).map((r) => (
                      <button key={r} onClick={(e) => { setRange(r); (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }} style={{ width: "100%", textAlign: "left", padding: "6px 8px", border: 0, background: "transparent", cursor: "pointer", borderRadius: 8 }}>
                        {RANGE_LABELS[r]}
                      </button>
                    ))}
                  </div>
                </div>
              );

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
                      {dropdown}
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

            {tab === "apps" && !summaryLoading && !summaryError && summary && (
              <div className="card" style={{padding: 20}}>
                <div className="card-header" style={{marginBottom: 14}}>
                  <h3>Ilovalar bo'yicha foydalanish</h3>
                </div>
                <div style={{display: 'flex', flexDirection: 'column'}}>
                  {sortedApps.map((app) => {
                    const d = appDisplay(app.app);
                    return (
                    <div className="activity-item" key={app.app} style={{display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: '1px solid rgba(37,99,235,.08)'}}>
                       <AppIcon appId={app.app} icon={app.icon} size={34} />
                       <span style={{flex: 1, minWidth: 0}}>
                         <span style={{display: 'block', fontWeight: 700, fontSize: 14, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{d.label}</span>
                         <span style={{fontSize: 12, color: d.color}}>{d.categoryLabel}</span>
                       </span>
                       <em style={{color: 'var(--muted)', fontStyle: 'normal', fontSize: 13, fontWeight: 600}}>{formatMinutes(app.minutes)}</em>
                    </div>
                    );
                  })}
                  {sortedApps.length === 0 && <p style={{color: 'var(--muted)', fontSize: 13, margin: '10px 0'}}>Bu davrda ma'lumot yo'q</p>}
                </div>
              </div>
            )}

            {tab === "sites" && (
              <div className="card" style={{padding: 30, textAlign: 'center', color: 'var(--muted)'}}>
                Saytlar ro'yxati hali mavjud emas — agent hozircha faqat ilova
                ishlatilishini (app_usage) yuboradi, sayt darajasidagi kuzatuv
                (browser_domain) hali qo'shilmagan.
              </div>
            )}
          </>
        )}
      </section>
    </AppShell>
  );
}

export default function ActivityPage() {
  return (
    <Suspense fallback={null}>
      <ActivityContent />
    </Suspense>
  );
}
