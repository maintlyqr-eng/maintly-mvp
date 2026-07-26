"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

// Facu (26 jul 2026): after the React error #310 crash, he asked "en caso
// de q falle no quiero q se vea como q no existe" — up until now, any
// uncaught React render error just bubbled up to the browser's own blank
// "This page couldn't load" screen, which reads as if the whole site is
// down rather than a page hiccup. This is the on-brand replacement,
// wired up via Next.js App Router error.tsx boundaries (see
// src/app/[locale]/dashboard/error.tsx, src/app/[locale]/admin/error.tsx
// and src/app/[locale]/error.tsx — one per section so a crash in one part
// doesn't need a full page reload from scratch, just `reset()`).
//
// Also closes a gap ErrorLogger.tsx's own comment flagged: "sin capturar
// errores de React en sí (eso requeriría un Error Boundary por árbol de
// componentes)" — this reports into the same /api/log-error pipeline the
// Admin's "Errores" panel already reads, so a crash caught here shows up
// there too, same as any other JS error.
export default function ErrorFallback({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("ErrorFallback");
  const reportedRef = useRef(false);

  useEffect(() => {
    if (reportedRef.current) return;
    reportedRef.current = true;
    fetch("/api/log-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message || "Unhandled render error",
        stack: error.stack,
        severity: "error",
        route: typeof window !== "undefined" ? window.location.pathname : undefined,
        context: { digest: error.digest, boundary: "react-error-boundary" },
      }),
    }).catch(() => {
      // Fire-and-forget, same as ErrorLogger — if the network call itself
      // fails there's nothing more useful to do from inside a crash screen.
    });
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-red-50/30 flex items-center justify-center p-4">
      <div className="w-full max-w-[380px] text-center">
        <div className="flex justify-center mb-6">
          <Image src="/images/Maintly_crop.png" alt="MaintlyQR" width={136} height={26} style={{ objectFit: "contain" }} />
        </div>
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-50 border border-red-100 mb-5">
          <AlertTriangle size={26} className="text-red-500" />
        </div>
        <h1 className="text-[18px] font-black text-zinc-900 mb-2">{t("title")}</h1>
        <p className="text-[13px] text-zinc-500 mb-7 leading-relaxed">{t("subtitle")}</p>
        <div className="flex items-center justify-center gap-2.5">
          <button
            onClick={() => reset()}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all text-white text-[13px] font-bold px-5 py-[11px] rounded-xl shadow-lg shadow-red-200"
          >
            <RotateCcw size={14} /> {t("retry")}
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors text-zinc-600 text-[13px] font-bold px-5 py-[11px] rounded-xl"
          >
            <Home size={14} /> {t("goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
