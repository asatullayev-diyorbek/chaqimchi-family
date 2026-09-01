"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { changePassword, CurrentUser, getCurrentUser, updateProfile } from "@/api/auth";
import { useApiQuery } from "@/hooks/useApiQuery";

const muted: React.CSSProperties = { color: "var(--muted)", fontSize: 14 };
const label: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6 };
const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  fontSize: 14,
};
const btn: React.CSSProperties = {
  border: "none",
  borderRadius: 10,
  padding: "10px 18px",
  background: "var(--accent-dark)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};
const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--border)", fontSize: 14 };

export default function SettingsPage() {
  const query = useApiQuery(() => getCurrentUser(), []);
  const user = query.data as CurrentUser | null;

  const [name, setName] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    if (query.error) toast.error(query.error.message);
  }, [query.error]);

  const fullName = name ?? user?.full_name ?? "";

  async function saveName() {
    if (savingName || !fullName.trim()) return;
    setSavingName(true);
    try {
      await updateProfile(fullName.trim());
      toast.success("Saqlandi.");
      query.refetch();
      setName(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Saqlanmadi");
    } finally {
      setSavingName(false);
    }
  }

  async function savePassword() {
    if (savingPw) return;
    if (newPw.length < 8) {
      toast.error("Yangi parol kamida 8 ta belgi.");
      return;
    }
    setSavingPw(true);
    try {
      await changePassword(oldPw, newPw);
      toast.success("Parol o'zgartirildi.");
      setOldPw("");
      setNewPw("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "O'zgartirilmadi");
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <>
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div className="card-header" style={{ marginBottom: 10 }}><h3>Hisob</h3></div>
        {query.isInitialLoad ? (
          <p style={muted}>Yuklanmoqda...</p>
        ) : (
          <>
            <div style={row}><span style={muted}>Email</span><span>{user?.email || "—"}</span></div>
            <div style={row}><span style={muted}>Username</span><span>{user?.username || "—"}</span></div>
            <div style={row}>
              <span style={muted}>Telegram</span>
              <span>{user?.telegram_linked ? `@${user.telegram_username || "ulangan"}` : "ulanmagan"}</span>
            </div>
            <div style={{ marginTop: 16, maxWidth: 380 }}>
              <label style={label} htmlFor="fn">To&apos;liq ism</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input id="fn" style={input} value={fullName} onChange={(e) => setName(e.target.value)} placeholder="Ism Familiya" />
                <button style={btn} onClick={saveName} disabled={savingName || (name ?? "") === ""}>Saqlash</button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div className="card-header" style={{ marginBottom: 10 }}><h3>Parol</h3></div>
        <div style={{ maxWidth: 380, display: "grid", gap: 12 }}>
          {user?.has_password && (
            <div>
              <label style={label} htmlFor="op">Joriy parol</label>
              <input id="op" style={input} type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} autoComplete="current-password" />
            </div>
          )}
          <div>
            <label style={label} htmlFor="np">Yangi parol</label>
            <input id="np" style={input} type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" placeholder="Kamida 8 ta belgi" />
          </div>
          <button style={{ ...btn, justifySelf: "start" }} onClick={savePassword} disabled={savingPw}>
            {savingPw ? "Saqlanmoqda…" : user?.has_password ? "Parolni o'zgartirish" : "Parol o'rnatish"}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div className="card-header" style={{ marginBottom: 10 }}><h3>Yordam</h3></div>
        <p style={muted}>
          Savol yoki muammo bo&apos;lsa Telegram: <a href="https://t.me/ChaqimchiGuardBot" target="_blank" rel="noopener" style={{ color: "var(--brand-blue)", fontWeight: 600 }}>@ChaqimchiGuardBot</a>
        </p>
        <p style={{ ...muted, marginTop: 8 }}>
          Windows agentini yuklab olish: <a href="/download" style={{ color: "var(--brand-blue)", fontWeight: 600 }}>guard.chaqimchi-ai.uz/download</a>
        </p>
      </div>
    </>
  );
}
