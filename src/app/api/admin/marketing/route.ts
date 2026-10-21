import { NextRequest, NextResponse } from "next/server";
import { adminHasCapability, getAdminUsername } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction, getRequestIp } from "@/lib/auditLog";
import { decryptSecret, encryptSecret, vaultConfigured } from "@/lib/vault";

// Espacio de Marketing (migración 059). Capacidad "marketing" (rol
// marketing + Super Admin). Un solo handler para los tres recursos:
//   GET    ?resource=accounts|contacts|feedback            → lista
//   GET    ?resource=accounts&reveal=<id>                  → { password } (auditado)
//   POST   { resource, ...campos }                         → crea
//   PATCH  { resource, id, ...campos }                     → edita
//   DELETE { resource, id }                                → borra
// Las contraseñas de accounts nunca salen en la lista: solo con reveal.

type Resource = "accounts" | "contacts" | "feedback";
const TABLE: Record<Resource, string> = { accounts: "marketing_accounts", contacts: "marketing_contacts", feedback: "marketing_feedback" };
const FIELDS: Record<Resource, string[]> = {
  accounts: ["platform", "label", "username", "recovery_email", "two_factor", "url", "notes"],
  contacts: ["name", "company", "source", "handle", "status", "next_action", "next_action_at", "notes"],
  feedback: ["source", "author", "kind", "body", "status", "answer"],
};
const LIST_SELECT: Record<Resource, string> = {
  accounts: "id, created_at, updated_at, platform, label, username, recovery_email, two_factor, url, notes, updated_by, password_enc",
  contacts: "id, created_at, updated_at, name, company, source, handle, status, next_action, next_action_at, notes, updated_by",
  feedback: "id, created_at, updated_at, source, author, kind, body, status, answer, updated_by",
};

function resourceOf(v: unknown): Resource | null {
  return v === "accounts" || v === "contacts" || v === "feedback" ? v : null;
}

function pick(resource: Resource, body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of FIELDS[resource]) {
    if (!(f in body)) continue;
    const v = body[f];
    if (v === null || v === undefined) { out[f] = null; continue; }
    const s = String(v).trim();
    out[f] = s === "" ? null : s.slice(0, f === "body" || f === "notes" || f === "answer" ? 4000 : 300);
  }
  return out;
}

function gate(req: NextRequest) {
  if (!adminHasCapability(req, "marketing")) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  return null;
}

export async function GET(req: NextRequest) {
  const denied = gate(req); if (denied) return denied;
  const url = new URL(req.url);
  const resource = resourceOf(url.searchParams.get("resource"));
  if (!resource) return NextResponse.json({ error: "Bad resource." }, { status: 400 });
  const admin = getSupabaseAdmin();
  const me = getAdminUsername(req) ?? "";

  const reveal = url.searchParams.get("reveal");
  if (resource === "accounts" && reveal) {
    const { data } = await admin.from("marketing_accounts").select("id, label, password_enc").eq("id", reveal).maybeSingle();
    if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (!data.password_enc) return NextResponse.json({ password: "" });
    try {
      const password = decryptSecret(data.password_enc);
      await logAdminAction({ adminUsername: me, action: "marketing_account.reveal", entityType: "marketing_account", entityId: data.id, newValue: { label: data.label }, ipAddress: getRequestIp(req) });
      return NextResponse.json({ password });
    } catch {
      return NextResponse.json({ error: "Vault key missing or changed." }, { status: 500 });
    }
  }

  const order = resource === "contacts" ? "updated_at" : "created_at";
  const { data, error } = await admin.from(TABLE[resource]).select(LIST_SELECT[resource]).order(order, { ascending: false }).limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const items = resource === "accounts"
    ? rows.map(({ password_enc, ...rest }) => ({ ...rest, has_password: !!password_enc }))
    : rows;
  return NextResponse.json({ items, vaultConfigured: vaultConfigured() });
}

export async function POST(req: NextRequest) {
  const denied = gate(req); if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const resource = resourceOf(body.resource);
  if (!resource) return NextResponse.json({ error: "Bad resource." }, { status: 400 });
  const me = getAdminUsername(req) ?? "";
  const row = pick(resource, body);
  if (resource === "accounts" && !row.label) return NextResponse.json({ error: "Label is required." }, { status: 400 });
  if (resource === "contacts" && !row.name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (resource === "feedback" && !row.body) return NextResponse.json({ error: "Text is required." }, { status: 400 });
  if (resource === "accounts" && typeof body.password === "string" && body.password) {
    if (!vaultConfigured()) return NextResponse.json({ error: "vault_not_configured" }, { status: 500 });
    row.password_enc = encryptSecret(body.password);
  }
  row.created_by = me; row.updated_by = me;
  const admin = getSupabaseAdmin();
  const { data: inserted, error } = await admin.from(TABLE[resource]).insert(row).select(LIST_SELECT[resource]).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const data = inserted as unknown as Record<string, unknown>;
  if (resource === "accounts") {
    await logAdminAction({ adminUsername: me, action: "marketing_account.save", entityType: "marketing_account", entityId: String(data.id), newValue: { label: row.label }, ipAddress: getRequestIp(req) });
  }
  const { password_enc, ...rest } = data;
  return NextResponse.json({ ok: true, item: resource === "accounts" ? { ...rest, has_password: !!password_enc } : rest });
}

export async function PATCH(req: NextRequest) {
  const denied = gate(req); if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const resource = resourceOf(body.resource);
  const id = typeof body.id === "string" ? body.id : "";
  if (!resource || !id) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const me = getAdminUsername(req) ?? "";
  const row = pick(resource, body);
  if (resource === "accounts" && typeof body.password === "string") {
    if (body.password) {
      if (!vaultConfigured()) return NextResponse.json({ error: "vault_not_configured" }, { status: 500 });
      row.password_enc = encryptSecret(body.password);
    }
    // password "" = no tocar la guardada (el formulario no la reenvía).
  }
  row.updated_by = me; row.updated_at = new Date().toISOString();
  const admin = getSupabaseAdmin();
  const { data: updated, error } = await admin.from(TABLE[resource]).update(row).eq("id", id).select(LIST_SELECT[resource]).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const data = updated as unknown as Record<string, unknown>;
  if (resource === "accounts") {
    await logAdminAction({ adminUsername: me, action: "marketing_account.save", entityType: "marketing_account", entityId: id, newValue: { label: data.label, passwordChanged: !!row.password_enc }, ipAddress: getRequestIp(req) });
  }
  const { password_enc, ...rest } = data;
  return NextResponse.json({ ok: true, item: resource === "accounts" ? { ...rest, has_password: !!password_enc } : rest });
}

export async function DELETE(req: NextRequest) {
  const denied = gate(req); if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const resource = resourceOf(body.resource);
  const id = typeof body.id === "string" ? body.id : "";
  if (!resource || !id) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const me = getAdminUsername(req) ?? "";
  const admin = getSupabaseAdmin();
  const { error } = await admin.from(TABLE[resource]).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (resource === "accounts") {
    await logAdminAction({ adminUsername: me, action: "marketing_account.delete", entityType: "marketing_account", entityId: id, ipAddress: getRequestIp(req) });
  }
  return NextResponse.json({ ok: true });
}
