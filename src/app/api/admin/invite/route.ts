import { NextRequest, NextResponse } from "next/server";
import { signAdminToken } from "@/lib/adminAuth";
import { hashInviteToken } from "@/lib/adminInvite";
import { hashPassword } from "@/lib/adminPassword";
import { AdminRole } from "@/lib/adminRoles";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction, getRequestIp } from "@/lib/auditLog";

// Aceptar una invitación de admin (migración 052). Ruta PÚBLICA: la única
// credencial es el token del link, que se valida contra su hash y vence a
// los 7 días. Un token sirve una sola vez.
//
// GET  ?t=<token>            → { ok, username, role } si es válido.
// POST { token, password }   → fija la contraseña, invalida el token y deja
//                              a la persona logueada (misma cookie que el
//                              login) para que caiga directo en su panel.

const COOKIE_NAME = "mly_admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

async function findByToken(token: string) {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("admin_users")
    .select("id, username, role, active, invite_expires_at")
    .eq("invite_token_hash", hashInviteToken(token))
    .maybeSingle();
  if (!data || !data.active) return null;
  if (!data.invite_expires_at || new Date(data.invite_expires_at).getTime() < Date.now()) return { expired: true as const, ...data };
  return { expired: false as const, ...data };
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  if (!token || token.length > 200) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 404 });
  const found = await findByToken(token);
  if (!found) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 404 });
  if (found.expired) return NextResponse.json({ ok: false, reason: "expired" }, { status: 410 });
  return NextResponse.json({ ok: true, username: found.username, role: found.role });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!token || token.length > 200) return NextResponse.json({ error: "invalid" }, { status: 404 });
  if (password.length < 8) return NextResponse.json({ error: "password_too_short" }, { status: 400 });

  const found = await findByToken(token);
  if (!found) return NextResponse.json({ error: "invalid" }, { status: 404 });
  if (found.expired) return NextResponse.json({ error: "expired" }, { status: 410 });

  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();
  // El filtro por invite_token_hash en el update garantiza un solo uso
  // aunque lleguen dos POST a la vez: el segundo no matchea ninguna fila.
  const { data: updated, error } = await admin
    .from("admin_users")
    .update({ password_hash: hashPassword(password), invite_token_hash: null, invite_expires_at: null, invite_accepted_at: now, last_login_at: now })
    .eq("id", found.id)
    .eq("invite_token_hash", hashInviteToken(token))
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "invalid" }, { status: 404 });

  await logAdminAction({
    adminUsername: found.username, action: "admin_user.accept_invite", entityType: "admin_user", entityId: found.id,
    ipAddress: getRequestIp(req),
  });

  const secret = process.env.ADMIN_SESSION_SECRET;
  const res = NextResponse.json({ ok: true, username: found.username });
  if (secret) {
    const expiry = Date.now() + SESSION_TTL_MS;
    res.cookies.set(COOKIE_NAME, signAdminToken(expiry, found.username, found.role as AdminRole, secret), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_TTL_MS / 1000,
    });
  }
  return res;
}
