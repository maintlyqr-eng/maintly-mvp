"use client";

// Caché local de lecturas (etapa A, 28/10/2026): guarda en IndexedDB el
// último resultado de cada consulta del dashboard, por usuario, para
// mostrarlo cuando no hay señal. La etapa B (cola de cambios) usa la misma
// base. Sin dependencias: IndexedDB a mano, ~60 líneas.
//
// Uso:  const r = await cachedRead(uid, "assets", () => supabase.from(...));
//       r.data (el mismo tipo que devuelve el fetcher), r.fromCache,
//       r.cachedAt, r.offline (true si no había red ni copia guardada).

const DB_NAME = "maintlyqr";
const STORE = "reads";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("no indexedDB")); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains("queue")) db.createObjectStore("queue", { keyPath: "id" }); // etapa B
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

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

export async function cachedRead<T>(uid: string, key: string, fetcher: () => PromiseLike<T>, opts?: { isFailure?: (r: T) => boolean }): Promise<CachedResult<T>> {
  const k = `${uid}:${key}`;
  const isFailure = opts?.isFailure ?? ((r: T) => looksLikeNetworkError(r));
  if (isOnline()) {
    try {
      const data = await fetcher();
      if (!isFailure(data)) {
        await idbSet(k, { data, at: new Date().toISOString() } satisfies Entry<T>);
        return { data, fromCache: false, cachedAt: null, offline: false };
      }
    } catch { /* cae a la caché */ }
  }
  const cached = await idbGet<Entry<T>>(k);
  if (cached) return { data: cached.data, fromCache: true, cachedAt: cached.at, offline: true };
  return { data: null, fromCache: false, cachedAt: null, offline: true };
}
