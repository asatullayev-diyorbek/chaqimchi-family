import type { CSSProperties } from "react";

export const inputStyle: CSSProperties = {
  // Solid-ish (not blurred) on purpose — an input this small doesn't
  // benefit visually from backdrop-filter, and keeping it at high
  // opacity protects contrast for the text being typed into it.
  background: "rgba(255, 255, 255, 0.85)",
  border: "1px solid var(--glass-border)",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
};

export const primaryButtonStyle: CSSProperties = {
  // --accent-dark, not --accent: an axe-core contrast audit caught
  // white-on-accent failing 4.5:1 for normal-size button text
  // (~3.9:1) — accent-dark passes comfortably (~6:1), still the
  // existing palette, no new color introduced.
  background: "var(--accent-dark)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "12px 16px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  marginTop: 6,
};
