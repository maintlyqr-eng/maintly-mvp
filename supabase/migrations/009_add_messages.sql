-- "Messages": a lightweight inquiry inbox. Anyone viewing a public asset
-- page (no account needed) can send a message about that asset to the
-- mechanic who manages it (the asset's created_by). The mechanic reads and
-- replies from the dashboard's "Messages" page — replies happen outside the
-- app (email/phone), using the contact info the sender left.

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete cascade,
  mechanic_id uuid not null references mechanics(id) on delete cascade,
  sender_name text not null,
  sender_contact text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists messages_mechanic_idx on messages (mechanic_id, created_at desc);

alter table messages enable row level security;

drop policy if exists "messages: cualquiera puede enviar" on messages;
create policy "messages: cualquiera puede enviar"
on messages for insert
with check (true);

drop policy if exists "messages: el mecanico dueño lee" on messages;
create policy "messages: el mecanico dueño lee"
on messages for select
using (auth.uid() = mechanic_id);

drop policy if exists "messages: el mecanico dueño actualiza" on messages;
create policy "messages: el mecanico dueño actualiza"
on messages for update
using (auth.uid() = mechanic_id)
with check (auth.uid() = mechanic_id);

drop policy if exists "messages: el mecanico dueño borra" on messages;
create policy "messages: el mecanico dueño borra"
on messages for delete
using (auth.uid() = mechanic_id);
