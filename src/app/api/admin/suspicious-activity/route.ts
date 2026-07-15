import { NextRequest, NextResponse } from "next/server";
import { adminHasCapability } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// GET: detección de spam / actividad sospechosa (incremento 18 de Item 6,
// Fase 3 "Escalabilidad", ítem 2 del orden ya autorizado por Facu —
// "vamos en ese orden dale...", ver claude/MAINTLYQR_FEATURE_BACKLOG.md).
//
// Deliberadamente NO es un sistema en tiempo real ni usa infraestructura
// nueva (sin colas, sin webhooks, sin jobs programados) — mismo criterio
// "simple y funcional" de todo Item 6. Es un reporte calculado on-demand
// a partir de datos que la app ya guarda (mechanics/assets/service_records/
// content_reports), igual que /api/admin/analytics. Cada vez que el admin
// abre la pestaña "Actividad sospechosa" (ver admin/page.tsx), esta ruta
// vuelve a calcular todo desde cero — no hay tabla de "flags" persistida,
// así que no hay nada que quede desactualizado ni que limpiar.
//
// 4 heurísticas, gateadas por umbral, cada una suma puntos a un "score" de
// sospecha por Maintler. Ningún umbral es mágico ni viene de un análisis
// estadístico del dataset real de Facu (todavía muy chico para eso) — son
// valores de sentido común, documentados acá, pensados para ajustarse con
// el tiempo si generan falsos positivos/negativos:
//
//   1. Ráfaga de activos: N o más activos creados por el mismo Maintler
//      dentro de una ventana de 1 hora. Señal clásica de bot/script.
//   2. Ráfaga de registros de servicio: mismo criterio que (1), sobre
//      service_records.
//   3. Notas duplicadas: N o más registros de servicio del mismo Maintler
//      con exactamente el mismo texto en `notes` (normalizado a
//      minúsculas/sin espacios de más). Solo cuenta notas de más de cierta
//      longitud para no marcar frases genéricas cortas como "cambio de
//      aceite" que un Maintler real perfectamente puede repetir a mano.
//   4. Cuenta nueva con volumen alto: un Maintler cuya cuenta tiene menos
//      de 48hs y ya acumuló un volumen alto de activos + registros —
//      patrón típico de un script que se registra y carga contenido de
//      inmediato, distinto de un uso orgánico gradual.
//
// Un quinto dato (no es una heurística de comportamiento, es un hecho ya
// registrado) sí sube el score: cuántos content_reports (migración 032)
// tiene encima el Maintler, ya sea directo (mechanic_id) o sobre alguno de
// sus activos (asset_id). Reportes reales de otros usuarios son la señal
// más confiable que ya existe en la base.
//
// El resultado NO suspende ni modifica nada por su cuenta — es una lista
// ordenada por score para que el admin revise y, si corresponde, suspenda
// manualmente desde el modal de detalle de cuenta ya existente (mismo botón
// "Suspender" de siempre, con su propio log de auditoría vía account.update
// en /api/admin/accounts).
const MECHANICS_CAP = 5000;
const ASSETS_CAP = 10000;
const SERVICE_RECORDS_CAP = 10000;
const REPORTS_CAP = 5000;

const BURST_WINDOW_MS = 60 * 60 * 1000; // 1 hora
const BURST_ASSET_THRESHOLD = 8;
const BURST_SERVICE_THRESHOLD = 8;
const DUPLICATE_NOTES_THRESHOLD = 5;
const DUPLICATE_NOTES_MIN_LENGTH = 15;
const NEW_ACCOUNT_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 horas
const NEW_ACCOUNT_VOLUME_THRESHOLD = 15;
const MAX_FLAGGED_RESULTS = 100;

type Reason =
  | { key: "burst_assets"; count: number }
  | { key: "burst_services"; count: number }
  | { key: "duplicate_notes"; count: number }
  | { key: "reported"; count: number }
  | { key: "new_account_volume"; count: number };

type FlaggedMechanic = {
  mechanicId: string;
  name: string;
  email: string;
  createdAt: string;
  suspended: boolean;
  score: number;
  reasons: Reason[];
};

// Cuenta el máximo de eventos que caen dentro de cualquier ventana deslizante
// de `windowMs` milisegundos — two-pointer sobre los timestamps ordenados,
// O(n log n) por el sort. Ej: [t, t+10min, t+20min, t+90min] con ventana de
// 1h da 3 (los primeros tres caen todos dentro de una ventana de 1h).
function maxBurstCount(timestampsMs: number[], windowMs: number): number {
  if (timestampsMs.length === 0) return 0;
  const sorted = [...timestampsMs].sort((a, b) => a - b);
  let left = 0;
  let max = 0;
  for (let right = 0; right < sorted.length; right++) {
    while (sorted[right] - sorted[left] > windowMs) left++;
    max = Math.max(max, right - left + 1);
  }
  return max;
}

