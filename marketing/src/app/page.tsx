import type { Metadata } from "next";
import Link from "next/link";
import { SITE, PROMISES, FEATURES, STEPS, FAQ } from "@/lib/site";

export const metadata: Metadata = {
  description:
    "Kunlik ekran vaqti, dam olish soatlari, ilova cheklovlari, faoliyat hisoboti va Telegram xabarlar — bola ham qoidalarni ko'radi.",
};

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function Stroke({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export default function Page() {
  return (
    <>
      <header className="nav">
        <div className="wrap nav-inner">
          <Link className="brand" href="/">
            <span className="brand-mark">C</span>
            ChaqimchiAI Family
          </Link>
          <nav className="nav-links">
            <a href="#imkoniyatlar">Imkoniyatlar</a>
            <a href="#qanday">Qanday ishlaydi</a>
            <a href="#platformalar">Platformalar</a>
            <a href="#narx">Narx</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="nav-cta">
            <a className="btn btn-ghost" href={SITE.loginUrl}>Kirish</a>
            <a className="btn btn-primary" href={SITE.downloadUrl}>Yuklab olish</a>
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="hero">
          <div className="wrap hero-grid">
            <div>
              <span className="eyebrow">Ota-ona nazorati · Windows</span>
              <h1>Oila uchun ochiq ekran-vaqt qoidalari</h1>
              <p className="lead" style={{ marginTop: 18 }}>
                {SITE.tagline} Kunlik limit, dam olish soatlari va ilova cheklovlarini
                oddiy tilda boshqaring — bola ham qoidalarni va qolgan vaqtни ko'rib turadi.
              </p>
              <div className="hero-cta">
                <a className="btn btn-primary" href={SITE.downloadUrl}>Windows uchun yuklab olish</a>
                <a className="btn btn-ghost" href={SITE.signupUrl}>Bepul boshlash</a>
              </div>
              <p className="hero-note">
                Windows 10/11 · MVP/Beta davrida bepul · Josuslik yoki jazolash vositasi emas
              </p>
            </div>

            <div className="glass mock" aria-hidden>
              <div className="mock-row">
                <div className="mock-tile">
                  <div className="mock-k">Bugungi ekran vaqti</div>
                  <div className="mock-v">2 soat 40 daq</div>
                  <div className="mock-bar"><i style={{ width: "66%" }} /></div>
                </div>
                <div className="mock-tile">
                  <div className="mock-k">Kunlik limit</div>
                  <div className="mock-v">4 soat</div>
                  <div className="mock-bar"><i style={{ width: "40%" }} /></div>
                </div>
              </div>
              <div className="mock-list">
                <div className="mock-item">
                  <span><span className="mock-dot" style={{ background: "color-mix(in srgb, var(--brand) 15%, transparent)", color: "var(--brand)" }}>▲</span>Chrome</span>
                  <b>58 daq</b>
                </div>
                <div className="mock-item">
                  <span><span className="mock-dot" style={{ background: "color-mix(in srgb, var(--accent) 16%, transparent)", color: "var(--accent)" }}>◆</span>Minecraft</span>
                  <b>44 daq</b>
                </div>
                <div className="mock-item">
                  <span><span className="mock-dot" style={{ background: "color-mix(in srgb, var(--warning) 16%, transparent)", color: "var(--warning)" }}>●</span>YouTube</span>
                  <b>31 daq</b>
                </div>
              </div>
              <div className="mock-tile" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span className="mock-dot" style={{ background: "color-mix(in srgb, var(--accent) 16%, transparent)", color: "var(--accent)" }}>✓</span>
                <span style={{ fontSize: "0.9rem", color: "var(--body)" }}>Dam olish vaqti 22:00–07:00 — faol</span>
              </div>
            </div>
          </div>
        </section>

        {/* PROMISES */}
        <section>
          <div className="wrap">
            <span className="eyebrow">Nega ChaqimchiAI</span>
            <h2>Uchta teng va'da</h2>
            <div className="grid grid-3">
              {PROMISES.map((p) => (
                <article key={p.title} className="glass card">
                  <span className="ico"><Stroke d={p.icon} /></span>
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* TRANSPARENCY */}
        <section>
          <div className="wrap">
            <div className="glass band">
              <span className="eyebrow">Muhim</span>
              <h2>Bu yashirin kuzatuv yoki jazolash vositasi emas</h2>
              <p className="section-lead">
                ChaqimchiAI oilalarga bola kompyuteridan foydalanish bo'yicha
                <b> ochiq kelishilgan </b> qoidalarni boshqarishga yordam beradi.
              </p>
              <ul>
                <li><Check /> Bola tray belgisi va status oynasi orqali agent borligini ko'radi.</li>
                <li><Check /> Bloklash oynasi xushmuomala: «Bugungi vaqting tugadi, ertaga davom etasan».</li>
                <li><Check /> Klaviatura bosilishi, skrinshot, mikrofon, shaxsiy xabarlar — hech qachon yozilmaydi.</li>
                <li><Check /> Yig'iladigan narsa: ilova nomi + foydalanish vaqti, qurilma holati, qoida hodisalari.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="imkoniyatlar">
          <div className="wrap">
            <span className="eyebrow">Imkoniyatlar</span>
            <h2>Bir panelda — hammasi sokin</h2>
            <p className="section-lead">Ota-ona web panelida yoki mobil ilovada. O'zgarishlar qurilmaga o'zi yetadi, offline ham ishlaydi.</p>
            <div className="grid grid-3">
              {FEATURES.map((f) => (
                <article key={f.title} className="glass card">
                  <span className="pill">{f.tag}</span>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* STEPS */}
        <section id="qanday">
          <div className="wrap">
            <span className="eyebrow">Qanday ishlaydi</span>
            <h2>Uch qadam</h2>
            <div className="grid grid-3">
              {STEPS.map((s) => (
                <article key={s.n} className="glass card">
                  <span className="step-n">{s.n}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* PLATFORMS */}
        <section id="platformalar">
          <div className="wrap">
            <span className="eyebrow">Platformalar</span>
            <h2>Bola qurilmasida — yengil agent, ota-onada — to'liq panel</h2>
            <div className="grid grid-2">
              <article className="glass plat">
                <span className="ico"><Stroke d="M4 5h16v11H4zM2 20h20M9 20v-4M15 20v-4" /></span>
                <div>
                  <small>Bola qurilmasi</small>
                  <h3 style={{ marginTop: 4 }}>Windows agent</h3>
                  <p>Windows xizmati sifatida ishlaydi, qoidalarni lokal qo'llaydi. Tray status oynasi, xushmuomala bloklash ekrani. OTA orqali o'zi yangilanadi.</p>
                </div>
              </article>
              <article className="glass plat">
                <span className="ico"><Stroke d="M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM11 18h2" /></span>
                <div>
                  <small>Ota-ona</small>
                  <h3 style={{ marginTop: 4 }}>Web panel + mobil ilova</h3>
                  <p>Kundalik holat, faoliyat, qoidalar va alertlar. Telegram bot orqali panelni ochmasdan ham nazorat. Bir nechta bola va qurilma.</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="narx">
          <div className="wrap">
            <span className="eyebrow">Narx</span>
            <h2>MVP/Beta davrida bepul</h2>
            <div className="glass price">
              <div className="amt">0 <span>so'm / oy</span></div>
              <p style={{ color: "var(--body)" }}>Sinov davri. Keyinchalik oilaviy obuna bo'ladi — oldindan xabar beramiz.</p>
              <ul>
                <li><Check /> Cheksiz qoidalar: limit, dam olish vaqti, ilova cheklovlari</li>
                <li><Check /> Bir nechta bola va qurilma</li>
                <li><Check /> Faoliyat tarixi + CSV eksport</li>
                <li><Check /> Telegram bot va kunlik hisobot</li>
                <li><Check /> Avtomatik yangilanishlar</li>
              </ul>
              <a className="btn btn-primary" href={SITE.signupUrl} style={{ width: "100%", justifyContent: "center" }}>Bepul boshlash</a>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq">
          <div className="wrap" style={{ maxWidth: 760 }}>
            <span className="eyebrow">FAQ</span>
            <h2>Ko'p beriladigan savollar</h2>
            <div className="faq" style={{ marginTop: 24 }}>
              {FAQ.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section>
          <div className="wrap">
            <div className="glass cta-box">
              <h2>Bugundanoq ochiq qoidalar bilan boshlang</h2>
              <p className="section-lead" style={{ marginInline: "auto" }}>
                Windows dasturini yuklab oling, qurilmani QR bilan bog'lang va birinchi qoidani belgilang.
              </p>
              <div className="hero-cta">
                <a className="btn btn-primary" href={SITE.downloadUrl}>Windows uchun yuklab olish</a>
                <a className="btn btn-ghost" href={SITE.botUrl}>Telegram bot</a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap foot-grid">
          <div>
            <div className="brand" style={{ marginBottom: 8 }}>
              <span className="brand-mark">C</span> ChaqimchiAI Family
            </div>
            © {new Date().getFullYear()} ChaqimchiAI · Toshkent
          </div>
          <div className="foot-links">
            <a href={SITE.loginUrl}>Panelga kirish</a>
            <a href={SITE.downloadUrl}>Yuklab olish</a>
            <a href={SITE.botUrl}>Telegram bot</a>
            <a href={`mailto:${SITE.supportEmail}`}>Aloqa</a>
          </div>
        </div>
      </footer>
    </>
  );
}
