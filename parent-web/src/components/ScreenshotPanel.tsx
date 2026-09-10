"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import Modal from "@/components/Modal";
import {
  deleteScreenshot,
  isPending,
  listScreenshots,
  requestScreenshot,
  RETENTION_LABEL,
  type Screenshot,
  type ScreenshotRetention,
} from "@/api/screenshots";

const RETENTION_ORDER: ScreenshotRetention[] = ["day", "week", "month"];
const POLL_MS = 3500;

function expiryLabel(iso: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "muddati tugadi";
  const days = Math.round(ms / 86_400_000);
  if (days >= 1) return `${days} kun qoldi`;
  const hours = Math.max(1, Math.round(ms / 3_600_000));
  return `${hours} soat qoldi`;
}

export default function ScreenshotPanel({
  deviceId,
  online,
}: {
  deviceId: string;
  online: boolean;
}) {
  const [shots, setShots] = useState<Screenshot[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [viewing, setViewing] = useState<Screenshot | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      setShots(await listScreenshots(deviceId));
    } catch {
      /* secondary content — keep the last good list */
    }
  }, [deviceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const waiting = shots.some(isPending);
  useEffect(() => {
    if (waiting && !timer.current) {
      timer.current = setInterval(refresh, POLL_MS);
    } else if (!waiting && timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, [waiting, refresh]);

  const submit = useCallback(
    async (retention: ScreenshotRetention) => {
      setPickerOpen(false);
      setRequesting(true);
      try {
        await requestScreenshot(deviceId, retention);
        await refresh();
        toast.success("So‘rov yuborildi");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "So‘rov yuborilmadi");
      } finally {
        setRequesting(false);
      }
    },
    [deviceId, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      setViewing(null);
      try {
        await deleteScreenshot(id);
        setShots((prev) => prev.filter((s) => s.id !== id));
        toast.success("O‘chirildi");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "O‘chirilmadi");
      }
    },
    [],
  );

  const ready = shots.filter((s) => s.status === "uploaded" && s.url);
  const failed = shots.filter((s) => s.status === "failed");

  return (
    <div className="card">
      <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <iconify-icon icon="solar:camera-linear"></iconify-icon>
        Ekran rasmi
      </h3>
      <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 14px" }}>
        Faqat siz so‘raganda olinadi. Farzand har safar buni ko‘radi — qurilmasida
        bildirishnoma chiqadi. Rasm tanlangan muddat o‘tgach o‘chiriladi.
      </p>

      <button
        className="primary-btn"
        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        disabled={!online || requesting}
        onClick={() => setPickerOpen(true)}
      >
        <iconify-icon icon="solar:camera-linear"></iconify-icon>
        {online
          ? requesting
            ? "So‘ralmoqda..."
            : "Ekran rasmini olish"
          : "Qurilma onlayn bo‘lganda mumkin"}
      </button>

      {waiting && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 14,
            padding: 12,
            borderRadius: 10,
            background: "var(--border)",
            fontSize: 14,
            color: "var(--muted)",
          }}
        >
          <iconify-icon icon="solar:hourglass-line-linear"></iconify-icon>
          Kutilmoqda — farzand qurilmasidan so‘ralmoqda. Bir necha soniyada tayyor bo‘ladi.
        </div>
      )}

      {failed.map((s) => (
        <div
          key={s.id}
          style={{ marginTop: 10, color: "var(--danger)", fontSize: 13, display: "flex", gap: 6 }}
        >
          <iconify-icon icon="solar:danger-triangle-linear"></iconify-icon>
          Rasm olinmadi{s.error ? ` — ${s.error}` : ""}
        </div>
      ))}

      {ready.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: 12,
            marginTop: 16,
          }}
        >
          {ready.map((s) => (
            <button
              key={s.id}
              onClick={() => setViewing(s)}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 10,
                overflow: "hidden",
                padding: 0,
                background: "var(--border)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.url!}
                alt="Ekran rasmi"
                style={{ width: "100%", aspectRatio: "16 / 10", objectFit: "cover", display: "block" }}
              />
              <span style={{ display: "block", padding: "6px 8px", fontSize: 12, color: "var(--muted)" }}>
                {expiryLabel(s.expires_at)}
              </span>
            </button>
          ))}
        </div>
      ) : !waiting ? (
        <p className="muted-sm" style={{ marginTop: 14, fontStyle: "italic" }}>
          Hali ekran rasmi olinmagan.
        </p>
      ) : null}

      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Rasm qancha saqlansin?"
        maxWidth={380}
      >
        <div style={{ display: "grid", gap: 8 }}>
          {RETENTION_ORDER.map((r) => (
            <button
              key={r}
              className="add-device-btn outline"
              style={{ justifyContent: "space-between", display: "flex" }}
              onClick={() => submit(r)}
            >
              <span>{RETENTION_LABEL[r]}</span>
              {r === "week" && <span style={{ color: "var(--muted)", fontSize: 12 }}>tavsiya etiladi</span>}
            </button>
          ))}
        </div>
      </Modal>

      {viewing && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setViewing(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.92)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 20px",
              color: "#fff",
            }}
          >
            <button
              onClick={() => setViewing(null)}
              style={{ background: "none", border: 0, color: "#fff", cursor: "pointer", fontSize: 22 }}
              aria-label="Yopish"
            >
              <iconify-icon icon="solar:close-circle-linear"></iconify-icon>
            </button>
            <span style={{ fontSize: 13, opacity: 0.7 }}>{expiryLabel(viewing.expires_at)}</span>
            <button
              onClick={() => remove(viewing.id)}
              style={{ background: "none", border: 0, color: "#fff", cursor: "pointer", fontSize: 20 }}
              aria-label="O‘chirish"
            >
              <iconify-icon icon="solar:trash-bin-trash-linear"></iconify-icon>
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={viewing.url!}
            alt="Ekran rasmi"
            onClick={(e) => e.stopPropagation()}
            style={{ flex: 1, minHeight: 0, objectFit: "contain", width: "100%", padding: "0 12px 16px" }}
          />
        </div>
      )}
    </div>
  );
}
