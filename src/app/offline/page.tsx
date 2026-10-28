import { WifiOff } from "lucide-react";
import Link from "next/link";

// Página que muestra el service worker cuando no hay señal y la pantalla
// pedida no estaba guardada. Sin dependencias de datos ni de idioma del
// servidor (tiene que servirse desde la caché), por eso los textos van
// en los tres idiomas acá mismo.
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 text-white flex items-center justify-center mx-auto mb-5"><WifiOff size={28} /></div>
        <h1 className="text-[20px] font-black text-zinc-900">Sin conexión · Offline · Sem conexão</h1>
        <p className="text-[13px] text-zinc-500 mt-2 leading-relaxed">
          Esta pantalla necesita señal y todavía no estaba guardada en tu dispositivo. Tus activos e historiales que ya abriste están disponibles en el panel.
        </p>
        <p className="text-[12px] text-zinc-400 mt-2">This screen needs a connection and wasn&apos;t saved yet. Your assets and histories you already opened are available in the dashboard.</p>
        <div className="flex gap-2 justify-center mt-6">
          <Link href="/dashboard" className="text-[13px] font-bold px-4 py-2.5 rounded-xl bg-red-600 text-white">Ir al panel</Link>
        </div>
      </div>
    </div>
  );
}
