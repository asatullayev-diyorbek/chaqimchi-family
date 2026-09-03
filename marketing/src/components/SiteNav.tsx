"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NAV_LINKS, SITE } from "@/lib/site";

export default function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll while the mobile sheet is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className={`nav ${scrolled ? "nav-scrolled" : ""}`}>
      <div className="wrap nav-inner">
        <Link className="brand" href="/" onClick={() => setOpen(false)}>
          <span className="brand-mark">C</span>
          ChaqimchiAI Family
        </Link>

        <nav className="nav-links">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href}>{l.label}</a>
          ))}
        </nav>

        <div className="nav-cta">
          <a className="btn btn-ghost" href={SITE.loginUrl}>Kirish</a>
          <a className="btn btn-primary" href={SITE.downloadUrl}>
            <iconify-icon icon="solar:download-minimalistic-linear" aria-hidden />
            Yuklab olish
          </a>
        </div>

        <button
          className="nav-burger"
          aria-label={open ? "Menyuni yopish" : "Menyuni ochish"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <iconify-icon icon={open ? "solar:close-square-linear" : "solar:hamburger-menu-linear"} aria-hidden />
        </button>
      </div>

      <div className={`nav-sheet ${open ? "open" : ""}`} onClick={() => setOpen(false)}>
        <div className="nav-sheet-inner" onClick={(e) => e.stopPropagation()}>
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</a>
          ))}
          <div className="nav-sheet-cta">
            <a className="btn btn-ghost" href={SITE.loginUrl}>Kirish</a>
            <a className="btn btn-primary" href={SITE.downloadUrl}>
              <iconify-icon icon="solar:download-minimalistic-linear" aria-hidden />
              Yuklab olish
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
