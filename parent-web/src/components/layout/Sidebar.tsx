"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentUser, logout } from "@/api/auth";

type NavItem = { label: string; href?: string; icon: string; };

const NAV_ITEMS: NavItem[] = [
  { label: "Bosh sahifa", href: "/overview", icon: "hugeicons:home-03" },
  { label: "Faoliyat", href: "/activity", icon: "hugeicons:activity-01" },
  { label: "Qurilmalar", href: "/devices", icon: "hugeicons:computer" },
  { label: "Sozlamalar", href: "/rules", icon: "hugeicons:settings-02" },
  { label: "Hisobotlar", icon: "hugeicons:chart-histogram" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => { getCurrentUser().then((user) => setEmail(user.email)).catch(() => setEmail(null)); }, []);
  const name = email?.split("@")[0] || "Abdulvosit";

  function onLogout(e: React.MouseEvent) {
    e.preventDefault();
    logout();
    router.replace("/login");
  }

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="logo">
        <Image src="/assets/logo.png" alt="ChaqimchiAI" width={48} height={48} priority />
        <div>
          <h3>ChaqimchiAI</h3>
          <span>Family</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="menu">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href && pathname?.startsWith(item.href);
          const className = `menu-item ${isActive ? "active" : ""}`;

          if (item.href) {
            return (
              <Link key={item.label} href={item.href} className={className}>
                <div className="left">
                  <iconify-icon icon={item.icon}></iconify-icon>
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          }

          return (
            <div key={item.label} className={className} style={{ opacity: 0.5, cursor: "not-allowed" }} title="Tez orada">
              <div className="left">
                <iconify-icon icon={item.icon}></iconify-icon>
                <span>{item.label}</span>
              </div>
            </div>
          );
        })}
      </nav>

      {/* User */}
      <div className="profile">
        <div className="profile-image">
                  <Image src="/assets/profile.png" alt="" width={40} height={40} />
        </div>
        <div className="profile-info">
          <h4>{name}</h4>
          <span>Ota-ona</span>
        </div>
        
        <div className="profile-menu-wrap">
          <button className="profile-menu">
            <iconify-icon icon="hugeicons:more-horizontal"></iconify-icon>
          </button>
          
          <div className="profile-dropdown">
            <Link href="#profil" className="profile-dropdown-item">
              <iconify-icon icon="hugeicons:user-circle"></iconify-icon>
              <span>Profil</span>
            </Link>
            <a href="#" className="profile-dropdown-item logout" onClick={onLogout}>
              <iconify-icon icon="hugeicons:logout-03"></iconify-icon>
              <span>Chiqish</span>
            </a>
          </div>
        </div>
      </div>
    </aside>
  );
}
