import Link from "next/link";

export default function NotFound() {
  return (
    <div className="auth-page">
      <div className="auth-shell" style={{ justifyContent: "center" }}>
        <div className="auth-card" style={{ maxWidth: 440, textAlign: "center", gap: "1.25rem" }}>
          <div
            style={{
              width: 64,
              height: 64,
              margin: "0 auto",
              display: "grid",
              placeItems: "center",
              borderRadius: 20,
              background: "var(--cat-blue-bg)",
              color: "var(--brand-blue)",
            }}
          >
            <iconify-icon icon="solar:map-arrow-square-linear" style={{ fontSize: 30 }}></iconify-icon>
          </div>

          <div className="auth-form-heading">
            <h2>Sahifa topilmadi</h2>
            <p>Siz izlagan sahifa mavjud emas yoki ko&apos;chirilgan bo&apos;lishi mumkin.</p>
          </div>

          <Link href="/overview" className="btn-primary auth-submit" style={{ textDecoration: "none" }}>
            <iconify-icon icon="solar:home-2-linear"></iconify-icon>
            Bosh sahifaga qaytish
          </Link>
        </div>
      </div>
    </div>
  );
}
