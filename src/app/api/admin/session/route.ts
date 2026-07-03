import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const COOKIE_NAME = "mly_admin_session";

function verify(token: string | undefined, secret: string | undefined): boolean {
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

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const ok = verify(token, process.env.ADMIN_SESSION_SECRET);
  return NextResponse.json({ ok });
}
