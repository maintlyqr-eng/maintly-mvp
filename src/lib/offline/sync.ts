"use client";

// Sincronizador local-first (28/10/2026).
// - pull(uid): baja del servidor todo lo del mecánico (activos, servicios,
//   clientes, tareas, QR, perfil) y reemplaza las tablas locales. Bajada
//   completa por ahora (las tablas no tienen updated_at todavía); con los
//   volúmenes actuales es cuestión de un segundo. Cuando se agregue
//   updated_at pasa a ser incremental sin tocar las pantallas.
// - push(): sube la cola de cambios hechos sin señal, en orden. Un cambio
//   que el servidor rechaza (no por falta de red) queda marcado "failed"
//   con el motivo, visible en el indicador de sincronización.
// - La app escucha "mly:sync" para volver a leer la base local.

import { supabase } from "@/lib/supabase";
import { uploadAssetPhoto } from "@/lib/uploadAssetPhoto";
import { TABLES, type Row, replaceAll, getAll, putOne, deleteOne, metaGet, metaSet, clearStores } from "./db";
import { isOnline, looksLikeNetworkError } from "./cache";

export type QueueOp = {
  id: string;            // uuid del cambio
  uid: string;
  table: "service_records" | "assets" | "customers" | "calendar_tasks" | "mechanic_assets" | "qr_codes" | "asset_photo";
  op: "insert" | "update" | "upsert" | "delete" | "upload";
  blob?: Blob;           // foto a subir (op "upload"); IndexedDB guarda Blobs tal cual
  row: Record<string, unknown>;   // fila completa (insert/upsert) o campos (update)
  match?: Record<string, unknown>; // filtro para update/delete (normalmente { id })
  createdAt: string;
  status: "pending" | "failed";
  error?: string;
  attempts: number;
};

export type SyncState = { syncing: boolean; lastPullAt: string | null; pending: number; failed: number; error: string | null };

const listeners = new Set<(s: SyncState) => void>();
let state: SyncState = { syncing: false, lastPullAt: null, pending: 0, failed: 0, error: null };
function emit() { for (const l of listeners) l(state); if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("mly:sync", { detail: state })); }
function set(p: Partial<SyncState>) { state = { ...state, ...p }; emit(); }
export function getSyncState(): SyncState { return state; }
export function subscribeSync(cb: (s: SyncState) => void): () => void { listeners.add(cb); cb(state); return () => { listeners.delete(cb); }; }

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16); });
}

async function refreshCounts() {
  const q = await getAll<QueueOp>("queue");
  set({ pending: q.filter((o) => o.status === "pending").length, failed: q.filter((o) => o.status === "failed").length });
}

/** Si cambió el usuario, vacía la base local (los datos son por persona). */
async function ensureOwner(uid: string) {
  const owner = await metaGet<string>("owner");
  if (owner && owner !== uid) { await clearStores([...TABLES, "reads", "queue"]); }
  if (owner !== uid) await metaSet("owner", uid);
}

// ── Bajada ───────────────────────────────────────────────────────────────
let pulling: Promise<boolean> | null = null;

export function pull(uid: string): Promise<boolean> {
  if (pulling) return pulling;
  pulling = doPull(uid).finally(() => { pulling = null; });
  return pulling;
}

