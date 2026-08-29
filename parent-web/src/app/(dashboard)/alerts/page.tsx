"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, getAlerts, markAlertSeen } from "@/api/alerts";
import { getDevices } from "@/api/tracking";
import { toast } from "react-hot-toast";

const PAGE_SIZE = 10;

function describeAlert(alert: Alert) {
  if (alert.alert_type === "blocked_app_opened") {
    const app = typeof alert.payload.app === "string" ? alert.payload.app : "Ilova";
    return `${app} ochilishi cheklandi`;
  }
  return "Bugungi ekran vaqti limiti to'ldi";
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("uz-UZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function AlertsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedDeviceId = searchParams.get("device");
  const requestedChildId = searchParams.get("child");
  const [deviceId, setDeviceId] = useState("");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [page, setPage] = useState(0);
  const loadAlerts = useCallback(async (selectedDeviceId: string) => {
    setLoading(true);
    try {
      setAlerts(await getAlerts(selectedDeviceId));
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Ma'lumotlar yangilanmadi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getDevices()
      .then((list) => {
        const selected = list.find((device) => device.id === requestedDeviceId) ?? list.find((device) => device.child_id === requestedChildId && device.status === "linked") ?? list.find((device) => device.status === "linked") ?? list[0];
        if (selected) {
          setDeviceId(selected.id);
          void loadAlerts(selected.id);
        } else {
          setLoading(false);
        }
      })
      .catch((cause) => {
        toast.error(cause instanceof Error ? cause.message : "Qurilmalar yuklanmadi");
        setLoading(false);
      });
  }, [loadAlerts, requestedDeviceId, requestedChildId, router]);

  async function markAllSeen() {
    const unseen = alerts.filter((alert) => !alert.seen);
    if (!unseen.length || marking) return;
    setMarking(true);
    try {
      await Promise.all(unseen.map((alert) => markAlertSeen(alert.id)));
      setAlerts((current) => current.map((alert) => ({ ...alert, seen: true })));
      toast.success(`${unseen.length} ta ogohlantirish ko'rilgan deb belgilandi.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Alertlar yangilanmadi");
    } finally {
      setMarking(false);
    }
  }

  // Clamp so deleting/filtering can't strand the view on an empty page.
  const pageCount = Math.max(1, Math.ceil(alerts.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = alerts.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  return (
    <>
      <div className="card" style={{ padding: 20 }}>
        <div className="card-header" style={{ marginBottom: 14 }}>
          <div>
            <h3>Ogohlantirishlar</h3>
            {alerts.length > 0 && (
              <p style={{ ...mutedStyle, fontSize: 13 }}>
                {alerts.length} ta · {alerts.filter((alert) => !alert.seen).length} ta yangi
              </p>
            )}
          </div>
          <button onClick={markAllSeen} disabled={marking || !alerts.some((alert) => !alert.seen)} style={buttonStyle}>
            {marking ? "Belgilanmoqda..." : "Barchasini ko'rilgan deb belgilash"}
          </button>
        </div>

        {loading ? <p style={mutedStyle}>Yuklanmoqda...</p> : null}
        {!loading && !deviceId ? <p style={mutedStyle}>Hali bog&apos;langan qurilma yo&apos;q.</p> : null}
        {!loading && deviceId && alerts.length === 0 ? <EmptyAlerts /> : null}
        {!loading && visible.map((alert) => <AlertRow alert={alert} key={alert.id} />)}

        {!loading && alerts.length > PAGE_SIZE && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
            <button className="btn-view" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>← Oldingi</button>
            <span style={{ ...mutedStyle, fontSize: 13 }}>{currentPage + 1} / {pageCount}</span>
            <button className="btn-view" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>Keyingi →</button>
          </div>
        )}
      </div>
    </>
  );
}

export default function AlertsPage() {
  return <Suspense fallback={<><p style={mutedStyle}>Yuklanmoqda...</p></>}><AlertsContent /></Suspense>;
}

function AlertRow({ alert }: { alert: Alert }) {
  const restricted = alert.alert_type === "blocked_app_opened";
  return <article style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 4px", borderBottom: "1px solid var(--border)", opacity: alert.seen ? .62 : 1 }}>
    <span style={{ ...iconStyle, background: restricted ? "var(--cat-blue-bg)" : "var(--cat-amber-bg)", color: restricted ? "var(--brand-blue)" : "var(--warning)" }}>
      <iconify-icon icon={restricted ? "solar:forbidden-circle-linear" : "solar:danger-triangle-linear"} style={{ fontSize: 20 }}></iconify-icon>
    </span>
    <div style={{ flex: 1, minWidth: 0 }}><strong style={{ fontSize: 14 }}>{describeAlert(alert)}</strong><p style={{ marginTop: 4, color: "var(--muted)", fontSize: 12 }}>{formatTime(alert.triggered_at)}</p></div>
    <span style={{ fontSize: 11, fontWeight: 700, color: alert.seen ? "var(--muted)" : "var(--warning)" }}>{alert.seen ? "Ko'rilgan" : "Yangi"}</span>
  </article>;
}

function EmptyAlerts() {
  return <div style={{ padding: "44px 16px", textAlign: "center" }}>
    <div style={{ ...iconStyle, margin: "0 auto 14px", background: "var(--cat-teal-bg)", color: "var(--accent)" }}>
      <iconify-icon icon="solar:shield-check-linear" style={{ fontSize: 20 }}></iconify-icon>
    </div>
    <strong>Hozircha ogohlantirish yo&apos;q</strong>
    <p style={{ ...mutedStyle, marginTop: 7 }}>Hammasi xotirjam davom etmoqda.</p>
  </div>;
}

const buttonStyle: React.CSSProperties = { border: "none", borderRadius: 12, padding: "11px 14px", background: "var(--accent-dark)", color: "#fff", fontWeight: 700, cursor: "pointer" };
const mutedStyle: React.CSSProperties = { color: "var(--muted)", fontSize: 14 };
const iconStyle: React.CSSProperties = { width: 38, height: 38, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: 13, fontWeight: 800, fontSize: 18 };
