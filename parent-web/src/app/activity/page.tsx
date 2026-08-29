"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { getAccessToken } from "@/api/client";
import { ActivityHistoryItem, Device, DeviceSummary, SummaryRange, getActivityHistory, getDevices, getSummary } from "@/api/tracking";
import { toast } from "react-hot-toast";

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

function shortDay(dateStr: string): string {
  const WEEKDAYS_UZ = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];
  const d = new Date(dateStr + "T00:00:00");
  return WEEKDAYS_UZ[d.getDay()];
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
  const [tab, setTab] = useState<"screen" | "apps" | "history" | "sites">("screen");
  const [history, setHistory] = useState<ActivityHistoryItem[]>([]);
  const [historyCount, setHistoryCount] = useState(0);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyNextOffset, setHistoryNextOffset] = useState<number | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(false);
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

  useEffect(() => {
    if (!activeDeviceId || tab !== "history") return;
    let cancelled = false;
    const start = setTimeout(() => {
      if (cancelled) return;
      setHistoryLoading(true);
      setHistoryError(false);
    }, 0);
    getActivityHistory(activeDeviceId, { limit: 50, offset: historyOffset })
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
  }, [activeDeviceId, historyOffset, tab]);

  const sortedApps = summary ? [...summary.top_apps].sort((a, b) => b.minutes - a.minutes) : [];

  return (
    <AppShell>
      {/* Header */}



      {/* Tabs */}
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
                      <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: "1px solid rgba(37,99,235,.08)" }}>
                        <time style={{ width: 48, color: "var(--muted)", fontSize: 13 }}>{formatActivityTime(item.started_at || item.created_at)}</time>
                        <span style={{ flex: 1, fontWeight: 700, color: "var(--foreground)" }}>{item.app_name || item.app_id || "Noma’lum ilova"}</span>
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
            {tab === "screen" && !summaryLoading && !summaryError && summary && (
              <div className="screen-layout">
                {/* Chart */}
                <div className="card chart-card">
                  <div className="card-header">
                    <h3>{range === "day" ? "Bugungi" : `${RANGE_LABELS[range]}lik`} ekran vaqti</h3>
                    <div className="dropdown-wrap" style={{position: 'relative'}}>
                      <button onClick={(e) => {
                        const target = e.currentTarget.nextElementSibling as HTMLElement;
                        target.style.display = target.style.display === 'block' ? 'none' : 'block';
                      }}>
                        {RANGE_LABELS[range]}
                        <iconify-icon icon="solar:alt-arrow-down-linear"></iconify-icon>
                      </button>
                      <div className="profile-dropdown" style={{display: 'none', position: 'absolute', right: 0, top: '100%', minWidth: 100, zIndex: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 8}}>
                        {(Object.keys(RANGE_LABELS) as SummaryRange[]).map(r => (
                          <button key={r} onClick={(e) => {
                             setRange(r);
                             const target = (e.currentTarget.parentElement as HTMLElement);
                             target.style.display = 'none';
                          }} style={{width: '100%', textAlign: 'left', padding: '6px 8px', border: 0, background: 'transparent', cursor: 'pointer', borderRadius: 8}}>
                            {RANGE_LABELS[r]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="dashboard-chart-scroll" style={{overflowX: 'auto', paddingBottom: 2}}>
                    <svg className="graph" viewBox="0 0 480 190" preserveAspectRatio="xMidYMid meet" style={{minWidth: 460}}>
                      <g stroke="rgba(37,99,235,.08)" strokeWidth="1">
                        <line x1="36" y1="10" x2="460" y2="10"/>
                        <line x1="36" y1="46" x2="460" y2="46"/>
                        <line x1="36" y1="82" x2="460" y2="82"/>
                        <line x1="36" y1="118" x2="460" y2="118"/>
                        <line x1="36" y1="154" x2="460" y2="154"/>
                      </g>
                      <g fontFamily="Inter, Segoe UI, Arial, sans-serif" fontSize="10" fill="#9aa6b6">
                        <text x="4"  y="14">5s</text>
                        <text x="4"  y="50">4s</text>
                        <text x="4"  y="86">3s</text>
                        <text x="4"  y="122">2s</text>
                        <text x="12" y="158">0</text>
                      </g>
                      <g>
                        {summary.breakdown.slice(-7).map((item, index) => {
                          const minutes = item.total_minutes;
                          const maxMins = 5 * 60;
                          const cappedMins = Math.min(minutes, maxMins);
                          const height = (cappedMins / maxMins) * (154 - 10);
                          const y = 154 - height;
                          return (
                            <rect key={item.date} x={52 + index * 63} y={y} width="28" height={Math.max(height, 2)} rx="8" fill="#60a5fa"/>
                          );
                        })}
                      </g>
                      <g fontFamily="Inter, Segoe UI, Arial, sans-serif" fontSize="11" fontWeight="600" fill="#7a8698" textAnchor="middle">
                        {summary.breakdown.slice(-7).map((item, index) => (
                          <text key={item.date} x={66 + index * 63} y="174">{shortDay(item.date)}</text>
                        ))}
                      </g>
                    </svg>
                  </div>
                </div>

                {/* Stats */}
                <div className="stats-grid activity-stats">
                  <div className="stat-card stat-card-limit stat-card-wide">
                    <div className="icon green">
                      <iconify-icon icon="solar:clock-circle-linear"></iconify-icon>
                    </div>
                    <div className="stat-card-limit-body">
                      <small>Tanlangan davr ekran vaqti</small>
                      <h2>{formatMinutes(summary.total_screen_minutes)}</h2>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="icon blue">
                      <iconify-icon icon="solar:widget-5-linear"></iconify-icon>
                    </div>
                    <div>
                      <small>Ilovalar soni</small>
                      <h2>{summary.top_apps.length} ta</h2>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === "apps" && !summaryLoading && !summaryError && summary && (
              <div className="card" style={{padding: 20}}>
                <div className="card-header" style={{marginBottom: 14}}>
                  <h3>Ilovalar bo'yicha foydalanish</h3>
                </div>
                <div style={{display: 'flex', flexDirection: 'column'}}>
                  {sortedApps.map((app) => (
                    <div className="activity-item" key={app.app} style={{display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: '1px solid rgba(37,99,235,.08)'}}>
                       <span className="app-icon" style={{display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 10, background: 'var(--cat-blue-bg)', color: 'var(--cat-blue)'}}>
                         <iconify-icon icon="solar:smartphone-linear" style={{fontSize: 18}}></iconify-icon>
                       </span>
                       <span style={{flex: 1, fontWeight: 700, fontSize: 14, color: 'var(--foreground)'}}>{app.app}</span>
                       <em style={{color: 'var(--muted)', fontStyle: 'normal', fontSize: 13, fontWeight: 600}}>{formatMinutes(app.minutes)}</em>
                    </div>
                  ))}
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
