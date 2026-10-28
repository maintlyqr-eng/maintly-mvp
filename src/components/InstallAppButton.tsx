"use client";

import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";
import { useTranslations } from "next-intl";

// Botón "Instalar app". En Android/Chrome/Edge usa el prompt nativo
// (beforeinstallprompt). En iPhone no existe ese prompt: muestra el
// instructivo "Compartir → Agregar a pantalla de inicio". Si ya está
// instalada (display-mode standalone) no aparece.
type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export default function InstallAppButton({ className }: { className?: string }) {
  const t = useTranslations("Offline");
  const [prompt, setPrompt] = useState<BIP | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    const ua = navigator.userAgent;
    setIos(/iphone|ipad|ipod/i.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream);
    const onBip = (e: Event) => { e.preventDefault(); setPrompt(e as BIP); };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (installed) return null;
  if (!prompt && !ios) return null;

  return (
    <>
      <button
        type="button"
        onClick={async () => { if (prompt) { await prompt.prompt(); const r = await prompt.userChoice; if (r.outcome === "accepted") setInstalled(true); } else setShowIosHelp(true); }}
        className={className ?? "flex items-center gap-2 text-[12px] font-bold px-3 py-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"}
      >
        <Download size={14} /> {t("install")}
      </button>
      {showIosHelp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowIosHelp(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <p className="text-[15px] font-black text-zinc-900 mb-2">{t("iosTitle")}</p>
            <ol className="text-[13px] text-zinc-700 space-y-2 list-decimal pl-5">
              <li>{t("iosStep1")} <Share size={14} className="inline text-sky-600" /></li>
              <li>{t("iosStep2")}</li>
              <li>{t("iosStep3")}</li>
            </ol>
            <button onClick={() => setShowIosHelp(false)} className="mt-4 w-full text-[12px] font-bold px-3 py-2 rounded-xl border border-zinc-200 text-zinc-600">{t("close")}</button>
          </div>
        </div>
      )}
    </>
  );
}
