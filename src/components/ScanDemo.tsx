// Demostración animada del escaneo, dentro del panel oscuro de la portada
// (Facu, 30/10/2026): una línea roja barre el QR de un equipo y aparecen
// "Equipo identificado" → "Historial disponible" → "Último mantenimiento".
// Ciclo de 7 s, solo CSS (keyframes en globals.css), marcada como demo.
// Con "reducir movimiento" queda el cuadro fijo con los tres estados.
import { useTranslations } from "next-intl";
import { CheckCircle2, Wrench } from "lucide-react";

export default function ScanDemo() {
  const t = useTranslations("ScanDemo");
  return (
    <div className="mly-demo relative w-full rounded-xl bg-zinc-800/80 border border-white/10 overflow-hidden text-left" style={{ height: "clamp(72px,10vh,112px)" }} aria-hidden="true">
      <span className="absolute top-1 right-1.5 text-[7px] font-black tracking-[0.2em] text-zinc-400 uppercase">{t("label")}</span>
      {/* Equipo con su QR */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/generador.png" alt="" className="object-contain opacity-90" style={{ width: "clamp(28px,3.6vh,44px)", height: "clamp(28px,3.6vh,44px)" }} />
        <div className="relative rounded-sm bg-white p-[2px]" style={{ width: "clamp(18px,2.6vh,30px)", height: "clamp(18px,2.6vh,30px)" }}>
          <svg viewBox="0 0 7 7" className="w-full h-full" shapeRendering="crispEdges">
            {[[0,0],[1,0],[2,0],[0,1],[2,1],[0,2],[1,2],[2,2],[4,0],[5,0],[6,0],[4,1],[6,1],[4,2],[5,2],[6,2],[0,4],[1,4],[2,4],[0,5],[2,5],[0,6],[1,6],[2,6],[4,4],[6,5],[5,6],[4,6],[3,1],[3,3],[1,3],[5,3],[6,3]].map(([x,y],i)=><rect key={i} x={x} y={y} width="1" height="1" fill="#111" />)}
          </svg>
          <div className="mly-demo-line absolute left-0 right-0 h-[2px] bg-red-500 shadow-[0_0_6px_2px_rgba(239,68,68,0.8)]" />
        </div>
      </div>
      {/* Estados */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-[3px]" style={{ fontSize: "clamp(7px,0.95vh,10px)" }}>
        <div className="mly-demo-step mly-demo-step-1 flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 px-1.5 py-[2px] font-bold"><CheckCircle2 style={{ width: "1em", height: "1em" }} /> {t("step1")}</div>
        <div className="mly-demo-step mly-demo-step-2 flex items-center gap-1 rounded-md bg-sky-500/15 border border-sky-400/30 text-sky-300 px-1.5 py-[2px] font-bold"><CheckCircle2 style={{ width: "1em", height: "1em" }} /> {t("step2")}</div>
        <div className="mly-demo-step mly-demo-step-3 flex items-center gap-1 rounded-md bg-white/10 border border-white/15 text-zinc-200 px-1.5 py-[2px] font-bold"><Wrench style={{ width: "1em", height: "1em" }} className="text-red-400" /> {t("step3")}</div>
      </div>
    </div>
  );
}
