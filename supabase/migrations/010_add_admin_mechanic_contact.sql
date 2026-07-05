-- Two-way contact between the Control Center (admin) and mechanics.
--
-- 1) Admin -> mechanic: reuses the existing "messages" inbox mechanics
--    already check (the one customer inquiries land in). An admin message
--    isn't tied to a specific asset, so asset_id becomes optional, and a
--    from_admin flag marks it as official. Admin messages are inserted via
--    the service-role client in /api/admin/messages (bypasses RLS), so the
--    public "anyone can send" policy is tightened to forbid setting
--    from_admin=true through the normal (customer-facing) insert path.
alter table messages alter column asset_id drop not null;
alter table messages add column if not exists from_admin boolean not null default false;

drop policy if exists "messages: cualquiera puede enviar" on messages;
create policy "messages: cualquiera puede enviar"
on messages for insert
with check (from_admin = false);

-- 2) Mechanic -> admin: a small "Support" inbox. The admin reads/replies via
-- the service-role client (bypasses RLS), so there's no need for a broad
-- "admin can read everything" policy here — only the sending mechanic can
-- read their own sent messages back.
create table if not exists support_messages (
  id uuid primary key default gen_random_uuid(),
  mechanic_id uuid not null references mechanics(id) on delete cascade,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists support_messages_created_idx on support_messages (created_at desc);

alter table support_messages enable row level security;

drop policy if exists "support_messages: el mecanico envia" on support_messages;
create policy "support_messages: el mecanico envia"
on support_messages for insert
with check (auth.uid() = mechanic_id);

drop policy if exists "support_messages: el mecanico ve las suyas" on support_messages;
create policy "support_messages: el mecanico ve las suyas"
on support_messages for select
using (auth.uid() = mechanic_id);
