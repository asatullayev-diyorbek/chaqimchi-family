"use client";

import { Suspense, useEffect, useState } from "react";
import { createRule, deleteRule, getDailyLimitMinutes, getRules, getWeekendLimitMinutes, Rule } from "@/api/rules";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useSelectedDevice } from "@/hooks/useSelectedDevice";
import { toast } from "react-hot-toast";

function RulesContent() {
  // Only the device selection moves to the shared hook. The rules list itself
  // stays local state: this page edits it (limit, blocked apps) as well as
  // reading it, and useApiQuery has no opinion about local mutations.
  const { deviceId, loading: devicesLoading } = useSelectedDevice();
  const rulesQuery = useApiQuery(() => getRules(deviceId), [deviceId], { enabled: Boolean(deviceId) });

  // Server rules, plus this page's own edits laid on top. Mutations return
  // the created object, so applying them locally avoids a refetch per change.
  const [localRules, setLocalRules] = useState<Rule[] | null>(null);
  const rules = localRules ?? rulesQuery.data ?? [];
  const setRules = (next: Rule[] | ((current: Rule[]) => Rule[])) =>
    setLocalRules(typeof next === "function" ? next(rules) : next);

  // The limit field is derived from the rules until the parent types into it;
  // `limitEdit` is that override. Deriving instead of seeding through an
  // effect is what keeps this free of setState-in-effect.
  const [limitEdit, setLimitEdit] = useState<string | null>(null);
  const limit = limitEdit ?? String(getDailyLimitMinutes(rules) ?? "");
  const setLimit = (value: string) => setLimitEdit(value);

  // Weekend (Sat–Sun) override. Empty means "same as weekday limit".
  const [weekendEdit, setWeekendEdit] = useState<string | null>(null);
  const weekend = weekendEdit ?? String(getWeekendLimitMinutes(rules) ?? "");
  const setWeekend = (value: string) => setWeekendEdit(value);

  const [app, setApp] = useState("");
  const [savingLimit, setSavingLimit] = useState(false);
  const [addingApp, setAddingApp] = useState(false);

  useEffect(() => {
    if (rulesQuery.error) toast.error(rulesQuery.error.message);
  }, [rulesQuery.error]);

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

    const weekendRaw = weekend.trim();
    const weekendMinutes = Number(weekendRaw);
    if (weekendRaw && (!Number.isInteger(weekendMinutes) || weekendMinutes < 0 || weekendMinutes > 24 * 60)) {
      toast.error("Dam olish kunlari limiti 0–1440 oralig'idagi butun son bo'lishi kerak.");
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
        const value: { minutes: number; weekend_minutes?: number } = { minutes };
        if (weekendRaw) value.weekend_minutes = weekendMinutes;
        const created = await createRule(deviceId, "daily_limit_minutes", value);
        if (oldLimit) await deleteRule(oldLimit.id).catch(() => undefined);
        setRules((current) => [...current.filter((rule) => rule.rule_type !== "daily_limit_minutes"), created]);
        setLimitEdit(null);
        setWeekendEdit(null);
        toast.success(
          weekendRaw
            ? `Ish kunlari ${minutes} daq, dam olish kunlari ${weekendMinutes} daq qilib saqlandi.`
            : `Kunlik limit ${minutes} daqiqa qilib saqlandi.`,
        );
      } else if (oldLimit) {
        await deleteRule(oldLimit.id);
        setRules((current) => current.filter((rule) => rule.rule_type !== "daily_limit_minutes"));
        setLimitEdit(null);
        setWeekendEdit(null);
        toast.success("Kunlik limit o'chirildi.");
      } else {
        toast("Limit allaqachon belgilanmagan.");
      }
    } catch (cause) {
      setRules(previous);
      setLimitEdit(null);
      setWeekendEdit(null);
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

  const loading = devicesLoading || rulesQuery.isInitialLoad;
  const blockedApps = rules.filter((rule) => rule.rule_type === "blocked_app");
  
  return (
    <>
      {/* Header */}


      <section className="tab-content active">
        {loading ? (
           <p className="muted" style={{ marginTop: 16 }}>Yuklanmoqda...</p>
        ) : !deviceId ? (
           <p className="muted" style={{ marginTop: 16 }}>Hali bog'langan qurilma yo'q.</p>
        ) : (
          <div className="card">
            <div className="settings-section">
              <h3>Kunlik ekran vaqti</h3>
              <p className="muted-sm" style={{ marginBottom: 16 }}>Daqiqalarda yozing. Bo'sh yoki 0 qiymat limitni o'chiradi.</p>
              
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
                </div>
              </div>

              <div className="setting-item" style={{display: 'flex', gap: 10, alignItems: 'center'}}>
                <div className="setting-left" style={{flex: 1}}>
                  <iconify-icon icon="solar:calendar-linear" style={{fontSize: 24, color: 'var(--muted)'}}></iconify-icon>
                  <div>
                    <h4 style={{margin: '0 0 4px', fontSize: 15}}>Dam olish kunlari (Shanba–Yakshanba)</h4>
                    <p style={{margin: 0, fontSize: 13, color: 'var(--muted)'}}>Bo'sh qoldirsangiz, dam olish kunlari ham yuqoridagi limit qo'llanadi.</p>
                  </div>
                </div>
                <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                  <input
                    value={weekend}
                    onChange={(event) => setWeekend(event.target.value)}
                    inputMode="numeric"
                    placeholder="Masalan: 240"
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
              <p className="muted-sm" style={{ marginBottom: 16 }}>Bola ilovasi buni “hozircha mavjud emas” holati sifatida ko'rsatadi.</p>
              
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
    </>
  );
}

export default function RulesPage() {
  return (
    <Suspense fallback={<><p className="muted">Yuklanmoqda...</p></>}>
      <RulesContent />
    </Suspense>
  );
}
