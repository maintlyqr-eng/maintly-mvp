"use client";

// Consultas sobre la base local (local-first, 28/10/2026). Devuelven las
// mismas formas que las consultas a Supabase que usaban las pantallas
// (anidados `assets(...)`, `qr_codes(...)`, `sharer`), así las pantallas
// cambian una línea y no su lógica. Siempre instantáneas, con o sin señal.

import { getAll, type Row } from "./db";
import { enqueue, newId } from "./sync";

type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function localMe(uid: string): Promise<Any | null> {
  return ((await getAll<Any>("mechanics")).find((m) => m.id === uid) ?? null);
}

/** mechanic_assets del taller con `assets` (+ `qr_codes`) y `sharer`, como la consulta de Activos. */
export async function localWorkshop(uid: string): Promise<Any[]> {
  const [links, assets, qrs, mechs] = await Promise.all([getAll<Any>("mechanic_assets"), getAll<Any>("assets"), getAll<Any>("qr_codes"), getAll<Any>("mechanics")]);
  const assetById = new Map(assets.map((a) => [a.id, a]));
  const qrByAsset = new Map<string, Any[]>();
  for (const q of qrs) { const arr = qrByAsset.get(q.asset_id) ?? []; arr.push(q); qrByAsset.set(q.asset_id, arr); }
  const mechById = new Map(mechs.map((m) => [m.id, m]));
  return links
    .filter((l) => l.mechanic_id === uid)
    .sort((a, b) => String(b.added_at ?? "").localeCompare(String(a.added_at ?? "")))
    .map((l) => {
      const a = assetById.get(l.asset_id);
      return {
        id: l.id, asset_id: l.asset_id, shared_by: l.shared_by ?? null, added_at: l.added_at,
        sharer: l.shared_by && mechById.get(l.shared_by) ? { name: mechById.get(l.shared_by)!.name } : null,
        assets: a ? { ...a, qr_codes: (qrByAsset.get(a.id) ?? []).map((q) => ({ code: q.code, theme: q.theme ?? null, label: q.label ?? null })) } : null,
      };
    });
}

/** Activos vivos del taller, planos, con qr_code y nombre de quien lo compartió. */
export async function localAssets(uid: string): Promise<Any[]> {
  return (await localWorkshop(uid)).map((r) => r.assets ? { ...r.assets, sharedBy: r.shared_by, sharerName: r.sharer?.name ?? null } : null).filter((a) => a && !a.deleted_at) as Any[];
}

