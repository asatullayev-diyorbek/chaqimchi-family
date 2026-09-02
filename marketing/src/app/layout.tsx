import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { SITE } from "@/lib/site";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.domain),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s — ${SITE.name}`,
  },
  description:
    "Bolalar kompyuteridan foydalanishni oilada ochiq kelishilgan qoidalar bilan boshqaring: kunlik limit, dam olish vaqti, ilova cheklovlari, faoliyat va Telegram xabarlar. Yashirin kuzatuv emas.",
  keywords: ["parental control", "ekran vaqti", "ota-ona nazorati", "ChaqimchiAI", "bola kompyuter", "screen time"],
  openGraph: {
    type: "website",
    locale: "uz_UZ",
    url: SITE.domain,
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: "Oila uchun ochiq ekran-vaqt qoidalari. Kunlik limit, dam olish vaqti, faoliyat, Telegram xabarlar.",
  },
  alternates: { canonical: SITE.domain },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
