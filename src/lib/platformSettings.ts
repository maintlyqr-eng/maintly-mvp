// Lectura pública (anon key) de la fila única de `platform_settings`
// (migración 037, incremento 17 de Item 6). Usado por los 3 puntos de
// carga de archivos (para los límites de tamaño configurables) y por
// el banner global del Dashboard (modo mantenimiento / anuncio).
//
// Cacheado en memoria por el tiempo de vida de la pestaña — no hace
// falta pedirlo de nuevo en cada componente que lo necesita, y un
// cambio hecho por el admin se ve la próxima vez que el Maintler
// recargue la página (no en tiempo real; mismo criterio de "simple"
// ya aplicado a otras partes de la app en este incremento).
//
// Si el fetch falla (offline, RLS todavía no migrada, etc.) se
// devuelven los mismos valores que estaban hardcodeados en el código
// antes de este incremento, para que nada se rompa silenciosamente.

import { supabase } from "@/lib/supabase";

export type PlatformSettings = {
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  bannerEnabled: boolean;
  bannerText: string | null;
  bannerSeverity: "info" | "warning" | "critical";
  bannerLinkUrl: string | null;
  maxAssetPhotoMb: number;
  maxDocumentMb: number;
  maxCertificateMb: number;
};

const FALLBACK_SETTINGS: PlatformSettings = {
  maintenanceMode: false,
  maintenanceMessage: null,
  bannerEnabled: false,
  bannerText: null,
  bannerSeverity: "info",
  bannerLinkUrl: null,
  maxAssetPhotoMb: 8,
  maxDocumentMb: 25,
  maxCertificateMb: 10,
};

let cached: PlatformSettings | null = null;
let inFlight: Promise<PlatformSettings> | null = null;

export async function fetchPlatformSettings(): Promise<PlatformSettings> {
  if (cached) return cached;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const { data, error } = await supabase.from("platform_settings").select("*").eq("id", true).single();
      if (error || !data) return FALLBACK_SETTINGS;

      const settings: PlatformSettings = {
        maintenanceMode: !!data.maintenance_mode,
        maintenanceMessage: data.maintenance_message ?? null,
        bannerEnabled: !!data.banner_enabled,
        bannerText: data.banner_text ?? null,
        bannerSeverity: (data.banner_severity as PlatformSettings["bannerSeverity"]) ?? "info",
        bannerLinkUrl: data.banner_link_url ?? null,
        maxAssetPhotoMb: typeof data.max_asset_photo_mb === "number" ? data.max_asset_photo_mb : FALLBACK_SETTINGS.maxAssetPhotoMb,
        maxDocumentMb: typeof data.max_document_mb === "number" ? data.max_document_mb : FALLBACK_SETTINGS.maxDocumentMb,
        maxCertificateMb: typeof data.max_certificate_mb === "number" ? data.max_certificate_mb : FALLBACK_SETTINGS.maxCertificateMb,
      };
      cached = settings;
      return settings;
    } catch {
      return FALLBACK_SETTINGS;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
