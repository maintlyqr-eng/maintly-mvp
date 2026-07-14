import { NextRequest, NextResponse } from "next/server";
import { adminHasCapability, getAdminUsername } from "@/lib/adminAuth";
import { hashPassword } from "@/lib/adminPassword";
import { ADMIN_ROLES, isValidAdminRole } from "@/lib/adminRoles";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction, getRequestIp } from "@/lib/auditLog";

// Incremento 11 (14 jul 2026) — gestión de otros admins (crear, asignar
// rol, activar/desactivar). Capacidad "admin_management": hoy solo la
// tiene Super Admin (ver src/lib/adminRoles.ts) — nadie más puede crear ni
// tocar otras cuentas de admin, ni siquiera para verlas.
//
// No hay DELETE de verdad acá — "quitarle acceso a alguien" es
// desactivarlo (active:false), mismo criterio de soft-delete que el resto
// de la plataforma (migración 031) y consistente con que admin_audit_logs
// referencia el username en texto libre, no una foreign key: si se
// borrara la fila, el historial de auditoría de ese admin quedaría con un
// username "huérfano" sin poder confirmar que en algún momento existió.

function isSelf(req: NextRequest, username: string): boolean {
  const me = getAdminUsername(req);
  return !!me && me.toLowerCase() === username.toLowerCase();
}

// GET: lista todos los admins (activos e inactivos) para la sección
// "Administradores" del panel. Nunca devuelve password_hash.
export async function GET(req: NextRequest) {
  if (!adminHasCapability(req, "admin_management")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("admin_users")
    .select("id, username, role, active, created_at, created_by, last_login_at")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ admins: data ?? [] });
}

// POST: crea un admin nuevo. Body: { username, password, role }
export async function POST(req: NextRequest) {
  if (!adminHasCapability(req, "admin_management")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = body.role;

  if (!username || username.length < 3) {
    return NextResponse.json({ error: "Username must be at least 3 characters." }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (!isValidAdminRole(role)) {
    return NextResponse.json({ error: `Invalid role. Must be one of: ${ADMIN_ROLES.join(", ")}` }, { status: 400 });
  }

  const createdBy = getAdminUsername(req);
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("admin_users")
    .insert({
      username,
      password_hash: hashPassword(password),
      role,
      created_by: createdBy,
    })
    .select("id, username, role, active, created_at, created_by, last_login_at")
    .single();

  if (error) {
    // Unique index es sobre username activos (migración 035) — un choque
    // acá casi siempre significa "ya hay un admin activo con ese username".
    const msg = error.code === "23505" ? "That username is already in use by an active admin." : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (createdBy) {
    await logAdminAction({
      adminUsername: createdBy,
      action: "admin_user.create",
      entityType: "admin_user",
      entityId: data.id,
      newValue: { username, role },
      ipAddress: getRequestIp(req),
    });
  }

  return NextResponse.json({ ok: true, admin: data });
}

// PATCH: cambia el rol y/o activa/desactiva un admin existente.
// Body: { id, role?, active? }
export async function PATCH(req: NextRequest) {
  if (!adminHasCapability(req, "admin_management")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { id, role, active } = body ?? {};

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }
  if (role !== undefined && !isValidAdminRole(role)) {
    return NextResponse.json({ error: `Invalid role. Must be one of: ${ADMIN_ROLES.join(", ")}` }, { status: 400 });
  }
  if (active !== undefined && typeof active !== "boolean") {
    return NextResponse.json({ error: "Invalid active." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: existing, error: fetchError } = await admin
    .from("admin_users")
    .select("id, username, role, active")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Admin not found." }, { status: 404 });

  // Salvaguarda anti-lockout: no dejar que un Super Admin se desactive a sí
  // mismo ni se saque su propio rol, y no dejar que el último Super Admin
  // activo (de la tabla — el fallback de las env vars no cuenta acá,
  // porque esa cuenta no se puede "desactivar" desde este panel) quede sin
  // nadie que pueda volver a entrar a "Administradores".
  const demotingOrDeactivatingSelf =
    isSelf(req, existing.username) && ((active === false) || (role !== undefined && role !== "super_admin" && existing.role === "super_admin"));
  if (demotingOrDeactivatingSelf) {
    return NextResponse.json({ error: "You can't deactivate or demote your own account." }, { status: 400 });
  }

  if (existing.role === "super_admin" && existing.active && ((active === false) || (role !== undefined && role !== "super_admin"))) {
    const { count } = await admin
      .from("admin_users")
      .select("id", { count: "exact", head: true })
      .eq("role", "super_admin")
      .eq("active", true);
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: "Can't remove the last active Super Admin." }, { status: 400 });
    }
  }

  const updates: Record<string, unknown> = {};
  if (role !== undefined) updates.role = role;
  if (active !== undefined) updates.active = active;

  const { data, error } = await admin
    .from("admin_users")
    .update(updates)
    .eq("id", id)
    .select("id, username, role, active, created_at, created_by, last_login_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const me = getAdminUsername(req);
  if (me) {
    await logAdminAction({
      adminUsername: me,
      action: "admin_user.update",
      entityType: "admin_user",
      entityId: id,
      oldValue: { role: existing.role, active: existing.active },
      newValue: updates,
      ipAddress: getRequestIp(req),
    });
  }

  return NextResponse.json({ ok: true, admin: data });
}
