import { NextRequest, NextResponse } from "next/server";

// Fires the welcome email for a brand-new mechanic account. Called
// client-side from src/app/register/page.tsx right after supabase.auth
// .signUp() resolves (fire-and-forget — a failed/slow email must never
// block or break the signup flow itself).
//
// Needs one env var to actually send anything: RESEND_API_KEY (get one free
// at resend.com, no credit card needed for the free tier). Without it, this
// route no-ops and logs a warning server-side instead of erroring, so
// signup keeps working even before email is set up.
//
// RESEND_FROM_EMAIL is optional. Left unset, this sends from Resend's own
// onboarding@resend.dev address, which works immediately with zero setup
// and can send to any recipient (not just your own inbox) — good enough to
// ship today. Once support@maintlyqr.com (or any @maintlyqr.com address) is
// verified as a sending domain in the Resend dashboard, set
// RESEND_FROM_EMAIL="MaintlyQR <support@maintlyqr.com>" for a more
// professional from-address and better inbox deliverability.
export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const { name, email } = payload ?? {};

  if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Missing or invalid email." }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[send-welcome-email] RESEND_API_KEY is not set — skipping welcome email for", email);
    // Not an error from the caller's point of view: signup should never
    // fail just because email sending isn't configured yet.
    return NextResponse.json({ ok: true, skipped: true });
  }

  const firstName = typeof name === "string" && name.trim() ? name.trim().split(" ")[0] : "there";
  const from = process.env.RESEND_FROM_EMAIL || "MaintlyQR <onboarding@resend.dev>";

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    const { error } = await resend.emails.send({
      from,
      to: email,
      subject: "Welcome to MaintlyQR",
      html: renderWelcomeEmailHtml(firstName),
      text: renderWelcomeEmailText(firstName),
    });

    if (error) {
      console.error("[send-welcome-email] Resend error:", error);
      return NextResponse.json({ error: "Failed to send email." }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[send-welcome-email] Unexpected error:", err);
    return NextResponse.json({ error: "Failed to send email." }, { status: 500 });
  }
}

function renderWelcomeEmailText(firstName: string): string {
  return `Welcome to MaintlyQR, ${firstName}!

MaintlyQR is a worldwide, QR-based service history system: every asset you register gets its own QR code, and anyone who scans it can instantly see its full maintenance history -- no app or account needed on their end.

A couple of things to try first:
- Add your first asset from the Assets tab.
- Head to QR Codes to print a batch of blank stickers you can assign later.

Questions? Just reply to this email or use the Messages tab in your dashboard -- our team is right there.

-- The MaintlyQR Team`;
}

function renderWelcomeEmailHtml(firstName: string): string {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;max-width:480px;width:100%;">
            <tr>
              <td style="background-color:#dc2626;padding:28px 32px;">
                <span style="color:#ffffff;font-size:20px;font-weight:900;letter-spacing:0.02em;">MaintlyQR</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;color:#18181b;">Welcome, ${escapeHtml(firstName)}!</h1>
                <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">
                  MaintlyQR is a worldwide, QR-based service history system: every asset you register gets its own QR code, and anyone who scans it can instantly see its full maintenance history &mdash; no app or account needed on their end.
                </p>
                <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#3f3f46;font-weight:700;">
                  A couple of things to try first:
                </p>
                <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;line-height:1.7;color:#3f3f46;">
                  <li>Add your first asset from the <strong>Assets</strong> tab.</li>
                  <li>Head to <strong>QR Codes</strong> to print a batch of blank stickers you can assign later.</li>
                </ul>
                <a href="https://maintlyqr.com/dashboard" style="display:inline-block;background-color:#dc2626;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:0.03em;text-transform:uppercase;padding:12px 24px;border-radius:10px;">
                  Go to your dashboard
                </a>
                <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#71717a;">
                  Questions? Just reply to this email, or use the Messages tab in your dashboard &mdash; our team is right there.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
