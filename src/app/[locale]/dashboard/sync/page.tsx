"use client";

// Pantalla de Sincronización (local-first, 30/10/2026). Muestra lo que el
// dispositivo tiene adentro: versión de la app, estado de red, última
// bajada, filas por tabla local, cola de cambios (con error si falló) y
// qué tiene guardado el service worker. Sirve para el usuario (ver qué
// falta subir, reintentar) y para diagnosticar sin adivinar.

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw, Trash2, CloudUpload } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { TABLES, getAll, metaGet } from "@/lib/offline/db";
import { listQueue, retryFailed, discardFailed, pull, push, subscribeSync, type QueueOp, type SyncState } from "@/lib/offline/sync";
import { getLocalSession } from "@/lib/offline/session";
import { useOnline } from "@/lib/offline/useOnline";

const VERSION = (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "dev").slice(0, 7);

export default function SyncPage() {
  const t = useTranslations("Offline");
  const online = useOnline();
  const [uid, setUid] = useState<string | null>(null);
  const [state, setState] = useState<SyncState | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [queue, setQueue] = useState<QueueOp[]>([]);
  const [owner, setOwner] = useState<string>("");
  const [sw, setSw] = useState<{ controlled: boolean; caches: string[]; cached: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const c: Record<string, number> = {};
    for (const tb of TABLES) c[tb] = (await getAll(tb)).length;
    setCounts(c);
    setQueue(await listQueue());
    setOwner((await metaGet<string>("owner")) ?? "");
    try {
      const keys = await caches.keys();
      let n = 0; for (const k of keys) n += (await (await caches.open(k)).keys()).length;
      setSw({ controlled: !!navigator.serviceWorker?.controller, caches: keys, cached: n });
    } catch { setSw({ controlled: false, caches: [], cached: 0 }); }
  }

  useEffect(() => {
    getLocalSession().then((s) => setUid(s?.uid ?? null));
    refresh();
    const unsub = subscribeSync((s) => { setState(s); refresh(); });
    return unsub;
  }, []);

  const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : "—");

  return (
    <div className="min-h-dvh bg-zinc-50 px-4 py-5 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[20px] font-black text-zinc-900">{t("syncTitle")}</h1>
        <Link href="/dashboard" className="text-[12px] font-bold text-red-600">{t("backToPanel")}</Link>
      </div>

      <div className="rounded-2xl bg-white border border-zinc-200 p-4 mb-3 text-[13px] space-y-1">
        <Row k={t("version")} v={VERSION} />
        <Row k={t("network")} v={online ? "online" : "offline"} />
        <Row k={t("user")} v={uid ? uid.slice(0, 8) + "…" : "—"} />
        <Row k={t("localOwner")} v={owner ? owner.slice(0, 8) + "…" : "—"} />
        <Row k={t("lastPull")} v={fmt(state?.lastPullAt)} />
        <Row k={t("syncError")} v={state?.error ?? "—"} />
        <Row k="Service worker" v={sw ? `${sw.controlled ? "activo" : "NO activo"} · ${sw.caches.join(", ") || "sin caché"} · ${sw.cached} archivos` : "…"} />
      </div>

      <div className="rounded-2xl bg-white border border-zinc-200 p-4 mb-3">
        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2">{t("localData")}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[13px]">
          {TABLES.map((tb) => <div key={tb} className="rounded-xl bg-zinc-50 px-3 py-2"><p className="text-[10px] text-zinc-400 font-mono">{tb}</p><p className="font-black text-zinc-900">{counts[tb] ?? "…"}</p></div>)}
        </div>
        <div className="flex gap-2 mt-3">
          <button disabled={busy || !online || !uid} onClick={async () => { setBusy(true); await pull(uid!); await refresh(); setBusy(false); }} className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] font-bold disabled:opacity-40"><RefreshCw size={13} className={busy ? "animate-spin" : ""} /> {t("pullNow")}</button>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-zinc-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">{t("queue")} ({queue.length})</p>
          <div className="flex gap-2">
            <button disabled={!online || queue.length === 0} onClick={async () => { await retryFailed(); await push(); await refresh(); }} className="flex items-center gap-1.5 rounded-xl bg-red-600 text-white px-3 py-1.5 text-[12px] font-bold disabled:opacity-40"><CloudUpload size={13} /> {t("uploadNow")}</button>
          </div>
        </div>
        {queue.length === 0 ? <p className="text-[13px] text-zinc-400">{t("queueEmpty")}</p> : (
          <div className="divide-y divide-zinc-100">
            {queue.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((q) => (
              <div key={q.id} className="py-2 text-[12px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-zinc-800">{q.table} · {q.op}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${q.status === "failed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{q.status === "failed" ? t("failed") : t("pending")}</span>
                </div>
                <p className="text-zinc-400">{fmt(q.createdAt)} · {q.attempts} {t("attempts")}</p>
                {q.error && <p className="text-red-600 break-all mt-0.5">{q.error}</p>}
                {q.status === "failed" && <button onClick={async () => { await discardFailed(q.id); await refresh(); }} className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-zinc-500 hover:text-red-600"><Trash2 size={11} /> {t("discard")}</button>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3"><span className="text-zinc-400">{k}</span><span className="font-bold text-zinc-800 text-right break-all">{v}</span></div>;
}
