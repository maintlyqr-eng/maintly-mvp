-- ============================================================
-- Welcome message: every new mechanic gets one message automatically,
-- from "MaintlyQR Team", in their own Messages inbox — no code changes
-- needed to *display* it, since it reuses the exact same from_admin
-- broadcast shape the Control Center already uses to message a mechanic
-- directly (see src/app/api/admin/messages/route.ts).
--
-- Implemented as a NEW trigger on public.mechanics (not by editing the
-- existing handle_new_mechanic() function on auth.users, defined in
-- schema.sql) so this ships purely additively, with zero risk to the
-- already-working signup flow: whenever a mechanics row is inserted —
-- by that existing trigger, or by anything else, ever — this fires once
-- right after.
--
-- The welcome EMAIL is handled separately, client-side (see
-- src/app/register/page.tsx + src/app/api/send-welcome-email/route.ts) —
-- deliberately NOT from this trigger, to avoid depending on the pg_net
-- extension being enabled on this Supabase project. If email deliverability
-- ever needs to be guaranteed even when the browser tab closes early, this
-- trigger is the right place to move it to later (via pg_net.http_post).
-- ============================================================

create or replace function public.handle_new_mechanic_welcome()
returns trigger as $$
begin
  insert into public.messages (mechanic_id, asset_id, from_admin, sender_name, sender_contact, body, read)
  values (
    new.id,
    null,
    true,
    'MaintlyQR Team',
    'support@maintlyqr.com',
    'Welcome to MaintlyQR, ' || split_part(new.name, ' ', 1) || '! ' ||
    'MaintlyQR is a worldwide, QR-based service history system: every asset you register gets its own QR code, and anyone who scans it can instantly see its full maintenance history -- no app or account needed on their end. ' ||
    'A couple of things to try first: add your first asset from the Assets tab, or head to QR Codes to print a batch of blank stickers you can assign later. ' ||
    'If you ever have questions, just reply right here -- this inbox reaches our team.',
    false
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_mechanic_created_welcome on public.mechanics;
create trigger on_mechanic_created_welcome
  after insert on public.mechanics
  for each row execute function public.handle_new_mechanic_welcome();
