import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// This file runs ONLY on the server. Nothing here — including the
// comparison below and the ADMIN_USERNAME / ADMIN_PASSWORD values it
// reads from the environment — is ever sent to the browser.

const COOKIE_NAME = "mly_admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function sign(expiry: number, secret: string) {
  const hmac = crypto.createHmac("sha256", secret).update(String(expiry)).digest("hex");
  return `${expiry}.${hmac}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";

  const validUser = process.env.ADMIN_USERNAME;
  const validPass = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!validUser || !validPass || !secret) {
    console.error("Admin login: missing ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_SESSION_SECRET env vars.");
    return NextResponse.json({ error: "Admin login is not configured on the server." }, { status: 500 });
  }

  // Constant-time comparison so response timing can't leak how many
  // characters matched.
  const userOk = timingSafeEqualStr(username, validUser);
  const passOk = timingSafeEqualStr(password, validPass);

  if (!userOk || !passOk) {
    return NextResponse.json({ error: "Incorrect credentials. Please try again." }, { status: 401 });
  }

  const expiry = Date.now() + SESSION_TTL_MS;
  const token = sign(expiry, secret);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return res;
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    // Still run a comparison of equal length to avoid an obvious timing
    // shortcut, then return false.
    crypto.timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}
