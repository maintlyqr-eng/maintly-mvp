// Server-only helper. Writes a row to admin_audit_logs (see migration 030)
// every time an admin performs a data-mutating action from the Control
// Center. Import this only from route handlers (src/app/api/admin/**).
//
// Deliberately scoped to actions that change stored data or security
// state (account edits/deletes, service record deletes, QR generation/
// unlinking, clearing a support thread, login/logout) — not routine
// reads or messaging actions like sending a support reply or marking a
// thread read. See claude/MAINTLYQR_FEATURE_BACKLOG.md for the reasoning.

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type AdminAuditAction =
  | "admin.login"
  | "admin.logout"
  | "account.update"
  | "account.delete"
  | "account.restore"
  | "account.delete_permanent"
  | "asset.delete"
  | "asset.restore"
  | "asset.delete_permanent"
  | "asset.update"
  | "service.delete"
  | "service.restore"
  | "service.delete_permanent"
  | "qr.generate_batch"
  | "qr.unlink"
  | "support_thread.clear"
  | "report.update_status";

export type AdminAuditEntityType = "mechanic" | "asset" | "service_record" | "qr_code" | "qr_batch" | "support_thread" | "content_report";

export async function logAdminAction(params: {
  adminUsername: string;
  action: AdminAuditAction;
  entityType?: AdminAuditEntityType;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  ipAddress?: string | null;
}) {
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("admin_audit_logs").insert({
      admin_username: params.adminUsername,
      action: params.action,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      old_value: params.oldValue ?? null,
      new_value: params.newValue ?? null,
      reason: params.reason ?? null,
      ip_address: params.ipAddress ?? null,
    });
    if (error) console.error("Failed to write admin audit log:", error.message);
  } catch (err) {
    // Best-effort: a logging failure should never block the actual admin
    // action, which has generally already succeeded by the time we log it.
    console.error("Failed to write admin audit log:", err);
  }
}

/** Best-effort client IP, for the "IP o información de sesión" field in the audit log. */
export function getRequestIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

/** Picks a subset of keys from an object — used to log only the fields that actually changed. */
export function pick<T extends Record<string, unknown>>(obj: T, keys: string[]): Partial<T> {
  const out: Partial<T> = {};
  for (const k of keys) {
    if (k in obj) out[k as keyof T] = obj[k as keyof T];
  }
  return out;
}
