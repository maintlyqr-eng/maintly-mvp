"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { fetchPlatformSettings, type PlatformSettings } from "@/lib/platformSettings";

// Incremento 17 de Item 6 ("Configuraciones globales avanzadas"): muestra
// el aviso de modo mantenimiento y/o el banner de anuncio configurados
// desde el panel admin (sección "Sistema"). Deliberadamente sólo en el
// Dashboard — se renderiza desde DashboardHeaderIntl, que ya es el único
// componente de header compartido por las 12 rutas del Dashboard — y NO en
// el panel admin ni en las páginas públicas: así nunca hay riesgo de que un
// bug acá le bloquee a Facu su propio acceso al admin, y evita tocar ~15
// páginas públicas para agregar un banner informativo.
//
// No es tiempo real: se resuelve una vez por carga de página (mismo
// criterio "simple" que el resto de fetchPlatformSettings()). Si el fetch
// falla o todavía no hay fila en platform_settings, no se muestra nada.
export default function PlatformStatusBanner() {
  const t = useTranslations("PlatformStatusBanner");
  const [settings, setSettings] = useState<PlatformSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPlatformSettings().then((s) => {
      if (!cancelled) setSettings(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!settings) return null;
  if (!settings.maintenanceMode && !(settings.bannerEnabled && settings.bannerText)) return null;

  return (
    <div className="flex flex-col">
      {settings.maintenanceMode && (
        <div className="flex items-center gap-2.5 px-4 md:px-7 py-2 bg-amber-50 border-b border-amber-200">
          <ShieldAlert size={14} className="text-amber-600 shrink-0" />
          <p className="text-[12px] font-semibold text-amber-800">
            {settings.maintenanceMessage || t("maintenanceDefaultMessage")}
          </p>
        </div>
      )}
      {settings.bannerEnabled && settings.bannerText && (
        <div
          className={`flex items-center gap-2.5 px-4 md:px-7 py-2 border-b ${
            settings.bannerSeverity === "critical"
              ? "bg-red-50 border-red-200"
              : settings.bannerSeverity === "warning"
              ? "bg-amber-50 border-amber-200"
              : "bg-blue-50 border-blue-200"
          }`}
        >
          {settings.bannerSeverity === "critical" ? (
            <AlertTriangle size={14} className="text-red-600 shrink-0" />
          ) : settings.bannerSeverity === "warning" ? (
            <AlertTriangle size={14} className="text-amber-600 shrink-0" />
          ) : (
            <Info size={14} className="text-blue-600 shrink-0" />
          )}
          <p
            className={`text-[12px] font-semibold ${
              settings.bannerSeverity === "critical"
                ? "text-red-800"
                : settings.bannerSeverity === "warning"
                ? "text-amber-800"
                : "text-blue-800"
            }`}
          >
            {settings.bannerText}
          </p>
          {settings.bannerLinkUrl && (
            <a
              href={settings.bannerLinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-bold underline shrink-0 ml-1"
            >
              {t("learnMore")}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
