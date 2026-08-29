"use client";

import { RefObject, useCallback, useEffect, useState } from "react";

/**
 * Popup menu behaviour for the topbar dropdowns: outside-press closes,
 * Escape closes and returns focus to the trigger.
 *
 * Outside-press listens for pointerdown, not mousedown — mousedown never
 * fires for touch, so on a phone the menus previously stayed open until you
 * hit the trigger again.
 *
 * The refs are owned by the caller and passed in rather than created here
 * and returned: a ref handed out through a hook's return value can't be
 * spread into JSX without tripping "cannot access refs during render".
 */
export function useDropdown(
  rootRef: RefObject<HTMLElement | null>,
  triggerRef: RefObject<HTMLButtonElement | null>,
) {
  const [open, setOpen] = useState(false);

  const close = useCallback(
    (restoreFocus = false) => {
      setOpen(false);
      if (restoreFocus) triggerRef.current?.focus();
    },
    [triggerRef],
  );

  const toggle = useCallback(() => setOpen((value) => !value), []);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, rootRef, triggerRef]);

  return { open, close, toggle };
}
