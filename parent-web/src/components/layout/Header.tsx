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
        padding: "4px 4px 0",
      }}
    >
      <button
        onClick={onLogout}
        style={{
          border: "1px solid rgba(0,0,0,.08)",
          background: "#fff",
          borderRadius: 12,
          padding: "9px 16px",
          fontSize: 13.5,
          fontWeight: 600,
          color: "var(--foreground)",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(90,120,170,.1)",
        }}
      >
        Chiqish
      </button>
    </header>
  );
}
