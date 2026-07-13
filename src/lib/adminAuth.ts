// Server-only helper. Verifies the signed admin session cookie set by
// /api/admin/login. Import this only from route handlers (src/app/api/**) —
// never from a "use client" component.

import crypto from "crypto";
import { NextRequest } from "next/server";

export const ADMIN_COOKIE_NAME = "mly_admin_session";

// Token format: "<expiry>.<base64url(username)>.<hmac>", where hmac signs
// "<expiry>.<base64url(username)>". The username travels inside the signed
// cookie (added for the admin audit log, see src/lib/auditLog.ts — every
// logged action needs to know WHICH admin did it) rather than in a separate
// unsigned cookie, so it can't be tampered with independently of the
// expiry. Base64url avoids "." collisions with the token's own delimiters
// in case a future username ever contains one.
export function signAdminToken(expiry: number, username: string, secret: string): string {
  const usernameB64 = Buffer.from(username, "utf8").toString("base64url");
  const hmac = crypto.createHmac("sha256", secret).update(`${expiry}.${usernameB64}`).digest("hex");
  return `${expiry}.${usernameB64}.${hmac}`;
}

export function verifyAdminSession(
  token: string | undefined,
  secret: string | undefined
): { valid: boolean; username: string | null } {
  if (!token || !secret) return { valid: false, username: null };

  const parts = token.split(".");
  if (parts.length !== 3) return { valid: false, username: null };
  const [expiryStr, usernameB64, hmac] = parts;

  const expiry = Number(expiryStr);
  if (!expiry || Date.now() > expiry) return { valid: false, username: null };

  const expected = crypto.createHmac("sha256", secret).update(`${expiryStr}.${usernameB64}`).digest("hex");
  const a = Buffer.from(hmac, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { valid: false, username: null };

  let username: string | null = null;
  try {
    username = Buffer.from(usernameB64, "base64url").toString("utf8") || null;
  } catch {
    username = null;
  }
  return { valid: true, username };
}

/** Returns true if the incoming request carries a valid admin session cookie. */
export function isAdminRequest(req: NextRequest): boolean {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminSession(token, process.env.ADMIN_SESSION_SECRET).valid;
}

/** Returns the admin username embedded in a valid session cookie, or null if absent/invalid. */
export function getAdminUsername(req: NextRequest): string | null {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const { valid, username } = verifyAdminSession(token, process.env.ADMIN_SESSION_SECRET);
  return valid ? username : null;
}
