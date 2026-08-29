"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Device, DeviceSummary, getDevices, getSummary, unlinkDevice, updateDevice } from "@/api/tracking";
import { Child, getChildren } from "@/api/children";
import { toast } from "react-hot-toast";
import TopbarActions from "@/components/layout/TopbarActions";
import AppIcon from "@/components/AppIcon";
import ConfirmDialog from "@/components/ConfirmDialog";
import { appDisplay } from "@/lib/appDisplay";

function formatTime(value: string | null) {
  if (!value) return "Noma'lum";
  return new Intl.DateTimeFormat("uz-UZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours && !mins) return `${hours} soat`;
  return hours ? `${hours} soat ${mins} min` : `${mins} min`;
}

function DeviceDetailContent() {
  const router = useRouter();
  const params = useParams();
  const deviceId = params.id as string;

  const [device, setDevice] = useState<Device | null>(null);
  const [child, setChild] = useState<Child | null>(null);
  const [summary, setSummary] = useState<DeviceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editOwnerId, setEditOwnerId] = useState("");
  const [children, setChildren] = useState<Child[]>([]);
  const [saving, setSaving] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  async function load() {
    const [devices, childList] = await Promise.all([getDevices(), getChildren()]);
    setChildren(childList);
    const currentDevice = devices.find((d) => d.id === deviceId);
    if (!currentDevice) {
      toast.error("Qurilma topilmadi");
      router.replace("/devices");
      return;
    }
    // Unlinked rows stay in the API so their activity history survives, but
    // the devices page only lists the active Guard. Redirect an old
    // bookmarked detail URL to the current one (or back to the list).
    if (currentDevice.status !== "linked") {
      const replacement = devices.find((d) => d.status === "linked" && d.child_id === currentDevice.child_id);
      router.replace(replacement ? `/devices/${replacement.id}` : "/devices");
      return;
    }
    setDevice(currentDevice);
    setEditName(currentDevice.child_name || "");
    setEditOwnerId(currentDevice.child_id || "");
    setChild(childList.find((c) => c.id === currentDevice.child_id) || null);
    setSummary(await getSummary(currentDevice.id).catch(() => null));
    setLoading(false);
  }

  useEffect(() => {
    // No setTimeout(fn, 0) wrapper: load() only sets state after an await, so
    // nothing runs synchronously in this effect. The wrapper existed purely to
    // dodge the lint rule, and it is what stranded a "yuklanmoqda" spinner
    // elsewhere when a cached response beat the timer.
    let active = true;
    (async () => {
      try {
        await load();
      } catch {
        if (!active) return;
        toast.error("Ma'lumotlarni yuklashda xatolik");
        setLoading(false);
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, router]);

  async function handleSaveEdit() {
    if (!device) return;
    setSaving(true);
    try {
      const updated = await updateDevice(device.id, {
        child_name: editName.trim() || undefined,
        child_id: editOwnerId || null,
      });
      setDevice(updated);
      setChild(children.find((c) => c.id === updated.child_id) || null);
      setIsEditing(false);
      toast.success("O'zgarishlar saqlandi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Saqlashda xatolik");
    } finally {
      setSaving(false);
    }
  }

  async function handleUnlink() {
    if (!device) return;
    setUnlinking(true);
    try {
      await unlinkDevice(device.id);
      toast.success("Qurilma uzildi");
      router.replace("/devices");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Qurilma uzilmadi");
      setUnlinking(false);
      setConfirmUnlink(false);
    }
  }

  if (loading) return <><p>Yuklanmoqda...</p></>;
  if (!device) return <><p>Qurilma topilmadi.</p></>;

  const isOnline = summary?.device_status === "online";
  const battery = summary?.battery_percent ?? null;

  return (
    <>
      <div className={`device-detail-card ${isEditing ? "editing" : ""}`}>
        <header className="content-header">
          <div className="header-title">
            <Link href="/devices" className="back-link">
              <iconify-icon icon="solar:alt-arrow-left-linear"></iconify-icon>
              Qurilmalarga qaytish
            </Link>
            <h1>{device.child_name || "Nomsiz qurilma"}</h1>
            <p>
              <span>{device.platform === "windows" ? "Windows PC" : device.platform}</span>
              <span className={`device-badge ${device.platform === "windows" ? "blue" : "green"}`}>
                {device.platform === "windows" ? "Asosiy qurilma" : "Mobil"}
              </span>
            </p>
          </div>
          <div className="header-right">
            {!isEditing && (
              <button className="edit-toggle-btn" onClick={() => setIsEditing(true)} title="Tahrirlash">
                <iconify-icon icon="solar:pen-linear"></iconify-icon>
                Tahrirlash
              </button>
            )}
            <TopbarActions />
          </div>
        </header>

        {isEditing && (
          <div className="card edit-mode edit-fields-card">
            <div className="edit-field">
              <label>Qurilma nomi</label>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="edit-field">
              <label>Egasi</label>
              <select value={editOwnerId} onChange={(e) => setEditOwnerId(e.target.value)}>
                <option value="">Biriktirilmagan</option>
                {children.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 10, width: "100%" }}>
              <button onClick={handleSaveEdit} disabled={saving} className="primary-btn" style={{ padding: "10px 20px", borderRadius: 8, background: "var(--brand-blue)", color: "white", border: 0, cursor: "pointer" }}>
                {saving ? "Saqlanmoqda..." : "Saqlash"}
              </button>
              <button onClick={() => { setIsEditing(false); setEditName(device.child_name || ""); setEditOwnerId(device.child_id || ""); }} className="btn-view" style={{ padding: "10px 20px", borderRadius: 8, background: "transparent", border: "1px solid var(--border)", color: "var(--foreground)", cursor: "pointer" }}>
                Bekor qilish
              </button>
            </div>
          </div>
        )}

        <section className="stats-grid device-detail-stats">
          <div className="stat-card">
            <div className="icon" style={{ color: isOnline ? "var(--green)" : "var(--muted)", background: isOnline ? "var(--green-bg)" : "var(--border)" }}>
              <iconify-icon icon={isOnline ? "solar:verified-check-linear" : "solar:close-circle-linear"}></iconify-icon>
            </div>
            <div>
              <span>Holati</span>
              <h2>{isOnline ? "Onlayn" : "Oflayn"}</h2>
              <small>{device.last_sync ? `Oxirgi aloqa: ${formatTime(device.last_sync)}` : "Sinxronlanmagan"}</small>
            </div>
          </div>

          {battery !== null && (
            <div className="stat-card">
              <div className={`icon ${battery <= 20 ? "red" : "orange"}`}>
                <iconify-icon icon={battery > 66 ? "solar:battery-full-linear" : battery > 33 ? "solar:battery-half-linear" : "solar:battery-low-linear"}></iconify-icon>
              </div>
              <div>
                <span>Batareya</span>
                <h2>{battery}%</h2>
                <small>{summary?.battery_updated_at ? formatTime(summary.battery_updated_at) : "Guard hisobotidan"}</small>
              </div>
            </div>
          )}

          <div className="stat-card">
            <div className="icon green">
              <iconify-icon icon="solar:clock-circle-linear"></iconify-icon>
            </div>
            <div>
              <span>Bugungi ekran vaqti</span>
              <h2>{formatMinutes(summary?.total_screen_minutes || 0)}</h2>
              <small>{summary?.top_apps.length || 0} ta ilova</small>
            </div>
          </div>
        </section>

        <div className="modal-tab-panel active">
          <div className="card">
            <h3>Qurilma ma'lumotlari</h3>
            <div className="info-grid">
              <div className="info-item">
                <span>Operatsion tizim</span>
                <strong>{device.platform === "windows" ? "Windows" : device.platform}</strong>
              </div>
              <div className="info-item">
                <span>Egasi</span>
                <strong>{child?.name || "Biriktirilmagan"}</strong>
              </div>
              <div className="info-item">
                <span>Qurilma turi</span>
                <strong>{device.platform === "windows" ? "Noutbuk / Kompyuter" : "Mobil telefon"}</strong>
              </div>
              <div className="info-item">
                <span>Ro'yxatdan o'tgan</span>
                <strong>{formatTime(device.linked_at || device.created_at)}</strong>
              </div>
              <div className="info-item">
                <span>Oxirgi sinxronizatsiya</span>
                <strong>{device.last_sync ? formatTime(device.last_sync) : "Hali yo'q"}</strong>
              </div>
              <div className="info-item">
                <span>Kuzatiladi</span>
                <strong>Ilova nomlari, ekran vaqti, qurilma holati</strong>
              </div>
              <div className="info-item">
                <span>Guard versiyasi</span>
                <strong>{summary?.agent_version || "Noma'lum"}</strong>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Bugungi eng ko'p ishlatilgan ilovalar</h3>
            {summary && summary.top_apps.length > 0 ? (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
                {summary.top_apps.slice(0, 6).map((app) => (
                  <li key={app.app} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                    <AppIcon appId={app.app} icon={app.icon} size={28} />
                    <span style={{ flex: 1, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{appDisplay(app.app).label}</span>
                    <span style={{ color: "var(--muted)" }}>{formatMinutes(app.minutes)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: "var(--muted)", fontSize: 13 }}>Bugun hali faoliyat qayd etilmagan.</p>
            )}
            <Link href={`/activity?device=${device.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 14, color: "var(--brand-blue)", fontWeight: 600, textDecoration: "none" }}>
              <iconify-icon icon="solar:chart-square-linear"></iconify-icon>
              To'liq hisobot
            </Link>
          </div>

          <div className="card">
            <h3>Qoidalar</h3>
            <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 14px" }}>
              Ekran vaqti limiti va bloklangan ilovalar shu qurilma uchun “Qoidalar” bo'limida sozlanadi.
            </p>
            <Link href={`/rules?device=${device.id}`} className="primary-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
              <iconify-icon icon="solar:shield-keyhole-linear"></iconify-icon>
              Qoidalarni sozlash
            </Link>
          </div>

          <div className="card device-detail-footer">
            <button className="danger-btn" onClick={() => setConfirmUnlink(true)} disabled={unlinking}>
              <iconify-icon icon="solar:link-broken-linear"></iconify-icon>
              {unlinking ? "Uzilmoqda..." : "Qurilmani uzish"}
            </button>
            <Link href={`/activity?device=${device.id}`} className="primary-btn" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "none" }}>
              <iconify-icon icon="solar:chart-square-linear"></iconify-icon>
              Hisobotni ko'rish
            </Link>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmUnlink}
        title="Qurilmani uzish"
        message="Guard xizmati o'chadi, ammo faoliyat tarixi saqlanadi. Qayta ulash uchun installerdan yangi kod kerak bo'ladi."
        confirmLabel="Uzish"
        danger
        busy={unlinking}
        onConfirm={handleUnlink}
        onCancel={() => setConfirmUnlink(false)}
      />
    </>
  );
}

export default function DeviceDetailPage() {
  return (
    <Suspense fallback={<><p>Yuklanmoqda...</p></>}>
      <DeviceDetailContent />
    </Suspense>
  );
}
