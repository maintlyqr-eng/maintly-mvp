import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getLocale } from "next-intl/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Incremento 28 (Facu): base para que cualquier URL de imagen relativa que
  // pongamos en `metadata` (acá o en cualquier página/layout hijo, como el
  // nuevo generateMetadata de asset/[code]) se resuelva sola a una URL
  // absoluta -- lo necesitan tanto Open Graph como Twitter Cards, que no
  // aceptan rutas relativas.
  metadataBase: new URL("https://maintlyqr.com"),
  title: "MaintlyQR",
  description: "One QR. Lifetime maintenance history for any asset, anywhere in the world.",
  // Vista previa genérica (WhatsApp/Slack/iMessage/etc.) para cualquier
  // página que no defina la suya propia -- antes no había ninguna, así que
  // compartir un link de MaintlyQR se veía como una tarjeta vacía/genérica
  // del navegador. asset/[code] (ver su layout.tsx) pisa esto con una
  // tarjeta específica por equipo cuando corresponde.
  openGraph: {
    title: "MaintlyQR",
    description: "One QR. Lifetime maintenance history for any asset, anywhere in the world.",
    images: [{ url: "/images/login-hero-desktop-light.png", width: 1672, height: 941 }],
    siteName: "MaintlyQR",
  },
  twitter: {
    card: "summary_large_image",
    title: "MaintlyQR",
    description: "One QR. Lifetime maintenance history for any asset, anywhere in the world.",
    images: ["/images/login-hero-desktop-light.png"],
  },
  // Favicon: served automatically by Next.js from src/app/icon.png — no
  // need to declare it here. (The old reference pointed at a 1MB image in
  // /public, which is likely why the tab icon was slow/inconsistent.)
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Locale-aware <html lang>: getLocale() reads whatever the i18n
  // middleware (src/middleware.ts) detected for this request. Routes that
  // aren't migrated to src/app/[locale]/ yet (dashboard, admin, api, and
  // every public page still pending migration) never go through that
  // middleware, so this just falls back to the default locale ("en") for
  // them — same as before i18n existed.
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
