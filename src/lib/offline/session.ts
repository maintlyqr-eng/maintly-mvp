"use client";

// Sesión "offline-safe": con señal, la sesión de Supabase de siempre; sin
// señal (o con el token vencido y sin poder renovarlo), el id del usuario
// que quedó guardado en el dispositivo. Así el panel abre siempre.
import { supabase } from "@/lib/supabase";
import { cachedUid, isOnline } from "./cache";
import { startSync, pull } from "./sync";
import { metaGet } from "./db";

export type LocalSession = { uid: string; email: string; online: boolean };

export async function getLocalSession(): Promise<LocalSession | null> {
  try {
    // Tope de 1,5 s: si el token venció y Supabase se queda intentando
    // renovarlo con mala señal, se sigue con la sesión guardada.
    const got = await Promise.race([
      supabase.auth.getSession().then((r) => r.data.session),
      new Promise<null>((r) => setTimeout(() => r(null), 1500)),
    ]);
    const session = got;
    if (session) {
      startSync(session.user.id);
      // Primera vez en este dispositivo: esperar la bajada inicial (máx. 15 s)
      // para no mostrar el panel vacío un instante.
      if (isOnline() && !(await metaGet<string>("lastPullAt"))) await Promise.race([pull(session.user.id), new Promise((r) => setTimeout(r, 15000))]);
      return { uid: session.user.id, email: session.user.email ?? "", online: isOnline() };
    }
  } catch { /* sigue abajo */ }
  const uid = cachedUid();
  if (uid !== "anon") { startSync(uid); return { uid, email: "", online: isOnline() }; }
  return null;
}

/** Vuelve a correr `fn` cada vez que el sincronizador bajó datos nuevos. */
export function onSynced(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const h = (e: Event) => { const d = (e as CustomEvent).detail; if (d && !d.syncing) fn(); };
  window.addEventListener("mly:sync", h);
  return () => window.removeEventListener("mly:sync", h);
}
