import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction, getRequestIp, type AdminAuditAction } from "@/lib/auditLog";
import { getMarketingActor, can, MARKETING_PERMS, type MarketingActor } from "@/lib/marketingPerms";
import { encryptSecret, decryptSecret, vaultConfigured } from "@/lib/vault";

// Departamento de Marketing — API única (migración 061). Spec:
// claude/MAINTLYQR_MARKETING_DEPARTAMENTO_SPEC.md. Cada operación verifica
// el permiso puntual del actor en el servidor (src/lib/marketingPerms.ts).
//
// GET  ?r=overview | members | settings | campaigns | tasks | posts | post&id=
//        | comments&type=&id= | library | handovers | accounts | file&bucket=&path=
// POST { r, action, ...campos }  (ver cada bloque abajo)

const MEDIA_BUCKET = "marketing-media";
const LIBRARY_BUCKET = "marketing-library";
const MAX_FILE = 100 * 1024 * 1024;

const ACCOUNT_SELECT = "id, created_at, updated_at, platform, label, username, recovery_email, url, notes, updated_by, password_enc, two_factor_enc, recovery_enc, owner_username, authorized_usernames, business_email, connection_status, connection_note";
const POST_SELECT = "id, created_at, updated_at, title, body, campaign_id, scheduled_at, timezone, status, created_by, updated_by, submitted_at, submitted_by, approved_at, approved_by, approved_hash, change_request_note, change_requested_by, cancelled_reason, cancelled_by";
const TARGET_SELECT = "id, post_id, account_id, adapted_body, result_status, result_url, result_error, published_at, published_by";

function deny(status = 403) { return NextResponse.json({ error: status === 401 ? "Not authorized." : "Permission denied." }, { status }); }
function bad(msg: string) { return NextResponse.json({ error: msg }, { status: 400 }); }
function str(v: unknown, max = 4000): string | null { if (v === null || v === undefined) return null; const s = String(v).trim(); return s ? s.slice(0, max) : null; }

async function audit(req: NextRequest, actor: MarketingActor, action: AdminAuditAction, entityType: Parameters<typeof logAdminAction>[0]["entityType"], entityId: string | null, newValue?: unknown, oldValue?: unknown) {
  await logAdminAction({ adminUsername: actor.username, action, entityType, entityId, newValue, oldValue, ipAddress: getRequestIp(req) });
}

function contentHash(body: string, targets: { account_id: string; adapted_body: string | null }[], mediaIds: string[]): string {
  const t = [...targets].sort((a, b) => a.account_id.localeCompare(b.account_id)).map((x) => `${x.account_id}:${x.adapted_body ?? ""}`);
  return crypto.createHash("sha256").update(JSON.stringify({ body, t, m: [...mediaIds].sort() })).digest("hex");
}

async function postSnapshot(postId: string) {
  const admin = getSupabaseAdmin();
  const [{ data: post }, { data: targets }, { data: media }] = await Promise.all([
    admin.from("marketing_posts").select(POST_SELECT).eq("id", postId).maybeSingle(),
    admin.from("marketing_post_targets").select(TARGET_SELECT).eq("post_id", postId),
    admin.from("marketing_media").select("id, name, mime, size, storage_path, uploaded_by, created_at").eq("post_id", postId),
  ]);
  return { post, targets: targets ?? [], media: media ?? [] };
}

function stripAccount(a: Record<string, unknown>, actor: MarketingActor) {
  const { password_enc, two_factor_enc, recovery_enc, ...rest } = a;
  return {
    ...rest,
    has_password: !!password_enc,
    has_two_factor: !!two_factor_enc,
    has_recovery: !!recovery_enc,
    can_reveal: can(actor, "vault"),
  };
}