/** Servicios del mecánico (no borrados ni ocultos del panel) con `assets(...)` anidado, más recientes primero. */
export async function localServices(uid: string, opts?: { includeHidden?: boolean }): Promise<Any[]> {
  const [svcs, assets, qrs] = await Promise.all([getAll<Any>("service_records"), getAll<Any>("assets"), getAll<Any>("qr_codes")]);
  const assetById = new Map(assets.map((a) => [a.id, a]));
  const qrByAsset = new Map<string, Any[]>();
  for (const q of qrs) { const arr = qrByAsset.get(q.asset_id) ?? []; arr.push(q); qrByAsset.set(q.asset_id, arr); }
  return svcs
    .filter((s) => s.mechanic_id === uid && !s.deleted_at && (opts?.includeHidden || !s.hidden_from_panel_at))
    .sort((a, b) => String(b.service_date).localeCompare(String(a.service_date)) || String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
    .map((s) => { const a = assetById.get(s.asset_id); return { ...s, assets: a ? { ...a, qr_codes: (qrByAsset.get(a.id) ?? []).map((q) => ({ code: q.code })) } : null }; });
}

/** Historial completo de un activo (todos los mecánicos), más reciente primero. */
export async function localAssetHistory(assetId: string): Promise<Any[]> {
  return (await getAll<Any>("service_records")).filter((s) => s.asset_id === assetId && !s.deleted_at).sort((a, b) => String(b.service_date).localeCompare(String(a.service_date)));
}

export async function localCustomers(uid: string): Promise<Any[]> {
  return (await getAll<Any>("customers")).filter((c) => c.mechanic_id === uid).sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
}

export async function localTasks(uid: string): Promise<Any[]> {
  return (await getAll<Any>("calendar_tasks")).filter((t) => t.mechanic_id === uid);
}

// ── Cambios (se aplican al instante en la base local y se encolan) ───────

export async function createServiceRecord(uid: string, row: { asset_id: string; service_type: string; service_date: string; km_hours: number | null; notes: string | null; customer_id: string | null; next_due_date?: string | null; next_due_km_hours?: number | null }): Promise<string> {
  const id = newId();
  const full = { id, mechanic_id: uid, created_at: new Date().toISOString(), ...row };
  const { putOne } = await import("./db");
  await putOne("service_records", full);
  await enqueue({ uid, table: "service_records", op: "insert", row: full });
  return id;
}

export async function updateAssetFields(uid: string, assetId: string, fields: Record<string, unknown>): Promise<void> {
  const { getOne, putOne } = await import("./db");
  const cur = await getOne<Row>("assets", assetId);
  if (cur) await putOne("assets", { ...cur, ...fields });
  await enqueue({ uid, table: "assets", op: "update", row: fields, match: { id: assetId } });
}

export async function updateServiceFields(uid: string, serviceId: string, fields: Record<string, unknown>): Promise<void> {
  const { getOne, putOne } = await import("./db");
  const cur = await getOne<Row>("service_records", serviceId);
  if (cur) await putOne("service_records", { ...cur, ...fields });
  await enqueue({ uid, table: "service_records", op: "update", row: fields, match: { id: serviceId } });
}

export async function createCustomer(uid: string, row: { name: string; phone?: string | null; email?: string | null; notes?: string | null }): Promise<string> {
  const id = newId();
  const full = { id, mechanic_id: uid, created_at: new Date().toISOString(), ...row };
  const { putOne } = await import("./db");
  await putOne("customers", full);
  await enqueue({ uid, table: "customers", op: "insert", row: full });
  return id;
}

/** Tareas del calendario con `assets(...)` anidado, por orden de creación. */
export async function localTasksWithAssets(uid: string): Promise<Any[]> {
  const [tasks, assets] = await Promise.all([getAll<Any>("calendar_tasks"), getAll<Any>("assets")]);
  const assetById = new Map(assets.map((a) => [a.id, a]));
  return tasks
    .filter((t) => t.mechanic_id === uid)
    .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")))
    .map((t) => { const a = t.asset_id ? assetById.get(t.asset_id) : null; return { ...t, assets: a ? { id: a.id, nickname: a.nickname, brand: a.brand, model: a.model, asset_type: a.asset_type } : null }; });
}

export async function createTask(uid: string, row: { asset_id: string | null; title: string; notes: string | null; task_date: string; customer_id: string | null }): Promise<string> {
  const id = newId();
  const full = { id, mechanic_id: uid, done: false, created_at: new Date().toISOString(), ...row };
  const { putOne } = await import("./db");
  await putOne("calendar_tasks", full);
  await enqueue({ uid, table: "calendar_tasks", op: "insert", row: full });
  return id;
}
export async function updateTask(uid: string, id: string, fields: Record<string, unknown>): Promise<void> {
  const { getOne, putOne } = await import("./db");
  const cur = await getOne<Row>("calendar_tasks", id);
  if (cur) await putOne("calendar_tasks", { ...cur, ...fields });
  await enqueue({ uid, table: "calendar_tasks", op: "update", row: fields, match: { id } });
}
export async function deleteTask(uid: string, id: string): Promise<void> {
  const { deleteOne } = await import("./db");
  await deleteOne("calendar_tasks", id);
  await enqueue({ uid, table: "calendar_tasks", op: "delete", row: {}, match: { id } });
}

export async function updateCustomer(uid: string, id: string, fields: Record<string, unknown>): Promise<void> {
  const { getOne, putOne } = await import("./db");
  const cur = await getOne<Row>("customers", id);
  if (cur) await putOne("customers", { ...cur, ...fields });
  await enqueue({ uid, table: "customers", op: "update", row: fields, match: { id } });
}
export async function deleteCustomer(uid: string, id: string): Promise<void> {
  const { deleteOne } = await import("./db");
  await deleteOne("customers", id);
  await enqueue({ uid, table: "customers", op: "delete", row: {}, match: { id } });
}

/** Activo nuevo creado desde el dispositivo (con o sin señal): activo + su
 *  código QR + vínculo con el taller, y la foto en cola si la hay. */
export async function createAssetLocal(uid: string, asset: Record<string, unknown>, code: string, photo?: File | null): Promise<string> {
  const { putOne } = await import("./db");
  const id = newId();
  const now = new Date().toISOString();
  const assetRow = { id, created_by: uid, created_at: now, photo_url: null, ...asset };
  const qrRow = { id: newId(), code, asset_id: id, created_by: uid, created_at: now };
  const linkRow = { id: newId(), mechanic_id: uid, asset_id: id, qr_code: code, added_at: now };
  await putOne("assets", assetRow);
  await putOne("qr_codes", qrRow);
  await putOne("mechanic_assets", linkRow);
  await enqueue({ uid, table: "assets", op: "insert", row: assetRow });
  await enqueue({ uid, table: "qr_codes", op: "insert", row: qrRow });
  // insert (no upsert): si ya existía, el "duplicate" se toma como subido.
  await enqueue({ uid, table: "mechanic_assets", op: "insert", row: linkRow });
  if (photo) {
    // Vista previa local mientras se sube: data URL en la fila local.
    try {
      const dataUrl = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(photo); });
      await putOne("assets", { ...assetRow, photo_url: dataUrl });
    } catch { /* sin vista previa */ }
    await enqueue({ uid, table: "asset_photo", op: "upload", row: { asset_id: id, name: photo.name }, blob: photo });
  }
  return id;
}
