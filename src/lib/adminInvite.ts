import crypto from "crypto";

// Tokens de invitación de admin (migración 052). Solo servidor.
// El token en claro viaja en el link; en la base queda únicamente su hash,
// así una lectura de la tabla no sirve para entrar.

export const ADMIN_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** URL pública del link de invitación. Base: el host del request. */
export function buildInviteLink(origin: string, token: string): string {
  return `${origin}/admin/invite?t=${encodeURIComponent(token)}`;
}
