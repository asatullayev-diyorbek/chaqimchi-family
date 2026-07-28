import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChaqimchiAI Family",
  description: "Ota-ona uchun oilaviy xavfsizlik paneli",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz">
      <body>{children}</body>
    </html>
  );
}
