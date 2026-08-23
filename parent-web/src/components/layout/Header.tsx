"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getCurrentUser } from "@/api/auth";
import TopbarActions from "./TopbarActions";

export default function Header() {
  const pathname = usePathname();
  const [parentName, setParentName] = useState("Abdulvosit");

  useEffect(() => {
    getCurrentUser()
      .then((user) => setParentName(user.full_name || user.username || user.email?.split("@")[0] || "Abdulvosit"))
      .catch(() => undefined);
  }, []);

  return (
    <header className="topbar">
      <div className="welcome">
        {pathname === "/overview" && (
          <>
            <h1>Xush kelibsiz, {parentName}! 👋</h1>
            <p>
              Farzandingizning bugungi holati:
              <span className="safe-badge">
                <iconify-icon icon="solar:shield-check-linear"></iconify-icon>
                Xavfsiz
              </span>
            </p>
          </>
        )}
        {pathname === "/activity" && (
          <>
            <h1>Faoliyat</h1>
            <p>Farzandingizning raqamli faoliyatini kuzatib boring.</p>
          </>
        )}
        {pathname === "/devices" && (
          <>
            <h1>Qurilmalar</h1>
            <p>Farzandingiz foydalanayotgan barcha qurilmalar.</p>
          </>
        )}
        {pathname === "/settings" && (
          <>
            <h1>Sozlamalar</h1>
            <p>Tizim va akkaunt sozlamalari.</p>
          </>
        )}
        {pathname === "/rules" && (
          <>
            <h1>Qoidalar</h1>
            <p>Vaqt va bloklash qoidalarini boshqaring.</p>
          </>
        )}
        {pathname === "/alerts" && (
          <>
            <h1>Ogohlantirishlar</h1>
            <p>Xavfli yoki taqiqlangan harakatlar haqida xabarlar.</p>
          </>
        )}
        {!["/overview", "/activity", "/devices", "/settings", "/rules", "/alerts"].includes(pathname) && (
          <>
            <h1>Sergak AI</h1>
            <p>Farzandingiz xavfsizligi sizning qo'lingizda</p>
          </>
        )}
      </div>

      <TopbarActions />
    </header>
  );
}
