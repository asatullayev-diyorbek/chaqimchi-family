"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { createRule, deleteRule, getDailyLimitMinutes, getRules, Rule } from "@/api/rules";
import { getAccessToken } from "@/api/client";
import { getDevices } from "@/api/tracking";
import { toast } from "react-hot-toast";

function RulesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedDeviceId = searchParams.get("device");
  const requestedChildId = searchParams.get("child");
  const [deviceId, setDeviceId] = useState("");
  const [rules, setRules] = useState<Rule[]>([]);
  const [limit, setLimit] = useState("");
  const [app, setApp] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingLimit, setSavingLimit] = useState(false);
  const [addingApp, setAddingApp] = useState(false);

  const loadRules = useCallback(async (selectedDeviceId: string) => {
    setLoading(true);
    try {
      const nextRules = await getRules(selectedDeviceId);
      setRules(nextRules);
      setLimit(String(getDailyLimitMinutes(nextRules) ?? ""));
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Qoidalar yuklanmadi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getAccessToken()) { router.replace("/login"); return; }
    getDevices().then((list) => {
      const selected = list.find((device) => device.id === requestedDeviceId) ?? list.find((device) => device.child_id === requestedChildId && device.status === "linked") ?? list.find((device) => device.status === "linked") ?? list[0];
      if (selected) { setDeviceId(selected.id); void loadRules(selected.id); } else setLoading(false);
    }).catch(() => { toast.error("Qurilmalar yuklanmadi"); setLoading(false); });
  }, [loadRules, requestedDeviceId, requestedChildId, router]);

  async function saveLimit() {
    if (!deviceId || savingLimit) return;
    const raw = limit.trim();
    const minutes = Number(raw);
    if (raw && (!Number.isInteger(minutes) || minutes < 0)) {
      toast.error("Limit butun, manfiy bo'lmagan son bo'lishi kerak.");
      return;
    }
    if (minutes > 24 * 60) {
      toast.error("Kunlik limit 1440 daqiqadan oshmasligi kerak.");
      return;
    }

    const previous = rules;
    const oldLimit = rules.find((rule) => rule.rule_type === "daily_limit_minutes");
    setSavingLimit(true);
    try {
      if (raw && minutes > 0) {
        // Create first, delete second. The old order removed the rule before
        // knowing the replacement would be accepted, so a failed create left
        // the device with no limit at all.
        const created = await createRule(deviceId, "daily_limit_minutes", { minutes });
        if (oldLimit) await deleteRule(oldLimit.id).catch(() => undefined);
        setRules((current) => [...current.filter((rule) => rule.rule_type !== "daily_limit_minutes"), created]);
        toast.success(`Kunlik limit ${minutes} daqiqa qilib saqlandi.`);
      } else if (oldLimit) {
        await deleteRule(oldLimit.id);
        setRules((current) => current.filter((rule) => rule.rule_type !== "daily_limit_minutes"));
        toast.success("Kunlik limit o'chirildi.");
      } else {
        toast("Limit allaqachon belgilanmagan.");
      }
    } catch (cause) {
      setRules(previous);
      setLimit(String(getDailyLimitMinutes(previous) ?? ""));
      toast.error(cause instanceof Error ? cause.message : "Limit saqlanmadi");
    } finally {
      setSavingLimit(false);
    }
  }

  async function addBlockedApp() {
    const name = app.trim();
    if (!deviceId || !name || addingApp) return;
    const already = rules.some(
      (rule) => rule.rule_type === "blocked_app" && "app" in rule.value &&
        String(rule.value.app).toLowerCase() === name.toLowerCase(),
    );
    if (already) {
      toast.error(`${name} allaqachon cheklangan.`);
      return;
    }
    setAddingApp(true);
    try {
      const created = await createRule(deviceId, "blocked_app", { app: name });
      setRules((current) => [...current, created]);
      setApp("");
      toast.success(`${name} cheklandi.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Ilova qo'shilmadi");
    } finally {
      setAddingApp(false);
    }
  }

  async function removeRule(rule: Rule) {
    try {
      await deleteRule(rule.id);
      setRules((current) => current.filter((item) => item.id !== rule.id));
      toast.success("Cheklov olib tashlandi.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Qoida o'chirilmadi");
    }
  }

  const blockedApps = rules.filter((rule) => rule.rule_type === "blocked_app");
  
  return (
    <AppShell>
      {/* Header */}


      <section className="tab-content active">
        {loading ? (
           <p style={{ marginTop: 16, color: "var(--muted)" }}>Yuklanmoqda...</p>
        ) : !deviceId ? (
           <p style={{ marginTop: 16, color: "var(--muted)" }}>Hali bog'langan qurilma yo'q.</p>
        ) : (
          <div className="card">
            <div className="settings-section">
              <h3>Kunlik ekran vaqti</h3>
              <p style={{color: 'var(--muted)', fontSize: 13, marginBottom: 16}}>Daqiqalarda yozing. Bo'sh yoki 0 qiymat limitni o'chiradi.</p>
              
              <div className="setting-item" style={{display: 'flex', gap: 10, alignItems: 'center'}}>
                <div className="setting-left" style={{flex: 1}}>
                  <iconify-icon icon="solar:clock-circle-linear" style={{fontSize: 24, color: 'var(--muted)'}}></iconify-icon>
                  <div>
                    <h4 style={{margin: '0 0 4px', fontSize: 15}}>Kunlik limit</h4>
                    <p style={{margin: 0, fontSize: 13, color: 'var(--muted)'}}>O'zgarishlar qurilmaga keyingi sinxronizatsiyada yetib boradi.</p>
                  </div>
                </div>
                <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                  <input
                    value={limit}
                    onChange={(event) => setLimit(event.target.value)}
                    inputMode="numeric"
                    placeholder="Masalan: 180"
                    style={{padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 14, width: 140}}
                  />
                  <button onClick={saveLimit} disabled={savingLimit} className="btn btn-outline" style={{padding: '10px 16px', borderRadius: 10}}>
                    {savingLimit ? "Saqlanmoqda..." : "Saqlash"}
                  </button>
                </div>
              </div>
            </div>

            <div className="settings-section">
              <h3>Cheklangan ilovalar</h3>
              <p style={{color: 'var(--muted)', fontSize: 13, marginBottom: 16}}>Bola ilovasi buni “hozircha mavjud emas” holati sifatida ko'rsatadi.</p>
              
              <div className="setting-item" style={{display: 'flex', gap: 10, alignItems: 'center', borderBottom: 'none'}}>
                <div className="setting-left" style={{flex: 1}}>
                  <iconify-icon icon="solar:shield-warning-linear" style={{fontSize: 24, color: 'var(--muted)'}}></iconify-icon>
                  <div>
                    <h4 style={{margin: '0 0 4px', fontSize: 15}}>Yangi ilova qo'shish</h4>
                    <p style={{margin: 0, fontSize: 13, color: 'var(--muted)'}}>Nomi yoki jarayon nomi bilan qo'shing</p>
                  </div>
                </div>
                <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                  <input
                    value={app}
                    onChange={(event) => setApp(event.target.value)}
                    placeholder="masalan: steam.exe"
                    onKeyDown={(event) => { if (event.key === "Enter") void addBlockedApp(); }}
                    style={{padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 14, width: 220}}
                  />
                  <button onClick={addBlockedApp} disabled={addingApp || !app.trim()} className="btn btn-primary" style={{padding: '10px 16px', borderRadius: 10}}>
                    {addingApp ? "Qo'shilmoqda..." : "Qo'shish"}
                  </button>
                </div>
              </div>

              <div style={{marginTop: 8}}>
                {blockedApps.map((rule) => (
                  <div key={rule.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 16px", border: "1px solid var(--border)", borderRadius: 12, marginBottom: 10, background: 'var(--surface)' }}>
                    <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                      <span style={{width: 36, height: 36, display: 'grid', placeItems: 'center', background: 'var(--cat-red-bg)', color: 'var(--cat-red)', borderRadius: 10}}>
                        <iconify-icon icon="solar:forbidden-circle-linear" style={{fontSize: 20}}></iconify-icon>
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{"app" in rule.value ? rule.value.app : "Ilova"}</span>
                    </div>
                    <button onClick={() => void removeRule(rule)} className="btn btn-outline" style={{padding: '8px 12px', fontSize: 13, color: 'var(--danger)', borderColor: 'transparent', background: 'var(--cat-amber-bg)'}}>
                      O'chirish
                    </button>
                  </div>
                ))}
                {!loading && blockedApps.length === 0 ? (
                  <div style={{padding: '24px', textAlign: 'center', color: 'var(--muted)', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 12}}>
                    Hali cheklangan ilova yo'q.
                  </div>
                ) : null}
              </div>
            </div>
            
                      </div>
        )}
      </section>
    </AppShell>
  );
}

export default function RulesPage() {
  return (
    <Suspense fallback={<AppShell><p style={{ color: "var(--muted)" }}>Yuklanmoqda...</p></AppShell>}>
      <RulesContent />
    </Suspense>
  );
}
