-- Turn "support_messages" into a full two-way conversation thread between a
-- mechanic and the Control Center, instead of splitting mechanic->admin and
-- admin->mechanic across two different tables. Now every message either side
-- sends lands in the same thread, ordered by created_at, so both the admin's
-- Support inbox and the mechanic's "Contact Support" panel can show the
-- complete back-and-forth history.

alter table support_messages add column if not exists from_admin boolean not null default false;

-- Mechanics can only insert their own (non-admin) messages. Admin replies are
-- inserted via the service-role client in /api/admin/support-messages, which
-- bypasses RLS entirely, so this policy only needs to gate the mechanic side.
drop policy if exists "support_messages: el mecanico envia" on support_messages;
create policy "support_messages: el mecanico envia"
on support_messages for insert
with check (auth.uid() = mechanic_id and from_admin = false);

-- Mechanics need to mark the admin's replies as read when they open the
-- thread (there was previously no update policy at all on this table).
drop policy if exists "support_messages: el mecanico actualiza" on support_messages;
create policy "support_messages: el mecanico actualiza"
on support_messages for update
using (auth.uid() = mechanic_id)
with check (auth.uid() = mechanic_id);
