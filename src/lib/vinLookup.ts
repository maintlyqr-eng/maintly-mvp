import { supabase } from "@/lib/supabase";

// Incremento 29 (Facu, escaneo de VIN) — un solo lugar para "¿ya existe un
// equipo con este VIN?", usado en dos flujos distintos:
//   1. NewAssetModalIntl.tsx: al crear un equipo nuevo, para avisar "este
//      auto ya está cargado" y evitar duplicados (pedido explícito de
//      Facu: "esta genial q no haya duplicados, esa es la idea").
//   2. Home / futuros lugares donde se escanea un VIN para ENCONTRAR un
//      equipo ya cargado (en vez de crear uno), igual que hoy se hace
//      escaneando el QR físico.
//
// `assets: lectura pública` (schema.sql) ya permite este mismo read sin
// sesión, así que usa el cliente anon normal -- no hace falta una ruta
// /api ni el service role.
export type VinMatch = {
  assetId: string;
  qrCode: string | null;
  displayName: string;
  assetType: string;
};

export async function findAssetByVin(vin: string): Promise<VinMatch | null> {
  const cleaned = vin.trim();
  if (!cleaned) return null;

  // ilike sin comodines (%) es igualdad exacta pero case-insensitive en
  // Postgres -- justo lo que hace falta acá, porque tanto el OCR como la
  // carga manual pueden variar en mayúsculas/minúsculas.
  const { data: asset } = await supabase
    .from("assets")
    .select("id, asset_type, brand, model, nickname")
    .ilike("vin_serial", cleaned)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (!asset) return null;

  // Un asset puede en teoría tener más de un QR asignado a lo largo del
  // tiempo (código perdido y reemplazado, etc.) -- cualquiera sirve para
  // navegar a la misma página pública, así que alcanza con el primero.
  const { data: qrRow } = await supabase
    .from("qr_codes")
    .select("code")
    .eq("asset_id", asset.id)
    .limit(1)
    .maybeSingle();

  const displayName =
    (asset.nickname as string | null)?.trim() ||
    [asset.brand, asset.model].filter(Boolean).join(" ").trim() ||
    (asset.asset_type as string);

  return {
    assetId: asset.id as string,
    qrCode: (qrRow?.code as string | undefined) ?? null,
    displayName,
    assetType: asset.asset_type as string,
  };
}
