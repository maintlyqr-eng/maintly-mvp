"use client";

import { useTranslations } from "next-intl";
import { LayoutGrid, Box, QrCode, FileText, Menu } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";

// Rediseño 21/10/2026 (dirección aprobada por Facu): en celular, la
// navegación principal pasa a una barra inferior grafito con 4 accesos
// directos + "Más", que abre el sidebar completo como cajón. En escritorio
// no se muestra (md:hidden). Se renderiza desde DashboardHeaderIntl, que ya
// está en las 12 rutas del dashboard, así que todas la reciben sin tocar
// cada página. Las áreas de scroll llevan data-dashboard-scroll para que
// globals.css les dé aire abajo y la última tarjeta no quede tapada.
//
// Identidad: fondo grafite (#1C1F24), ítem activo con halo rojo "LED",
// ítems inactivos en gris acero.

const ITEMS: { key: string; href: string; icon: typeof Box }[] = [
  { key: "dashboard", href: "/dashboard", icon: LayoutGrid },
  { key: "assets", href: "/dashboard/assets", icon: Box },
  { key: "qrCodes", href: "/dashboard/qr-codes", icon: QrCode },
  { key: "myServices", href: "/dashboard/services", icon: FileText },
];

export default function DashboardBottomNavIntl({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const tNav = useTranslations("DashboardNav");
  const t = useTranslations("DashboardBottomNav");
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const anyMain = ITEMS.some((i) => isActive(i.href));

  return (
    <nav
      aria-label={t("ariaLabel")}
      className="md:hidden fixed inset-x-0 bottom-0 z-30 bg-graphite shadow-[0_-1px_0_#2E333A] grid grid-cols-5 px-2 pt-2 pb-[max(10px,env(safe-area-inset-bottom))]"
    >
      {ITEMS.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.key}
            href={item.href}
            className={`flex flex-col items-center gap-1 text-[11px] ${active ? "text-white font-semibold" : "text-steel-2 font-medium"}`}
          >
            <span className={`flex items-center justify-center w-11 h-7 rounded-full transition-all ${active ? "bg-brand/20 shadow-[0_0_16px_rgba(224,36,43,0.45)]" : ""}`}>
              <item.icon size={21} className={active ? "text-brand-glow" : ""} />
            </span>
            {tNav(item.key)}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onOpenSidebar}
        className={`flex flex-col items-center gap-1 text-[11px] ${!anyMain ? "text-white font-semibold" : "text-steel-2 font-medium"}`}
      >
        <span className={`flex items-center justify-center w-11 h-7 rounded-full ${!anyMain ? "bg-brand/20 shadow-[0_0_16px_rgba(224,36,43,0.45)]" : ""}`}>
          <Menu size={21} className={!anyMain ? "text-brand-glow" : ""} />
        </span>
        {t("more")}
      </button>
    </nav>
  );
}
