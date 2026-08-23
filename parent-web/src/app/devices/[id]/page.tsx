"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { getAccessToken } from "@/api/client";
import { Device, DeviceSummary, getDevices, getSummary } from "@/api/tracking";
import { Child, getChildren } from "@/api/children";
import { toast } from "react-hot-toast";
import TopbarActions from "@/components/layout/TopbarActions";

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
  
  const [activeTab, setActiveTab] = useState<"general" | "settings">("general");
  const [isEditing, setIsEditing] = useState(false);
  
  // Edit state
  const [editName, setEditName] = useState("");
  const [editOwnerId, setEditOwnerId] = useState("");
  const [children, setChildren] = useState<Child[]>([]);
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    
    Promise.all([getDevices(), getChildren()])
      .then(async ([devices, childList]) => {
        setChildren(childList);
        const currentDevice = devices.find(d => d.id === deviceId);
        if (!currentDevice) {
          toast.error("Qurilma topilmadi");
          router.replace("/devices");
          return;
        }
        // Unlinked rows remain in the API so their activity history is not
        // destroyed, but the devices page only exposes the current active
        // Guard. Keep an old bookmarked detail URL aligned with that list.
        if (currentDevice.status !== "linked") {
          const activeReplacement = devices.find(
            d => d.status === "linked" && d.child_id === currentDevice.child_id,
          );
          if (activeReplacement) {
            router.replace(`/devices/${activeReplacement.id}`);
          } else {
            router.replace("/devices");
          }
          return;
        }
        setDevice(currentDevice);
        setEditName(currentDevice.child_name || "");
        setEditOwnerId(currentDevice.child_id || "");
        
        const currentChild = childList.find(c => c.id === currentDevice.child_id);
        if (currentChild) setChild(currentChild);
        
        try {
          const summaryData = await getSummary(currentDevice.id).catch(() => null);
          setSummary(summaryData);
        } catch {
          console.error("Failed to load summary");
        }
        
        setLoading(false);
      })
      .catch(() => {
        toast.error("Ma'lumotlarni yuklashda xatolik");
        setLoading(false);
      });
  }, [deviceId, router]);

  const handleSaveEdit = async () => {
    if (!device) return;
    setSaving(true);
    try {
      // In a real app we would call an API to rename or reassign device here
      toast.success("O'zgarishlar saqlandi");
      setDevice({ ...device, child_name: editName, child_id: editOwnerId });
      setChild(children.find(c => c.id === editOwnerId) || null);
      setIsEditing(false);
    } catch {
      toast.error("Saqlashda xatolik");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AppShell><p>Yuklanmoqda...</p></AppShell>;
  if (!device) return <AppShell><p>Qurilma topilmadi.</p></AppShell>;

  const isOnline = device.status === "linked" && summary?.device_status === "online";

  return (
    <AppShell>
      <div className={`device-detail-card ${isEditing ? 'editing' : ''}`}>
        
        <header className="content-header">
            <div className="header-title">
                <Link href="/devices" className="back-link">
                    <iconify-icon icon="solar:alt-arrow-left-linear"></iconify-icon>
                    Qurilmalarga qaytish
                </Link>
                <h1>{device.child_name || "Nomsiz qurilma"}</h1>
                <p>
                    <span>{device.platform === 'windows' ? 'Windows PC' : device.platform}</span>
                    <span className={`device-badge ${device.platform === 'windows' ? 'blue' : 'green'}`}>{device.platform === 'windows' ? 'Asosiy qurilma' : 'Mobil'}</span>
                </p>
            </div>
            
            <div className="header-right">
                <button className="edit-toggle-btn" onClick={() => setIsEditing(true)} title="Tahrirlash">
                    <iconify-icon icon="solar:pen-linear"></iconify-icon>
                    Tahrirlash
                </button>
                <TopbarActions />
            </div>
        </header>

        <div className="card edit-mode edit-fields-card">
            <div className="edit-field">
                <label>Qurilma nomi</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="edit-field">
                <label>Egasi</label>
                <select value={editOwnerId} onChange={e => setEditOwnerId(e.target.value)}>
                    <option value="">Biriktirilmagan</option>
                    {children.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </div>
            
            <div style={{ display: 'flex', gap: 10, marginTop: 10, width: '100%' }}>
                <button onClick={handleSaveEdit} disabled={saving} className="primary-btn" style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--brand-blue)', color: 'white', border: 0, cursor: 'pointer' }}>
                  {saving ? "Saqlanmoqda..." : "Saqlash"}
                </button>
                <button onClick={() => setIsEditing(false)} className="btn-view" style={{ padding: '10px 20px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--foreground)', cursor: 'pointer' }}>
                  Bekor qilish
                </button>
            </div>
        </div>

        <section className="stats-grid device-detail-stats">
            <div className="stat-card">
                <div className={`icon ${isOnline ? '' : 'slate'}`} style={{ color: isOnline ? 'var(--green)' : 'var(--muted)', background: isOnline ? 'var(--green-bg)' : 'var(--border)' }}>
                    <iconify-icon icon={isOnline ? "solar:verified-check-linear" : "solar:close-circle-linear"}></iconify-icon>
                </div>
                <div>
                    <span>Holati</span>
                    <h2>{isOnline ? "Onlayn" : "Oflayn"}</h2>
                    <small>{device.last_sync ? formatTime(device.last_sync) : "Sinxronlanmagan"}</small>
                </div>
            </div>

            <div className="stat-card">
                <div className="icon orange">
                    <iconify-icon icon="solar:battery-half-linear"></iconify-icon>
                </div>
                <div>
                  <span>Batareya</span>
                  <h2>Ma'lumot yo'q</h2>
                  <small>Guard telemetrysi kutilmoqda</small>
                </div>
            </div>

            <div className="stat-card">
                <div className="icon purple">
                    <iconify-icon icon="solar:server-linear"></iconify-icon>
                </div>
                <div>
                  <span>Saqlash</span>
                  <h2>Ma'lumot yo'q</h2>
                  <small>Guard telemetrysi kutilmoqda</small>
                </div>
            </div>
        </section>

        <div className="activity-tabs">
            <button className={`tab ${activeTab === 'general' ? 'active' : ''}`} onClick={() => setActiveTab('general')}>
                <iconify-icon icon="solar:document-text-linear"></iconify-icon>
                <span>Umumiy</span>
            </button>
            <button className={`tab ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
                <iconify-icon icon="solar:settings-minimalistic-linear"></iconify-icon>
                <span>Sozlamalar</span>
            </button>
        </div>

        {activeTab === 'general' && (
          <div className="modal-tab-panel active">
              <div className="card">
                  <h3>Qurilma ma'lumotlari</h3>
                  <div className="info-grid">
                      <div className="info-item">
                          <span>Operatsion tizim</span>
                          <strong>{device.platform}</strong>
                      </div>
                      <div className="info-item">
                          <span>Egasi</span>
                          <strong>{child?.name || "Yo'q"}</strong>
                      </div>
                      <div className="info-item">
                          <span>Qurilma turi</span>
                          <strong>{device.platform === 'windows' ? 'Noutbuk / Kompyuter' : 'Mobil telefon'}</strong>
                      </div>
                      <div className="info-item">
                          <span>Model</span>
                          <strong>Noma'lum</strong>
                      </div>
                      <div className="info-item">
                          <span>IP manzil</span>
                          <strong>Noma'lum</strong>
                      </div>
                      <div className="info-item">
                          <span>MAC manzil</span>
                          <strong>Noma'lum</strong>
                      </div>
                      <div className="info-item">
                          <span>Ro'yxatdan o'tgan</span>
                          <strong>{formatTime(device.linked_at || device.created_at)}</strong>
                      </div>
                      <div className="info-item">
                          <span>Versiya</span>
                          <strong>Ma'lumot yo'q</strong>
                      </div>
                  </div>
              </div>

              <div className="card">
                  <div className="section-header">
                      <h3>Oxirgi sinxronizatsiya</h3>
                      <button className="sync-btn" onClick={() => toast.success("Sinxronlash boshlandi...")}>
                          <iconify-icon icon="solar:refresh-linear"></iconify-icon>
                          Qo'lda sinxronlash
                      </button>
                  </div>
                  <div className="sync-card">
                      <div className="sync-icon">
                          <iconify-icon icon="solar:check-circle-linear"></iconify-icon>
                      </div>
                      <div>
                          <h4>{device.last_sync ? formatTime(device.last_sync) : "Sinxronlanmagan"}</h4>
                          <small>Keyingi avtomatik sinxronlash: <span>10 daqiqadan so'ng</span></small>
                      </div>
                  </div>
              </div>

              <div className="card">
                  <h3>Bugungi statistika</h3>
                  <div className="mini-stats-grid">
                      <div className="mini-stat">
                          <iconify-icon icon="solar:clock-circle-linear"></iconify-icon>
                          <span>Ekran vaqti</span>
                          <h4>{formatMinutes(summary?.total_screen_minutes || 0)}</h4>
                      </div>
                      <div className="mini-stat">
                          <iconify-icon icon="solar:widget-2-linear"></iconify-icon>
                          <span>Ilovalar</span>
                          <h4>{summary?.top_apps.length || 0} ta</h4>
                      </div>
                      <div className="mini-stat">
                          <iconify-icon icon="solar:global-linear"></iconify-icon>
                          <span>Internet</span>
                          <h4>Noma'lum</h4>
                      </div>
                      <div className="mini-stat">
                          <iconify-icon icon="solar:bell-linear"></iconify-icon>
                          <span>Bildirishnoma</span>
                          <h4>Noma'lum</h4>
                      </div>
                  </div>
              </div>

              <div className="card device-detail-footer">
                  <button className="danger-btn">
                      <iconify-icon icon="solar:link-broken-linear"></iconify-icon>
                      Qurilmani uzish
                  </button>
                  <Link href={`/activity?device=${device.id}`} className="primary-btn" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none' }}>
                      <iconify-icon icon="solar:chart-square-linear"></iconify-icon>
                      Hisobotni ko'rish
                  </Link>
              </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="modal-tab-panel active">
              <div className="card">
                  <div className="settings-section">
                      <h3>Umumiy sozlamalar</h3>
                      <div className="setting-item">
                          <div className="setting-left">
                              <iconify-icon icon="solar:laptop-linear"></iconify-icon>
                              <div>
                                  <h4>Qurilma nomi</h4>
                                  <p>Qurilmaga berilgan nom</p>
                              </div>
                          </div>
                          <input type="text" value={device.child_name || ""} onChange={() => {}} style={{ background: 'var(--bg)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--foreground)' }} />
                      </div>
                      <div className="setting-item">
                          <div className="setting-left">
                              <iconify-icon icon="solar:clock-circle-linear"></iconify-icon>
                              <div>
                                  <h4>Vaqt zonasi</h4>
                                  <p>Qurilmadagi vaqt zonasi</p>
                              </div>
                          </div>
                          <select style={{ background: 'var(--bg)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--foreground)' }}>
                              <option>(UTC+05:00) Toshkent</option>
                          </select>
                      </div>
                      <div className="setting-item">
                          <div className="setting-left">
                              <iconify-icon icon="solar:bell-linear"></iconify-icon>
                              <div>
                                  <h4>Bildirishnomalar</h4>
                                  <p>Ushbu qurilmadan bildirishnoma olish</p>
                              </div>
                          </div>
                          <label className="switch">
                              <input type="checkbox" defaultChecked />
                              <span></span>
                          </label>
                      </div>
                  </div>

                  <div className="settings-section" style={{ marginTop: 30 }}>
                      <h3>Sinxronizatsiya sozlamalari</h3>
                      <div className="setting-item">
                          <div className="setting-left">
                              <iconify-icon icon="solar:refresh-linear"></iconify-icon>
                              <div>
                                  <h4>Avtomatik sinxronlash</h4>
                                  <p>Har 15 daqiqada ma'lumotlarni yuborish</p>
                              </div>
                          </div>
                          <label className="switch">
                              <input type="checkbox" defaultChecked />
                              <span></span>
                          </label>
                      </div>
                      <div className="setting-item">
                          <div className="setting-left">
                              <iconify-icon icon="solar:wifi-linear"></iconify-icon>
                              <div>
                                  <h4>Faqat Wi-Fi orqali</h4>
                                  <p>Mobil internetni tejash uchun</p>
                              </div>
                          </div>
                          <label className="switch">
                              <input type="checkbox" />
                              <span></span>
                          </label>
                      </div>
                  </div>

                  <div className="settings-section" style={{ marginTop: 30 }}>
                      <h3>Xavfsizlik</h3>
                      <div className="setting-item">
                          <div className="setting-left">
                              <iconify-icon icon="solar:shield-check-linear"></iconify-icon>
                              <div>
                                  <h4>Xavfsiz qidiruv (Safe Search)</h4>
                                  <p>Yomon kontentni bloklash</p>
                              </div>
                          </div>
                          <label className="switch">
                              <input type="checkbox" defaultChecked />
                              <span></span>
                          </label>
                      </div>
                  </div>
              </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}

export default function DeviceDetailPage() {
  return <Suspense fallback={<AppShell><p>Yuklanmoqda...</p></AppShell>}><DeviceDetailContent /></Suspense>;
}
