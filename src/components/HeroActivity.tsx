"use client";

// Línea de actividad real en la portada: rota eventos recientes (equipo
// registrado, mantenimiento cargado, QR escaneado, Maintler nuevo) con país
// y "hace N min". Sin nombres ni códigos. Si no hay eventos, no muestra nada.
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Activity } from "lucide-react";

type Ev = { type: "asset" | "service" | "scan" | "maintler"; at: string; country: string | null };

function relative(iso: string, locale: string): string {
  const diff = (Date.now() - Date.parse(iso)) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (diff < 60) return rtf.format(0, "minute");
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), "minute");
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), "hour");
  return rtf.format(-Math.round(diff / 86400), "day");
}
function countryName(code: string | null, locale: string): string | null {
  if (!code) return null;
  try { return new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase()) ?? code; } catch { return code; }
}

export default function HeroActivity({ className = "" }: { className?: string }) {
  const t = useTranslations("HeroActivity");
  const locale = useLocale();
  const [events, setEvents] = useState<Ev[]>([]);
  const [i, setI] = useState(0);
  const [show, setShow] = useState(true);

  useEffect(() => {
    const load = () => fetch("/api/public-activity").then((r) => r.json()).then((j) => setEvents(j.events ?? [])).catch(() => {});
    load();
    const id = setInterval(load, 120_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (events.length < 2) return;
    const id = setInterval(() => { setShow(false); setTimeout(() => { setI((x) => (x + 1) % events.length); setShow(true); }, 350); }, 4500);
    return () => clearInterval(id);
  }, [events.length]);

  if (events.length === 0) return null;
  const ev = events[i % events.length];
  const country = countryName(ev.country, locale);
  return (
    <div className={`inline-flex items-center gap-2 text-zinc-600 ${className}`} aria-live="polite">
      <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60 animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" /></span>
      <span className="font-bold uppercase tracking-widest text-zinc-400" style={{ fontSize: "clamp(8px,0.6vw,10px)" }}>{t("label")}</span>
      <span className="transition-opacity duration-300" style={{ opacity: show ? 1 : 0, fontSize: "clamp(10px,0.8vw,12px)" }}>
        <Activity className="inline mr-1 text-red-500" style={{ width: "0.9em", height: "0.9em" }} />
        {t(ev.type)}{country ? ` · ${country}` : ""} · {relative(ev.at, locale)}
      </span>
    </div>
  );
}
