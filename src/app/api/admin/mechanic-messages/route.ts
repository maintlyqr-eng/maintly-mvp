import { NextRequest, NextResponse } from "next/server";
import { adminHasCapability } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// GET: every mechanic-to-mechanic Team Chat message, full stop — including
// ones a Maintler has "cleared" from their own view. hidden_for_sender /
// hidden_for_recipient are soft-delete flags a Maintler's own client
// respects when it queries as itself (RLS still lets them see their own
// rows regardless — nothing is ever actually deleted); this admin view
// intentionally does NOT filter on those flags at all, on purpose. Facu
// wants full oversight of what's said on Team Chat no matter what either
// side has hidden, since MaintlyQR is a professional platform, not a
// private messenger.
//
// Enriches each row with the sender/recipient's basic info via a second
// query rather than a Postgrest embedded-resource join, since a join would
// need the exact auto-generated FK constraint names for two separate
// foreign keys to the same table (sender_id and recipient_id both
// reference mechanics) — fetching mechanics separately and joining
// in-memory is more robust and doesn't depend on guessing a constraint
// name right.
export async function GET(req: NextRequest) {
  // Incremento 11: "reports" — oversight de Team Chat, dominio de moderación.
  if (!adminHasCapability(req, "reports")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const admin = getSupabaseAdmin();

  const { data: messages, error } = await admin
    .from("mechanic_messages")
    .select("id, sender_id, recipient_id, body, read, hidden_for_sender, hidden_for_recipient, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = messages ?? [];
  const ids = Array.from(new Set(rows.flatMap((m) => [m.sender_id, m.recipient_id])));

  let infoById: Record<string, { name: string; email: string; workshop_name: string | null }> = {};
  if (ids.length > 0) {
    const { data: mechanics } = await admin
      .from("mechanics")
      .select("id, name, email, workshop_name")
      .in("id", ids);
    infoById = Object.fromEntries(
      (mechanics ?? []).map((m) => [m.id, { name: m.name, email: m.email, workshop_name: m.workshop_name }])
    );
  }

  const enriched = rows.map((m) => ({
    ...m,
    sender: infoById[m.sender_id] ?? null,
    recipient: infoById[m.recipient_id] ?? null,
  }));

  return NextResponse.json({ messages: enriched });
}
