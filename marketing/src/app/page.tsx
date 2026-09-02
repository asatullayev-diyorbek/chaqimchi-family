import type { Metadata } from "next";
import Link from "next/link";
import Reveal from "@/components/Reveal";
import { SITE, PROMISES, FEATURES, STEPS, FAQ } from "@/lib/site";

export const metadata: Metadata = {
  description:
    "Kunlik ekran vaqti, dam olish soatlari, ilova cheklovlari, faoliyat hisoboti va Telegram xabarlar — bola ham qoidalarni ko'radi.",
};

function Ico({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
const DownloadIcon = <Ico d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" />;

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
            <a href="#bola">Bola nima ko&apos;radi</a>
            <a href="#narx">Narx</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="nav-cta">
            <a className="btn btn-ghost" href={SITE.loginUrl}>Kirish</a>
            <a className="btn btn-primary" href={SITE.downloadUrl}>{DownloadIcon}Yuklab olish</a>
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="hero">
          <div className="wrap hero-grid">
            <div>
              <span className="badge"><span className="dot" /> Windows 10/11 · MVP/Beta davrida bepul</span>
              <h1>
                Oila uchun <span className="grad">ochiq</span> ekran-vaqt qoidalari
              </h1>
              <p className="lead" style={{ maxWidth: "46ch" }}>
                Kunlik limit, dam olish soatlari va ilova cheklovlarini oddiy tilda boshqaring.
                Bola ham qoidalarni va qolgan vaqtни ko&apos;rib turadi — <b>yashirin kuzatuv emas</b>.
              </p>
              <div className="hero-cta">
                <a className="btn btn-primary btn-lg" href={SITE.downloadUrl}>{DownloadIcon}Windows uchun yuklab olish</a>
                <a className="btn btn-ghost btn-lg" href={SITE.signupUrl}>Bepul boshlash</a>
              </div>
              <p className="hero-note">
                Josuslik yoki jazolash vositasi emas
                <span className="sep" /> Offline ham ishlaydi
                <span className="sep" /> Bir necha bola va qurilma
              </p>
            </div>

            <div className="showcase">
              <div className="glass panel">
                <div className="panel-bar">
                  <i /><i /><i /><span>Bugun · Aziz</span>
                </div>
                <div className="tiles">
                  <div className="tile">
                    <div className="k">Bugungi ekran vaqti</div>
                    <div className="v">2s 40d</div>
                    <div className="meter"><i style={{ width: "66%" }} /></div>
                  </div>
                  <div className="tile">
                    <div className="k">Kunlik limit</div>
                    <div className="v">4 soat</div>
                    <div className="meter warn"><i style={{ width: "66%" }} /></div>
                  </div>
                </div>
                <div className="rows">
                  <div className="row">
                    <span className="app"><span className="chip-ico" style={{ background: "color-mix(in srgb, var(--brand) 15%, transparent)", color: "var(--brand)" }}>▲</span>Chrome</span>
                    <b>58 daq</b>
                  </div>
                  <div className="row">
                    <span className="app"><span className="chip-ico" style={{ background: "color-mix(in srgb, var(--accent) 16%, transparent)", color: "var(--accent-ink)" }}>◆</span>Minecraft</span>
                    <b>44 daq</b>
                  </div>
                  <div className="row">
                    <span className="app"><span className="chip-ico" style={{ background: "color-mix(in srgb, var(--warning) 18%, transparent)", color: "var(--warning)" }}>●</span>YouTube</span>
                    <b>31 daq</b>
                  </div>
                </div>
                <div className="strip">
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

        {/* TRUST STRIP */}
        <div className="trust">
          <div className="wrap trust-inner">
            <span className="trust-item"><Ico d="M12 2 4 5v6c0 5 3.4 9.4 8 10.6 4.6-1.2 8-5.6 8-10.6V5l-8-3Z" /> Shaffof rozilik</span>
            <span className="trust-item"><Ico d="M5 13l4 4L19 7" /> Klaviatura/skrinshot yozilmaydi</span>
            <span className="trust-item"><Ico d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /> Offline barqaror</span>
            <span className="trust-item"><Ico d="m22 3-9.5 9.5M22 3l-6.5 18-3.5-8-8-3.5L22 3Z" /> Telegram xabarlar</span>
          </div>
        </div>

        {/* PROMISES */}
        <section>
          <div className="wrap">
            <Reveal>
              <span className="eyebrow">Nega ChaqimchiAI</span>
              <h2>Uchta teng va&apos;da</h2>
            </Reveal>
            <div className="grid grid-3">
              {PROMISES.map((p, i) => (
                <Reveal as="article" className="glass card" key={p.title} delay={i * 80}>
                  <span className={`ico ${i === 2 ? "teal" : ""}`}><Ico d={p.icon} /></span>
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* TRANSPARENCY */}
        <section>
          <div className="wrap">
            <Reveal as="div" className="glass band">
              <div className="cols">
                <div>
                  <span className="eyebrow">Muhim</span>
                  <h2>Bu yashirin kuzatuv yoki jazolash vositasi emas</h2>
                  <p className="section-lead">
                    ChaqimchiAI oilalarga bola kompyuteridan foydalanish bo&apos;yicha
                    <b> ochiq kelishilgan </b> qoidalarni boshqarishga yordam beradi.
                  </p>
                </div>
                <ul className="checks">
                  <li><span className="tick"><Check /></span>Bola tray belgisi va status oynasi orqali agent borligini ko&apos;radi.</li>
                  <li><span className="tick"><Check /></span>Bloklash oynasi xushmuomala: «Bugungi vaqting tugadi, ertaga davom etasan».</li>
                  <li><span className="tick"><Check /></span>Klaviatura bosilishi, skrinshot, mikrofon, shaxsiy xabarlar — hech qachon yozilmaydi.</li>
                  <li><span className="tick"><Check /></span>Yig&apos;iladigan narsa: ilova nomi + foydalanish vaqti, qurilma holati, qoida hodisalari.</li>
                </ul>
              </div>
            </Reveal>
          </div>
        </section>

        {/* FEATURES */}
        <section id="imkoniyatlar">
          <div className="wrap">
            <Reveal>
              <span className="eyebrow">Imkoniyatlar</span>
              <h2>Bir panelda — hammasi sokin</h2>
              <p className="section-lead">Ota-ona web panelida yoki mobil ilovada. O&apos;zgarishlar qurilmaga o&apos;zi yetadi, offline ham ishlaydi.</p>
            </Reveal>
            <div className="grid grid-3">
              {FEATURES.map((f, i) => (
                <Reveal as="article" className="glass card" key={f.title} delay={(i % 3) * 80}>
                  <span className="ico"><Ico d={f.icon} /></span>
                  <span className="pill">{f.tag}</span>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* STEPS */}
        <section id="qanday">
          <div className="wrap">
            <Reveal>
              <span className="eyebrow">Qanday ishlaydi</span>
              <h2>Uch qadam — 5 daqiqa</h2>
            </Reveal>
            <div className="steps">
              {STEPS.map((s, i) => (
                <Reveal as="article" className="glass step" key={s.n} delay={i * 90}>
                  <span className="n">{s.n}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* CHILD SIDE */}
        <section id="bola">
          <div className="wrap">
            <Reveal>
              <span className="eyebrow">Bola tomoni</span>
              <h2>Bola ham xuddi shu qoidalarni ko&apos;radi</h2>
              <p className="section-lead">Ota-ona qoidani belgilaydi — bola qolgan vaqtни, cheklovlarni va nima kuzatilishini o&apos;z ekranida ko&apos;radi.</p>
            </Reveal>
            <div className="duo">
              <Reveal as="div" className="glass">
                <div className="cap"><span className="tag">Ota-ona</span> Web panel</div>
                <div className="tiles">
                  <div className="tile"><div className="k">Haftalik o&apos;rtacha</div><div className="v">3s 10d</div><div className="meter"><i style={{ width: "52%" }} /></div></div>
                  <div className="tile"><div className="k">Cheklangan ilova</div><div className="v">2 ta</div></div>
                </div>
                <div className="rows" style={{ marginTop: 13 }}>
                  <div className="row"><span className="app"><span className="chip-ico" style={{ background: "color-mix(in srgb, var(--warning) 18%, transparent)", color: "var(--warning)" }}>!</span>Limit tugadi — Aziz</span><b>19:40</b></div>
                  <div className="row"><span className="app"><span className="chip-ico" style={{ background: "color-mix(in srgb, var(--brand) 15%, transparent)", color: "var(--brand)" }}>◷</span>Dam olish vaqti boshlandi</span><b>22:00</b></div>
                </div>
              </Reveal>
              <Reveal as="div" className="glass" delay={100}>
                <div className="cap"><span className="tag">Bola</span> Windows ekrani</div>
                <div className="block-mock">
                  <span className="em">🌙</span>
                  <strong>Bugungi ekran vaqting tugadi</strong>
                  <span>Ertaga davom etasan! Savoling bo&apos;lsa, ota-onangga murojaat qil.</span>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* STATS + QUOTE */}
        <section>
          <div className="wrap">
            <div className="stats">
              <Reveal as="div" className="glass stat"><div className="big grad">5&nbsp;daq</div><div className="lbl">o&apos;rnatishdan birinchi qoidagacha</div></Reveal>
              <Reveal as="div" className="glass stat" delay={80}><div className="big grad">0</div><div className="lbl">skrinshot, klaviatura yoki mikrofon</div></Reveal>
              <Reveal as="div" className="glass stat" delay={160}><div className="big grad">24/7</div><div className="lbl">offline ham qoidalar qo&apos;llanadi</div></Reveal>
            </div>
            <Reveal as="div" className="glass quote">
              <div className="mark">&ldquo;</div>
              <p>Farzandim bilan &laquo;dastur seni kuzatyapti&raquo; deb janjallashmaymiz — u ham ekranida qoidani ko&apos;rib turadi. Bu kelishuvni osonlashtirdi.</p>
              <div className="by">— Beta sinovidagi ota-ona</div>
            </Reveal>
          </div>
        </section>

        {/* PLATFORMS */}
        <section id="platformalar">
          <div className="wrap">
            <Reveal>
              <span className="eyebrow">Platformalar</span>
              <h2>Bola qurilmasida yengil agent, ota-onada to&apos;liq panel</h2>
            </Reveal>
            <div className="grid grid-2">
              <Reveal as="article" className="glass plat">
                <span className="ico"><Ico d="M4 5h16v11H4zM2 20h20M9 20v-4M15 20v-4" /></span>
                <div>
                  <small>Bola qurilmasi</small>
                  <h3 style={{ marginTop: 4 }}>Windows agent</h3>
                  <p>Windows xizmati sifatida ishlaydi, qoidalarni lokal qo&apos;llaydi. Tray status oynasi, xushmuomala bloklash ekrani, OTA orqali avto-yangilanish.</p>
                </div>
              </Reveal>
              <Reveal as="article" className="glass plat" delay={100}>
                <span className="ico teal"><Ico d="M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM11 18h2" /></span>
                <div>
                  <small>Ota-ona</small>
                  <h3 style={{ marginTop: 4 }}>Web panel + mobil ilova</h3>
                  <p>Kundalik holat, faoliyat, qoidalar va alertlar. Telegram bot orqali panelni ochmasdan nazorat. Bir nechta bola va qurilma.</p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="narx">
          <div className="wrap center">
            <Reveal>
              <span className="eyebrow">Narx</span>
              <h2>MVP/Beta davrida bepul</h2>
            </Reveal>
            <Reveal as="div" className="price">
              <div className="price-inner">
                <div className="amt">0 <span>so&apos;m / oy</span></div>
                <p>Sinov davri. Keyinchalik oilaviy obuna bo&apos;ladi — mavjud foydalanuvchilarni oldindan xabardor qilamiz.</p>
                <ul>
                  <li><Check /> Cheksiz qoidalar: limit, dam olish vaqti, ilova cheklovlari</li>
                  <li><Check /> Bir nechta bola va qurilma</li>
                  <li><Check /> Faoliyat tarixi + CSV eksport</li>
                  <li><Check /> Telegram bot va kunlik hisobot</li>
                  <li><Check /> Avtomatik yangilanishlar</li>
                </ul>
                <a className="btn btn-primary btn-lg" href={SITE.signupUrl} style={{ width: "100%", justifyContent: "center" }}>Bepul boshlash</a>
              </div>
            </Reveal>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq">
          <div className="wrap" style={{ maxWidth: 800 }}>
            <Reveal>
              <span className="eyebrow">FAQ</span>
              <h2>Ko&apos;p beriladigan savollar</h2>
            </Reveal>
            <Reveal as="div" className="faq">
              {FAQ.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </Reveal>
          </div>
        </section>

        {/* FINAL CTA */}
        <section>
          <div className="wrap">
            <Reveal as="div" className="glass cta">
              <h2>Bugundanoq ochiq qoidalar bilan boshlang</h2>
              <p className="section-lead" style={{ marginInline: "auto" }}>
                Windows dasturini yuklab oling, qurilmani QR bilan bog&apos;lang va birinchi qoidani belgilang.
              </p>
              <div className="hero-cta">
                <a className="btn btn-primary btn-lg" href={SITE.downloadUrl}>{DownloadIcon}Windows uchun yuklab olish</a>
                <a className="btn btn-ghost btn-lg" href={SITE.botUrl}>Telegram bot</a>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap foot-grid">
          <div>
            <div className="brand" style={{ marginBottom: 10 }}>
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
