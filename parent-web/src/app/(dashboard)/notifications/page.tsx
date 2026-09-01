"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { AlertPref, getNotificationPrefs, updateNotificationPrefs } from "@/api/notifications";
import { useApiQuery } from "@/hooks/useApiQuery";

const muted: React.CSSProperties = { color: "var(--muted)", fontSize: 14 };

export default function NotificationsPage() {
  const query = useApiQuery(() => getNotificationPrefs(), []);
  const [local, setLocal] = useState<AlertPref[] | null>(null);
  const [saving, setSaving] = useState(false);

  const prefs = query.data;
  const alerts = local ?? prefs?.alerts ?? [];

  useEffect(() => {
    if (query.error) toast.error(query.error.message);
  }, [query.error]);

  async function toggle(alertType: string, on: boolean) {
    if (saving) return;
    const next = alerts.map((a) => (a.alert_type === alertType ? { ...a, via_telegram: on } : a));
    setLocal(next);
    setSaving(true);
    try {
      const updated = await updateNotificationPrefs(
        next.map((a) => ({ alert_type: a.alert_type, via_telegram: a.via_telegram })),
      );
      setLocal(updated.alerts);
    } catch (cause) {
      setLocal(alerts); // revert
      toast.error(cause instanceof Error ? cause.message : "Saqlanmadi");
    } finally {
      setSaving(false);
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
        ) : prefs?.telegram.linked ? (
          <p style={muted}>
            Ulangan{prefs.telegram.username ? `: @${prefs.telegram.username}` : ""}. Bildirishnomalar
            shu hisobga keladi.
          </p>
        ) : (
          <p style={muted}>
            Telegram ulanmagan. Bildirishnomalarni olish uchun hisobingizni Telegram orqali kiring
            yoki keyingi versiyada shu yerdan ulang.
          </p>
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
                  disabled={saving || !prefs?.telegram.linked}
                  onChange={(e) => toggle(a.alert_type, e.target.checked)}
                />
                <span />
              </label>
            </div>
          ))
        )}

        {!query.isInitialLoad && !prefs?.telegram.linked && (
          <p style={{ ...muted, fontSize: 12, marginTop: 12 }}>
            Telegram ulangach bu sozlamalar ishlaydi.
          </p>
        )}
      </div>
    </>
  );
}
