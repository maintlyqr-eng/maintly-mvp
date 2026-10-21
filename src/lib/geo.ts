import type { NextRequest } from "next/server";

// Ubicación aproximada por IP, a partir de las cabeceras que Vercel agrega
// a cada pedido (x-vercel-ip-country, -country-region, -city). Solo
// servidor. En local no existen → todo null.
export type Geo = { country: string | null; region: string | null; city: string | null };

export function geoFromRequest(req: NextRequest): Geo {
  const h = (n: string) => { const v = req.headers.get(n); return v ? decodeURIComponent(v).trim() || null : null; };
  return { country: h("x-vercel-ip-country"), region: h("x-vercel-ip-country-region"), city: h("x-vercel-ip-city") };
}
