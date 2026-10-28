"use client";

import { WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOnline } from "@/lib/offline/useOnline";

// Franja discreta arriba del contenido cuando no hay señal. Opcionalmente
// muestra de cuándo son los datos guardados que se están viendo.
export default function OfflineBanner({ cachedAt }: { cachedAt?: string | null }) {
  const online = useOnline();
  const t = useTranslations("Offline");
  if (online && !cachedAt) return null;
  if (online) return null;
  return (
    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-[12px] font-semibold rounded-xl px-3 py-2 mb-3">
      <WifiOff size={14} className="shrink-0" />
      <span>{t("offline")}{cachedAt ? ` · ${t("showingSaved", { when: new Date(cachedAt).toLocaleString() })}` : ""}</span>
    </div>
  );
}
