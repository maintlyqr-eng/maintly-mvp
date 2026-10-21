"use client";

// Lado cliente: pide una vez por sesión de pestaña la ubicación aproximada
// (/api/geo, que la lee de las cabeceras de Vercel) y la guarda en
// sessionStorage. Nunca falla el flujo que la usa: si no hay, devuelve nulls.
export type GeoClient = { country: string | null; region: string | null; city: string | null };

const KEY = "mly_geo_v1";

export async function getGeo(): Promise<GeoClient> {
  const empty: GeoClient = { country: null, region: null, city: null };
  try {
    const cached = sessionStorage.getItem(KEY);
    if (cached) return JSON.parse(cached) as GeoClient;
  } catch { /* sin sessionStorage */ }
  try {
    const r = await fetch("/api/geo", { signal: AbortSignal.timeout(4000) });
    const j = await r.json();
    const geo: GeoClient = { country: j.country ?? null, region: j.region ?? null, city: j.city ?? null };
    try { sessionStorage.setItem(KEY, JSON.stringify(geo)); } catch { /* ignorar */ }
    return geo;
  } catch {
    return empty;
  }
}
