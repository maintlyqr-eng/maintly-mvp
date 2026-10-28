"use client";

// Base de datos local de MaintlyQR (local-first, 28/10/2026).
// IndexedDB a mano, sin dependencias. Una tabla local por tabla del
// servidor que el panel necesita, más la cola de cambios pendientes y
// metadatos de sincronización. Todas las pantallas del panel leen de acá
// (instantáneo, con o sin señal); src/lib/offline/sync.ts la mantiene al
// día con Supabase en segundo plano.

export const DB_NAME = "maintlyqr";
export const DB_VERSION = 2;

export const TABLES = ["mechanics", "assets", "mechanic_assets", "qr_codes", "service_records", "customers", "calendar_tasks"] as const;
export type Table = (typeof TABLES)[number];
const ALL_STORES = [...TABLES, "reads", "queue", "meta"] as const;

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("no indexedDB")); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of ALL_STORES) {
        if (db.objectStoreNames.contains(name)) continue;
        if (name === "queue") db.createObjectStore(name, { keyPath: "id" });
        else if (name === "reads" || name === "meta") db.createObjectStore(name);
        else db.createObjectStore(name, { keyPath: "id" });
      }
    };
    req.onsuccess = () => { req.result.onversionchange = () => { req.result.close(); dbPromise = null; }; resolve(req.result); };
    req.onerror = () => { dbPromise = null; reject(req.error); };
    req.onblocked = () => { /* otra pestaña con la versión vieja: se resuelve al cerrarla */ };
  });
  return dbPromise;
}

function tx(db: IDBDatabase, stores: string | string[], mode: IDBTransactionMode) {
  return db.transaction(stores, mode);
}
function reqToPromise<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
}
function done(t: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => { t.oncomplete = () => resolve(); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error); });
}

export type Row = Record<string, unknown> & { id: string };

export async function getAll<T = Row>(store: string): Promise<T[]> {
  try { const db = await openDb(); return (await reqToPromise(tx(db, store, "readonly").objectStore(store).getAll())) as T[]; }
  catch { return []; }
}
export async function getOne<T = Row>(store: string, id: string): Promise<T | undefined> {
  try { const db = await openDb(); return (await reqToPromise(tx(db, store, "readonly").objectStore(store).get(id))) as T | undefined; }
  catch { return undefined; }
}
export async function putMany(store: string, rows: Row[]): Promise<void> {
  if (rows.length === 0) return;
  const db = await openDb(); const t = tx(db, store, "readwrite"); const s = t.objectStore(store);
  for (const r of rows) s.put(r);
  await done(t);
}
export async function putOne(store: string, row: Row): Promise<void> { return putMany(store, [row]); }
export async function deleteOne(store: string, id: string): Promise<void> {
  const db = await openDb(); const t = tx(db, store, "readwrite"); t.objectStore(store).delete(id); await done(t);
}
/** Reemplaza el contenido entero de una tabla (bajada completa). */
export async function replaceAll(store: string, rows: Row[]): Promise<void> {
  const db = await openDb(); const t = tx(db, store, "readwrite"); const s = t.objectStore(store);
  s.clear(); for (const r of rows) s.put(r);
  await done(t);
}
export async function clearStores(stores: string[]): Promise<void> {
  const db = await openDb(); const t = tx(db, stores, "readwrite");
  for (const s of stores) t.objectStore(s).clear();
  await done(t);
}
export async function metaGet<T>(key: string): Promise<T | undefined> {
  try { const db = await openDb(); return (await reqToPromise(tx(db, "meta", "readonly").objectStore("meta").get(key))) as T | undefined; }
  catch { return undefined; }
}
export async function metaSet(key: string, value: unknown): Promise<void> {
  try { const db = await openDb(); const t = tx(db, "meta", "readwrite"); t.objectStore("meta").put(value, key); await done(t); } catch { /* sin IDB */ }
}
