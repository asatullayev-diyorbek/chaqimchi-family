import type { Metadata } from "next";
import Link from "next/link";
import Reveal from "@/components/Reveal";
import SiteNav from "@/components/SiteNav";
import CountUp from "@/components/CountUp";
import { WeekBars, CategoryDonut } from "@/components/Charts";
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

/* ---- small live-looking previews for the three feature blocks ---- */

function BlockPreview({ kind }: { kind: string }) {
  if (kind === "limit") {
    return (
      <div className="fp">
        <div className="fp-head"><span>Kunlik limit</span><b>3s 24d / 4s</b></div>
        <div className="meter"><i style={{ "--w": "85%" } as React.CSSProperties} /></div>
        <div className="fp-tags">
          <span>Ish kuni · 4s</span>
          <span>Dam olish · 6s</span>
        </div>
      </div>
    );
  }
  if (kind === "quiet") {
    return (
      <div className="fp">
        <div className="fp-head"><span>Dam olish vaqti</span><b>22:00 → 07:00</b></div>
        <div className="fp-clock">
          <Ico name="solar:moon-sleep-bold" />
          <div className="fp-track"><i style={{ "--w": "100%" } as React.CSSProperties} /></div>
        </div>
        <div className="fp-note">Ekran xushmuomala tarzda bloklangan</div>
      </div>
    );
  }
  return (
    <div className="fp">
      <div className="fp-head"><span>Cheklangan</span><b>2 ta ilova</b></div>
      <div className="fp-row"><span className="chip-ico brand"><iconify-icon icon="logos:steam-icon" /></span>steam.exe<em>bloklangan</em></div>
      <div className="fp-row"><span className="chip-ico brand"><iconify-icon icon="logos:discord-icon" /></span>discord.exe<em>bloklangan</em></div>
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
                <div className="rows">
                  <div className="row hp" style={{ "--d": "340ms" } as React.CSSProperties}>
                    <span className="app"><span className="chip-ico brand"><iconify-icon icon="logos:chrome" /></span>Chrome</span>
                    <b>58 daq</b>
                  </div>
                  <div className="row hp" style={{ "--d": "430ms" } as React.CSSProperties}>
                    <span className="app"><span className="chip-ico brand"><iconify-icon icon="simple-icons:minecraft" style={{ color: "#68b247" }} /></span>Minecraft</span>
                    <b>44 daq</b>
                  </div>
                  <div className="row hp" style={{ "--d": "520ms" } as React.CSSProperties}>
                    <span className="app"><span className="chip-ico brand"><iconify-icon icon="logos:youtube-icon" /></span>YouTube</span>
                    <b>31 daq</b>
                  </div>
                </div>
                <div className="strip hp" style={{ "--d": "620ms" } as React.CSSProperties}>
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
                <span className="url">guard.chaqimchi-ai.uz</span>
              </div>
              <div className="browser-body">
                <div className="bcol bcol-a">
                  <div className="bcard">
                    <div className="ch-head"><h3>7 kunlik statistika</h3><span>o&apos;rtacha 3s 24d</span></div>
                    <WeekBars />
                  </div>
                  <div className="bcard">
                    <div className="ch-head"><h3>So&apos;nggi faoliyat</h3><span>bugun</span></div>
                    <div className="rows plain">
                      <div className="row"><span className="app"><span className="chip-ico brand"><iconify-icon icon="logos:chrome" /></span>Chrome</span><b>58 daq</b></div>
                      <div className="row"><span className="app"><span className="chip-ico brand"><iconify-icon icon="simple-icons:minecraft" style={{ color: "#68b247" }} /></span>Minecraft</span><b>44 daq</b></div>
                      <div className="row"><span className="app"><span className="chip-ico" style={{ background: "color-mix(in srgb, var(--warning) 18%, transparent)", color: "var(--warning)" }}><iconify-icon icon="solar:danger-triangle-bold" /></span>Limit tugadi</span><b>19:40</b></div>
                    </div>
                  </div>
                </div>
                <div className="bcol">
                  <div className="bcard">
                    <div className="ch-head"><h3>Faoliyat kategoriyalari</h3><span>bugun</span></div>
                    <CategoryDonut />
                  </div>
                  <div className="bcard bcard-status">
                    <div className="ch-head"><h3>Qurilma</h3><span className="ok">onlayn</span></div>
                    <div className="statline"><Ico name="solar:battery-half-linear" /> Batareya 62%</div>
                    <div className="statline"><Ico name="solar:refresh-linear" /> Oxirgi sinx: 2 daq oldin</div>
                    <div className="statline"><Ico name="solar:shield-check-linear" /> 3 ta faol qoida</div>
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
                  <strong>Bugungi ekran vaqting tugadi</strong>
                  <span>Ertaga davom etasan! Savoling bo&apos;lsa, ota-onangga murojaat qil.</span>
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
                  <span className={`ico ${i === 2 ? "teal" : ""}`}><Ico name={p.icon} /></span>
                  <div className="plat-row">
                    <small>{p.tag}</small>
                    <span className={`plat-status ${p.status === "Mavjud" ? "live" : "soon"}`}>{p.status}</span>
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
