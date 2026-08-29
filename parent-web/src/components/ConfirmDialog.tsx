"use client";

import Modal from "@/components/Modal";

/**
 * Branded stand-in for window.confirm(). Beyond looking like the rest of the
 * app, it can show a pending state — the native dialog returns instantly and
 * left the caller with no way to block a second click on a slow request.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Tasdiqlash",
  cancelLabel = "Bekor qilish",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      // Escape and the overlay must not dismiss a request already in flight.
      onClose={busy ? () => {} : onCancel}
      title={title}
      maxWidth={420}
      footer={
        <>
          <button type="button" className="add-device-btn outline" onClick={onCancel} disabled={busy} style={{ flex: 1 }}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="add-device-btn primary"
            onClick={onConfirm}
            disabled={busy}
            style={{ flex: 1, ...(danger ? { background: "var(--danger)", borderColor: "var(--danger)" } : {}) }}
          >
            {busy ? "Bajarilmoqda..." : confirmLabel}
          </button>
        </>
      }
    >
      <div className="add-device-body">
        <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, margin: 0 }}>{message}</p>
      </div>
    </Modal>
  );
}
