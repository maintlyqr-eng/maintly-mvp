"use client";

// Caché local de lecturas (etapa A, 28/10/2026): guarda en IndexedDB el
// último resultado de cada consulta del dashboard, por usuario, para
// mostrarlo cuando no hay señal. La etapa B (cola de cambios) usa la misma
// base. Sin dependencias: IndexedDB a mano, ~60 líneas.
//
// Uso:  const r = await cachedRead(uid, "assets", () => supabase.from(...));
//       r.data (el mismo tipo que devuelve el fetcher), r.fromCache,
//       r.cachedAt, r.offline (true si no había red ni copia guardada).

import { openDb } from "./db";

const STORE = "reads";

export async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await openDb();
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const r = tx.objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result as T | undefined);
      r.onerror = () => reject(r.error);
    });
  } catch { return undefined; }
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* sin IndexedDB (modo privado viejo): se sigue sin caché */ }
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

/** true si una respuesta de supabase-js falló por falta de red (y no por un error de datos). */
export function looksLikeNetworkError(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const err = (result as { error?: { message?: string } }).error;
  if (!err) return false;
  const m = (err.message ?? "").toLowerCase();
  return m.includes("fetch") || m.includes("network") || m.includes("load failed") || m.includes("timeout");
}

export type CachedResult<T> = { data: T | null; fromCache: boolean; cachedAt: string | null; offline: boolean };

type Entry<T> = { data: T; at: string };

/** id del usuario según la sesión que supabase-js guarda en localStorage (sin red). */
export function cachedUid(): string {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? "";
      if (k.startsWith("sb-") && k.endsWith("-auth-token")) {
        const v = JSON.parse(localStorage.getItem(k) ?? "null");
        const id = v?.user?.id ?? v?.currentSession?.user?.id;
        if (typeof id === "string") return id;
      }
    }
  } catch { /* sin localStorage */ }
  return "anon";
}

/** Atajo para una consulta de lectura: devuelve lo mismo que `await builder`
 *  (data/error/count) pero, sin red, la última copia guardada. */
export async function cachedQuery<T>(key: string, builder: () => PromiseLike<T>): Promise<T> {
  const r = await cachedRead(cachedUid(), key, builder);
  return (r.data ?? ({ data: null, error: r.offline ? { message: "offline" } : null, count: null } as unknown as T));
}

function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

export async function cachedRead<T>(
  uid: string,
  key: string,
  fetcher: () => PromiseLike<T>,
  opts?: { isFailure?: (r: T) => boolean; onUpdate?: (fresh: T) => void },
): Promise<CachedResult<T>> {
  const k = `${uid}:${key}`;
  const isFailure = opts?.isFailure ?? ((r: T) => looksLikeNetworkError(r));
  const cached = await idbGet<Entry<T>>(k);

  // Con señal y copia guardada + onUpdate: se devuelve la copia al instante
  // (la pantalla aparece ya) y la lectura real sigue por detrás; cuando
  // llega, onUpdate la aplica. Así la app se siente rápida con y sin señal.
  if (isOnline() && cached && opts?.onUpdate) {
    const onUpdate = opts.onUpdate;
    Promise.resolve()
      .then(() => fetcher())
      .then(async (data) => {
        if (isFailure(data)) return;
        await idbSet(k, { data, at: new Date().toISOString() } satisfies Entry<T>);
        onUpdate(data);
      })
      .catch(() => { /* se queda con la copia */ });
    return { data: cached.data, fromCache: true, cachedAt: null, offline: false };
  }

  if (isOnline()) {
    try {
      const data = await withTimeout(fetcher(), 12000);
      if (!isFailure(data)) {
        await idbSet(k, { data, at: new Date().toISOString() } satisfies Entry<T>);
        return { data, fromCache: false, cachedAt: null, offline: false };
      }
    } catch { /* cae a la caché */ }
  }
  if (cached) return { data: cached.data, fromCache: true, cachedAt: cached.at, offline: true };
  return { data: null, fromCache: false, cachedAt: null, offline: true };
}
