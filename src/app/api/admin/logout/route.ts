import { NextResponse } from "next/server";

const COOKIE_NAME = "mly_admin_session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}
