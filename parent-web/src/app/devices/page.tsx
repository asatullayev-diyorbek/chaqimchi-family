"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { getAccessToken } from "@/api/client";
import {
  Device,
  generateEnrollCode,
  getDevices,
  renameDevice,
  unlinkDevice,
  verifyEnrollCode,
} from "@/api/tracking";

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

export default function DevicesPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [adding, setAdding] = useState(false);

  async function load() {
    try {
      setError(null);
      setDevices(await getDevices());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ma'lumotlar yangilanmadi");
    }
  }

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    (async () => {
      try {
        setError(null);
        setDevices(await getDevices());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ma'lumotlar yangilanmadi");
      }
    })();
  }, [router]);

  async function saveRename(id: string) {
    try {
      await renameDevice(id, editingName);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nomlash muvaffaqiyatsiz");
    }
  }

  async function onUnlink(id: string, name: string) {
    if (!confirm(`${name || "Qurilma"}ni ajratmoqchimisiz? Tarixiy ma'lumotlar saqlanadi.`)) return;
    try {
      await unlinkDevice(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ajratish muvaffaqiyatsiz");
    }
  }

  async function onAddDemoDevice() {
    const name = prompt("Farzand ismi (ixtiyoriy):") ?? "";
    setAdding(true);
    setError(null);
    try {
      // NOTE: in the real product a physical device's installer generates
      // this code and a parent scans/types it from their own phone/laptop —
      // two different machines. There's no Windows installer available in
      // this dev setup, so this button plays both roles at once (generate
      // + immediately verify with the logged-in parent's own session) to
      // give a working demo/test device. This is not the real enrollment
      // flow, just a stand-in for it.
      const generated = await generateEnrollCode(name);
      await verifyEnrollCode(generated.code);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Qurilma qo'shilmadi");
    } finally {
      setAdding(false);
    }
  }

  return (
    <AppShell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Qurilmalar</h1>
        <button onClick={onAddDemoDevice} disabled={adding} style={addButtonStyle}>
          {adding ? "Qo'shilmoqda..." : "+ Yangi qurilma qo'shish (demo)"}
        </button>
      </div>

      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16, maxWidth: 560 }}>
        Haqiqiy loyihada qurilma kodni o&apos;zining Windows o&apos;rnatuvchisida ko&apos;rsatadi,
        ota-ona uni boshqa qurilmadan kiritadi. Bu yerda haqiqiy Windows qurilma yo&apos;qligi
        sababli tugma shu ikki qadamni birlashtirib, test qurilmasini darhol bog&apos;laydi.
      </p>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      {devices && devices.length === 0 && (
        <p style={{ color: "var(--muted)" }}>Hali bog&apos;langan qurilma yo&apos;q</p>
      )}

      {devices && devices.length > 0 && (
        <table style={{ width: "100%", maxWidth: 760, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Nomi</th>
              <th style={thStyle}>Holat</th>
              <th style={thStyle}>Oxirgi sinxronizatsiya</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.id}>
                <td style={tdStyle}>
                  {editingId === device.id ? (
                    <input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      autoFocus
                      style={{ border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", fontSize: 14 }}
                    />
                  ) : (
                    <Link href={`/activity?device=${device.id}`} style={{ color: "var(--accent-dark)", fontWeight: 600 }}>
                      {device.child_name || "Qurilma"}
                    </Link>
                  )}
                </td>
                <td style={tdStyle}>{device.status === "linked" ? "Bog'langan" : "Bog'lanmagan"}</td>
                <td style={tdStyle}>{formatLastSync(device.last_sync)}</td>
                <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                  {editingId === device.id ? (
                    <>
                      <button onClick={() => saveRename(device.id)} style={linkButtonStyle}>
                        Saqlash
                      </button>
                      <button onClick={() => setEditingId(null)} style={linkButtonStyle}>
                        Bekor qilish
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditingId(device.id);
                          setEditingName(device.child_name);
                        }}
                        style={linkButtonStyle}
                      >
                        Qayta nomlash
                      </button>
                      <button onClick={() => onUnlink(device.id, device.child_name)} style={{ ...linkButtonStyle, color: "var(--danger)" }}>
                        Ajratish
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AppShell>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 4px",
  fontSize: 12,
  color: "var(--muted)",
  borderBottom: "1px solid var(--border)",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 4px",
  fontSize: 14,
  borderBottom: "1px solid var(--border)",
};

const addButtonStyle: React.CSSProperties = {
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "10px 16px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

const linkButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--accent-dark)",
  fontSize: 13,
  cursor: "pointer",
  marginLeft: 12,
  padding: 0,
};
