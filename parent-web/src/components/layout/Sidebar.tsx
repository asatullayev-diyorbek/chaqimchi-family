"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getCurrentUser } from "@/api/auth";

type NavItem = {
  label: string;
  href: string;
  icon: string;
  enabled: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Bosh sahifa", href: "/overview", icon: "🏠", enabled: true },
  { label: "Faoliyat", href: "/activity", icon: "📈", enabled: true },
  { label: "Qurilmalar", href: "/devices", icon: "🖥️", enabled: true },
  { label: "Alertlar", href: "/alerts", icon: "🔔", enabled: false },
  { label: "Qoidalar", href: "/rules", icon: "🛡️", enabled: false },
  { label: "Hisobotlar", href: "/reports", icon: "📄", enabled: false },
  { label: "Sozlamalar", href: "/settings", icon: "⚙️", enabled: false },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser()
      .then((user) => setEmail(user.email))
      .catch(() => setEmail(null));
  }, []);

  return (
    <nav
      className="glass-sidebar"
      style={{
        width: 240,
        flexShrink: 0,
        color: "var(--sidebar-fg)",
        minHeight: "100vh",
        padding: "24px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div
        style={{
          padding: "0 12px 24px",
          fontSize: 18,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span aria-hidden>🛡️</span> ChaqimchiAI
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
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
              title="Keyingi bosqichda qo'shiladi"
            >
              <span aria-hidden style={{ opacity: 0.6 }}>{item.icon}</span>
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
              display: "flex",
              alignItems: "center",
              gap: 10,
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
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}

      <div
        style={{
          marginTop: 20,
          padding: 16,
          borderRadius: 16,
          background: "rgba(0,0,0,0.18)",
          border: "1px solid rgba(255,255,255,0.1)",
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          Farzandingiz xavfsizligi biz uchun muhim
        </div>
        <div style={{ color: "var(--sidebar-disabled)" }}>
          Doimo nazoratda, doimo xotirjam.
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <div
        style={{
          padding: "12px",
          borderTop: "1px solid rgba(255,255,255,0.12)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 13,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.14)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            flexShrink: 0,
          }}
          aria-hidden
        >
          {email ? email[0].toUpperCase() : "?"}
        </div>
        <div style={{ overflow: "hidden" }}>
          <div
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontWeight: 600,
            }}
          >
            {email ?? "Yuklanmoqda..."}
          </div>
          <div style={{ color: "var(--sidebar-disabled)", fontSize: 12 }}>Ota-ona</div>
        </div>
      </div>
    </nav>
  );
}
