import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { signAdminToken } from "@/lib/adminAuth";
import { verifyPassword } from "@/lib/adminPassword";
import { AdminRole } from "@/lib/adminRoles";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction, getRequestIp } from "@/lib/auditLog";

// This file runs ONLY on the server. Nothing here — including the
// comparisons below and the ADMIN_USERNAME / ADMIN_PASSWORD values it
// reads from the environment — is ever sent to the browser.

const COOKIE_NAME = "mly_admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// Incremento 11 (14 jul 2026, base de roles y permisos — item 12 del
// pedido original de Facu): el login ahora prueba DOS caminos, en orden:
//
// 1) admin_users (migración 035) — cualquier admin creado desde la sección
//    "Administradores" del panel (Super Admin únicamente) entra por acá,
//    con su propio usuario/contraseña y el rol que se le asignó.
// 2) Si no matchea ningún admin_users activo, cae al login legado de
//    siempre: usuario/contraseña de ADMIN_USERNAME/ADMIN_PASSWORD (env
//    vars), tratado siempre como super_admin. Esto es a propósito — Facu
//    pidió explícitamente dejar la base de roles lista pero seguir siendo
//    el único que entra por ahora, así que su login de siempre no puede
//    dejar de funcionar ni depender de que se cree una fila nueva en la
//    base para él.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    console.error("Admin login: missing ADMIN_SESSION_SECRET env var.");
    return NextResponse.json({ error: "Admin login is not configured on the server." }, { status: 500 });
  }
  if (!username || !password) {
    return NextResponse.json({ error: "Incorrect credentials. Please try again." }, { status: 401 });
  }

  let authedUsername: string | null = null;
  let authedRole: AdminRole | null = null;

  const admin = getSupabaseAdmin();
  const { data: dbUser } = await admin
    .from("admin_users")
    .select("id, username, password_hash, role, active")
    .eq("active", true)
    .ilike("username", username)
    .maybeSingle();

  if (dbUser && verifyPassword(password, dbUser.password_hash)) {
    authedUsername = dbUser.username;
    authedRole = dbUser.role as AdminRole;
    // Best-effort — un fallo acá nunca debe bloquear un login que ya es válido.
    admin.from("admin_users").update({ last_login_at: new Date().toISOString() }).eq("id", dbUser.id)
      .then(({ error }) => { if (error) console.error("Failed to stamp admin last_login_at:", error.message); });
  } else {
    const validUser = process.env.ADMIN_USERNAME;
    const validPass = process.env.ADMIN_PASSWORD;
    // Constant-time comparison so response timing can't leak how many
    // characters matched.
    if (validUser && validPass && timingSafeEqualStr(username, validUser) && timingSafeEqualStr(password, validPass)) {
      authedUsername = validUser;
      authedRole = "super_admin";
    }
  }

  if (!authedUsername || !authedRole) {
    return NextResponse.json({ error: "Incorrect credentials. Please try again." }, { status: 401 });
  }

  const expiry = Date.now() + SESSION_TTL_MS;
  const token = signAdminToken(expiry, authedUsername, authedRole, secret);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });

  // Best-effort — a logging hiccup should never block a successful login.
  await logAdminAction({ adminUsername: authedUsername, action: "admin.login", ipAddress: getRequestIp(req) });

  return res;
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    // Still run a comparison of equal length to avoid an obvious timing
    // shortcut, then return false.
    crypto.timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}
