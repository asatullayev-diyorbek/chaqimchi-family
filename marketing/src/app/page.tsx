import type { Metadata } from "next";
import Link from "next/link";
import Reveal from "@/components/Reveal";
import SiteNav from "@/components/SiteNav";
import CountUp from "@/components/CountUp";
import { WeekBars, CategoryDonut, MiniWeek } from "@/components/Charts";
import {
  SITE,
  PROMISES,
  FEATURE_BLOCKS,
  FEATURE_CARDS,
  STEPS,
  CHECKS,
  PRICING,
  PLATFORMS,
  FAQ,
  DEMO_APPS,
} from "@/lib/site";

export const metadata: Metadata = {
  description:
    "Kunlik ekran vaqti, dam olish soatlari, ilova cheklovlari, faoliyat hisoboti va Telegram xabarlar — bola ham qoidalarni ko'radi.",
};

function Ico({ name }: { name: string }) {
  return <iconify-icon icon={name} aria-hidden />;
}
function Check() {
  return <iconify-icon icon="solar:check-circle-bold" aria-hidden />;
}
const DownloadIcon = <iconify-icon icon="solar:download-minimalistic-linear" aria-hidden />;

function AppChip({ icon, color }: { icon: string; color?: string }) {
  return (
    <span className="chip-ico brand">
      <iconify-icon icon={icon} style={color ? { color } : undefined} />
    </span>
  );
}
function fmt(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}s ${m}d` : `${m}d`;
}

/* ---- small live-looking previews for the three feature blocks ---- */

function Ring({ pct, label, sub }: { pct: number; label: string; sub: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring">
      <svg viewBox="0 0 84 84" width="84" height="84" aria-hidden>
        <circle cx="42" cy="42" r={r} fill="none" stroke="var(--chart-track)" strokeWidth="9" />
        <circle
          className="ring-fill"
          cx="42" cy="42" r={r} fill="none" stroke="var(--chart-bar-active)" strokeWidth="9"
          strokeLinecap="round" strokeDasharray={`${c} ${c}`}
          transform="rotate(-90 42 42)"
          style={{ "--dfull": c, "--d": c * (1 - pct / 100) } as React.CSSProperties}
        />
      </svg>
      <div className="ring-c"><b>{label}</b><small>{sub}</small></div>
    </div>
  );
}

function BlockPreview({ kind }: { kind: string }) {
  if (kind === "limit") {
    return (
      <div className="fp">
        <div className="fp-head"><span>Bugun</span><b>3s 24d / 4s</b></div>
        <div className="fp-limit">
          <Ring pct={85} label="85%" sub="ishlatildi" />
          <div className="fp-limit-side">
            <div className="fp-mini">
              <span>Ish kuni</span><strong>4 soat</strong>
            </div>
            <div className="fp-mini">
              <span>Dam olish</span><strong>6 soat</strong>
            </div>
          </div>
        </div>
        <MiniWeek />
      </div>
    );
  }
  if (kind === "quiet") {
    return (
      <div className="fp">
        <div className="fp-head"><span>Dam olish vaqti</span><b className="fp-on">Faol</b></div>
        <div className="fp-timeline">
          <span>22:00</span>
          <div className="fp-timeline-bar"><i /></div>
          <span>07:00</span>
        </div>
        <div className="fp-block">
          <Ico name="solar:moon-sleep-bold" />
          <div>
            <strong>Ekran bloklangan</strong>
            <small>Ertaga 07:00 da o&apos;zi ochiladi</small>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="fp">
      <div className="fp-head"><span>Ilovalar</span><b>2 tasi cheklangan</b></div>
      <div className="fp-row"><AppChip icon="logos:chrome" />Google Chrome<em className="ok">ruxsat</em></div>
      <div className="fp-row"><AppChip icon="logos:youtube-icon" />YouTube<em className="ok">ruxsat</em></div>
      <div className="fp-row"><AppChip icon="logos:steam" />Steam<em>cheklangan</em></div>
      <div className="fp-row"><AppChip icon="logos:discord-icon" />Discord<em>cheklangan</em></div>
    </div>
  );
}

export default function Page() {
  return (
    <>
      <SiteNav />

      <main>
        {/* ================= HERO ================= */}
        <section className="hero">
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <span className="badge"><span className="dot" /> Windows 10/11 · MVP/Beta davrida bepul</span>
              <h1>
                Oila uchun <span className="grad">ochiq</span> ekran-vaqt qoidalari
              </h1>
              <p className="lead">
                Kunlik limit, dam olish soatlari va ilova cheklovlarini oddiy tilda boshqaring.
                Bola ham qoidalarni va qolgan vaqtini o&apos;z ekranida ko&apos;radi.
              </p>
              <div className="hero-cta">
                <a className="btn btn-primary btn-lg btn-glow" href={SITE.downloadUrl}>{DownloadIcon}Windows uchun yuklab olish</a>
                <a className="btn btn-ghost btn-lg" href={SITE.signupUrl}>Bepul boshlash</a>
              </div>
              <p className="hero-note">
                Josuslik yoki jazolash vositasi emas
                <span className="sep" /> Offline ham ishlaydi
                <span className="sep" /> Bir necha bola va qurilma
              </p>
            </div>

            <div className="showcase">
              <div className="glass panel hero-anim">
                <div className="panel-bar">
                  <i /><i /><i /><span>Bugun · Aziz</span>
                  <span className="panel-badge"><span className="pb-dot" />1 yangi</span>
                </div>
                <div className="tiles">
                  <div className="tile hp" style={{ "--d": "120ms" } as React.CSSProperties}>
                    <div className="k">Bugungi ekran vaqti</div>
                    <div className="v">2s 40d</div>
                    <div className="meter"><i style={{ "--w": "66%" } as React.CSSProperties} /></div>
                  </div>
                  <div className="tile hp" style={{ "--d": "220ms" } as React.CSSProperties}>
                    <div className="k">Kunlik limit</div>
                    <div className="v">4 soat</div>
                    <div className="meter warn"><i style={{ "--w": "66%" } as React.CSSProperties} /></div>
                  </div>
                </div>
                <div className="tile hp panel-chart" style={{ "--d": "320ms" } as React.CSSProperties}>
                  <div className="k">Oxirgi 7 kun</div>
                  <MiniWeek />
                </div>
                <div className="tile hp panel-cats" style={{ "--d": "380ms" } as React.CSSProperties}>
                  <div className="k">Kategoriyalar</div>
                  <div className="catbar">
                    <span style={{ flex: 34, background: "var(--cat-teal)" }} />
                    <span style={{ flex: 28, background: "var(--cat-blue)" }} />
                    <span style={{ flex: 22, background: "var(--cat-amber)" }} />
                    <span style={{ flex: 16, background: "var(--cat-slate)" }} />
                  </div>
                  <div className="catlabels">
                    <span><i style={{ background: "var(--cat-teal)" }} />Ta&apos;lim</span>
                    <span><i style={{ background: "var(--cat-blue)" }} />O&apos;yin</span>
                    <span><i style={{ background: "var(--cat-amber)" }} />Ijtimoiy</span>
                  </div>
                </div>
                <div className="rows">
                  {DEMO_APPS.slice(0, 3).map((a, i) => (
                    <div className="row hp" key={a.name} style={{ "--d": `${420 + i * 90}ms` } as React.CSSProperties}>
                      <span className="app"><AppChip icon={a.icon} color={a.color} />{a.name}</span>
                      <b>{fmt(a.minutes)}</b>
                    </div>
                  ))}
                </div>
                <div className="strip hp" style={{ "--d": "720ms" } as React.CSSProperties}>
                  <Check />
                  Dam olish vaqti 22:00–07:00 — faol
                </div>
              </div>
              <div className="float-chip">
                <span className="ring" />
                <div>
                  <b>1s 20d qoldi</b>
                  <small>Bugungi limitgacha</small>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= TRUST STRIP ================= */}
        <div className="trust">
          <Reveal as="div" className="wrap trust-inner">
            <span className="trust-item"><Ico name="solar:shield-check-linear" /> Shaffof rozilik</span>
            <span className="trust-item"><Ico name="solar:lock-keyhole-minimalistic-linear" /> Klaviatura/skrinshot yozilmaydi</span>
            <span className="trust-item"><Ico name="solar:wi-fi-router-minimalistic-linear" /> Offline barqaror</span>
            <span className="trust-item"><Ico name="solar:plain-2-linear" /> Telegram xabarlar</span>
          </Reveal>
        </div>

        {/* ================= PROMISES ================= */}
        <section>
          <div className="wrap">
            <Reveal>
              <span className="eyebrow">Nega ChaqimchiAI</span>
              <h2>Ota-ona uchun xotirjamlik, bola uchun ochiq qoidalar</h2>
            </Reveal>
            <div className="grid grid-3">
              {PROMISES.map((p, i) => (
                <Reveal as="article" className="glass card value-card" key={p.title} delay={i * 90}>
                  <span className={`ico ${i === 2 ? "teal" : ""}`}><Ico name={p.icon} /></span>
                  <h3>{p.title}</h3>
                  <ul>
                    {p.points.map((pt) => (
                      <li key={pt}><Check />{pt}</li>
                    ))}
                  </ul>
                  <div className="value-viz">
                    {i === 0 && (
                      <div className="vv-line">
                        <span className="vv-dot" style={{ background: "var(--accent)" }} />
                        <Ico name="solar:shield-check-bold" /> Agent faol · ko&apos;rinadi
                      </div>
                    )}
                    {i === 1 && (
                      <>
                        <div className="vv-line">Kunlik limit <span style={{ marginLeft: "auto" }}>3s 24d / 4s</span></div>
                        <div className="meter"><i style={{ "--w": "85%" } as React.CSSProperties} /></div>
                      </>
                    )}
                    {i === 2 && (
                      <div className="value-viz-sync">
                        <Ico name="solar:cloud-linear" /> Server
                        <Ico name="solar:arrow-right-linear" /> Lokal agent
                        <Ico name="solar:arrow-right-linear" /> <b>Sinxron</b>
                      </div>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ================= PRIVACY / MUHIM ================= */}
        <section>
          <div className="wrap">
            <Reveal as="div" className="glass band">
              <div className="cols">
                <div>
                  <span className="eyebrow">Muhim</span>
                  <h2>Bu yashirin kuzatuv yoki jazolash vositasi emas</h2>
                  <p className="section-lead">
                    ChaqimchiAI oilalarga bola kompyuteridan foydalanish bo&apos;yicha
                    <b> ochiq kelishilgan </b> raqamli tartibni boshqarishga yordam beradi.
                  </p>
                  <div className="pviz">
                    <span className="pviz-shield"><Ico name="solar:shield-keyhole-bold" /></span>
                    <div className="pviz-list">
                      <div className="pviz-item yes"><Ico name="solar:check-circle-bold" /> Faoliyat vaqti va ilova nomi</div>
                      <div className="pviz-item yes"><Ico name="solar:check-circle-bold" /> Qurilma holati</div>
                      <div className="pviz-item no"><Ico name="solar:close-circle-bold" /> Skrinshot</div>
                      <div className="pviz-item no"><Ico name="solar:close-circle-bold" /> Klaviatura yozuvi</div>
                      <div className="pviz-item no"><Ico name="solar:close-circle-bold" /> Mikrofon</div>
                      <div className="pviz-item no"><Ico name="solar:close-circle-bold" /> Shaxsiy xabarlar</div>
                    </div>
                  </div>
                </div>
                <ul className="checks">
                  {CHECKS.map((c, i) => (
                    <li key={c} style={{ "--d": `${i * 90}ms` } as React.CSSProperties}>
                      <span className="tick"><Check /></span>{c}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ================= FEATURES ================= */}
        <section id="imkoniyatlar">
          <div className="wrap">
            <Reveal>
              <span className="eyebrow">Imkoniyatlar</span>
              <h2>Bir panelda — hammasi sokin</h2>
              <p className="section-lead">O&apos;zgarishlar qurilmaga o&apos;zi yetadi, offline ham ishlaydi.</p>
            </Reveal>

            <div className="fblocks">
              {FEATURE_BLOCKS.map((f, i) => (
                <Reveal as="article" className={`glass fblock ${i % 2 ? "rev" : ""}`} key={f.title} delay={40}>
                  <div className="fblock-text">
                    <span className="pill">{f.tag}</span>
                    <h3>{f.title}</h3>
                    <p>{f.body}</p>
                  </div>
                  <div className="fblock-preview"><BlockPreview kind={f.preview} /></div>
                </Reveal>
              ))}
            </div>

            <div className="grid grid-3 fcards">
              {FEATURE_CARDS.map((f, i) => (
                <Reveal as="article" className="glass card" key={f.title} delay={i * 80}>
                  <span className="ico"><Ico name={f.icon} /></span>
                  <span className="pill">{f.tag}</span>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ================= HOW IT WORKS ================= */}
        <section id="qanday">
          <div className="wrap">
            <Reveal>
              <span className="eyebrow">Qanday ishlaydi</span>
              <h2>Uch qadam — 5 daqiqa</h2>
            </Reveal>
            <div className="steps">
              {STEPS.map((s, i) => (
                <Reveal as="article" className="glass step" key={s.n} delay={i * 110}>
                  <span className="n">{s.n}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                  {i < STEPS.length - 1 && <span className="step-link" aria-hidden><Ico name="solar:arrow-right-linear" /></span>}
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ================= PRODUCT DEMO ================= */}
        <section id="panel">
          <div className="wrap">
            <Reveal>
              <span className="eyebrow">Panel</span>
              <h2>Bir qarashda — bugun, hafta, kategoriyalar</h2>
              <p className="section-lead">Ota-ona paneli har ochilganda asosiy savollarga javob beradi: qancha vaqt, qaysi ilova, muhim xabar bormi.</p>
            </Reveal>
            <Reveal as="div" className="browser">
              <div className="browser-bar">
                <i /><i /><i />
                <span className="url"><Ico name="solar:lock-keyhole-minimalistic-bold" /> guard.chaqimchi-ai.uz</span>
              </div>
              <div className="browser-body">
                <aside className="bside" aria-hidden>
                  <div className="bside-brand"><span className="brand-mark">C</span></div>
                  <a className="bside-item active"><Ico name="solar:home-2-linear" /> Bosh sahifa</a>
                  <a className="bside-item"><Ico name="solar:chart-2-linear" /> Faoliyat</a>
                  <a className="bside-item"><Ico name="solar:devices-linear" /> Qurilmalar</a>
                  <a className="bside-item"><Ico name="solar:shield-check-linear" /> Qoidalar</a>
                  <a className="bside-item"><Ico name="solar:bell-linear" /> Xabarlar</a>
                </aside>
                <div className="bmain">
                  <div className="bcol bcol-a">
                    <div className="bcard bcard-hero">
                      <div className="ch-head"><h3>Bugungi ekran vaqti — Aziz</h3><span className="ok">onlayn</span></div>
                      <div className="bhero-row">
                        <div className="bhero-big">2s 40d <small>/ 4 soat</small></div>
                        <div className="bhero-left">1s 20d qoldi</div>
                      </div>
                      <div className="meter"><i style={{ "--w": "66%" } as React.CSSProperties} /></div>
                    </div>
                    <div className="bcard">
                      <div className="ch-head"><h3>7 kunlik statistika</h3><span>o&apos;rtacha 3s 24d</span></div>
                      <WeekBars />
                    </div>
                    <div className="bcard">
                      <div className="ch-head"><h3>So&apos;nggi faoliyat</h3><span>bugun</span></div>
                      <div className="rows plain">
                        {DEMO_APPS.map((a) => (
                          <div className="row" key={a.name}>
                            <span className="app"><AppChip icon={a.icon} color={a.color} />{a.name}</span>
                            <b>{fmt(a.minutes)}</b>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="bcol">
                    <div className="bcard">
                      <div className="ch-head"><h3>Faoliyat kategoriyalari</h3><span>bugun</span></div>
                      <CategoryDonut />
                    </div>
                    <div className="bcard">
                      <div className="ch-head"><h3>Faol qoidalar</h3><span>3 ta</span></div>
                      <div className="statline"><Ico name="solar:clock-circle-linear" /> Kunlik limit — 4 soat</div>
                      <div className="statline"><Ico name="solar:moon-sleep-linear" /> Dam olish — 22:00–07:00</div>
                      <div className="statline"><Ico name="solar:forbidden-circle-linear" /> Cheklangan — 2 ilova</div>
                    </div>
                    <div className="bcard bcard-status">
                      <div className="ch-head"><h3>Qurilma</h3></div>
                      <div className="statline"><Ico name="solar:battery-half-linear" /> Batareya 62%</div>
                      <div className="statline"><Ico name="solar:refresh-linear" /> Oxirgi sinx: 2 daq oldin</div>
                      <div className="statline"><Ico name="solar:cpu-linear" /> Agent 0.4.0</div>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ================= CHILD SIDE ================= */}
        <section id="bola">
          <div className="wrap">
            <Reveal>
              <span className="eyebrow">Bola tomoni</span>
              <h2>Bola ham xuddi shu qoidalarni ko&apos;radi</h2>
              <p className="section-lead">Ota-ona nima belgilasa, bola ham nimaga amal qilayotganini ko&apos;radi. Bu — kelishuv, kuzatuv emas.</p>
            </Reveal>
            <div className="duo">
              <Reveal as="div" className="glass duo-card">
                <div className="cap"><span className="tag">Ota-ona</span> Web panel</div>
                <div className="tiles">
                  <div className="tile"><div className="k">Haftalik o&apos;rtacha</div><div className="v">3s 10d</div><div className="meter"><i style={{ "--w": "52%" } as React.CSSProperties} /></div></div>
                  <div className="tile"><div className="k">Cheklangan ilova</div><div className="v">2 ta</div></div>
                </div>
                <div className="rows" style={{ marginTop: 13 }}>
                  <div className="row"><span className="app"><span className="chip-ico" style={{ background: "color-mix(in srgb, var(--warning) 18%, transparent)", color: "var(--warning)" }}><iconify-icon icon="solar:danger-triangle-bold" /></span>Limit tugadi — Aziz</span><b>19:40</b></div>
                  <div className="row"><span className="app"><span className="chip-ico" style={{ background: "color-mix(in srgb, var(--brand) 15%, transparent)", color: "var(--brand)" }}><iconify-icon icon="solar:moon-sleep-bold" /></span>Dam olish vaqti boshlandi</span><b>22:00</b></div>
                </div>
              </Reveal>

              <div className="duo-link" aria-hidden>
                <span className="duo-link-line" />
                <span className="duo-link-pill">
                  <iconify-icon icon="solar:link-bold" />
                  Kelishilgan qoida
                </span>
                <span className="duo-link-line" />
              </div>

              <Reveal as="div" className="glass duo-card" delay={120}>
                <div className="cap"><span className="tag">Bola</span> Windows ekrani</div>
                <div className="block-mock">
                  <span className="em"><Ico name="solar:moon-sleep-bold" /></span>
                  <strong>Bugungi ekran vaqti tugadi</strong>
                  <span>Ertaga yana ochiladi. Savol bo&apos;lsa, ota-onaga murojaat qiling.</span>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ================= STATS ================= */}
        <section>
          <div className="wrap">
            <Reveal as="div" className="glass stats">
              <div className="stat">
                <div className="big grad"><CountUp to={5} /> daqiqa</div>
                <div className="lbl">O&apos;rnatishdan birinchi qoidagacha</div>
              </div>
              <div className="stat">
                <div className="big grad"><CountUp to={0} /></div>
                <div className="lbl">Skrinshot, klaviatura yoki mikrofon yozuvi</div>
              </div>
              <div className="stat">
                <div className="big grad">24/7</div>
                <div className="lbl">Offline ham qoidalar ishlaydi</div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ================= PLATFORMS ================= */}
        <section id="platformalar">
          <div className="wrap">
            <Reveal>
              <span className="eyebrow">Platformalar</span>
              <h2>Bola qurilmasida yengil agent, ota-onada to&apos;liq panel</h2>
            </Reveal>
            <div className="grid grid-3">
              {PLATFORMS.map((p, i) => (
                <Reveal as="article" className="glass card plat-card" key={p.title} delay={i * 90}>
                  <div className="plat-row">
                    <small>{p.tag}</small>
                    <span className={`plat-status ${p.status === "Mavjud" ? "live" : "soon"}`}>{p.status}</span>
                  </div>
                  <div className={`plat-viz pv-${i}`} aria-hidden>
                    {i === 0 && (
                      <div className="pv-laptop"><div className="pv-screen"><Ico name="solar:shield-check-bold" /></div><span className="pv-base" /></div>
                    )}
                    {i === 1 && (
                      <div className="pv-browser"><span className="pv-bar"><i /><i /><i /></span><div className="pv-grid"><span /><span /><span /><span /></div></div>
                    )}
                    {i === 2 && (
                      <div className="pv-phone"><div className="pv-notch" /><div className="pv-soon">Tez orada</div></div>
                    )}
                  </div>
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ================= PRICING ================= */}
        <section id="narx">
          <div className="wrap center">
            <Reveal>
              <span className="eyebrow">Narx</span>
              <h2>MVP/Beta davrida bepul</h2>
            </Reveal>
            <Reveal as="div" className="price">
              <div className="price-inner">
                <div className="price-top">
                  <span className="pill">MVP / Beta</span>
                  <div className="amt">0 <span>so&apos;m / oy</span></div>
                  <p>Sinov davri. Keyingi narx aniqlanganda oldindan xabar beramiz.</p>
                </div>
                <ul>
                  {PRICING.map((item) => (
                    <li key={item}><Check /> {item}</li>
                  ))}
                </ul>
                <a className="btn btn-primary btn-lg" href={SITE.signupUrl}>Bepul boshlash</a>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ================= FAQ ================= */}
        <section id="faq">
          <div className="wrap faq-wrap">
            <Reveal>
              <span className="eyebrow">FAQ</span>
              <h2>Ko&apos;p beriladigan savollar</h2>
            </Reveal>
            <Reveal as="div" className="faq">
              {FAQ.map((item, i) => (
                <details key={item.q} name="faq" open={i === 0}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </Reveal>
          </div>
        </section>

        {/* ================= FINAL CTA ================= */}
        <section className="cta-section">
          <div className="wrap">
            <Reveal as="div" className="cta">
              <h2>Farzandingizning ekran vaqtini bugundan tartibga soling</h2>
              <p>Ochiq qoidalar. Xotirjam nazorat. Kerakli ma&apos;lumotlar — bir joyda.</p>
              <div className="hero-cta">
                <a className="btn btn-primary btn-lg" href={SITE.signupUrl}>Bepul boshlash</a>
                <a className="btn btn-ghost btn-lg" href={SITE.downloadUrl}>{DownloadIcon}Windows uchun yuklab olish</a>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* ================= FOOTER ================= */}
      <footer>
        <div className="wrap foot-main">
          <div className="foot-brand">
            <div className="brand">
              <span className="brand-mark">C</span> ChaqimchiAI Family
            </div>
            <p>Ota-ona va bola o&apos;rtasidagi ekran-vaqt qoidalarini ochiq boshqarish vositasi.</p>
          </div>
          <div className="foot-cols">
            <div>
              <h4>Mahsulot</h4>
              <a href="#imkoniyatlar">Imkoniyatlar</a>
              <a href="#qanday">Qanday ishlaydi</a>
              <a href="#narx">Narx</a>
              <a href="#faq">FAQ</a>
            </div>
            <div>
              <h4>Boshlash</h4>
              <a href={SITE.signupUrl}>Bepul boshlash</a>
              <a href={SITE.downloadUrl}>Yuklab olish</a>
              <a href={SITE.loginUrl}>Kirish</a>
              <a href={SITE.botUrl}>Telegram bot</a>
            </div>
            <div>
              <h4>Huquqiy</h4>
              <Link href={SITE.privacyUrl}>Maxfiylik siyosati</Link>
              <Link href={SITE.termsUrl}>Foydalanish shartlari</Link>
              <a href={`mailto:${SITE.supportEmail}`}>Aloqa</a>
            </div>
          </div>
        </div>
        <div className="wrap foot-bottom">
          © {new Date().getFullYear()} ChaqimchiAI · Toshkent
        </div>
      </footer>
    </>
  );
}
