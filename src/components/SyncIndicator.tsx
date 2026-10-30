"use client";

// Indicador de sincronización (local-first). Muestra: sin señal, cambios
// pendientes de subir, subiendo, o errores con botón de reintentar.
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CloudOff, RefreshCw, AlertTriangle, CloudUpload } from "lucide-react";
import { subscribeSync, type SyncState } from "@/lib/offline/sync";
import { useOnline } from "@/lib/offline/useOnline";
import { Link } from "@/i18n/navigation";

export default function SyncIndicator() {
  const t = useTranslations("Offline");
  const online = useOnline();
  const [s, setS] = useState<SyncState | null>(null);
  useEffect(() => subscribeSync(setS), []);
  if (!s) return null;
  if (!online) return <Link href="/dashboard/sync" className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 px-2.5 py-1 text-[11px] font-bold" title={t("offlineHint")}><CloudOff size={12} /> {t("offline")}{s.pending > 0 ? ` · ${t("pendingN", { n: s.pending })}` : ""}</Link>;
  if (s.failed > 0) return <Link href="/dashboard/sync" className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 px-2.5 py-1 text-[11px] font-bold"><AlertTriangle size={12} /> {t("failedN", { n: s.failed })} · {t("retry")}</Link>;
  if (s.pending > 0) return <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 border border-sky-200 text-sky-800 px-2.5 py-1 text-[11px] font-bold"><CloudUpload size={12} className="animate-pulse" /> {t("uploadingN", { n: s.pending })}</span>;
  if (s.syncing) return <span className="inline-flex items-center gap-1.5 text-zinc-400 text-[11px] font-bold"><RefreshCw size={12} className="animate-spin" /> {t("syncing")}</span>;
  return null;
}
