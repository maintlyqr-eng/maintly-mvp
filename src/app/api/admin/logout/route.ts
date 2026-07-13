import { NextRequest, NextResponse } from "next/server";
import { getAdminUsername } from "@/lib/adminAuth";
import { logAdminAction, getRequestIp } from "@/lib/auditLog";

const COOKIE_NAME = "mly_admin_session";

export async function POST(req: NextRequest) {
  // Read who's logging out BEFORE clearing the cookie — there's nothing
  // left to identify them from afterward.
  const username = getAdminUsername(req);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });

  if (username) {
    await logAdminAction({ adminUsername: username, action: "admin.logout", ipAddress: getRequestIp(req) });
  }

  return res;
}