async function doPull(uid: string): Promise<boolean> {
  if (!isOnline()) return false;
  await ensureOwner(uid);
  set({ syncing: true, error: null });
  try {
    const [me, ma, svc, cus, tasks] = await Promise.all([
      supabase.from("mechanics").select("id, name, photo_url, maintler_code, email, profession").eq("id", uid).maybeSingle(),
      supabase.from("mechanic_assets").select("id, mechanic_id, asset_id, shared_by, added_at, assets(*), sharer:mechanics!mechanic_assets_shared_by_fkey(id, name)").eq("mechanic_id", uid),
      supabase.from("service_records").select("*").eq("mechanic_id", uid).is("deleted_at", null).order("service_date", { ascending: false }).limit(5000),
      supabase.from("customers").select("*").eq("mechanic_id", uid),
      supabase.from("calendar_tasks").select("*").eq("mechanic_id", uid),
    ]);
    const results = [me, ma, svc, cus, tasks];
    if (results.some((r) => looksLikeNetworkError(r))) { set({ syncing: false, error: "network" }); return false; }
    const firstErr = results.find((r) => r.error)?.error;
    if (firstErr) { set({ syncing: false, error: firstErr.message }); return false; }

    const maRows = (ma.data ?? []) as unknown as Array<Row & { asset_id: string; assets: Row | Row[] | null; sharer: Row | Row[] | null }>;
    const assets: Row[] = []; const sharers: Row[] = [];
    const links: Row[] = maRows.map((r) => {
      const a = Array.isArray(r.assets) ? r.assets[0] : r.assets;
      if (a) assets.push(a);
      const s = Array.isArray(r.sharer) ? r.sharer[0] : r.sharer;
      if (s) sharers.push(s);
      return { id: r.id, mechanic_id: r.mechanic_id, asset_id: r.asset_id, shared_by: r.shared_by ?? null, added_at: r.added_at };
    });
    const assetIds = assets.map((a) => a.id);
    // Códigos QR de esos activos y servicios de activos ajenos que
    // aparecen en el taller (historial completo por activo).
    const [qr, svcAll] = assetIds.length
      ? await Promise.all([
          supabase.from("qr_codes").select("id, code, asset_id, theme, label, created_by, created_at").in("asset_id", assetIds),
          supabase.from("service_records").select("*").in("asset_id", assetIds).is("deleted_at", null).order("service_date", { ascending: false }).limit(5000),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];
    if (looksLikeNetworkError(qr) || looksLikeNetworkError(svcAll)) { set({ syncing: false, error: "network" }); return false; }

    const svcMap = new Map<string, Row>();
    for (const r of ((svcAll.data ?? []) as Row[])) svcMap.set(r.id, r);
    for (const r of ((svc.data ?? []) as Row[])) svcMap.set(r.id, r);

    // Los cambios pendientes locales se conservan por encima de lo bajado.
    const queue = (await getAll<QueueOp>("queue")).filter((o) => o.status === "pending");
    const pendingSvc = queue.filter((o) => o.table === "service_records" && o.op === "insert").map((o) => o.row as Row);
    const pendingAssets = queue.filter((o) => o.table === "assets" && o.op === "insert").map((o) => o.row as Row);
    const pendingLinks = queue.filter((o) => o.table === "mechanic_assets" && o.op !== "delete").map((o) => o.row as Row);
    const pendingQr = queue.filter((o) => o.table === "qr_codes" && o.op === "insert").map((o) => o.row as Row);
    const pendingCus = queue.filter((o) => o.table === "customers" && o.op === "insert").map((o) => o.row as Row);

    await Promise.all([
      replaceAll("mechanics", [...(me.data ? [me.data as Row] : []), ...sharers]),
      replaceAll("assets", [...assets, ...pendingAssets]),
      replaceAll("mechanic_assets", [...links, ...pendingLinks]),
      replaceAll("qr_codes", [...((qr.data ?? []) as Row[]), ...pendingQr]),
      replaceAll("service_records", [...svcMap.values(), ...pendingSvc]),
      replaceAll("customers", [...((cus.data ?? []) as Row[]), ...pendingCus]),
      replaceAll("calendar_tasks", (tasks.data ?? []) as Row[]),
    ]);
    // Updates pendientes se re-aplican encima
    for (const o of queue) if (o.op === "update" && o.match?.id) {
      const cur = (await getAll<Row>(o.table)).find((r) => r.id === o.match!.id);
      if (cur) await putOne(o.table, { ...cur, ...o.row });
    }
    const at = new Date().toISOString();
    await metaSet("lastPullAt", at);
    set({ syncing: false, lastPullAt: at, error: null });
    return true;
  } catch (e) {
    set({ syncing: false, error: e instanceof Error ? e.message : "pull" });
    return false;
  }
}

// ── Cola / subida ────────────────────────────────────────────────────────
export async function enqueue(op: Omit<QueueOp, "id" | "createdAt" | "status" | "attempts">): Promise<QueueOp> {
  const full: QueueOp = { ...op, id: newId(), createdAt: new Date().toISOString(), status: "pending", attempts: 0 };
  await putOne("queue", full as unknown as Row);
  await refreshCounts();
  void push();
  return full;
}

let pushing: Promise<void> | null = null;
export function push(): Promise<void> {
  if (pushing) return pushing;
  pushing = doPush().finally(() => { pushing = null; });
  return pushing;
}

async function doPush() {
  if (!isOnline()) return;
  const ops = (await getAll<QueueOp>("queue")).filter((o) => o.status === "pending").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (ops.length === 0) return;
  let uid: string | null = null;
  for (const op of ops) {
    uid = op.uid;
    let error: { message: string } | null = null;
    try {
      if (op.table === "asset_photo") {
        // Foto de un activo creado sin señal: subir y guardar la URL.
        const assetId = String(op.row.asset_id);
        const file = op.blob instanceof File ? op.blob : new File([op.blob as Blob], String(op.row.name ?? "photo.jpg"), { type: (op.blob as Blob)?.type || "image/jpeg" });
        const up = await uploadAssetPhoto(supabase, file, assetId);
        if (up.url) { const r2 = await supabase.from("assets").update({ photo_url: up.url }).eq("id", assetId); error = r2.error; }
        else error = { message: up.error ?? "upload" };
        if (!error) { await deleteOne("queue", op.id); continue; }
        if (looksLikeNetworkError({ error })) break;
        await putOne("queue", { ...op, status: "failed", error: error.message, attempts: op.attempts + 1 } as unknown as Row);
        continue;
      }
      const t = supabase.from(op.table);
      let r: { error: { message: string } | null };
      if (op.op === "insert") r = await t.insert(op.row);
      else if (op.op === "upsert") r = await t.upsert(op.row, { onConflict: (op.match?.onConflict as string) ?? "id" });
      else if (op.op === "update") r = await t.update(op.row).match(op.match ?? {});
      else r = await t.delete().match(op.match ?? {});
      error = r.error;
    } catch (e) { error = { message: e instanceof Error ? e.message : "fetch" }; }
    if (!error) { await deleteOne("queue", op.id); continue; }
    if (looksLikeNetworkError({ error })) { break; }           // sin red: se reintenta después
    // Duplicado = ya se había subido en un intento anterior (la red cortó
    // después de que el servidor lo guardó). Se da por hecho.
    if (/duplicate|already exists|23505/i.test(error.message)) { await deleteOne("queue", op.id); continue; }
    await putOne("queue", { ...op, status: "failed", error: error.message, attempts: op.attempts + 1 } as unknown as Row);
  }
  await refreshCounts();
  if (uid) void pull(uid);
}

export async function retryFailed(): Promise<void> {
  const ops = (await getAll<QueueOp>("queue")).filter((o) => o.status === "failed");
  for (const o of ops) await putOne("queue", { ...o, status: "pending", error: undefined } as unknown as Row);
  await refreshCounts(); await push();
}
export async function discardFailed(id: string): Promise<void> { await deleteOne("queue", id); await refreshCounts(); }
export async function listQueue(): Promise<QueueOp[]> { return getAll<QueueOp>("queue"); }

// ── Arranque: sincroniza al abrir, al volver la señal y cada 5 minutos ──
let started = false;
export function startSync(uid: string) {
  if (started || typeof window === "undefined") return;
  started = true;
  metaGet<string>("lastPullAt").then((at) => { if (at) set({ lastPullAt: at }); });
  void refreshCounts();
  const run = () => { if (!isOnline()) return; push().then(() => pull(uid)); };
  run();
  window.addEventListener("online", run);
  window.addEventListener("focus", () => { const last = state.lastPullAt ? Date.parse(state.lastPullAt) : 0; if (Date.now() - last > 60_000) run(); });
  setInterval(run, 5 * 60_000);
  // Al cerrar sesión se borra todo lo local: los datos son de la persona,
  // no del dispositivo (un celular prestado no debe quedar con el taller).
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") { void clearStores([...TABLES, "reads", "queue"]); void metaSet("owner", ""); void metaSet("lastPullAt", ""); }
  });
}
