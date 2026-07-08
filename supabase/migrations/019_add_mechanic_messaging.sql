-- ============================================================
-- Mechanic-to-mechanic direct messaging.
--
-- Copies the proven support_messages pattern (admin<->mechanic, see
-- 010/011/012_support_*.sql) rather than inventing a new shape: a flat
-- message-row table, a boolean pair for per-side soft delete instead of
-- real row deletion, and RLS as the only access control (no service-role
-- API route needed for the mechanic's own actions — same as
-- ContactSupportWidget.tsx talks to support_messages directly).
--
-- The one real difference from support_messages: there's no fixed single
-- counterparty ("the admin") to imply, so this needs an actual
-- recipient_id column and a picker in the UI (mechanics are already
-- publicly SELECT-able per the "mechanics: lectura pública" policy in
-- schema.sql, so the picker can query mechanics directly, no new API
-- route needed for that either).
-- ============================================================

create table if not exists public.mechanic_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.mechanics(id) on delete cascade,
  recipient_id uuid not null references public.mechanics(id) on delete cascade,
  body text not null,
  read boolean not null default false,
  hidden_for_sender boolean not null default false,
  hidden_for_recipient boolean not null default false,
  created_at timestamptz not null default now(),
  constraint mechanic_messages_no_self_message check (sender_id <> recipient_id)
);

-- Fetching "all messages in my conversation with mechanic X" needs both
-- directions; fetching "my conversation list" needs the most recent message
-- per counterparty. These two indexes cover both access patterns.
create index if not exists mechanic_messages_recipient_idx on public.mechanic_messages (recipient_id, created_at desc);
create index if not exists mechanic_messages_sender_idx on public.mechanic_messages (sender_id, created_at desc);

alter table public.mechanic_messages enable row level security;

create policy "mechanic_messages: sender or recipient can read"
  on public.mechanic_messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "mechanic_messages: insert only as yourself"
  on public.mechanic_messages for insert
  with check (auth.uid() = sender_id);

-- Update is used for two things by whichever side does them: the recipient
-- marks messages read, and either side can set their own hidden_for_* flag
-- to soft-delete the thread on their end without touching the other side's
-- copy. Column-level enforcement (e.g. a mechanic can't flip someone else's
-- hidden flag) isn't modeled here, same tradeoff support_messages already
-- makes — the row-level check is the real boundary, not the column.
create policy "mechanic_messages: sender or recipient can update"
  on public.mechanic_messages for update
  using (auth.uid() = sender_id or auth.uid() = recipient_id);
