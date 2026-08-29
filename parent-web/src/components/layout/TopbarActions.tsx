"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getAlerts, Alert } from "@/api/alerts";
import { Device, getDevices } from "@/api/tracking";
import { Child, createChild, getChildren } from "@/api/children";
import { mediaUrl } from "@/api/client";
import { applyTheme, readTheme } from "@/lib/theme";
import { useObjectUrl } from "@/hooks/useObjectUrl";
import Modal from "@/components/Modal";
import WheelPicker from "@/components/WheelPicker";
import toast from "react-hot-toast";

const MONTH_NAMES = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];
const CURRENT_YEAR = new Date().getFullYear();
const BIRTH_YEARS = Array.from({ length: 19 }, (_, i) => CURRENT_YEAR - i);

function daysInMonth(month: string, year: string): number {
  if (!month) return 31;
  return new Date(Number(year) || CURRENT_YEAR, Number(month), 0).getDate();
}

export default function TopbarActions() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [devices, setDevices] = useState<Device[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [showAddChild, setShowAddChild] = useState(false);
  const [addStep, setAddStep] = useState<1 | 2>(1);
  const [addedChild, setAddedChild] = useState<Child | null>(null);
  const [childName, setChildName] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [photo, setPhoto] = useState<File>();
  const photoUrl = useObjectUrl(photo);
  const [photoError, setPhotoError] = useState("");
  const [gender, setGender] = useState<"boy" | "girl">("boy");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfiles, setShowProfiles] = useState(false);
  
  // Seeded from whatever the pre-hydration script already stamped on <html>,
  // so the toggle icon matches the painted theme on the very first render.
  const [dark, setDark] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const selectedDeviceId = searchParams.get("device") ?? devices.find((device) => device.status === "linked")?.id ?? "";
  const selectedDevice = devices.find((device) => device.id === selectedDeviceId);
  const selectedChildId = searchParams.get("child") ?? selectedDevice?.child_id ?? children[0]?.id ?? "";
  const selectedChild = children.find((child) => child.id === selectedChildId) ?? children[0];

  useEffect(() => {
    getDevices().then(setDevices).catch(() => setDevices([])); 
    getChildren().then(setChildren).catch(() => setChildren([]));
    queueMicrotask(() => setDark(readTheme() === "dark"));


    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfiles(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (selectedDeviceId) getAlerts(selectedDeviceId).then(setAlerts).catch(() => setAlerts([]));
  }, [selectedDeviceId]);

  function toggleTheme() {
    const next = readTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    setDark(next === "dark");
  }

  function selectDevice(deviceId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (deviceId) params.set("device", deviceId); else params.delete("device");
    setShowProfiles(false);
    
    const pathname = window.location.pathname;
    router.replace(`${pathname}${params.size ? `?${params.toString()}` : ""}`);
  }

  function closeAddChildModal() {
    setShowAddChild(false);
    setTimeout(() => {
      setChildName(""); setBirthDay(""); setBirthMonth(""); setBirthYear(""); setPhoto(undefined); setGender("boy"); setAddStep(1); setAddedChild(null); setPhotoError("");
    }, 200);
  }

  async function addChild() {
    if (!childName.trim() || photoError) return;
    try {
      let finalPhoto = photo;
      if (!finalPhoto) {
        const res = await fetch(`/assets/child-${gender}.png`);
        const blob = await res.blob();
        finalPhoto = new File([blob], `child-${gender}.png`, { type: "image/png" });
      }
      const birthDate = birthDay && birthMonth && birthYear
        ? `${birthYear}-${birthMonth.padStart(2, "0")}-${birthDay.padStart(2, "0")}`
        : undefined;
      const child = await createChild({ name: childName.trim(), birth_date: birthDate, photo: finalPhoto });
      setChildren((v) => [...v, child]);
      setAddedChild(child);
      setAddStep(2);
      toast.success("Farzand muvaffaqiyatli qo'shildi!");
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Noma'lum xatolik";
      setPhotoError(errMsg);
      toast.error(errMsg);
    }
  }

  function choosePhoto(file?: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024 || !["image/png","image/jpeg","image/webp"].includes(file.type)) {
      setPhotoError("PNG, JPG yoki WEBP rasm 5 MB gacha bo‘lishi kerak.");
      setPhoto(undefined); return;
    }
    setPhotoError(""); setPhoto(file);
  }

  const unseen = alerts.filter((alert) => !alert.seen).length;

  return (
    <>
      <div className="topbar-actions">
        <div className={`dropdown-wrap ${showNotifications ? 'open' : ''}`} data-dropdown ref={notifRef}>
          <button className="icon-btn" data-dropdown-toggle onClick={() => setShowNotifications(!showNotifications)}>
            <iconify-icon icon="solar:bell-linear"></iconify-icon>
            {unseen > 0 && <span className="notification">{unseen}</span>}
          </button>

          <div className="notif-dropdown">
            <div className="notif-dropdown-header">Bildirishnomalar</div>
            {alerts.slice(0, 3).map((alert) => (
              <Link key={alert.id} href={`/alerts?device=${selectedDeviceId}`} className="notif-item" onClick={() => setShowNotifications(false)}>
                <span className={`notif-icon ${alert.alert_type === "limit_reached" ? "orange" : "blue"}`}>
                  <iconify-icon icon={alert.alert_type === "limit_reached" ? "solar:danger-triangle-linear" : "solar:shield-check-linear"}></iconify-icon>
                </span>
                <div>
                  <p>{alert.alert_type === "limit_reached" ? "Ekran vaqti limiti tugadi" : "Cheklangan ilova ochildi"}</p>
                  <small suppressHydrationWarning>{new Date(alert.triggered_at).toLocaleString("uz-UZ")}</small>
                </div>
              </Link>
            ))}
            {!alerts.length && <div className="notif-item"><div><p>Yangi bildirishnoma yo‘q.</p></div></div>}
          </div>
        </div>

        <button
          className="icon-btn"
          data-theme-toggle
          title={dark ? "Yorug' rejimga o'tish" : "Tungi rejimga o'tish"}
          aria-label={dark ? "Yorug' rejimga o'tish" : "Tungi rejimga o'tish"}
          aria-pressed={dark}
          onClick={toggleTheme}
        >
          <iconify-icon icon={dark ? "solar:sun-linear" : "solar:moon-linear"}></iconify-icon>
        </button>

        <div className={`dropdown-wrap ${showProfiles ? 'open' : ''}`} data-dropdown ref={profileRef}>
          <div className="child-profile" data-dropdown-toggle role="button" tabIndex={0} onClick={() => setShowProfiles(!showProfiles)}>
            <span className="child-avatar">
              {selectedChild?.photo_url ? (
                <img src={mediaUrl(selectedChild.photo_url)} alt="" loading="lazy" decoding="async" />
              ) : children.length ? (
                <img src="/assets/child-boy.png" alt="" loading="lazy" decoding="async" />
              ) : (
                <iconify-icon icon="solar:add-circle-linear"></iconify-icon>
              )}
            </span>
            <div>
              <h4>{selectedChild?.name || "Farzand qo‘shish"}</h4>
              <span>{children.length ? "Farzand" : "Profil yarating"}</span>
            </div>
            <iconify-icon icon="solar:alt-arrow-down-linear"></iconify-icon>
          </div>

            <div className="child-dropdown">
              {children.map((child, index) => {
                const device = devices.find((item) => item.child_id === child.id);
                const isActive = device?.id === selectedDeviceId;
                return (
                  <a href="#" key={child.id} className={`child-dropdown-item ${isActive ? "active" : ""}`} onClick={(e) => { e.preventDefault(); if(device) selectDevice(device.id); }}>
                    <span className="child-avatar small">
                      {child.photo_url ? <img src={mediaUrl(child.photo_url)} alt="" loading="lazy" decoding="async" /> : <img src={index % 2 === 0 ? "/assets/child-boy.png" : "/assets/child-girl.png"} alt="" loading="lazy" decoding="async" />}
                    </span>
                    <div>
                      <h4>{child.name}</h4>
                      <span>Farzand</span>
                    </div>
                    {isActive && <iconify-icon icon="solar:check-circle-bold" className="check"></iconify-icon>}
                  </a>
                );
              })}

              <a href="#" className="child-dropdown-item add" onClick={(e) => { e.preventDefault(); setShowProfiles(false); setShowAddChild(true); }}>
                <span className="child-avatar small add">
                  <iconify-icon icon="solar:add-circle-linear"></iconify-icon>
                </span>
                <span>Farzand qo'shish</span>
              </a>
            </div>
        </div>
      </div>

      <Modal
        open={showAddChild}
        onClose={closeAddChildModal}
        title="Farzand qo'shish"
        subtitle={addStep === 1 ? "Ma'lumotlarni kiriting" : "2-qadam: Tasdiqlash"}
        footer={
          addStep === 1 ? (
            <button className="add-device-btn primary" onClick={addChild} style={{ width: "100%" }}>
              Saqlash va davom etish
            </button>
          ) : undefined
        }
      >
        <>
            <div className="step-indicator">
              <div className={`step-dot ${addStep >= 1 ? "active" : ""}`}><span>1</span></div>
              <div className="step-line"></div>
              <div className={`step-dot ${addStep >= 2 ? "active" : ""}`}><span>2</span></div>
            </div>

            <div className="add-device-body">
              {addStep === 1 && (
                <div className="add-device-step active">
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 24, marginTop: 10 }}>
                    <div 
                      onClick={() => document.getElementById("avatar-upload")?.click()}
                      style={{
                        width: 86, height: 86, borderRadius: 43, background: "var(--border)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", overflow: "hidden", position: "relative",
                        border: "2px solid var(--accent)", flexShrink: 0
                      }}
                      title="Rasm yuklash"
                    >
                      {photo && photoUrl ? (
                        <img src={photoUrl} alt="Tanlangan rasm" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <iconify-icon icon="solar:camera-add-bold" style={{ fontSize: 36, color: "var(--muted)" }}></iconify-icon>
                      )}
                    </div>
                    <input id="avatar-upload" type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => choosePhoto(e.target.files?.[0])} />
                  </div>

                  <div className="edit-field" style={{ marginTop: 0 }}>
                    <label>Ism</label>
                    <input type="text" value={childName} onChange={e => setChildName(e.target.value)} placeholder="Masalan: Umar" />
                  </div>
                  <div className="edit-field" style={{ marginTop: 14 }}>
                    <label>Tug'ilgan sana</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 1fr", gap: 8 }}>
                      <WheelPicker
                        ariaLabel="Kun"
                        value={birthDay}
                        onChange={setBirthDay}
                        options={[
                          { value: "", label: "–" },
                          ...Array.from({ length: daysInMonth(birthMonth, birthYear) }, (_, i) => {
                            const day = String(i + 1);
                            return { value: day, label: day };
                          }),
                        ]}
                      />
                      <WheelPicker
                        ariaLabel="Oy"
                        value={birthMonth}
                        onChange={(month) => {
                          setBirthMonth(month);
                          if (birthDay && Number(birthDay) > daysInMonth(month, birthYear)) setBirthDay("");
                        }}
                        options={[
                          { value: "", label: "–" },
                          ...MONTH_NAMES.map((name, index) => ({ value: String(index + 1), label: name })),
                        ]}
                      />
                      <WheelPicker
                        ariaLabel="Yil"
                        value={birthYear}
                        onChange={(year) => {
                          setBirthYear(year);
                          if (birthDay && Number(birthDay) > daysInMonth(birthMonth, year)) setBirthDay("");
                        }}
                        options={[
                          { value: "", label: "–" },
                          ...BIRTH_YEARS.map((year) => ({ value: String(year), label: String(year) })),
                        ]}
                      />
                    </div>
                  </div>
                  
                  <div className="edit-field" style={{ marginTop: 16 }}>
                    <label style={{ marginBottom: 10, display: "block" }}>Jinsi</label>
                    <div className="child-pick-list">
                      <button type="button" className={`child-pick-item ${gender === "boy" ? "selected" : ""}`} onClick={() => setGender("boy")}>
                        <div style={{ background: gender === "boy" ? "var(--cat-blue-bg)" : "var(--border)", width: 44, height: 44, borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8, transition: "0.2s" }}>
                          <iconify-icon icon="ph:gender-male-bold" style={{ fontSize: 24, color: gender === "boy" ? "var(--cat-blue)" : "var(--muted)", transition: "0.2s" }}></iconify-icon>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", transition: "0.2s" }}>O'g'il</span>
                      </button>
                      <button type="button" className={`child-pick-item ${gender === "girl" ? "selected" : ""}`} onClick={() => setGender("girl")}>
                        <div style={{ background: gender === "girl" ? "var(--pink-bg)" : "var(--border)", width: 44, height: 44, borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8, transition: "0.2s" }}>
                          <iconify-icon icon="ph:gender-female-bold" style={{ fontSize: 24, color: gender === "girl" ? "var(--pink)" : "var(--muted)", transition: "0.2s" }}></iconify-icon>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", transition: "0.2s" }}>Qiz</span>
                      </button>
                    </div>
                  </div>
                  
                  {photoError && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10, textAlign: "center" }}>{photoError}</p>}
                </div>
              )}

              {addStep === 2 && (
                <div className="add-device-step active" style={{ textAlign: "center" }}>
                  <div style={{ width: 64, height: 64, borderRadius: 32, background: "var(--green-bg)", color: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 16px" }}>
                    <iconify-icon icon="solar:check-circle-bold"></iconify-icon>
                  </div>
                  <h3 style={{ fontSize: 18, marginBottom: 8 }}>Muvaffaqiyatli qo'shildi!</h3>
                  <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 24 }}>{addedChild?.name} profili yaratildi. Endi unga qurilma ulashingiz mumkin.</p>
                  
                  <Link href="/devices" onClick={closeAddChildModal} className="add-device-btn primary" style={{ textDecoration: "none", display: "block" }}>
                    Qurilma ulash
                  </Link>
                </div>
              )}
            </div>
        </>
      </Modal>
    </>
  );
}
