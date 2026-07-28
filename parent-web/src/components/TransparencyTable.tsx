// Verbatim content from docs/chaqimchiai-family-bola-ilova-dizayn-talablari.md
// (4.5-bo'lim) and docs/chaqimchiai-family-ornatuvchi-dizayn-talablari.md
// (3.2-bo'lim, "so'zma-so'z bir xil mazmun" requirement) — do not paraphrase
// these lists if this component is ever edited; the two docs are explicit
// that the wording must match across mobile/bola/o'rnatuvchi/desktop.
const WE_SEE = ["Qaysi ilova ishlatilgani", "Qaysi saytga kirilgani (sayt nomi)", "Ekran vaqti"];
const WE_DONT_SEE = ["Yozgan xabarlaring", "Parollaring", "Kamera/mikrofon", "Bosgan tugmalaring"];

export default function TransparencyTable() {
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
        Nimani ko&apos;ramiz, nimani ko&apos;rmaymiz
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div
          className="glass-solid-well"
          style={{
            padding: 16,
          }}
        >
          <div style={{ fontWeight: 600, color: "var(--accent-dark)", marginBottom: 8 }}>
            Ko&apos;ramiz
          </div>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
            {WE_SEE.map((item) => (
              <li key={item} style={{ display: "flex", gap: 8, fontSize: 14 }}>
                <span style={{ color: "var(--accent-dark)" }}>✓</span> {item}
              </li>
            ))}
          </ul>
        </div>
        <div
          className="glass-solid-well"
          style={{
            padding: 16,
          }}
        >
          <div style={{ fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>
            Ko&apos;rmaymiz
          </div>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
            {WE_DONT_SEE.map((item) => (
              <li key={item} style={{ display: "flex", gap: 8, fontSize: 14 }}>
                <span style={{ color: "var(--muted)" }}>✕</span> {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p style={{ marginTop: 12, fontSize: 13, color: "var(--muted)" }}>
        Bu ilova farzandingiz xavfsizligi uchun, va biz nimani ko&apos;rsak ham ochiq aytamiz.
      </p>
    </div>
  );
}
