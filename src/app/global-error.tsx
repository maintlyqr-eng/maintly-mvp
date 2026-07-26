"use client";

import { useEffect, useRef } from "react";
import "./globals.css";

// Facu (26 jul 2026): "en caso de q falle no quiero q se vea como q no
// existe" — this is the last-resort catch: it only fires if something
// crashes in the ROOT layout itself (src/app/layout.tsx), which is rare
// enough that every other error.tsx boundary in the app (dashboard,
// admin, and the rest of the locale-scoped pages — see
// src/app/[locale]/error.tsx and friends) would normally catch things
// first. Next.js requires global-error.tsx to render its own full
// <html>/<body> since it fully replaces the root layout when active, so
// this deliberately doesn't reach for next-intl or the shared
// ErrorFallback component — the very thing that might be broken is
// whatever those depend on. Plain, hardcoded, self-contained.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const reportedRef = useRef(false);

  useEffect(() => {
    if (reportedRef.current) return;
    reportedRef.current = true;
    fetch("/api/log-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message || "Unhandled root-layout error",
        stack: error.stack,
        severity: "error",
        route: typeof window !== "undefined" ? window.location.pathname : undefined,
        context: { digest: error.digest, boundary: "global-error" },
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-red-50/30 flex items-center justify-center p-4 antialiased">
        <div className="w-full max-w-[380px] text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-50 border border-red-100 mb-5">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </div>
          <h1 className="text-[18px] font-black text-zinc-900 mb-2">We&apos;re working on it</h1>
          <p className="text-[13px] text-zinc-500 mb-7 leading-relaxed">
            Something went wrong on our end — we&apos;ve already been notified and we&apos;re on it. Try again in a moment.
          </p>
          <div className="flex items-center justify-center gap-2.5">
            <button
              onClick={() => reset()}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all text-white text-[13px] font-bold px-5 py-[11px] rounded-xl shadow-lg shadow-red-200"
            >
              Try again
            </button>
            <a
              href="/"
              className="flex items-center gap-2 border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors text-zinc-600 text-[13px] font-bold px-5 py-[11px] rounded-xl"
            >
              Go to homepage
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
