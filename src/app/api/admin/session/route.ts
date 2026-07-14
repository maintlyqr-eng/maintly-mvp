import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest, getAdminRole, getAdminUsername } from "@/lib/adminAuth";
import { capabilitiesForRole, isRoleReadOnly } from "@/lib/adminRoles";

// Incremento 11 (14 jul 2026): además de "ok", ahora devuelve el rol del
// admin logueado, sus capacidades, y si es de solo lectura — el frontend
// (admin/page.tsx) usa esto para filtrar el sidebar y bloquear acciones que
// ese rol no puede hacer, sin tener que duplicar el mapeo rol → capacidad
// que ya vive en src/lib/adminRoles.ts.
export async function GET(req: NextRequest) {
  const ok = isAdminRequest(req);
  if (!ok) return NextResponse.json({ ok: false });

  const role = getAdminRole(req);
  return NextResponse.json({
    ok: true,
    username: getAdminUsername(req),
    role,
    capabilities: capabilitiesForRole(role),
    readOnly: isRoleReadOnly(role),
  });
}
