// Server-only helper. Verifies the signed admin session cookie set by
// /api/admin/login. Import this only from route handlers (src/app/api/**) —
// never from a "use client" component.

import crypto from "crypto";
import { NextRequest } from "next/server";
import {
  AdminCapability,
  AdminRole,
  isValidAdminRole,
  roleHasCapability,
  isRoleReadOnly,
} from "@/lib/adminRoles";

export const ADMIN_COOKIE_NAME = "mly_admin_session";

// Token format (incremento 11, 14 jul 2026 — agrega el rol al token
// firmado, ver src/lib/adminRoles.ts para el modelo de roles):
// "<expiry>.<base64url(username)>.<base64url(role)>.<hmac>", donde el hmac
// firma "<expiry>.<usernameB64>.<roleB64>". El rol viaja adentro de la
// cookie firmada (no en una cookie separada sin firmar) por la misma razón
// que el username: así ninguno de los dos puede alterarse por separado del
// resto del token.
//
// Esto es un cambio de formato respecto al token de 3 partes que existía
// antes (incrementos 1-10, un solo admin sin rol) — verifyAdminSession
// ahora exige 4 partes, así que cualquier sesión activa al momento del
// deploy deja de ser válida y ese admin tiene que loguearse una vez más;
// después de eso, todas las sesiones nuevas ya incluyen el rol.
export function signAdminToken(expiry: number, username: string, role: AdminRole, secret: string): string {
  const usernameB64 = Buffer.from(username, "utf8").toString("base64url");
  const roleB64 = Buffer.from(role, "utf8").toString("base64url");
  const hmac = crypto.createHmac("sha256", secret).update(`${expiry}.${usernameB64}.${roleB64}`).digest("hex");
  return `${expiry}.${usernameB64}.${roleB64}.${hmac}`;
}

export function verifyAdminSession(
  token: string | undefined,
  secret: string | undefined
): { valid: boolean; username: string | null; role: AdminRole | null } {
  if (!token || !secret) return { valid: false, username: null, role: null };

  const parts = token.split(".");
  if (parts.length !== 4) return { valid: false, username: null, role: null };
  const [expiryStr, usernameB64, roleB64, hmac] = parts;

  const expiry = Number(expiryStr);
  if (!expiry || Date.now() > expiry) return { valid: false, username: null, role: null };

  const expected = crypto.createHmac("sha256", secret).update(`${expiryStr}.${usernameB64}.${roleB64}`).digest("hex");
  const a = Buffer.from(hmac, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { valid: false, username: null, role: null };

  let username: string | null = null;
  let role: AdminRole | null = null;
  try {
    username = Buffer.from(usernameB64, "base64url").toString("utf8") || null;
    const roleStr = Buffer.from(roleB64, "base64url").toString("utf8");
    role = isValidAdminRole(roleStr) ? roleStr : null;
  } catch {
    username = null;
    role = null;
  }
  if (!username || !role) return { valid: false, username: null, role: null };
  return { valid: true, username, role };
}

/** Returns true if the incoming request carries a valid admin session cookie. */
export function isAdminRequest(req: NextRequest): boolean {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminSession(token, process.env.ADMIN_SESSION_SECRET).valid;
}

/** Returns the admin username embedded in a valid session cookie, or null if absent/invalid. */
export function getAdminUsername(req: NextRequest): string | null {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const { valid, username } = verifyAdminSession(token, process.env.ADMIN_SESSION_SECRET);
  return valid ? username : null;
}

/** Rol del admin logueado (incremento 11), o null si no hay sesión válida. */
export function getAdminRole(req: NextRequest): AdminRole | null {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const { valid, role } = verifyAdminSession(token, process.env.ADMIN_SESSION_SECRET);
  return valid ? role : null;
}

/**
 * Gate de una sola línea para el principio de cada handler de ruta que
 * necesite una capacidad puntual (ver src/lib/adminRoles.ts): true solo si
 * hay sesión válida Y el rol de esa sesión tiene esa capacidad. No
 * distingue lectura de escritura — para eso ver isAdminReadOnly, que hay
 * que combinar aparte en las rutas que mutan datos (Analytics Viewer tiene
 * la capacidad "reports" pero solo para leer, nunca para escribir).
 */
export function adminHasCapability(req: NextRequest, capability: AdminCapability): boolean {
  return roleHasCapability(getAdminRole(req), capability);
}

/** true si el rol logueado tiene AL MENOS UNA de las capacidades dadas — para rutas que sirven más de un dominio a la vez (ej. bulk-data, trash). */
export function adminHasAnyCapability(req: NextRequest, capabilities: AdminCapability[]): boolean {
  const role = getAdminRole(req);
  return capabilities.some((c) => roleHasCapability(role, c));
}

/** true si el rol logueado es de solo lectura (hoy: analytics_viewer). */
export function isAdminReadOnly(req: NextRequest): boolean {
  return isRoleReadOnly(getAdminRole(req));
}
