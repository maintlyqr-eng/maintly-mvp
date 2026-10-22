"use client";

// Tipos y utilidades compartidas del departamento de Marketing (migración
// 061). Spec: claude/MAINTLYQR_MARKETING_DEPARTAMENTO_SPEC.md. Toda la API
// pasa por /api/admin/marketing/dept (GET ?r=… / POST { r, action, … }).

import { supabase } from "@/lib/supabase";

export type Perm = "stats" | "content" | "approve" | "publish" | "connections" | "vault";
export const PERMS: Perm[] = ["stats", "content", "approve", "publish", "connections", "vault"];

export type Actor = { username: string; isSuper: boolean; isMember: boolean; isLead: boolean; perms: Record<Perm, boolean> };
export type Settings = { require_approval: boolean; default_timezone: string; monthly_goals: string | null };
export type Member = { id: string; username: string; title: string | null; is_lead: boolean; permissions: Partial<Record<Perm, boolean>>; granted_by: string | null; granted_at: string; revoked_at: string | null };
export type AdminLite = { username: string; role: string; active: boolean; first_name: string | null; last_name: string | null; nickname: string | null; display_name: string | null };

export type Campaign = { id: string; name: string; objective: string | null; starts_on: string | null; ends_on: string | null; status: "active" | "closed"; budget_proposed: number | null; budget_currency: string; budget_approved_by: string | null; budget_approved_at: string | null; budget_note: string | null; created_by: string | null; created_at: string };
export type Task = { id: string; title: string; description: string | null; assignee_username: string | null; due_on: string | null; priority: "low" | "normal" | "high"; status: "todo" | "doing" | "done"; campaign_id: string | null; post_id: string | null; created_by: string | null; created_at: string; done_at: string | null };
export type PostStatus = "draft" | "review" | "approved" | "scheduled" | "published" | "cancelled";
export type Post = { id: string; title: string; body: string; campaign_id: string | null; scheduled_at: string | null; timezone: string; status: PostStatus; created_by: string | null; updated_by: string | null; submitted_at: string | null; submitted_by: string | null; approved_at: string | null; approved_by: string | null; change_request_note: string | null; change_requested_by: string | null; cancelled_reason: string | null; cancelled_by: string | null; created_at: string; updated_at: string };
export type Target = { id: string; post_id: string; account_id: string; adapted_body: string | null; result_status: "pending" | "published" | "failed" | "manual"; result_url: string | null; result_error: string | null; published_at: string | null; published_by: string | null };
export type Media = { id: string; name: string; mime: string | null; size: number | null; storage_path: string; uploaded_by: string | null; created_at: string };
export type Comment = { id: string; created_at: string; entity_type: string; entity_id: string; author_username: string; body: string };
export type Account = { id: string; platform: string; label: string; username: string | null; url: string | null; recovery_email: string | null; business_email: string | null; owner_username: string | null; authorized_usernames: string[]; connection_status: "none" | "connected" | "needs_reconnect"; connection_note: string | null; notes: string | null; has_password: boolean; has_two_factor: boolean; has_recovery: boolean; can_reveal: boolean; updated_at: string; updated_by: string | null };
export type LibraryItem = { id: string; name: string; kind: "logo" | "color" | "font" | "photo" | "video" | "template" | "doc" | "text"; is_official: boolean; version: number; replaces_id: string | null; is_current: boolean; storage_path: string | null; mime: string | null; size: number | null; value: string | null; notes: string | null; created_by: string | null; created_at: string };
export type Handover = { id: string; started_at: string; started_by: string; from_username: string; to_username: string | null; completed_at: string | null; checklist: { key: string; label: string; done: boolean; done_by?: string | null; done_at?: string | null; note?: string | null }[] };

export type T = (key: string, values?: Record<string, string | number>) => string;

export async function mkGet<R = Record<string, unknown>>(params: Record<string, string>): Promise<R> {
  const q = new URLSearchParams(params).toString();
  const r = await fetch(`/api/admin/marketing/dept?${q}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j as R;
}

export async function mkPost<R = Record<string, unknown>>(body: Record<string, unknown>): Promise<{ ok: boolean; data: R; error?: string }> {
  const r = await fetch("/api/admin/marketing/dept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok && !j.error, data: j as R, error: j.error as string | undefined };
}

/** Sube un archivo directo a Storage con URL firmada (sin pasar por Vercel). Devuelve la ruta. */
export async function mkUpload(file: File, bucket: "media" | "library"): Promise<string> {
  const r1 = await mkPost<{ path: string; token: string }>({ r: "upload-url", bucket, name: file.name, size: file.size, type: file.type });
  if (!r1.ok) throw new Error(r1.error || "upload-url failed");
  const bucketId = bucket === "library" ? "marketing-library" : "marketing-media";
  const { error } = await supabase.storage.from(bucketId).uploadToSignedUrl(r1.data.path, r1.data.token, file, { contentType: file.type || "application/octet-stream" });
  if (error) throw new Error(error.message);
  return r1.data.path;
}

export function fileUrl(bucket: "media" | "library", path: string): string {
  return `/api/admin/marketing/dept?r=file&bucket=${bucket}&path=${encodeURIComponent(path)}`;
}

export function fmtSize(n: number | null | undefined): string {
  if (!n) return "";
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function fmtDateTime(iso: string | null | undefined, locale: string, tz?: string): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short", timeZone: tz || undefined }); } catch { return new Date(iso).toLocaleString(locale); }
}

export function personLabel(username: string | null | undefined, admins?: AdminLite[]): string {
  if (!username) return "—";
  const a = admins?.find((x) => x.username.toLowerCase() === username.toLowerCase());
  return a?.nickname || a?.first_name || a?.display_name || username;
}

export const STATUS_TONE: Record<PostStatus, "zinc" | "amber" | "blue" | "emerald" | "red"> = {
  draft: "zinc", review: "amber", approved: "blue", scheduled: "blue", published: "emerald", cancelled: "red",
};

export const PLATFORMS = ["instagram", "facebook", "tiktok", "linkedin", "x", "youtube", "google", "canva", "other"];

// Estilos compartidos (mismo lenguaje visual del resto del panel).
export const ui = {
  input: "w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500 bg-white",
  label: "text-[12px] font-bold text-zinc-700",
  primary: "text-[12px] font-bold px-4 py-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-40",
  danger: "text-[12px] font-bold px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-40",
  ghost: "text-[12px] font-bold px-4 py-2 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40",
  icon: "p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100",
  card: "bg-white rounded-2xl border border-zinc-200/80 shadow-sm",
  chip: (active: boolean) => `text-[11px] font-bold px-3 py-1.5 rounded-xl border ${active ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50"}`,
};
