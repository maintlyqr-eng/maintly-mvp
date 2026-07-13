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
  title: "MaintlyQR",
  description: "One QR. Lifetime maintenance history for any machine, anywhere in the world.",
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
