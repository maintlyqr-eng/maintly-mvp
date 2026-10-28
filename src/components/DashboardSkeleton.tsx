// Esqueleto del panel (28/10/2026). Reemplaza la pantalla vacía con
// "Cargando…" que mostraba cada sección mientras verificaba la sesión:
// dibuja el mismo armazón (menú lateral en escritorio, cabecera, bloques
// grises) para que pasar de una sección a otra se vea como navegar y no
// como recargar. Sin texto, sin spinner: solo una barrita roja arriba.
import Image from "next/image";

export default function DashboardSkeleton() {
  return (
    <div className="h-dvh bg-zinc-50 flex relative overflow-hidden" aria-busy="true">
      <aside className="hidden md:flex w-[230px] bg-white border-r border-zinc-200 flex-col shrink-0">
        <div className="px-5 py-5"><Image src="/images/Maintly_crop.png" alt="MaintlyQR" width={150} height={29} priority /></div>
        <div className="px-4 space-y-2 animate-pulse">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2"><div className="w-4 h-4 rounded bg-zinc-200" /><div className="h-3 rounded bg-zinc-200" style={{ width: `${55 + ((i * 37) % 40)}%` }} /></div>
          ))}
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-0.5 w-full bg-zinc-100 overflow-hidden"><div className="h-full w-1/3 bg-red-600 animate-[mlyBar_1s_ease-in-out_infinite]" /></div>
        <header className="flex items-center justify-between gap-3 px-4 md:px-7 py-3 bg-white border-b border-zinc-200 animate-pulse">
          <div className="space-y-2"><div className="h-5 w-48 rounded bg-zinc-200" /><div className="h-3 w-64 rounded bg-zinc-100" /></div>
          <div className="flex items-center gap-3"><div className="hidden md:block h-9 w-56 rounded-full bg-zinc-100" /><div className="w-9 h-9 rounded-full bg-zinc-200" /></div>
        </header>
        <div className="flex-1 px-3 md:px-4 pt-3 space-y-3 animate-pulse">
          <div className="h-[140px] rounded-2xl bg-zinc-200/60" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3"><div className="h-[220px] rounded-2xl bg-zinc-200/60" /><div className="h-[220px] rounded-2xl bg-zinc-200/60" /><div className="h-[220px] rounded-2xl bg-zinc-200/60" /></div>
        </div>
      </div>
    </div>
  );
}
