"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { API_BASE_URL, getAccessToken, mediaUrl } from "@/api/client";
import {
  Device,
  DeviceSummary,
  getDevices,
  getSummary,
  verifyEnrollCode,
} from "@/api/tracking";
import { Child, deleteChild, getChildren, updateChild } from "@/api/children";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { toast } from "react-hot-toast";

function formatLastSync(iso: string | null): string {
  if (!iso) return "Hech qachon";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Hozirgina";
  if (mins < 60) return `${mins} daqiqa oldin`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} soat oldin`;
  return `${Math.floor(hours / 24)} kun oldin`;
}

function DeviceIcon({ platform }: { platform: string }) {
  if (platform === "windows") return <iconify-icon icon="solar:laptop-linear"></iconify-icon>;
  return <iconify-icon icon="solar:smartphone-linear"></iconify-icon>;
}

function OsIcon({ platform }: { platform: string }) {
  if (platform === "windows") return <iconify-icon icon="logos:microsoft-windows-icon"></iconify-icon>;
  return <iconify-icon icon="logos:android-icon"></iconify-icon>;
}

export default function DevicesPage() {
  const router = useRouter();
  const [childFilterId, setChildFilterId] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [summaries, setSummaries] = useState<Record<string, DeviceSummary | null>>({});
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkStep, setLinkStep] = useState(1);
  const [linkedDeviceName, setLinkedDeviceName] = useState("");
  const [enrollmentCode, setEnrollmentCode] = useState("");
  const [linking, setLinking] = useState(false);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");

  const [profileChild, setProfileChild] = useState<Child | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileBirth, setProfileBirth] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<File>();
  const [removeProfilePhoto, setRemoveProfilePhoto] = useState(false);
  const [profileGender, setProfileGender] = useState<"boy" | "girl">("boy");
  const [confirmRemove, setConfirmRemove] = useState<Child | null>(null);
  const [removing, setRemoving] = useState(false);

  const linkedDevices = devices?.filter((device) => device.status === "linked");
  const visibleDevices = childFilterId ? linkedDevices?.filter((device) => device.child_id === childFilterId) : linkedDevices;
  const totalScreenMinutes = Object.values(summaries).reduce((sum, s) => sum + (s?.total_screen_minutes ?? 0), 0);
  const onlineCount = Object.values(summaries).filter((s) => s?.device_status === "online").length;

  async function load() {
    try {
      const [deviceList, childList] = await Promise.all([getDevices(), getChildren()]);
      setDevices(deviceList);
      setChildren(childList);
      const summaryEntries = await Promise.all(
        deviceList
          .filter((device) => device.status === "linked")
          .map(async (device) => [device.id, await getSummary(device.id).catch(() => null)] as const),
      );
      setSummaries(Object.fromEntries(summaryEntries));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ma'lumotlar yangilanmadi");
    }
  }

  useEffect(() => {
    const childFromUrl = new URLSearchParams(window.location.search).get("child");
    setTimeout(() => {
      setChildFilterId(childFromUrl);
      if (childFromUrl) setSelectedChildId(childFromUrl);
    }, 0);
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    setTimeout(() => void load(), 0);
  }, [router]);

  function openLinkModal() {
    setShowLinkForm(true);
    setLinkStep(1);
    setEnrollmentCode("");
    setSelectedChildId("");
    }

  async function onLinkDevice() {
    const code = enrollmentCode.replace(/\D/g, "");
    if (code.length !== 6) {
      toast.error("Installer ko'rsatgan 6 xonali kodni kiriting.");
      return;
    }
    setLinking(true);
    try {
      if (!selectedChildId) { toast.error("Avval farzandni tanlang yoki yangi farzand qo'shing."); return; }

      const linked = await verifyEnrollCode(code, selectedChildId);
      await load();

      setLinkedDeviceName(`Windows Guard · ${linked.device_id.slice(0, 8)}`);
      setLinkStep(3);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Qurilma bog'lanmadi");
    } finally {
      setLinking(false);
    }
  }

  async function removeChild() {
    const child = confirmRemove;
    if (!child) return;
    setRemoving(true);
    try {
      await deleteChild(child.id);
      await load();
      setConfirmRemove(null);
      setProfileChild(null);
      toast.success(`${child.name} o'chirildi.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Farzand o'chirilmadi");
    } finally {
      setRemoving(false);
    }
  }

  async function saveProfile() {
    if (!profileChild || !profileName.trim()) return;

    try {
      let finalPhoto = profilePhoto;
      const remove_photo = removeProfilePhoto;

      const isDefaultPhoto = !profileChild.photo_url || profileChild.photo_url.includes("child-boy") || profileChild.photo_url.includes("child-girl");

      if (!finalPhoto && !remove_photo && isDefaultPhoto) {
        const currentGender = profileChild.photo_url?.includes("girl") ? "girl" : "boy";
        if (currentGender !== profileGender) {
          const res = await fetch(`/assets/child-${profileGender}.png`);
          const blob = await res.blob();
          finalPhoto = new File([blob], `child-${profileGender}.png`, { type: "image/png" });
        }
      }

      await updateChild(profileChild.id, {
        name: profileName.trim(),
        birth_date: profileBirth || undefined,
        ...(finalPhoto ? { photo: finalPhoto } : remove_photo ? { photo: null } : {})
      });
      setProfileChild(null);
      await load();
      toast.success("Farzand profili yangilandi!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Profil yangilanmadi");
    }
  }

  function age(date: string | null) {
    if (!date) return "";
    const d = new Date(date); const now = new Date();
    let value = now.getFullYear() - d.getFullYear();
    if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) value--;
    return `${value} yosh`;
  }

  return (
    <AppShell>
      {/* Header */}


      {/* Stats */}
      <section className="stats-grid device-stats">
        <div className="stat-card">
          <div className="icon green">
            <iconify-icon icon="solar:clock-circle-linear"></iconify-icon>
          </div>
          <div>
            <span>Bugungi umumiy ekran vaqti</span>
            <h2>{Math.floor(totalScreenMinutes / 60) ? `${Math.floor(totalScreenMinutes / 60)} soat ` : ""}{totalScreenMinutes % 60} min</h2>
            <small>Barcha qurilmalar</small>
          </div>
        </div>
        <div className="stat-card">
          <div className="icon purple">
            <iconify-icon icon="solar:graph-up-linear"></iconify-icon>
          </div>
          <div>
            <span>Bog'langan qurilmalar</span>
            <h2>{linkedDevices?.length || 0} ta</h2>
            <small>{onlineCount} ta onlayn</small>
          </div>
        </div>

        <button type="button" className="add-device-card" onClick={openLinkModal}>
          <span className="add-device-icon">
            <iconify-icon icon="solar:add-circle-linear"></iconify-icon>
          </span>
          <div>
            <h4>Qurilma qo'shish</h4>
            <p>Yangi qurilmani ulang</p>
          </div>
        </button>
      </section>


      {/* Link Form */}
      <Modal
        open={showLinkForm}
        onClose={() => setShowLinkForm(false)}
        title="Qurilmani bog'lash"
        subtitle={linkStep === 1 ? "1-qadam: Farzandni tanlang" : linkStep === 2 ? "2-qadam: Kodni kiriting" : "3-qadam: Tayyor"}
        footer={
          <>
            {linkStep === 1 && (
              <button className="add-device-btn primary" disabled={!selectedChildId} onClick={() => setLinkStep(2)} style={{width: '100%'}}>
                Davom etish
              </button>
            )}
            {linkStep === 2 && (
              <>
                <button className="add-device-btn outline" onClick={() => setLinkStep(1)}>
                  <iconify-icon icon="solar:alt-arrow-left-linear"></iconify-icon> Orqaga
                </button>
                <button className="add-device-btn primary" disabled={enrollmentCode.length !== 6 || linking} onClick={onLinkDevice}>
                  {linking ? "Bog'lanmoqda..." : "Bog'lash"}
                </button>
              </>
            )}
            {linkStep === 3 && (
              <button className="add-device-btn primary" onClick={() => setShowLinkForm(false)} style={{width: '100%'}}>
                <iconify-icon icon="solar:check-circle-linear"></iconify-icon> Tayyor
              </button>
            )}
          </>
        }
      >
        <>
            <div className="step-indicator">
              <div className={`step-dot ${linkStep >= 1 ? 'active' : ''}`}><span>1</span></div>
              <div className="step-line"></div>
              <div className={`step-dot ${linkStep >= 2 ? 'active' : ''}`}><span>2</span></div>
              <div className="step-line"></div>
              <div className={`step-dot ${linkStep >= 3 ? 'active' : ''}`}><span>3</span></div>
            </div>

            <div className="add-device-body">
              {linkStep === 1 && (
                <div className="add-device-step active">
                  <p className="step-intro">Bu qurilma qaysi farzandingizga tegishli?</p>
                  <div className="child-pick-list">
                    {children.map(child => (
                      <button
                        key={child.id}
                        type="button"
                        className={`child-pick-item ${selectedChildId === child.id ? 'active' : ''}`}
                        onClick={() => setSelectedChildId(child.id)}
                      >
                        {child.photo_url ? <img src={mediaUrl(child.photo_url)} alt="" loading="lazy" decoding="async" style={{objectFit: 'cover'}} /> : <img src="/assets/child-boy.png" alt="" loading="lazy" decoding="async" />}
                        <span>{child.name}</span>
                        <iconify-icon icon="solar:check-circle-bold" className="check"></iconify-icon>
                      </button>
                    ))}
                    {children.length === 0 && (
                      <p style={{textAlign: 'center', width: '100%', color: 'var(--muted)', fontSize: 14}}>
                        Hali farzand qo'shilmagan. Yuqoridagi yuzichadan farzand qo'shing.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {linkStep === 2 && (
                <div className="add-device-step active">
                  <p className="step-intro">
                    Farzandingiz kompyuterida ChaqimchiAI dasturini o'rnating. Ekranda chiqqan 6 xonali kodni shu yerga kiriting.
                  </p>
                  <div className="qr-placeholder">
                    <iconify-icon icon="solar:laptop-linear"></iconify-icon>
                  </div>
                  <div style={{ position: 'relative', marginTop: 20 }}>
                    <div className="code-input-row" style={{ marginTop: 0 }}>
                      {[0, 1, 2, 3, 4, 5].map(i => (
                        <div
                          key={i}
                          className="code-digit"
                          style={{
                            display: 'grid',
                            placeItems: 'center',
                            borderColor: enrollmentCode.length === i ? 'var(--brand-blue)' : undefined,
                            boxShadow: enrollmentCode.length === i ? '0 0 0 3px rgba(37,99,235,.15)' : undefined
                          }}
                        >
                          {enrollmentCode[i] || ""}
                        </div>
                      ))}
                    </div>
                    <input
                      autoFocus
                      value={enrollmentCode}
                      onChange={(e) => setEnrollmentCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      inputMode="numeric"
                      style={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                        opacity: 0, cursor: 'text'
                      }}
                    />
                  </div>
                  <p className="code-hint">Kod 10 daqiqa amal qiladi</p>
                  <div style={{marginTop: 12, textAlign: 'center'}}>
                    <a href={`${API_BASE_URL}/releases/`} target="_blank" rel="noreferrer" style={{color: 'var(--brand-blue)', fontSize: 13, fontWeight: 600, textDecoration: 'none'}}>
                      Windows installer yuklab olish →
                    </a>
                  </div>
                </div>
              )}

              {linkStep === 3 && (
                <div className="add-device-step active">
                  <div className="success-panel">
                    <div className="success-icon">
                      <iconify-icon icon="solar:check-circle-bold"></iconify-icon>
                    </div>
                    <h3>Muvaffaqiyatli ulandi!</h3>
                    <p>Qurilma <strong>{children.find(c => c.id === selectedChildId)?.name}</strong>ning hisobiga bog'landi. Endi uning faoliyatini kuzatishingiz mumkin.</p>
                    <div className="detected-device-card">
                      <span className="device-icon">
                        <iconify-icon icon="solar:laptop-linear"></iconify-icon>
                      </span>
                      <div>
                        <h4>{linkedDeviceName}</h4>
                        <span>Aktiv</span>
                      </div>
                      <span className="detected-battery">
                        <iconify-icon icon="solar:battery-low-linear"></iconify-icon>
                        Ma'lumot yo'q
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
        </>
      </Modal>

      {/* Children list - Quick manage */}
      {children.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div>
              <h3>Farzandlar</h3>
              <p>Profilingizga biriktirilgan farzandlar va ularning qurilmalari.</p>
            </div>
          </div>
          <div style={{ padding: "0 24px 24px 24px", display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {children.map(child => (
              <div key={child.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, background: 'var(--bg-gradient)', border: '1px solid var(--border)', borderRadius: 16 }}>
                <span className="child-avatar" style={{ flexShrink: 0, width: 48, height: 48 }}>
                  {child.photo_url ? <img src={mediaUrl(child.photo_url)} alt="" loading="lazy" decoding="async" style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : <img src="/assets/child-boy.png" alt="" loading="lazy" decoding="async" style={{width: '100%', height: '100%', objectFit: 'cover'}} />}
                </span>
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontSize: 16, margin: '0 0 4px', color: 'var(--foreground)' }}>{child.name}</h4>
                  <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>{linkedDevices?.filter((device) => device.child_id === child.id).length || 0} ta qurilma</span>
                </div>
                <button
                  onClick={() => { setProfileChild(child); setProfileName(child.name); setProfileBirth(child.birth_date || ""); setProfilePhoto(undefined); setProfileGender(child.photo_url?.includes("girl") ? "girl" : "boy"); setRemoveProfilePhoto(false); }}
                  className="btn-view"
                  style={{ width: 40, height: 40, padding: 0, display: 'grid', placeItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '50%', color: 'var(--muted)', flexShrink: 0 }}
                >
                  <iconify-icon icon="solar:pen-linear" style={{ fontSize: 18 }}></iconify-icon>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Profile Modal */}
      <Modal
        open={profileChild !== null}
        onClose={() => setProfileChild(null)}
        title="Farzand profili"
        subtitle="Ma'lumotlarni tahrirlash"
        maxWidth={400}
        footer={
          <>
            <button className="add-device-btn secondary" onClick={() => setConfirmRemove(profileChild)} style={{flex: 1, color: 'var(--danger)'}}>O&apos;chirish</button>
            <button className="add-device-btn primary" onClick={saveProfile} style={{flex: 2}}>Saqlash</button>
          </>
        }
      >
        {profileChild && (
            <div className="add-device-body">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24, marginTop: 10 }}>
                <div style={{ width: 86, height: 86, position: 'relative' }}>
                          <img loading="lazy" decoding="async" src={
                    profilePhoto ? URL.createObjectURL(profilePhoto) :
                    removeProfilePhoto ? `/assets/child-${profileGender}.png` :
                    ((!profileChild.photo_url || profileChild.photo_url.includes("child-boy") || profileChild.photo_url.includes("child-girl"))
                      ? `/assets/child-${profileGender}.png` : mediaUrl(profileChild.photo_url))
                  } alt="" style={{width: 86, height: 86, borderRadius: '43px', objectFit: 'cover', border: '2px solid var(--accent)'}}/>

                  <label htmlFor="edit-avatar-upload" style={{ position: 'absolute', right: -4, bottom: 0, width: 32, height: 32, background: 'var(--cat-blue)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '3px solid var(--surface)', color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', transition: '0.2s' }} title="Rasmni o'zgartirish">
                    <iconify-icon icon="solar:camera-add-bold" style={{ fontSize: 16 }}></iconify-icon>
                  </label>
                </div>
                <input id="edit-avatar-upload" type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => {setProfilePhoto(e.target.files?.[0]); setRemoveProfilePhoto(false);}} />
              </div>
              <div className="edit-field" style={{marginBottom: 14}}>
                <label>Ismi</label>
                <input value={profileName} onChange={e => setProfileName(e.target.value)} />
              </div>
              <div className="edit-field" style={{marginBottom: 14}}>
                <label>Tug'ilgan sana {age(profileBirth)}</label>
                <input type="date" value={profileBirth} onChange={e => setProfileBirth(e.target.value)} />
              </div>
              <div className="edit-field" style={{ marginTop: 16, marginBottom: 14 }}>
                <label style={{ marginBottom: 10, display: "block" }}>Jinsi</label>
                <div className="child-pick-list">
                  <button type="button" className={`child-pick-item ${profileGender === "boy" ? "selected" : ""}`} onClick={() => setProfileGender("boy")}>
                    <div style={{ background: profileGender === "boy" ? "var(--cat-blue-bg)" : "var(--border)", width: 44, height: 44, borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8, transition: "0.2s" }}>
                      <iconify-icon icon="ph:gender-male-bold" style={{ fontSize: 24, color: profileGender === "boy" ? "var(--cat-blue)" : "var(--muted)", transition: "0.2s" }}></iconify-icon>
                    </div>
                    <span>O'g'il</span>
                    {profileGender === "boy" && <iconify-icon icon="solar:check-circle-bold" className="check"></iconify-icon>}
                  </button>
                  <button type="button" className={`child-pick-item ${profileGender === "girl" ? "selected" : ""}`} onClick={() => setProfileGender("girl")}>
                    <div style={{ background: profileGender === "girl" ? "var(--cat-purple-bg)" : "var(--border)", width: 44, height: 44, borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8, transition: "0.2s" }}>
                      <iconify-icon icon="ph:gender-female-bold" style={{ fontSize: 24, color: profileGender === "girl" ? "var(--cat-purple)" : "var(--muted)", transition: "0.2s" }}></iconify-icon>
                    </div>
                    <span>Qiz</span>
                    {profileGender === "girl" && <iconify-icon icon="solar:check-circle-bold" className="check"></iconify-icon>}
                  </button>
                </div>
              </div>

            </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmRemove !== null}
        title="Farzandni o'chirish"
        message={`${confirmRemove?.name ?? ""}ni o'chirasizmi? Qurilmalar va faoliyat tarixi saqlanadi.`}
        confirmLabel="O'chirish"
        danger
        busy={removing}
        onConfirm={removeChild}
        onCancel={() => setConfirmRemove(null)}
      />

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3>Qurilmalar ro'yxati</h3>
            <p>Farzandingiz foydalanayotgan barcha qurilmalar.</p>
          </div>
          <div className="table-actions">
            <button className="btn-filter">
              <iconify-icon icon="solar:calendar-linear"></iconify-icon>
              Bugun
              <iconify-icon icon="solar:alt-arrow-down-linear"></iconify-icon>
            </button>
            <div className="view-toggle">
              <button className="active" title="Ro'yxat ko'rinishi">
                <iconify-icon icon="solar:list-linear"></iconify-icon>
              </button>
              <button title="Katakcha ko'rinishi">
                <iconify-icon icon="solar:widget-4-linear"></iconify-icon>
              </button>
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <table className="device-table">
            <thead>
              <tr>
                <th>Qurilma</th>
                <th>Operatsion tizim</th>
                <th>Egasi</th>
                <th>Bugungi ekran vaqti</th>
                <th>Batareya</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {devices === null && (
                <tr>
                  <td colSpan={6}>
                    <div className="device-table-loading" aria-live="polite">
                      <div className="skeleton skeleton-row"></div>
                      <p>Qurilmalar yuklanmoqda...</p>
                    </div>
                  </td>
                </tr>
              )}
              {visibleDevices?.map((device) => {
                const child = children.find(c => c.id === device.child_id);
                const summary = summaries[device.id];
                const isOnline = summary?.device_status === "online";
                const minutesUsed = summary?.total_screen_minutes ?? 0;
                const usagePercent = Math.min((minutesUsed / (24 * 60)) * 100, 100);
                const usageHours = Math.floor(minutesUsed / 60);
                const usageMinutes = minutesUsed % 60;
                const battery = summary?.battery_percent ?? null;

                return (
                  <tr key={device.id} suppressHydrationWarning>
                    <td>
                      <div className="device">
                        <span className="device-icon">
                          <DeviceIcon platform={device.platform} />
                        </span>
                        <div>
                          <h4>{device.child_name || "Nomsiz qurilma"}</h4>
                          <small>{device.platform === "windows" ? "Windows PC" : device.platform}</small>
                          <span className={`device-badge ${device.platform === 'windows' ? 'blue' : 'green'}`}>
                            {device.platform === 'windows' ? 'Asosiy qurilma' : 'Mobil'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="os">
                        <OsIcon platform={device.platform} />
                        <div>
                          <strong>{device.platform === "windows" ? "Windows" : device.platform}</strong>
                          <small>{device.platform === "windows" ? "PC" : "Mobil"}</small>
                        </div>
                      </div>
                    </td>
                    <td suppressHydrationWarning>
                      <div className="owner" suppressHydrationWarning>
                        {child?.photo_url ? <img src={mediaUrl(child.photo_url)} alt="" loading="lazy" decoding="async" /> : <img src="/assets/child-boy.png" alt="" loading="lazy" decoding="async" />}
                        <div suppressHydrationWarning>
                          <span>{child?.name || "Biriktirilmagan"}</span>
                          <small className="owner-status" suppressHydrationWarning>
                            <span className={`status ${isOnline ? 'online' : 'offline'}`}></span>
                            {isOnline ? 'Onlayn' : formatLastSync(device.last_sync)}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="usage-cell">
                        <span>{usageHours ? `${usageHours} soat ` : ""}{usageMinutes} min</span>
                        <div className="usage-bar"><div style={{width: `${usagePercent}%`}}></div></div>
                      </div>
                    </td>
                    <td>
                      <span className="battery">
                        <iconify-icon icon="solar:battery-low-linear"></iconify-icon>
                        {battery !== null ? `${battery}%` : "—"}
                      </span>
                    </td>
                    <td>
                      <Link href={`/devices/${device.id}`} className="btn-view" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                         <iconify-icon icon="solar:eye-linear" style={{ fontSize: 16 }}></iconify-icon>
                         Ko'rish
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {visibleDevices && visibleDevices.length === 0 && (
                <tr>
                  <td colSpan={6} style={{textAlign: 'center', padding: '40px 0', color: 'var(--muted)'}}>
                    Hali bog'langan qurilmalar yo'q.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
