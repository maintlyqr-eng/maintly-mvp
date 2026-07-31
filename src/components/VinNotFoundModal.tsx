"use client";

import { useTranslations } from "next-intl";
import { X, SearchX } from "lucide-react";
import { Link } from "@/i18n/navigation";

// Incremento 29 (Facu, escaneo de VIN): resultado de "escanear VIN para
// encontrar un equipo" (Home) cuando findAssetByVin no encuentra nada. No es
// un error -- simplemente ese vehículo todavía no tiene historial cargado en
// MaintlyQR. Se ofrece el paso siguiente lógico: cargarlo, lo cual requiere
// estar logueado como Maintler (cargar equipos es una acción del dashboard,
// no del Home público) -- por eso la CTA cambia según `loggedIn`.
//
// Incremento 29d (Facu, 31 jul 2026): "cuando voy desde el home y escaneo
// algo q no existe me dice queres agregar el equipo toco q si y me manda a
// mi dashboard y ahi tengo q tocar de nuevo, deberia agregarmelo directo" --
// antes la CTA de "logueado" mandaba a /dashboard a secas, dejando a la
// persona en la pantalla principal con que volver a tocar "Agregar equipo" y
// tipear el VIN de nuevo. Ahora manda con el VIN ya escaneado en la URL
// (?newAssetVin=...) -- el Dashboard (ver src/app/[locale]/dashboard/
// page.tsx) lo detecta al cargar y abre el formulario de "nuevo equipo"
// directo, con el VIN precargado.
export default function VinNotFoundModal({
  open,
  onClose,
  loggedIn,
  vin,
}: {
  open: boolean;
  onClose: () => void;
  loggedIn: boolean;
  vin: string;
}) {
  const t = useTranslations("VinNotFoundModal");
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-zinc-900/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
          <h3 className="text-[15px] font-black text-zinc-900 flex items-center gap-2">
            <SearchX size={16} className="text-zinc-400" /> {t("title")}
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
        </div>
        <div className="p-6 text-center">
          <p className="text-[13px] text-zinc-500 leading-relaxed mb-6">{t("description")}</p>
          {loggedIn ? (
            <a
              href={`/dashboard?newAssetVin=${encodeURIComponent(vin)}`}
              className="block w-full bg-red-600 hover:bg-red-500 text-white font-black py-3 rounded-xl text-[13px] transition-all"
            >
              {t("dashboardCta")}
            </a>
          ) : (
            <Link
              href="/login"
              className="block w-full bg-red-600 hover:bg-red-500 text-white font-black py-3 rounded-xl text-[13px] transition-all"
            >
              {t("loginCta")}
            </Link>
          )}
          <button onClick={onClose} className="w-full mt-2 text-zinc-400 hover:text-zinc-600 font-semibold py-2 text-[12px]">
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}
