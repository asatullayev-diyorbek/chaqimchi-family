import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

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
          borderRadius: 16,
          background: "linear-gradient(140deg, #3b82f6, #2563eb 55%, #2fbfa6)",
          color: "#fff",
          fontSize: 40,
          fontWeight: 800,
          fontFamily: "sans-serif",
        }}
      >
        C
      </div>
    ),
    size,
  );
}
