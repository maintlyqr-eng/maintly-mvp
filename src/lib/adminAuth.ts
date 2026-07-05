// Server-only helper. Verifies the signed admin session cookie set by
// /api/admin/login. Import this only from route handlers (src/app/api/**) —
// never from a "use client" component.

import crypto from "crypto";
import { NextRequest } from "next/server";

export const ADMIN_COOKIE_NAME = "mly_admin_session";

export function verifyAdminToken(token: string | undefined, secret: string | undefined): boolean {
  if (!token || !secret) return false;
  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return false;
  const expiryStr = token.slice(0, dotIndex);
  const hmac = token.slice(dotIndex + 1);
  const expiry = Number(expiryStr);
  if (!expiry || Date.now() > expiry) return false;

  const expected = crypto.createHmac("sha256", secret).update(expiryStr).digest("hex");
  const a = Buffer.from(hmac, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Returns true if the incoming request carries a valid admin session cookie. */
export function isAdminRequest(req: NextRequest): boolean {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminToken(token, process.env.ADMIN_SESSION_SECRET);
}