// ───────────────────────────── GET ─────────────────────────────
export async function GET(req: NextRequest) {
  const actor = await getMarketingActor(req);
  if (!actor) return deny(401);
  if (!actor.isMember) return deny();
  const url = new URL(req.url);
  const r = url.searchParams.get("r") ?? "";
  const admin = getSupabaseAdmin();

  if (r === "overview") {
    const nowIso = new Date().toISOString();
    const in14 = new Date(Date.now() + 14 * 86400000).toISOString();
    const [{ data: settings }, { data: tasks }, { data: review }, { data: upcoming }, { data: accounts }, { data: members }] = await Promise.all([
      admin.from("marketing_settings").select("*").eq("id", 1).maybeSingle(),
      admin.from("marketing_tasks").select("id, title, assignee_username, due_on, priority, status, campaign_id").neq("status", "done").order("due_on", { ascending: true, nullsFirst: false }).limit(50),
      admin.from("marketing_posts").select("id, title, scheduled_at, status, created_by, submitted_at").eq("status", "review").order("submitted_at", { ascending: true }).limit(50),
      admin.from("marketing_posts").select("id, title, scheduled_at, status, created_by").in("status", ["approved", "scheduled"]).gte("scheduled_at", nowIso).lte("scheduled_at", in14).order("scheduled_at", { ascending: true }).limit(50),
      admin.from("marketing_accounts").select("id, label, platform, connection_status, connection_note, owner_username").neq("connection_status", "connected"),
      admin.from("department_members").select("username, title, is_lead, permissions").eq("department", "marketing").is("revoked_at", null),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    return NextResponse.json({
      actor,
      settings,
      tasksPending: tasks ?? [],
      tasksOverdue: (tasks ?? []).filter((t) => t.due_on && t.due_on < today),
      awaitingApproval: review ?? [],
      upcoming: upcoming ?? [],
      accountsAttention: accounts ?? [],
      members: members ?? [],
    });
  }

  if (r === "members") {
    if (!actor.isSuper) return deny();
    const [{ data: members }, { data: admins }] = await Promise.all([
      admin.from("department_members").select("*").eq("department", "marketing").order("granted_at"),
      admin.from("admin_users").select("username, role, active, first_name, last_name, nickname, display_name").eq("active", true),
    ]);
    return NextResponse.json({ members: members ?? [], admins: admins ?? [] });
  }

  if (r === "settings") {
    const { data } = await admin.from("marketing_settings").select("*").eq("id", 1).maybeSingle();
    return NextResponse.json({ settings: data });
  }

  if (r === "campaigns") {
    const { data, error } = await admin.from("marketing_campaigns").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) return bad(error.message);
    return NextResponse.json({ items: data ?? [] });
  }

  if (r === "tasks") {
    const { data, error } = await admin.from("marketing_tasks").select("*").order("status").order("due_on", { ascending: true, nullsFirst: false }).limit(1000);
    if (error) return bad(error.message);
    return NextResponse.json({ items: data ?? [] });
  }

  if (r === "posts") {
    const from = url.searchParams.get("from"); const to = url.searchParams.get("to");
    let q = admin.from("marketing_posts").select(POST_SELECT).order("scheduled_at", { ascending: true, nullsFirst: false }).limit(1000);
    if (from) q = q.or(`scheduled_at.gte.${from},scheduled_at.is.null`);
    if (to) q = q.or(`scheduled_at.lte.${to},scheduled_at.is.null`);
    const { data: posts, error } = await q;
    if (error) return bad(error.message);
    const ids = (posts ?? []).map((p) => p.id);
    const { data: targets } = ids.length ? await admin.from("marketing_post_targets").select(TARGET_SELECT).in("post_id", ids) : { data: [] };
    return NextResponse.json({ items: posts ?? [], targets: targets ?? [] });
  }

  if (r === "post") {
    const id = url.searchParams.get("id") ?? "";
    if (!id) return bad("Missing id.");
    const snap = await postSnapshot(id);
    if (!snap.post) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const { data: comments } = await admin.from("marketing_comments").select("*").eq("entity_type", "post").eq("entity_id", id).order("created_at");
    return NextResponse.json({ ...snap, comments: comments ?? [] });
  }

  if (r === "comments") {
    const type = url.searchParams.get("type") ?? ""; const id = url.searchParams.get("id") ?? "";
    if (!["task", "campaign", "post"].includes(type) || !id) return bad("Bad request.");
    const { data } = await admin.from("marketing_comments").select("*").eq("entity_type", type).eq("entity_id", id).order("created_at");
    return NextResponse.json({ items: data ?? [] });
  }

  if (r === "library") {
    const { data, error } = await admin.from("marketing_library").select("*").order("kind").order("name").order("version", { ascending: false }).limit(2000);
    if (error) return bad(error.message);
    return NextResponse.json({ items: data ?? [] });
  }

  if (r === "handovers") {
    if (!actor.isSuper) return deny();
    const { data } = await admin.from("marketing_handovers").select("*").order("started_at", { ascending: false }).limit(50);
    return NextResponse.json({ items: data ?? [] });
  }

  if (r === "accounts") {
    const { data, error } = await admin.from("marketing_accounts").select(ACCOUNT_SELECT).order("platform").order("label");
    if (error) return bad(error.message);
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    return NextResponse.json({ items: rows.map((a) => stripAccount(a, actor)), vaultConfigured: vaultConfigured() });
  }

  if (r === "reveal") {
    if (!can(actor, "vault")) return deny();
    const id = url.searchParams.get("id") ?? ""; const field = url.searchParams.get("field") ?? "password";
    const col = field === "two_factor" ? "two_factor_enc" : field === "recovery" ? "recovery_enc" : "password_enc";
    const { data } = await admin.from("marketing_accounts").select(`id, label, ${col}`).eq("id", id).maybeSingle();
    if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const enc = (data as unknown as Record<string, string | null>)[col];
    try {
      const value = enc ? decryptSecret(enc) : "";
      await audit(req, actor, "marketing_account.reveal", "marketing_account", id, { label: (data as { label: string }).label, field });
      return NextResponse.json({ value });
    } catch { return NextResponse.json({ error: "Vault key missing or changed." }, { status: 500 }); }
  }

  if (r === "file") {
    const bucket = url.searchParams.get("bucket") === "library" ? LIBRARY_BUCKET : MEDIA_BUCKET;
    const path = url.searchParams.get("path") ?? "";
    if (!path) return bad("Missing path.");
    const { data: signed, error } = await admin.storage.from(bucket).createSignedUrl(path, 3600);
    if (error || !signed) return NextResponse.json({ error: "Could not sign." }, { status: 500 });
    return NextResponse.redirect(signed.signedUrl, 302);
  }

  return bad("Bad resource.");
}

// ───────────────────────────── POST ─────────────────────────────
export async function POST(req: NextRequest) {
  const actor = await getMarketingActor(req);
  if (!actor) return deny(401);
  if (!actor.isMember) return deny();
  const body = await req.json().catch(() => ({}));
  const r = String(body.r ?? ""); const action = String(body.action ?? "");
  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();

  // ── Miembros y permisos (solo Super Admin) ──
  if (r === "members") {
    if (!actor.isSuper) return deny();
    const username = str(body.username, 80);
    if (!username) return bad("Missing username.");
    if (action === "revoke") {
      const { data: before } = await admin.from("department_members").select("permissions, is_lead").eq("department", "marketing").ilike("username", username).maybeSingle();
      const { error } = await admin.from("department_members").update({ revoked_at: now, revoked_by: actor.username, permissions: {}, is_lead: false }).eq("department", "marketing").ilike("username", username);
      if (error) return bad(error.message);
      await audit(req, actor, "marketing_member.revoke", "marketing_member", username, null, before);
      return NextResponse.json({ ok: true });
    }
    const perms: Record<string, boolean> = {};
    for (const k of MARKETING_PERMS) perms[k] = !!(body.permissions ?? {})[k];
    const row = { department: "marketing", username, title: str(body.title, 120), is_lead: !!body.is_lead, permissions: perms, granted_by: actor.username, granted_at: now, revoked_at: null, revoked_by: null };
    const { data, error } = await admin.from("department_members").upsert(row, { onConflict: "department,username" }).select("*").single();
    if (error) return bad(error.message);
    await audit(req, actor, "marketing_member.update", "marketing_member", username, { title: row.title, is_lead: row.is_lead, permissions: perms });
    return NextResponse.json({ ok: true, member: data });
  }

  // ── Ajustes (solo Super Admin) ──
  if (r === "settings") {
    if (!actor.isSuper) return deny();
    const updates: Record<string, unknown> = { updated_by: actor.username, updated_at: now };
    if (typeof body.require_approval === "boolean") updates.require_approval = body.require_approval;
    if (body.default_timezone !== undefined) updates.default_timezone = str(body.default_timezone, 60) ?? "Australia/Brisbane";
    if (body.monthly_goals !== undefined) updates.monthly_goals = str(body.monthly_goals, 4000);
    const { data, error } = await admin.from("marketing_settings").update(updates).eq("id", 1).select("*").single();
    if (error) return bad(error.message);
    await audit(req, actor, "marketing_settings.update", "marketing_settings", "1", updates);
    return NextResponse.json({ ok: true, settings: data });
  }

  // ── Cuentas (connections para datos; vault para secretos) ──
  if (r === "accounts") {
    if (action === "delete") {
      if (!can(actor, "connections")) return deny();
      const id = str(body.id, 60); if (!id) return bad("Missing id.");
      const { error } = await admin.from("marketing_accounts").delete().eq("id", id);
      if (error) return bad(error.message);
      await audit(req, actor, "marketing_account.delete", "marketing_account", id);
      return NextResponse.json({ ok: true });
    }
    if (!can(actor, "connections")) return deny();
    const row: Record<string, unknown> = {};
    for (const f of ["platform", "label", "username", "recovery_email", "url", "notes", "owner_username", "business_email", "connection_status", "connection_note"] as const) {
      if (f in body) row[f] = str(body[f], f === "notes" ? 4000 : 300);
    }
    if (Array.isArray(body.authorized_usernames)) row.authorized_usernames = body.authorized_usernames.map((u: unknown) => String(u).trim()).filter(Boolean).slice(0, 50);
    if (row.connection_status && !["none", "connected", "needs_reconnect"].includes(String(row.connection_status))) return bad("Bad connection_status.");
    // Secretos: solo con permiso vault; cadena vacía = no tocar.
    const secretFields: [string, string][] = [["password", "password_enc"], ["two_factor", "two_factor_enc"], ["recovery", "recovery_enc"]];
    let secretsChanged = false;
    for (const [inKey, col] of secretFields) {
      if (typeof body[inKey] === "string" && body[inKey]) {
        if (!can(actor, "vault")) return deny();
        if (!vaultConfigured()) return NextResponse.json({ error: "vault_not_configured" }, { status: 500 });
        row[col] = encryptSecret(body[inKey]); secretsChanged = true;
      }
    }
    row.updated_by = actor.username; row.updated_at = now;
    const id = str(body.id, 60);
    if (!id && !row.label) return bad("Label is required.");
    const q = id ? admin.from("marketing_accounts").update(row).eq("id", id) : admin.from("marketing_accounts").insert({ ...row, created_by: actor.username, platform: row.platform ?? "other" });
    const { data, error } = await q.select(ACCOUNT_SELECT).single();
    if (error) return bad(error.message);
    const saved = data as unknown as Record<string, unknown>;
    await audit(req, actor, "marketing_account.save", "marketing_account", String(saved.id), { label: saved.label, secretsChanged, connection_status: saved.connection_status, owner: saved.owner_username });
    return NextResponse.json({ ok: true, item: stripAccount(saved, actor) });
  }

  // ── Campañas ──
  if (r === "campaigns") {
    if (!can(actor, "content")) return deny();
    const id = str(body.id, 60);
    if (action === "approve_budget") {
      if (!actor.isSuper) return deny();
      if (!id) return bad("Missing id.");
      const { data, error } = await admin.from("marketing_campaigns").update({ budget_approved_by: actor.username, budget_approved_at: now, budget_note: str(body.budget_note, 1000), updated_by: actor.username, updated_at: now }).eq("id", id).select("*").single();
      if (error) return bad(error.message);
      await audit(req, actor, "marketing_campaign.approve_budget", "marketing_campaign", id, { budget: data.budget_proposed, currency: data.budget_currency });
      return NextResponse.json({ ok: true, item: data });
    }
    if (action === "delete") {
      if (!actor.isSuper) return deny();
      if (!id) return bad("Missing id.");
      const { error } = await admin.from("marketing_campaigns").delete().eq("id", id);
      if (error) return bad(error.message);
      return NextResponse.json({ ok: true });
    }
    const row: Record<string, unknown> = { updated_by: actor.username, updated_at: now };
    for (const f of ["name", "objective", "starts_on", "ends_on", "status", "budget_currency"] as const) if (f in body) row[f] = str(body[f], f === "objective" ? 4000 : 120);
    if ("budget_proposed" in body) { const n = Number(body.budget_proposed); row.budget_proposed = isFinite(n) && body.budget_proposed !== "" && body.budget_proposed !== null ? n : null; if (!id || row.budget_proposed !== undefined) { row.budget_approved_by = null; row.budget_approved_at = null; } }
    if (row.status && !["active", "closed"].includes(String(row.status))) return bad("Bad status.");
    if (!id && !row.name) return bad("Name is required.");
    const q = id ? admin.from("marketing_campaigns").update(row).eq("id", id) : admin.from("marketing_campaigns").insert({ ...row, created_by: actor.username });
    const { data, error } = await q.select("*").single();
    if (error) return bad(error.message);
    return NextResponse.json({ ok: true, item: data });
  }

  // ── Tareas ──
  if (r === "tasks") {
    if (!can(actor, "content")) return deny();
    const id = str(body.id, 60);
    if (action === "delete") {
      if (!id) return bad("Missing id.");
      const { error } = await admin.from("marketing_tasks").delete().eq("id", id);
      if (error) return bad(error.message);
      return NextResponse.json({ ok: true });
    }
    const row: Record<string, unknown> = { updated_by: actor.username, updated_at: now };
    for (const f of ["title", "description", "assignee_username", "due_on", "priority", "status", "campaign_id", "post_id"] as const) if (f in body) row[f] = str(body[f], f === "description" ? 4000 : 200);
    if (row.priority && !["low", "normal", "high"].includes(String(row.priority))) return bad("Bad priority.");
    if (row.status && !["todo", "doing", "done"].includes(String(row.status))) return bad("Bad status.");
    if (row.status === "done") row.done_at = now; else if (row.status) row.done_at = null;
    if (!id && !row.title) return bad("Title is required.");
    const q = id ? admin.from("marketing_tasks").update(row).eq("id", id) : admin.from("marketing_tasks").insert({ ...row, created_by: actor.username });
    const { data, error } = await q.select("*").single();
    if (error) return bad(error.message);
    return NextResponse.json({ ok: true, item: data });
  }

  // ── Comentarios ──
  if (r === "comments") {
    const type = str(body.entity_type, 20); const id = str(body.entity_id, 60); const text = str(body.body, 4000);
    if (!type || !["task", "campaign", "post"].includes(type) || !id || !text) return bad("Bad request.");
    const { data, error } = await admin.from("marketing_comments").insert({ entity_type: type, entity_id: id, author_username: actor.username, body: text }).select("*").single();
    if (error) return bad(error.message);
    return NextResponse.json({ ok: true, item: data });
  }

  // ── Publicaciones ──
  if (r === "posts") {
    const id = str(body.id, 60);
    const { data: settings } = await admin.from("marketing_settings").select("require_approval, default_timezone").eq("id", 1).maybeSingle();
    const requireApproval = settings?.require_approval ?? true;

    if (action === "save") {
      if (!can(actor, "content")) return deny();
      const row: Record<string, unknown> = { updated_by: actor.username, updated_at: now };
      for (const f of ["title", "body", "campaign_id", "scheduled_at", "timezone"] as const) if (f in body) row[f] = str(body[f], f === "body" ? 10000 : 200);
      if (!id && !row.title) return bad("Title is required.");
      if (!id && !row.timezone) row.timezone = settings?.default_timezone ?? "Australia/Brisbane";
      let saved: Record<string, unknown>;
      if (id) {
        const { data: cur } = await admin.from("marketing_posts").select(POST_SELECT).eq("id", id).maybeSingle();
        if (!cur) return NextResponse.json({ error: "Not found." }, { status: 404 });
        if (cur.status === "published" || cur.status === "cancelled") return bad("Post is closed.");
        const { data, error } = await admin.from("marketing_posts").update(row).eq("id", id).select(POST_SELECT).single();
        if (error) return bad(error.message);
        saved = data as unknown as Record<string, unknown>;
      } else {
        const { data, error } = await admin.from("marketing_posts").insert({ ...row, created_by: actor.username, status: "draft" }).select(POST_SELECT).single();
        if (error) return bad(error.message);
        saved = data as unknown as Record<string, unknown>;
      }
      // Destinos (reemplazo completo si vienen).
      if (Array.isArray(body.targets)) {
        const postId = String(saved.id);
        const wanted = (body.targets as { account_id: string; adapted_body?: string | null }[]).filter((t) => t && t.account_id);
        const { data: existing } = await admin.from("marketing_post_targets").select("id, account_id").eq("post_id", postId);
        const keepIds = new Set(wanted.map((t) => t.account_id));
        const toDelete = (existing ?? []).filter((e) => !keepIds.has(e.account_id)).map((e) => e.id);
        if (toDelete.length) await admin.from("marketing_post_targets").delete().in("id", toDelete);
        for (const t of wanted) {
          await admin.from("marketing_post_targets").upsert({ post_id: postId, account_id: t.account_id, adapted_body: str(t.adapted_body, 10000) }, { onConflict: "post_id,account_id" });
        }
      }
      // Si estaba aprobado/programado y cambió el contenido → vuelve a revisión.
      const snap = await postSnapshot(String(saved.id));
      if (snap.post && (snap.post.status === "approved" || snap.post.status === "scheduled") && snap.post.approved_hash) {
        const h = contentHash(snap.post.body ?? "", snap.targets, snap.media.map((m) => m.id));
        if (h !== snap.post.approved_hash) {
          await admin.from("marketing_posts").update({ status: "review", change_request_note: null, submitted_at: now, submitted_by: actor.username }).eq("id", snap.post.id);
          await audit(req, actor, "marketing_post.back_to_review", "marketing_post", snap.post.id, { reason: "content_changed" });
          snap.post.status = "review";
        }
      }
      return NextResponse.json({ ok: true, ...snap });
    }

    if (!id) return bad("Missing id.");
    const snap = await postSnapshot(id);
    const post = snap.post;
    if (!post) return NextResponse.json({ error: "Not found." }, { status: 404 });

    if (action === "submit") {
      if (!can(actor, "content")) return deny();
      if (!["draft", "review"].includes(post.status)) return bad("Only drafts can be submitted.");
      if (snap.targets.length === 0) return bad("Add at least one target account.");
      const hash = contentHash(post.body ?? "", snap.targets, snap.media.map((m) => m.id));
      const next = requireApproval && !can(actor, "approve") ? "review" : "approved";
      const upd: Record<string, unknown> = { status: next, submitted_at: now, submitted_by: actor.username, change_request_note: null, updated_at: now, updated_by: actor.username };
      if (next === "approved") { upd.approved_at = now; upd.approved_by = actor.username; upd.approved_hash = hash; }
      const { error } = await admin.from("marketing_posts").update(upd).eq("id", id);
      if (error) return bad(error.message);
      await audit(req, actor, next === "approved" ? "marketing_post.approve" : "marketing_post.submit", "marketing_post", id, { title: post.title, auto: next === "approved" });
      return NextResponse.json({ ok: true, ...(await postSnapshot(id)) });
    }

    if (action === "approve") {
      if (!can(actor, "approve")) return deny();
      if (post.status !== "review") return bad("Post is not in review.");
      const hash = contentHash(post.body ?? "", snap.targets, snap.media.map((m) => m.id));
      const { error } = await admin.from("marketing_posts").update({ status: "approved", approved_at: now, approved_by: actor.username, approved_hash: hash, change_request_note: null, updated_at: now, updated_by: actor.username }).eq("id", id);
      if (error) return bad(error.message);
      await audit(req, actor, "marketing_post.approve", "marketing_post", id, { title: post.title });
      return NextResponse.json({ ok: true, ...(await postSnapshot(id)) });
    }

    if (action === "request_changes") {
      if (!can(actor, "approve")) return deny();
      if (post.status !== "review") return bad("Post is not in review.");
      const note = str(body.note, 2000);
      const { error } = await admin.from("marketing_posts").update({ status: "draft", change_request_note: note, change_requested_by: actor.username, updated_at: now, updated_by: actor.username }).eq("id", id);
      if (error) return bad(error.message);
      if (note) await admin.from("marketing_comments").insert({ entity_type: "post", entity_id: id, author_username: actor.username, body: note });
      await audit(req, actor, "marketing_post.request_changes", "marketing_post", id, { title: post.title });
      return NextResponse.json({ ok: true, ...(await postSnapshot(id)) });
    }

    if (action === "schedule") {
      if (!can(actor, "publish")) return deny();
      if (post.status !== "approved") return bad("Post must be approved first.");
      if (!post.scheduled_at) return bad("Set a date and time first.");
      const { error } = await admin.from("marketing_posts").update({ status: "scheduled", updated_at: now, updated_by: actor.username }).eq("id", id);
      if (error) return bad(error.message);
      await audit(req, actor, "marketing_post.schedule", "marketing_post", id, { title: post.title, scheduled_at: post.scheduled_at });
      return NextResponse.json({ ok: true, ...(await postSnapshot(id)) });
    }

    if (action === "target_result") {
      // Resultado por red: manual (con enlace) o fallo. Sin integración
      // todavía (etapa 2), "published" lo pondrá el conector.
      if (!can(actor, "publish")) return deny();
      if (!["approved", "scheduled", "published"].includes(post.status)) return bad("Post must be approved first.");
      const targetId = str(body.target_id, 60); const result = str(body.result, 20);
      if (!targetId || !result || !["manual", "failed", "pending"].includes(result)) return bad("Bad request.");
      const upd: Record<string, unknown> = { result_status: result, result_url: str(body.url, 1000), result_error: result === "failed" ? str(body.error, 1000) : null };
      if (result === "manual") { upd.published_at = now; upd.published_by = actor.username; } else { upd.published_at = null; upd.published_by = null; }
      const { error } = await admin.from("marketing_post_targets").update(upd).eq("id", targetId).eq("post_id", id);
      if (error) return bad(error.message);
      // Si todos los destinos quedaron publicados (manual o integración) → published.
      const { data: ts } = await admin.from("marketing_post_targets").select("result_status").eq("post_id", id);
      const allDone = (ts ?? []).length > 0 && (ts ?? []).every((t) => t.result_status === "manual" || t.result_status === "published");
      if (allDone) await admin.from("marketing_posts").update({ status: "published", updated_at: now, updated_by: actor.username }).eq("id", id);
      await audit(req, actor, "marketing_post.publish", "marketing_post", id, { title: post.title, target: targetId, result, allDone });
      return NextResponse.json({ ok: true, ...(await postSnapshot(id)) });
    }

    if (action === "cancel") {
      const own = post.created_by?.toLowerCase() === actor.username.toLowerCase();
      if (!(can(actor, "approve") || (own && can(actor, "content")))) return deny();
      if (post.status === "published") return bad("Already published.");
      const { error } = await admin.from("marketing_posts").update({ status: "cancelled", cancelled_reason: str(body.reason, 1000), cancelled_by: actor.username, updated_at: now, updated_by: actor.username }).eq("id", id);
      if (error) return bad(error.message);
      await audit(req, actor, "marketing_post.cancel", "marketing_post", id, { title: post.title });
      return NextResponse.json({ ok: true, ...(await postSnapshot(id)) });
    }

    if (action === "reopen") {
      if (!can(actor, "content")) return deny();
      if (post.status !== "cancelled") return bad("Only cancelled posts can be reopened.");
      const { error } = await admin.from("marketing_posts").update({ status: "draft", cancelled_reason: null, cancelled_by: null, approved_hash: null, approved_at: null, approved_by: null, updated_at: now, updated_by: actor.username }).eq("id", id);
      if (error) return bad(error.message);
      return NextResponse.json({ ok: true, ...(await postSnapshot(id)) });
    }

    if (action === "delete") {
      if (!actor.isSuper && !(post.status === "draft" && post.created_by?.toLowerCase() === actor.username.toLowerCase())) return deny();
      for (const m of snap.media) await admin.storage.from(MEDIA_BUCKET).remove([m.storage_path]);
      const { error } = await admin.from("marketing_posts").delete().eq("id", id);
      if (error) return bad(error.message);
      return NextResponse.json({ ok: true });
    }
    return bad("Bad action.");
  }

  // ── Medios (publicaciones / campañas) y biblioteca: subida directa a Storage ──
  if (r === "upload-url") {
    if (!can(actor, "content")) return deny();
    const bucket = body.bucket === "library" ? LIBRARY_BUCKET : MEDIA_BUCKET;
    const name = String(body.name ?? "archivo").replace(/[^\w.\-() ]+/g, "_").slice(0, 120) || "archivo";
    const size = Number(body.size ?? 0);
    if (!size || size > MAX_FILE) return bad("File too large (max 100 MB).");
    const path = `${new Date().toISOString().slice(0, 7)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${name}`;
    const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path);
    if (error || !data) return NextResponse.json({ error: error?.message ?? "Could not sign upload." }, { status: 500 });
    return NextResponse.json({ ok: true, path, token: data.token });
  }

  if (r === "media") {
    if (!can(actor, "content")) return deny();
    if (action === "delete") {
      const id = str(body.id, 60); if (!id) return bad("Missing id.");
      const { data: m } = await admin.from("marketing_media").select("storage_path, post_id").eq("id", id).maybeSingle();
      if (m) { await admin.storage.from(MEDIA_BUCKET).remove([m.storage_path]); await admin.from("marketing_media").delete().eq("id", id); }
      return NextResponse.json({ ok: true });
    }
    const path = str(body.storage_path, 500); const name = str(body.name, 200);
    if (!path || !name) return bad("Bad request.");
    const { data, error } = await admin.from("marketing_media").insert({ post_id: str(body.post_id, 60), campaign_id: str(body.campaign_id, 60), storage_path: path, name, mime: str(body.mime, 100), size: Number(body.size ?? 0) || null, uploaded_by: actor.username }).select("*").single();
    if (error) return bad(error.message);
    return NextResponse.json({ ok: true, item: data });
  }

  if (r === "library") {
    if (!can(actor, "content")) return deny();
    const id = str(body.id, 60);
    if (action === "delete") {
      if (!actor.isSuper) return deny();
      if (!id) return bad("Missing id.");
      const { data: it } = await admin.from("marketing_library").select("storage_path").eq("id", id).maybeSingle();
      if (it?.storage_path) await admin.storage.from(LIBRARY_BUCKET).remove([it.storage_path]);
      const { error } = await admin.from("marketing_library").delete().eq("id", id);
      if (error) return bad(error.message);
      await audit(req, actor, "marketing_library.update", "marketing_library", id, { deleted: true });
      return NextResponse.json({ ok: true });
    }
    if (action === "set_official") {
      if (!can(actor, "approve")) return deny();
      if (!id) return bad("Missing id.");
      const { data, error } = await admin.from("marketing_library").update({ is_official: !!body.is_official }).eq("id", id).select("*").single();
      if (error) return bad(error.message);
      await audit(req, actor, "marketing_library.update", "marketing_library", id, { is_official: !!body.is_official, name: data.name });
      return NextResponse.json({ ok: true, item: data });
    }
    // create / new_version
    const kind = str(body.kind, 20);
    if (!kind || !["logo", "color", "font", "photo", "video", "template", "doc", "text"].includes(kind)) return bad("Bad kind.");
    const name = str(body.name, 200); if (!name) return bad("Name is required.");
    let version = 1; let replaces: string | null = null;
    if (action === "new_version" && id) {
      const { data: prev } = await admin.from("marketing_library").select("id, version").eq("id", id).maybeSingle();
      if (prev) { version = (prev.version ?? 1) + 1; replaces = prev.id; await admin.from("marketing_library").update({ is_current: false }).eq("id", prev.id); }
    }
    const { data, error } = await admin.from("marketing_library").insert({
      name, kind, version, replaces_id: replaces, is_official: !!body.is_official && can(actor, "approve"),
      storage_path: str(body.storage_path, 500), mime: str(body.mime, 100), size: Number(body.size ?? 0) || null,
      value: str(body.value, 4000), notes: str(body.notes, 2000), created_by: actor.username,
    }).select("*").single();
    if (error) return bad(error.message);
    await audit(req, actor, "marketing_library.update", "marketing_library", String(data.id), { name, kind, version });
    return NextResponse.json({ ok: true, item: data });
  }

  // ── Transferencia del departamento (solo Super Admin) ──
  if (r === "handover") {
    if (!actor.isSuper) return deny();
    const id = str(body.id, 60);
    if (action === "start") {
      const from = str(body.from_username, 80); const to = str(body.to_username, 80);
      if (!from) return bad("Missing from_username.");
      const checklist = [
        { key: "revoke_perms", label: "Revocar los permisos de Marketing de quien se retira", done: false },
        { key: "reassign_tasks", label: "Reasignar tareas y aprobaciones pendientes", done: false },
        { key: "external_access", label: "Revisar accesos directos en cada red social (quitar a la persona como admin/editor)", done: false },
        { key: "sessions", label: "Cerrar sesiones activas y revisar conexiones de Maintly con las redes", done: false },
        { key: "recovery", label: "Revisar correos y métodos de recuperación de cada cuenta (quedan bajo control de Maintly)", done: false },
        { key: "rotate_passwords", label: "Cambiar las contraseñas compartidas que esa persona conoció y actualizarlas en la bóveda", done: false },
        { key: "assign_new", label: "Dar permisos a la nueva persona responsable", done: false },
      ];
      const { data, error } = await admin.from("marketing_handovers").insert({ started_by: actor.username, from_username: from, to_username: to, checklist }).select("*").single();
      if (error) return bad(error.message);
      await audit(req, actor, "marketing_handover.start", "marketing_handover", String(data.id), { from, to });
      return NextResponse.json({ ok: true, item: data });
    }
    if (!id) return bad("Missing id.");
    const { data: h } = await admin.from("marketing_handovers").select("*").eq("id", id).maybeSingle();
    if (!h) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (action === "step") {
      const key = str(body.key, 40);
      const checklist = (h.checklist as { key: string; done: boolean }[]).map((s) => s.key === key ? { ...s, done: !!body.done, done_by: body.done ? actor.username : null, done_at: body.done ? now : null, note: str(body.note, 1000) } : s);
      // Pasos con efecto en Maintly:
      if (key === "revoke_perms" && body.done) {
        await admin.from("department_members").update({ revoked_at: now, revoked_by: actor.username, permissions: {}, is_lead: false }).eq("department", "marketing").ilike("username", h.from_username);
        await audit(req, actor, "marketing_member.revoke", "marketing_member", h.from_username, { via: "handover" });
      }
      if (key === "reassign_tasks" && body.done && h.to_username) {
        await admin.from("marketing_tasks").update({ assignee_username: h.to_username, updated_by: actor.username, updated_at: now }).ilike("assignee_username", h.from_username).neq("status", "done");
        await admin.from("marketing_accounts").update({ owner_username: h.to_username, updated_by: actor.username, updated_at: now }).ilike("owner_username", h.from_username);
      }
      const { data, error } = await admin.from("marketing_handovers").update({ checklist }).eq("id", id).select("*").single();
      if (error) return bad(error.message);
      return NextResponse.json({ ok: true, item: data });
    }
    if (action === "complete") {
      const { data, error } = await admin.from("marketing_handovers").update({ completed_at: now }).eq("id", id).select("*").single();
      if (error) return bad(error.message);
      await audit(req, actor, "marketing_handover.complete", "marketing_handover", id, { from: h.from_username, to: h.to_username });
      return NextResponse.json({ ok: true, item: data });
    }
    return bad("Bad action.");
  }

  return bad("Bad resource.");
}
