"use client";

// Barra de título propia para la app instalada en la compu (Chrome/Edge).
// Solo aparece cuando la ventana está en modo "window controls overlay":
// el usuario lo activa con el botón ˄ que Chrome muestra arriba a la
// derecha de la app instalada. Dibuja una franja grafito con el logo que
// ocupa el espacio de la barra de título (los botones minimizar/cerrar
// siguen siendo de Windows). En el navegador normal o en el celular no
// renderiza nada.

import { useEffect, useState } from "react";

type WCO = { visible: boolean; addEventListener: (t: "geometrychange", cb: () => void) => void; removeEventListener: (t: "geometrychange", cb: () => void) => void };

export default function AppTitleBar() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const wco = (navigator as unknown as { windowControlsOverlay?: WCO }).windowControlsOverlay;
    if (!wco) return;
    const update = () => {
      setVisible(wco.visible);
      document.documentElement.classList.toggle("mly-wco", wco.visible);
    };
    update();
    wco.addEventListener("geometrychange", update);
    return () => wco.removeEventListener("geometrychange", update);
  }, []);
  if (!visible) return null;
  return (
    <div
      className="fixed top-0 left-0 z-[100] flex items-center gap-2 px-3 bg-[#1c1f24] text-white select-none"
      style={{
        left: "env(titlebar-area-x, 0)",
        width: "env(titlebar-area-width, 100%)",
        height: "env(titlebar-area-height, 32px)",
        // Permite arrastrar la ventana desde la franja
        WebkitAppRegion: "drag",
      } as React.CSSProperties}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" width={18} height={18} className="rounded-sm" />
      <span className="text-[12px] font-extrabold tracking-wide">
        MAINTLY<span className="text-red-500">QR</span>
      </span>
      <span className="text-[10px] text-zinc-400 hidden sm:inline">· Maintenance · Tracked</span>
    </div>
  );
}
