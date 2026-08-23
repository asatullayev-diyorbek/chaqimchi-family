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
        {children}
      </main>
    </>
  );
}
