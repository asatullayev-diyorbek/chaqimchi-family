import Link from "next/link";
import { SITE } from "@/lib/site";

export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="nav nav-scrolled">
        <div className="wrap nav-inner">
          <Link className="brand" href="/">
            <span className="brand-mark">C</span>
            ChaqimchiAI Family
          </Link>
          <div className="nav-cta">
            <Link className="btn btn-ghost" href="/">Bosh sahifa</Link>
          </div>
        </div>
      </header>
      <main className="wrap legal">
        <h1>{title}</h1>
        <p className="legal-updated">Oxirgi yangilanish: {updated}</p>
        {children}
        <p className="legal-contact">
          Savollar: <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>
        </p>
      </main>
      <footer>
        <div className="wrap foot-grid">
          <div>© {new Date().getFullYear()} ChaqimchiAI · Toshkent</div>
          <div className="foot-links">
            <Link href="/">Bosh sahifa</Link>
            <Link href={SITE.privacyUrl}>Maxfiylik</Link>
            <Link href={SITE.termsUrl}>Shartlar</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
