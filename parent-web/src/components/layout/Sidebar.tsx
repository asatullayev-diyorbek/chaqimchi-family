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
  { label: "Faoliyat", href: "/activity", enabled: false },
  { label: "Alertlar", href: "/alerts", enabled: false },
  { label: "Qoidalar", href: "/rules", enabled: false },
  { label: "Qurilmalar", href: "/devices", enabled: false },
  { label: "Sozlamalar", href: "/settings", enabled: false },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        width: 220,
        flexShrink: 0,
        background: "var(--sidebar-bg)",
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
              background: active ? "rgba(255,255,255,0.12)" : "transparent",
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
