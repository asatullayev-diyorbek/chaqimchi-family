"use client";

import { useEffect, useRef } from "react";

export const WHEEL_ITEM_HEIGHT = 36;
const WHEEL_VISIBLE_ITEMS = 5;
const WHEEL_PADDING = WHEEL_ITEM_HEIGHT * Math.floor(WHEEL_VISIBLE_ITEMS / 2);

export type WheelPickerOption = { value: string; label: string };

export default function WheelPicker({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: WheelPickerOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programmatic = useRef(false);

  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const targetTop = selectedIndex * WHEEL_ITEM_HEIGHT;
    if (Math.abs(el.scrollTop - targetTop) > 1) {
      programmatic.current = true;
      el.scrollTo({ top: targetTop, behavior: "auto" });
      requestAnimationFrame(() => { programmatic.current = false; });
    }
    // Re-sync only when the selected value or the option list identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options.length]);

  function handleScroll() {
    if (programmatic.current) return;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const el = scrollRef.current;
      if (!el || !options.length) return;
      const index = Math.min(Math.max(Math.round(el.scrollTop / WHEEL_ITEM_HEIGHT), 0), options.length - 1);
      const option = options[index];
      programmatic.current = true;
      el.scrollTo({ top: index * WHEEL_ITEM_HEIGHT, behavior: "smooth" });
      requestAnimationFrame(() => { programmatic.current = false; });
      if (option && option.value !== value) onChange(option.value);
    }, 110);
  }

  return (
    <div className="wheel-picker" aria-label={ariaLabel} role="listbox">
      <div className="wheel-picker-highlight" aria-hidden="true" />
      <div className="wheel-picker-scroll" ref={scrollRef} onScroll={handleScroll}>
        <div style={{ height: WHEEL_PADDING }} aria-hidden="true" />
        {options.map((option) => (
          <div
            key={option.value || "empty"}
            role="option"
            aria-selected={option.value === value}
            className={`wheel-picker-item ${option.value === value ? "selected" : ""}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </div>
        ))}
        <div style={{ height: WHEEL_PADDING }} aria-hidden="true" />
      </div>
    </div>
  );
}
