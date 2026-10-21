import { NextRequest, NextResponse } from "next/server";
import { getAdminUsername } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Chat interno del equipo (migración 057). Cualquier admin logueado.
//
// GET                 → { people: [{username, displayName, role, unread, lastAt}] }
// GET ?with=<user>    → { messages } entre el logueado y <user> (marca leídos
//                        los que recibió). ?after=<ISO> devuelve solo los nuevos.
// GET ?file=<id>      → redirige a una URL firmada (1 h) del adjunto de ese
//                        mensaje, solo si el logueado es parte de la charla.
// POST JSON           → ver abajo (upload-url + mensaje).

const BUCKET = "admin-chat";
const MAX_FILE = 25 * 1024 * 1024;
const ALLOWED = /^(image\/(jpeg|png|webp|gif|heic|heif)|application\/pdf|video\/mp4|video\/quicktime|audio\/(mpeg|mp4|ogg|wav)|text\/plain|application\/(zip|vnd\.openxmlformats-officedocument\.[a-z.]+|msword|vnd\.ms-excel))$/i;

const SELECT = "id, created_at, from_username, to_username, body, attachment_path, attachment_name, attachment_type, attachment_size, read_at";

export async function GET(req: NextRequest) {
  const me = getAdminUsername(req);
  if (!me) return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  const url = new URL(req.url);
  const admin = getSupabaseAdmin();

  const fileId = url.searchParams.get("file");
  if (fileId) {
    const { data: msg } = await admin.from("admin_chat_messages").select("from_username, to_username, attachment_path").eq("id", fileId).maybeSingle();
    if (!msg || !msg.attachment_path) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (![msg.from_username, msg.to_username].map((u) => u.toLowerCase()).includes(me.toLowerCase())) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }
    const { data: signed, error } = await admin.storage.from(BUCKET).createSignedUrl(msg.attachment_path, 3600);
    if (error || !signed) return NextResponse.json({ error: "Could not sign." }, { status: 500 });
    return NextResponse.redirect(signed.signedUrl, 302);
  }

  const withUser = url.searchParams.get("with");
  if (withUser) {
    const after = url.searchParams.get("after");
    let q = admin.from("admin_chat_messages").select(SELECT)
      .or(`and(from_username.ilike.${me},to_username.ilike.${withUser}),and(from_username.ilike.${withUser},to_username.ilike.${me})`)
      .order("created_at", { ascending: true }).limit(500);
    if (after) q = q.gt("created_at", after);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Marcar como leídos los que me mandaron.
    const unreadIds = (data ?? []).filter((m) => m.to_username.toLowerCase() === me.toLowerCase() && !m.read_at).map((m) => m.id);
    if (unreadIds.length) await admin.from("admin_chat_messages").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
    return NextResponse.json({ messages: data ?? [] });
  }

  // Lista de personas: admins activos + el Super Admin fundador (env).
  const [{ data: admins }, { data: unread }, { data: recent }] = await Promise.all([
    admin.from("admin_users").select("username, display_name, first_name, nickname, role").eq("active", true),
    admin.from("admin_chat_messages").select("from_username").ilike("to_username", me).is("read_at", null).limit(5000),
    admin.from("admin_chat_messages").select("from_username, to_username, created_at")
      .or(`from_username.ilike.${me},to_username.ilike.${me}`).order("created_at", { ascending: false }).limit(500),
  ]);
  const people = new Map<string, { username: string; displayName: string | null; role: string | null; unread: number; lastAt: string | null }>();
  for (const a of admins ?? []) people.set(a.username.toLowerCase(), { username: a.username, displayName: a.nickname || a.first_name || a.display_name, role: a.role, unread: 0, lastAt: null });
  const founder = process.env.ADMIN_USERNAME;
  if (founder && !people.has(founder.toLowerCase())) people.set(founder.toLowerCase(), { username: founder, displayName: "Facundo (CEO)", role: "super_admin", unread: 0, lastAt: null });
  people.delete(me.toLowerCase());
  for (const u of unread ?? []) { const p = people.get(u.from_username.toLowerCase()); if (p) p.unread += 1; }
  for (const m of recent ?? []) {
    const other = m.from_username.toLowerCase() === me.toLowerCase() ? m.to_username : m.from_username;
    const p = people.get(other.toLowerCase());
    if (p && !p.lastAt) p.lastAt = m.created_at;
  }
  const list = Array.from(people.values()).sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? "") || a.username.localeCompare(b.username));
  return NextResponse.json({ people: list });
}

// POST JSON. Dos acciones:
//  { action: "upload-url", name, type, size } → { path, token }: URL firmada
//     para que el navegador suba el archivo DIRECTO a Supabase Storage
//     (las rutas de Vercel no aceptan cuerpos > 4,5 MB, así que el archivo
//     nunca pasa por acá).
//  { to, body?, attachment?: { path, name, type, size } } → guarda el mensaje
//     (verifica que el adjunto exista en el bucket y sea de quien lo manda).
export async function POST(req: NextRequest) {
  const me = getAdminUsername(req);
  if (!me) return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  const payload = await req.json().catch(() => ({}));
  const admin = getSupabaseAdmin();
  const prefix = `${me.toLowerCase().replace(/[^a-z0-9._-]/g, "_")}/`;

  if (payload.action === "upload-url") {
    const name = String(payload.name ?? "archivo").replace(/[^\w.\-() ]+/g, "_").slice(0, 120) || "archivo";
    const type = String(payload.type ?? "application/octet-stream");
    const size = Number(payload.size ?? 0);
    if (!ALLOWED.test(type)) return NextResponse.json({ error: "File type not allowed." }, { status: 400 });
    if (!size || size > MAX_FILE) return NextResponse.json({ error: "File too large (max 25 MB)." }, { status: 400 });
    const path = `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${name}`;
    const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) return NextResponse.json({ error: error?.message ?? "Could not sign upload." }, { status: 500 });
    return NextResponse.json({ ok: true, path, token: data.token });
  }

  const to = String(payload.to ?? "").trim();
  const body = String(payload.body ?? "").trim().slice(0, 4000);
  const att = payload.attachment && typeof payload.attachment === "object" ? payload.attachment : null;
  if (!to) return NextResponse.json({ error: "Missing recipient." }, { status: 400 });
  if (!body && !att) return NextResponse.json({ error: "Empty message." }, { status: 400 });

  let attachment: { path: string; name: string; type: string; size: number } | null = null;
  if (att) {
    const path = String(att.path ?? "");
    if (!path.startsWith(prefix)) return NextResponse.json({ error: "Invalid attachment." }, { status: 400 });
    // Confirmar que el archivo realmente quedó en el bucket.
    const dir = path.slice(0, path.lastIndexOf("/"));
    const fileName = path.slice(path.lastIndexOf("/") + 1);
    const { data: listed } = await admin.storage.from(BUCKET).list(dir, { search: fileName, limit: 1 });
    if (!listed || !listed.some((f) => f.name === fileName)) return NextResponse.json({ error: "Attachment not uploaded." }, { status: 400 });
    attachment = { path, name: String(att.name ?? fileName).slice(0, 200), type: String(att.type ?? "application/octet-stream"), size: Number(att.size ?? 0) };
  }

  const { data, error } = await admin.from("admin_chat_messages").insert({
    from_username: me, to_username: to, body,
    attachment_path: attachment?.path ?? null, attachment_name: attachment?.name ?? null,
    attachment_type: attachment?.type ?? null, attachment_size: attachment?.size ?? null,
  }).select(SELECT).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, message: data });
}
