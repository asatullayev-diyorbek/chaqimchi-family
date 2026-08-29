"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import Header from "./Header";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDeviceDetail = pathname.startsWith("/devices/") && pathname !== "/devices";

  return (
    <>
      <Sidebar />
      <main className="content">
        {!isDeviceDetail && (
          <Suspense fallback={null}>
            <Header />
          </Suspense>
        )}
        {/* Keyed on the route so the content area — and only the content
            area — replays its short fade when you switch pages. The shell
            around it stays mounted. */}
        <div key={pathname} className="page-transition">
          {children}
        </div>
      </main>
    </>
  );
}
