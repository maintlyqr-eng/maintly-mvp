import { NextRequest, NextResponse } from "next/server";
import { adminHasCapability, getAdminUsername } from "@/lib/adminAuth";
import { hashPassword } from "@/lib/adminPassword";
import { ADMIN_ROLES, isValidAdminRole } from "@/lib/adminRoles";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction, getRequestIp } from "@/lib/auditLog";
import { ADMIN_INVITE_TTL_MS, buildInviteLink, generateInviteToken, hashInviteToken } from "@/lib/adminInvite";
import { sendAdminWelcomeEmail, type Salutation } from "@/lib/adminWelcomeEmail";

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
    .select("id, username, role, active, created_at, created_by, last_login_at, password_hash, invite_expires_at, email, display_name, salutation, phone, address, birth_date, notes")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Nunca se manda password_hash al navegador: se traduce a "invitación
  // pendiente" (sin contraseña todavía) y nada más.
  const admins = (data ?? []).map(({ password_hash, invite_expires_at, ...rest }) => ({
    ...rest,
    invite_pending: !password_hash,
    invite_expires_at: password_hash ? null : invite_expires_at,
  }));
  return NextResponse.json({ admins });
}

function requestOrigin(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "www.maintlyqr.com";
  return `${proto}://${host}`;
}

// POST: crea un admin nuevo. Body: { username, role, password? }
// Sin password (Facu, 21/10/2026): se crea con una invitación por link —
// la persona elige su propia contraseña al abrirlo. Respuesta: { admin,
// inviteLink }. Con password: comportamiento original.
export async function POST(req: NextRequest) {
  if (!adminHasCapability(req, "admin_management")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = body.role;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const locale = typeof body.locale === "string" ? body.locale : "es";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 80) : "";
  const salutation: Salutation = body.salutation === "f" || body.salutation === "m" ? body.salutation : "n";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }

  if (!username || username.length < 3) {
    return NextResponse.json({ error: "Username must be at least 3 characters." }, { status: 400 });
  }
  if (password && password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (!isValidAdminRole(role)) {
    return NextResponse.json({ error: `Invalid role. Must be one of: ${ADMIN_ROLES.join(", ")}` }, { status: 400 });
  }

  const createdBy = getAdminUsername(req);
  const admin = getSupabaseAdmin();
  const inviteToken = password ? null : generateInviteToken();
  const { data, error } = await admin
    .from("admin_users")
    .insert({
      username,
      password_hash: password ? hashPassword(password) : null,
      role,
      created_by: createdBy,
      email: email || null,
      display_name: displayName || null,
      salutation,
      invite_token_hash: inviteToken ? hashInviteToken(inviteToken) : null,
      invite_expires_at: inviteToken ? new Date(Date.now() + ADMIN_INVITE_TTL_MS).toISOString() : null,
    })
    .select("id, username, role, active, created_at, created_by, last_login_at, invite_expires_at, email, display_name, salutation, phone, address, birth_date, notes")
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
      newValue: { username, role, invited: !!inviteToken },
      ipAddress: getRequestIp(req),
    });
  }

  const inviteLink = inviteToken ? buildInviteLink(requestOrigin(req), inviteToken) : null;
  // Mail de bienvenida al equipo si cargaron email (best-effort: si Resend
  // falla, el admin ya quedó creado y el link igual se muestra en pantalla).
  let emailSent = false;
  let emailError: string | null = null;
  if (inviteLink && email) {
    const r = await sendAdminWelcomeEmail({ to: email, username, role, inviteLink, locale, displayName, salutation });
    emailSent = r.ok && !r.skipped;
    if (!r.ok) emailError = r.error ?? "send_failed";
  }

  return NextResponse.json({
    ok: true,
    admin: { ...data, invite_pending: !!inviteToken, invite_expires_at: inviteToken ? data.invite_expires_at : null },
    inviteLink,
    emailSent,
    emailError,
  });
}

// PATCH: cambia el rol y/o activa/desactiva un admin existente.
// Body: { id, role?, active? }
export async function PATCH(req: NextRequest) {
  if (!adminHasCapability(req, "admin_management")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { id, role, active, reinvite } = body ?? {};

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  // { id, reinvite: true }: genera un link nuevo (el anterior deja de
  // servir). Para invitaciones vencidas o perdidas, y también para
  // resetear la contraseña de un admin existente: al aceptar el link, la
  // persona elige una contraseña nueva.
  if (reinvite === true) {
    const admin = getSupabaseAdmin();
    const { data: target, error: fetchErr } = await admin
      .from("admin_users").select("id, username, active").eq("id", id).maybeSingle();
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!target) return NextResponse.json({ error: "Admin not found." }, { status: 404 });
    if (!target.active) return NextResponse.json({ error: "Reactivate the admin first." }, { status: 400 });
    const token = generateInviteToken();
    const expires = new Date(Date.now() + ADMIN_INVITE_TTL_MS).toISOString();
    const { error: updErr } = await admin
      .from("admin_users")
      .update({ invite_token_hash: hashInviteToken(token), invite_expires_at: expires, invite_accepted_at: null })
      .eq("id", id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    const me = getAdminUsername(req);
    if (me) {
      await logAdminAction({
        adminUsername: me, action: "admin_user.reinvite", entityType: "admin_user", entityId: id,
        newValue: { username: target.username, expires }, ipAddress: getRequestIp(req),
      });
    }
    const link = buildInviteLink(requestOrigin(req), token);
    let emailSent = false;
    if (body.sendEmail === true) {
      const { data: full } = await admin.from("admin_users").select("email, role, display_name, salutation").eq("id", id).maybeSingle();
      if (full?.email) {
        const r = await sendAdminWelcomeEmail({ to: full.email, username: target.username, role: full.role, inviteLink: link, locale: typeof body.locale === "string" ? body.locale : "es", displayName: full.display_name, salutation: full.salutation as Salutation | null });
        emailSent = r.ok && !r.skipped;
      }
    }
    return NextResponse.json({ ok: true, inviteLink: link, invite_expires_at: expires, emailSent });
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
  // Ficha del empleado (migración 056). Strings vacíos = borrar el dato.
  const profile = body.profile;
  if (profile && typeof profile === "object") {
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) || null : undefined);
    const dn = str(profile.displayName, 80); if (dn !== undefined) updates.display_name = dn;
    const ph = str(profile.phone, 40); if (ph !== undefined) updates.phone = ph;
    const ad = str(profile.address, 300); if (ad !== undefined) updates.address = ad;
    const no = str(profile.notes, 2000); if (no !== undefined) updates.notes = no;
    const em = str(profile.email, 120);
    if (em !== undefined) {
      if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return NextResponse.json({ error: "Invalid email." }, { status: 400 });
      updates.email = em ? em.toLowerCase() : null;
    }
    if (profile.salutation === "f" || profile.salutation === "m" || profile.salutation === "n") updates.salutation = profile.salutation;
    const bd = str(profile.birthDate, 10);
    if (bd !== undefined) {
      if (bd && !/^\d{4}-\d{2}-\d{2}$/.test(bd)) return NextResponse.json({ error: "Invalid birth date." }, { status: 400 });
      updates.birth_date = bd;
    }
  }
  if (active !== undefined) updates.active = active;

  const { data, error } = await admin
    .from("admin_users")
    .update(updates)
    .eq("id", id)
    .select("id, username, role, active, created_at, created_by, last_login_at, email, display_name, salutation, phone, address, birth_date, notes")
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
