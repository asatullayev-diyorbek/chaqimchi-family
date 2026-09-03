import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import { SITE } from "@/lib/site";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.domain),
  title: {
    default: `${SITE.name} — oila uchun ochiq ekran-vaqt qoidalari`,
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
    title: `${SITE.name} — oila uchun ochiq ekran-vaqt qoidalari`,
    description: `${SITE.tagline} Kunlik limit, dam olish vaqti, faoliyat, Telegram xabarlar.`,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — oila uchun ochiq ekran-vaqt qoidalari`,
    description: "Kunlik limit, dam olish vaqti, ilova cheklovlari, faoliyat va Telegram xabarlar.",
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
      <body>
        <div className="bg-glow-3" aria-hidden />
        {children}
        {/* Real icon set (Solar) — same source the dashboard uses. */}
        <Script src="https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
