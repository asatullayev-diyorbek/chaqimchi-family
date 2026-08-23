"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { Alert, getAlerts, markAlertSeen } from "@/api/alerts";
import { getAccessToken } from "@/api/client";
import { getDevices } from "@/api/tracking";
import { toast } from "react-hot-toast";

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
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
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
    try {
      await Promise.all(unseen.map((alert) => markAlertSeen(alert.id)));
      setAlerts((current) => current.map((alert) => ({ ...alert, seen: true })));
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Alertlar yangilanmadi");
    }
  }

  return (
    <AppShell>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <button onClick={markAllSeen} disabled={!alerts.some((alert) => !alert.seen)} style={buttonStyle}>
          Barchasini ko&apos;rilgan deb belgilash
        </button>
      </div>

      <section className="glass" style={{ marginTop: 20, padding: 20 }}>
        {loading ? <p style={mutedStyle}>Yuklanmoqda...</p> : null}
        {!loading && !deviceId ? <p style={mutedStyle}>Hali bog&apos;langan qurilma yo&apos;q.</p> : null}
        {!loading && deviceId && alerts.length === 0 ? <EmptyAlerts /> : null}
        {!loading && alerts.map((alert) => <AlertRow alert={alert} key={alert.id} />)}
      </section>
    </AppShell>
  );
}

export default function AlertsPage() {
  return <Suspense fallback={<AppShell><p style={mutedStyle}>Yuklanmoqda...</p></AppShell>}><AlertsContent /></Suspense>;
}

function AlertRow({ alert }: { alert: Alert }) {
  const restricted = alert.alert_type === "blocked_app_opened";
  return <article style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 4px", borderBottom: "1px solid var(--border)", opacity: alert.seen ? .62 : 1 }}>
    <span style={{ ...iconStyle, background: restricted ? "var(--cat-blue-bg)" : "var(--cat-amber-bg)", color: restricted ? "var(--brand-blue)" : "#b96820" }}>{restricted ? "◌" : "!"}</span>
    <div style={{ flex: 1, minWidth: 0 }}><strong style={{ fontSize: 14 }}>{describeAlert(alert)}</strong><p style={{ marginTop: 4, color: "var(--muted)", fontSize: 12 }}>{formatTime(alert.triggered_at)}</p></div>
    <span style={{ fontSize: 11, fontWeight: 700, color: alert.seen ? "var(--muted)" : "var(--warning)" }}>{alert.seen ? "Ko'rilgan" : "Yangi"}</span>
  </article>;
}

function EmptyAlerts() {
  return <div style={{ padding: "44px 16px", textAlign: "center" }}><div style={{ ...iconStyle, margin: "0 auto 14px", background: "var(--cat-teal-bg)", color: "var(--accent)" }}>✓</div><strong>Hozircha ogohlantirish yo&apos;q</strong><p style={{ ...mutedStyle, marginTop: 7 }}>Hammasi xotirjam davom etmoqda.</p></div>;
}

const buttonStyle: React.CSSProperties = { border: "none", borderRadius: 12, padding: "11px 14px", background: "var(--accent-dark)", color: "#fff", fontWeight: 700, cursor: "pointer" };
const mutedStyle: React.CSSProperties = { color: "var(--muted)", fontSize: 14 };
const iconStyle: React.CSSProperties = { width: 38, height: 38, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: 13, fontWeight: 800, fontSize: 18 };
