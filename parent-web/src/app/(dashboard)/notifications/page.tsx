"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import {
  AlertPref,
  getNotificationPrefs,
  telegramLinkStart,
  telegramLinkStatus,
  telegramUnlink,
  updateNotificationPrefs,
} from "@/api/notifications";
import { useApiQuery } from "@/hooks/useApiQuery";

const muted: React.CSSProperties = { color: "var(--muted)", fontSize: 14 };
const btn: React.CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "9px 16px",
  background: "var(--accent-dark)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};
const btnGhost: React.CSSProperties = {
  ...btn,
  background: "transparent",
  color: "var(--danger)",
  border: "1px solid var(--border)",
};

export default function NotificationsPage() {
  const query = useApiQuery(() => getNotificationPrefs(), []);
  const [local, setLocal] = useState<AlertPref[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const prefs = query.data;
  const linked = prefs?.telegram.linked ?? false;
  const alerts = local ?? prefs?.alerts ?? [];

  useEffect(() => {
    if (query.error) toast.error(query.error.message);
  }, [query.error]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function toggle(alertType: string, on: boolean) {
    if (saving) return;
    const prev = alerts;
    const next = alerts.map((a) => (a.alert_type === alertType ? { ...a, via_telegram: on } : a));
    setLocal(next);
    setSaving(true);
    try {
      const updated = await updateNotificationPrefs(
        next.map((a) => ({ alert_type: a.alert_type, via_telegram: a.via_telegram })),
      );
      setLocal(updated.alerts);
    } catch (cause) {
      setLocal(prev);
      toast.error(cause instanceof Error ? cause.message : "Saqlanmadi");
    } finally {
      setSaving(false);
    }
  }

  async function connect() {
    if (linking) return;
    setLinking(true);
    try {
      const { token, bot_url } = await telegramLinkStart();
      window.open(bot_url, "_blank", "noopener");
      toast("Telegram'da tasdiqlang…");
      pollRef.current = setInterval(async () => {
        try {
          const { status } = await telegramLinkStatus(token);
          if (status === "linked") {
            clearInterval(pollRef.current!);
            setLinking(false);
            setLocal(null);
            query.refetch();
            toast.success("Telegram ulandi.");
          } else if (status === "rejected" || status === "expired") {
            clearInterval(pollRef.current!);
            setLinking(false);
            toast.error(status === "expired" ? "Havola muddati tugadi." : "Rad etildi.");
          }
        } catch {
          /* keep polling */
        }
      }, 2500);
    } catch (cause) {
      setLinking(false);
      toast.error(cause instanceof Error ? cause.message : "Boshlab bo'lmadi");
    }
  }

  async function disconnect() {
    if (!confirm("Telegram'ni uzasizmi? Bildirishnomalar to'xtaydi.")) return;
    try {
      await telegramUnlink();
      setLocal(null);
      query.refetch();
      toast.success("Telegram uzildi.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Uzib bo'lmadi");
    }
  }

  return (
    <>
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div className="card-header" style={{ marginBottom: 6 }}>
          <h3>Telegram</h3>
        </div>
        {query.isInitialLoad ? (
          <p style={muted}>Yuklanmoqda...</p>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
            <p style={{ ...muted, margin: 0 }}>
              {linked
                ? `Ulangan${prefs?.telegram.username ? `: @${prefs.telegram.username}` : ""}. Bildirishnomalar shu yerga keladi.`
                : "Telegram ulanmagan. Bildirishnomalarni Telegram orqali olish uchun ulang."}
            </p>
            {linked ? (
              <button style={btnGhost} onClick={disconnect}>Uzish</button>
            ) : (
              <button style={btn} onClick={connect} disabled={linking}>
                {linking ? "Kutilmoqda…" : "Telegram'ni ulash"}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div className="card-header" style={{ marginBottom: 14 }}>
          <div>
            <h3>Qaysi xabarlar kelsin</h3>
            <p style={{ ...muted, fontSize: 13 }}>Har bir tur uchun Telegram bildirishnomasini yoqing yoki o&apos;chiring.</p>
          </div>
        </div>

        {query.isInitialLoad ? (
          <p style={muted}>Yuklanmoqda...</p>
        ) : (
          alerts.map((a) => (
            <div
              key={a.alert_type}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 14,
                padding: "14px 4px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600 }}>{a.label}</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={a.via_telegram}
                  disabled={saving || !linked}
                  onChange={(e) => toggle(a.alert_type, e.target.checked)}
                />
                <span />
              </label>
            </div>
          ))
        )}

        {!query.isInitialLoad && !linked && (
          <p style={{ ...muted, fontSize: 12, marginTop: 12 }}>Telegram ulangach bu sozlamalar ishlaydi.</p>
        )}
      </div>
    </>
  );
}
