import type { Metadata } from "next";
import Script from "next/script";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import "./style.css";


export const metadata: Metadata = {
  title: "ChaqimchiAI Family",
  description: "Bolalar qurilmalarini monitoring qilish tizimi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz" data-theme="light">
      <head>
        <Script src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js" strategy="afterInteractive" />
      </head>
      <body>
        <Toaster 
          position="top-center" 
          containerStyle={{ zIndex: 99999 }}
          toastOptions={{
            duration: 4000,
            style: {
              background: 'var(--surface)',
              color: 'var(--foreground)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 600,
              boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
            }
          }} 
        />
        {children}
      </body>
    </html>
  );
}
