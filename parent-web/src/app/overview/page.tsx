"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { getAccessToken } from "@/api/client";
import { Device, DeviceSummary, getDevices, getSummary } from "@/api/tracking";

type DeviceWithSummary = Device & { summary: DeviceSummary | null };

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}d`;
  return `${hours}s ${mins}d`;
}

export default function OverviewPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<DeviceWithSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }

    (async () => {
      try {
        const list = await getDevices();
        const withSummaries = await Promise.all(
          list.map(async (device) => {
            if (device.status !== "linked") {
              return { ...device, summary: null };
            }
            try {
              return { ...device, summary: await getSummary(device.id) };
            } catch {
              return { ...device, summary: null };
            }
          })
        );
        setDevices(withSummaries);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ma'lumotlar yangilanmadi, birozdan keyin qayta urinib ko'ring");
      }
    })();
  }, [router]);

  return (
    <AppShell>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Bosh sahifa</h1>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      {devices === null && !error && <p style={{ color: "var(--muted)" }}>Yuklanmoqda...</p>}

      {devices && devices.length === 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 16,
            maxWidth: 700,
          }}
        >
          <AddDeviceCard />
        </div>
      )}

      {devices && devices.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 16,
            maxWidth: 900,
          }}
        >
          {devices.map((device) => (
            <DeviceCard key={device.id} device={device} />
          ))}
          <AddDeviceCard />
        </div>
      )}
    </AppShell>
  );
}

function DeviceCard({ device }: { device: DeviceWithSummary }) {
  const isOnline = device.summary?.device_status === "online";
  return (
    <Link
      href={`/activity?device=${device.id}`}
      style={{
        border: "1px solid var(--border)",
        borderRadius: 16,
        background: "var(--surface)",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--foreground)" }}>
        {device.child_name || "Qurilma"}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)" }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            background: isOnline ? "var(--accent)" : "var(--sidebar-disabled)",
            display: "inline-block",
          }}
        />
        {device.status !== "linked" ? "Bog'lanmagan" : isOnline ? "Onlayn" : "Oflayn"}
      </div>
      {device.summary && (
        <div style={{ fontSize: 24, fontWeight: 700 }}>
          {formatMinutes(device.summary.total_screen_minutes)}
          <span style={{ fontSize: 12, fontWeight: 400, color: "var(--muted)", marginLeft: 6 }}>
            bugungi
          </span>
        </div>
      )}
    </Link>
  );
}

function AddDeviceCard() {
  return (
    <Link
      href="/devices"
      style={{
        border: "1px dashed var(--border)",
        borderRadius: 16,
        background: "transparent",
        padding: 20,
        minHeight: 110,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--muted)",
        fontSize: 14,
      }}
    >
      + Qurilma qo&apos;shish
    </Link>
  );
}
