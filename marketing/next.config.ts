import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The installer and its verified hash live on the app domain; keep one
      // source of truth rather than copying the .exe into this project.
      { source: "/download", destination: "https://guard.chaqimchi-ai.uz/download", permanent: false },
    ];
  },
};

export default nextConfig;