function normalizeNotes(notes: string): string {
  return notes.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function GET(req: NextRequest) {
  // Mismo capability que "Reportes y Moderación" (ver SECTION_CAPABILITY en
  // admin/page.tsx) — esta pestaña vive dentro de esa misma sección. Solo
  // lectura, así que Analytics Viewer (que también tiene "reports", de solo
  // lectura) puede verla igual que puede ver Reportes.
  if (!adminHasCapability(req, "reports")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const admin = getSupabaseAdmin();

  const [mechanicsRes, assetsRes, servicesRes, reportsRes] = await Promise.all([
    admin
      .from("mechanics")
      .select("id, name, email, created_at, suspended")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(MECHANICS_CAP),
    admin
      .from("assets")
      .select("id, created_by, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(ASSETS_CAP),
    admin
      .from("service_records")
      .select("mechanic_id, created_at, notes")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(SERVICE_RECORDS_CAP),
    admin
      .from("content_reports")
      .select("mechanic_id, asset_id")
      .limit(REPORTS_CAP),
  ]);

  const firstError = [mechanicsRes.error, assetsRes.error, servicesRes.error, reportsRes.error].find(Boolean);
  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  const mechanics = mechanicsRes.data ?? [];
  const assets = assetsRes.data ?? [];
  const services = servicesRes.data ?? [];
  const reports = reportsRes.data ?? [];

  // Activo → dueño, para poder atribuirle a un Maintler los reportes que
  // apuntan a uno de sus activos (content_reports.asset_id) además de los
  // que lo apuntan a él directo (content_reports.mechanic_id).
  const ownerByAssetId = new Map<string, string>();
  const assetTimestampsByMechanic = new Map<string, number[]>();
  for (const a of assets) {
    if (!a.created_by || !a.created_at) continue;
    ownerByAssetId.set(a.id, a.created_by);
    const arr = assetTimestampsByMechanic.get(a.created_by) ?? [];
    arr.push(new Date(a.created_at).getTime());
    assetTimestampsByMechanic.set(a.created_by, arr);
  }

  const serviceTimestampsByMechanic = new Map<string, number[]>();
  const serviceNotesByMechanic = new Map<string, string[]>();
  for (const s of services) {
    if (!s.mechanic_id || !s.created_at) continue;
    const tsArr = serviceTimestampsByMechanic.get(s.mechanic_id) ?? [];
    tsArr.push(new Date(s.created_at).getTime());
    serviceTimestampsByMechanic.set(s.mechanic_id, tsArr);

    if (s.notes && s.notes.trim().length >= DUPLICATE_NOTES_MIN_LENGTH) {
      const notesArr = serviceNotesByMechanic.get(s.mechanic_id) ?? [];
      notesArr.push(normalizeNotes(s.notes));
      serviceNotesByMechanic.set(s.mechanic_id, notesArr);
    }
  }

  const reportsCountByMechanic = new Map<string, number>();
  for (const r of reports) {
    const targetMechanicId = r.mechanic_id ?? (r.asset_id ? ownerByAssetId.get(r.asset_id) ?? null : null);
    if (!targetMechanicId) continue;
    reportsCountByMechanic.set(targetMechanicId, (reportsCountByMechanic.get(targetMechanicId) ?? 0) + 1);
  }

  const now = Date.now();
  const flagged: FlaggedMechanic[] = [];

  for (const m of mechanics) {
    const reasons: Reason[] = [];
    let score = 0;

    const assetTimestamps = assetTimestampsByMechanic.get(m.id) ?? [];
    const serviceTimestamps = serviceTimestampsByMechanic.get(m.id) ?? [];

    const burstAssets = maxBurstCount(assetTimestamps, BURST_WINDOW_MS);
    if (burstAssets >= BURST_ASSET_THRESHOLD) {
      reasons.push({ key: "burst_assets", count: burstAssets });
      score += 3;
    }

    const burstServices = maxBurstCount(serviceTimestamps, BURST_WINDOW_MS);
    if (burstServices >= BURST_SERVICE_THRESHOLD) {
      reasons.push({ key: "burst_services", count: burstServices });
      score += 3;
    }

    const notes = serviceNotesByMechanic.get(m.id) ?? [];
    if (notes.length > 0) {
      const countByNote = new Map<string, number>();
      for (const n of notes) countByNote.set(n, (countByNote.get(n) ?? 0) + 1);
      const maxDuplicateCount = Math.max(0, ...countByNote.values());
      if (maxDuplicateCount >= DUPLICATE_NOTES_THRESHOLD) {
        reasons.push({ key: "duplicate_notes", count: maxDuplicateCount });
        score += 2;
      }
    }

    const reportsCount = reportsCountByMechanic.get(m.id) ?? 0;
    if (reportsCount > 0) {
      reasons.push({ key: "reported", count: reportsCount });
      score += Math.min(reportsCount * 2, 10);
    }

    const accountAgeMs = now - new Date(m.created_at).getTime();
    const totalVolume = assetTimestamps.length + serviceTimestamps.length;
    if (accountAgeMs >= 0 && accountAgeMs <= NEW_ACCOUNT_WINDOW_MS && totalVolume >= NEW_ACCOUNT_VOLUME_THRESHOLD) {
      reasons.push({ key: "new_account_volume", count: totalVolume });
      score += 3;
    }

    if (score > 0) {
      flagged.push({
        mechanicId: m.id,
        name: m.name,
        email: m.email,
        createdAt: m.created_at,
        suspended: m.suspended,
        score,
        reasons,
      });
    }
  }

  flagged.sort((a, b) => b.score - a.score);

  return NextResponse.json({
    flagged: flagged.slice(0, MAX_FLAGGED_RESULTS),
    flaggedTotal: flagged.length,
    scannedMechanics: mechanics.length,
    scannedAssets: assets.length,
    scannedServices: services.length,
    scannedReports: reports.length,
    truncated:
      mechanics.length >= MECHANICS_CAP ||
      assets.length >= ASSETS_CAP ||
      services.length >= SERVICE_RECORDS_CAP ||
      reports.length >= REPORTS_CAP,
  });
}
