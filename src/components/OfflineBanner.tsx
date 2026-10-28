"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOnline } from "@/lib/offline/useOnline";
import { subscribeSync } from "@/lib/offline/sync";

// Franja discreta arriba del contenido cuando no hay señal. Muestra de
// cuándo es la última sincronización y cuántos cambios esperan subir.
// `cachedAt` (etapa A) se mantiene por compatibilidad.
export default function OfflineBanner({ cachedAt }: { cachedAt?: string | null }) {
  const online = useOnline();
  const t = useTranslations("Offline");
  const [lastPullAt, setLastPullAt] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  useEffect(() => subscribeSync((s) => { setLastPullAt(s.lastPullAt); setPending(s.pending); }), []);
  if (online) return null;
  const when = cachedAt ?? lastPullAt;
  return (
    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-[12px] font-semibold rounded-xl px-3 py-2 mb-3">
      <WifiOff size={14} className="shrink-0" />
      <span>
        {t("offline")}
        {when ? ` · ${t("showingSaved", { when: new Date(when).toLocaleString() })}` : ""}
        {pending > 0 ? ` · ${t("pendingN", { n: pending })}` : ""}
      </span>
    </div>
  );
}
