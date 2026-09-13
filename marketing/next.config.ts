import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The installer and its verified hash live on the app domain; keep one
      // source of truth rather than copying the .exe into this project.
      // Host-independent on purpose — this still applies as-is once
      // chaqimchi-ai.uz itself starts redirecting to spino24.uz below,
      // since Next.js takes the first matching rule.
      { source: "/download", destination: "https://guard.chaqimchi-ai.uz/download", permanent: false },
      // chaqimchi-ai.uz is being retired in favor of spino24.uz — not
      // permanent yet (the move is recent) so it stays easy to reverse;
      // switch to permanent once this is confirmed to stick.
      {
        source: "/:path*",
        has: [{ type: "host", value: "chaqimchi-ai.uz" }],
        destination: "https://spino24.uz/:path*",
        permanent: false,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.chaqimchi-ai.uz" }],
        destination: "https://spino24.uz/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
