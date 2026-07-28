"use client";

import { useRouter } from "next/navigation";
import { logout } from "@/api/auth";

export default function Header() {
  const router = useRouter();

  function onLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 16,
        padding: "16px 32px",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      <button
        onClick={onLogout}
        style={{
          border: "1px solid var(--border)",
          background: "transparent",
          borderRadius: 8,
          padding: "8px 14px",
          fontSize: 14,
          color: "var(--muted)",
          cursor: "pointer",
        }}
      >
        Chiqish
      </button>
    </header>
  );
}
