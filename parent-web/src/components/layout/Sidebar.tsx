"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getCurrentUser } from "@/api/auth";

type NavItem = {
  label: string;
  href: string;
  enabled: boolean;
  icon: React.ReactNode;
};

const iconProps = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none" as const };

const NAV_ITEMS: NavItem[] = [
  {
    label: "Bosh sahifa",
    href: "/overview",
    enabled: true,
    icon: (
      <svg {...iconProps}>
        <path d="M3 10.5 12 3l9 7.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 9.5V20h14V9.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 20v-5h4v5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Faoliyat",
    href: "/activity",
    enabled: true,
    icon: (
      <svg {...iconProps}>
        <path d="M3 12h4l3 7 4-14 3 7h4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Qurilmalar",
    href: "/devices",
    enabled: true,
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="4" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.9" />
        <path d="M8 20h8M12 16v4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Alertlar",
    href: "/alerts",
    enabled: false,
    icon: (
      <svg {...iconProps}>
        <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Qoidalar",
    href: "/rules",
    enabled: false,
    icon: (
      <svg {...iconProps}>
        <rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="1.9" />
        <path d="M8 12l3 3 5-6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Sozlamalar",
    href: "/settings",
    enabled: false,
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.9" />
        <path
          d="M12 3v3M12 18v3M3 12h3M18 12h3M5.5 5.5l2 2M16.5 16.5l2 2M18.5 5.5l-2 2M7.5 16.5l-2 2"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    label: "Hisobotlar",
    href: "/reports",
    enabled: false,
    icon: (
      <svg {...iconProps}>
        <path d="M6 3h9l4 4v14H6z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
        <path d="M14 3v4h4M9 13h6M9 17h6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    ),
  },
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
    <aside
      className="glass-sidebar"
      style={{
        width: 236,
        flexShrink: 0,
        height: "100%",
        padding: "20px 16px",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 6px 20px" }}>
        <div
          style={{
            width: 44,
            height: 44,
            flexShrink: 0,
            borderRadius: 13,
            background: "linear-gradient(150deg,#3ad0b3,#2aa9c9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 6px 14px rgba(45,180,190,.35)",
          }}
        >
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <path d="M12 4L2 9l10 5 8-4v6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6 12.5V16c0 1.1 2.7 2.5 6 2.5s6-1.4 6-2.5v-3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ lineHeight: 1.15 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: "#1f2b3a" }}>
            Chaqimchi<span style={{ color: "#2fbfa6" }}>AI</span>
          </div>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#7d8a9c" }}>Family</div>
        </div>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {NAV_ITEMS.map((item) => {
          const active = item.enabled && pathname?.startsWith(item.href);
          const rowStyle: React.CSSProperties = {
            display: "flex",
            alignItems: "center",
            gap: 13,
            padding: "12px 14px",
            borderRadius: 14,
            fontWeight: active ? 700 : 600,
            fontSize: 15,
            color: active ? "var(--sidebar-active-fg)" : item.enabled ? "var(--sidebar-fg)" : "var(--sidebar-disabled)",
            background: active ? "var(--sidebar-active-bg)" : "transparent",
            border: active ? "1px solid var(--sidebar-active-border)" : "1px solid transparent",
            cursor: item.enabled ? "pointer" : "not-allowed",
          };

          if (!item.enabled) {
            return (
              <div key={item.href} aria-disabled="true" title="Keyingi bosqichda qo'shiladi" style={rowStyle}>
                {item.icon}
                {item.label}
              </div>
            );
          }

          return (
            <Link key={item.href} href={item.href} style={rowStyle}>
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div
        style={{
          marginTop: 20,
          borderRadius: 20,
          padding: "18px 16px 0",
          background: "linear-gradient(160deg,#8b7bf0,#6f8dfb)",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 12px 26px rgba(120,110,220,.3)",
        }}
      >
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={{ marginBottom: 8 }}>
          <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>
          Farzandingiz xavfsizligi biz uchun muhim
        </div>
        <div style={{ color: "rgba(255,255,255,.82)", fontSize: 12.5, marginTop: 8, lineHeight: 1.4 }}>
          Doimo nazoratda,
          <br />
          doimo xotirjam.
        </div>
        <svg width={200} height={96} viewBox="0 0 200 96" style={{ display: "block", margin: "6px auto -4px" }} fill="none">
          <g fill="rgba(30,40,90,.42)">
            <circle cx="60" cy="30" r="13" />
            <path d="M42 92c0-13 8-24 18-24s18 11 18 24z" />
            <circle cx="140" cy="28" r="14" />
            <path d="M120 92c0-14 9-26 20-26s20 12 20 26z" />
            <circle cx="92" cy="46" r="10" />
            <path d="M78 92c0-9 6-17 14-17s14 8 14 17z" />
            <circle cx="116" cy="48" r="9" />
            <path d="M104 92c0-8 5-15 12-15s12 7 12 15z" />
          </g>
        </svg>
      </div>

      <div style={{ flex: 1 }} />

      <div
        style={{
          marginTop: 16,
          display: "flex",
          alignItems: "center",
          gap: 11,
          padding: 10,
          background: "rgba(255,255,255,.6)",
          border: "1px solid rgba(255,255,255,.8)",
          borderRadius: 16,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: 12,
            background: "linear-gradient(140deg,#7d8ff6,#a488f2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 700,
            fontSize: 16,
          }}
          aria-hidden
        >
          {email ? email[0].toUpperCase() : "?"}
        </div>
        <div style={{ flex: 1, lineHeight: 1.2, overflow: "hidden" }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 14,
              color: "#22303f",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {email ?? "Yuklanmoqda..."}
          </div>
          <div style={{ fontSize: 12, color: "#8593a4" }}>Ota-ona</div>
        </div>
      </div>
    </aside>
  );
}
