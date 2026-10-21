import { NextRequest, NextResponse } from "next/server";
import { geoFromRequest } from "@/lib/geo";

// Devuelve la ubicación aproximada por IP del que llama (cabeceras de
// Vercel). Pública y sin datos sensibles: solo país / región / ciudad.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return NextResponse.json(geoFromRequest(req), { headers: { "cache-control": "no-store" } });
}
