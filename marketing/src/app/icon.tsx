import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// A real shield-check mark (not a letter) rendered onto the brand gradient.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 14,
          background: "linear-gradient(140deg, #3b82f6, #2563eb 55%, #2fbfa6)",
        }}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2 4 5v6c0 5.25 3.4 9.4 8 10.6 4.6-1.2 8-5.35 8-10.6V5l-8-3Z" />
          <path d="M9 12.2l2 2 4.2-4.4" />
        </svg>
      </div>
    ),
    size,
  );
}
