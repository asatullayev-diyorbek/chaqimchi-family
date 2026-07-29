"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  label: string;
  href: string;
  enabled: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Bosh sahifa", href: "/overview", enabled: true },
  { label: "Faoliyat", href: "/activity", enabled: true },
  { label: "Alertlar", href: "/alerts", enabled: false },
  { label: "Qoidalar", href: "/rules", enabled: false },
  { label: "Qurilmalar", href: "/devices", enabled: true },
  { label: "Sozlamalar", href: "/settings", enabled: false },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      className="glass-sidebar"
      style={{
        width: 220,
        flexShrink: 0,
        color: "var(--sidebar-fg)",
        minHeight: "100vh",
        padding: "24px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ padding: "0 12px 24px", fontSize: 18, fontWeight: 700 }}>
        ChaqimchiAI
      </div>
      {NAV_ITEMS.map((item) => {
        const active = item.enabled && pathname?.startsWith(item.href);
        if (!item.enabled) {
          return (
            <div
              key={item.href}
              aria-disabled="true"
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                color: "var(--sidebar-disabled)",
                cursor: "not-allowed",
                fontSize: 14,
              }}
              title="Keyingi bosqichda qo'shiladi"
            >
              {item.label}
            </div>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: active ? 600 : 400,
              // The text here is light (--sidebar-fg), so a WHITE highlight
              // overlay actively hurts contrast — it lightens the dark
              // backdrop the light text needs. Measured that mistake
              // directly (0.12 white -> 4.16:1 worst-case, 0.24 white ->
              // 3.15:1, i.e. worse). A dark overlay is what actually
              // reliably darkens the sidebar's variable glass backdrop
              // regardless of which blob is behind it at that point.
              background: active ? "rgba(0,0,0,0.28)" : "transparent",
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
