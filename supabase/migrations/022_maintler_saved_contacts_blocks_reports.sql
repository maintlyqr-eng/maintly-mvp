-- ============================================================
-- Follow-up to 020_add_maintler_connections.sql, same day: Facu tried the
-- request/accept "Connections" feature and gave clear feedback that
-- changes the design:
--
--   1. Messaging must NOT require any approval — any Maintler can already
--      write to any other Maintler (that was already true at the RLS
--      level), but "saving" someone as a trusted Maintler should be an
--      instant, one-directional bookmark, not a mutual handshake with a
--      pending/accepted state. "uno tiene que primero enviarle solicitud
--      para que se habilite el chat y eso no me gusta... deberia uno poder
--      escribirle derecho nomas y poder agregarlo como amigo".
--   2. Instead of gatekeeping who can message you, the real answer to "I
--      don't want messages from this person" is to let a Maintler block
--      someone (enforced for real, not just hidden in the UI) or report
--      them to MaintlyQR support.
--
-- The maintler_connections table shipped a few hours ago has no real
-- production data yet (only Facu's own test rows), so this drops it
-- outright and replaces it with a plain bookmark table, rather than
-- trying to migrate pending/accepted rows into a shape that no longer has
-- an equivalent concept.
-- ============================================================

drop table if exists public.maintler_connections;

create table public.maintler_saved_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.mechanics(id) on delete cascade,
  saved_id uuid not null references public.mechanics(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint maintler_saved_contacts_no_self check (owner_id <> saved_id),
  unique (owner_id, saved_id)
);

create index if not exists maintler_saved_contacts_owner_idx on public.maintler_saved_contacts (owner_id);

alter table public.maintler_saved_contacts enable row level security;

create policy "maintler_saved_contacts: owner can read"
  on public.maintler_saved_contacts for select
  using (auth.uid() = owner_id);

create policy "maintler_saved_contacts: owner can insert"
  on public.maintler_saved_contacts for insert
  with check (auth.uid() = owner_id);

create policy "maintler_saved_contacts: owner can delete"
  on public.maintler_saved_contacts for delete
  using (auth.uid() = owner_id);


-- ============================================================
-- Block / report — the actual "escape valve" for unwanted messages,
-- replacing the idea of gating chat behind a connection request.
-- ============================================================

create table public.maintler_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.mechanics(id) on delete cascade,
  blocked_id uuid not null references public.mechanics(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint maintler_blocks_no_self check (blocker_id <> blocked_id),
  unique (blocker_id, blocked_id)
);

create index if not exists maintler_blocks_blocker_idx on public.maintler_blocks (blocker_id);
create index if not exists maintler_blocks_blocked_idx on public.maintler_blocks (blocked_id);

alter table public.maintler_blocks enable row level security;

-- Deliberately no "the blocked person can see who blocked them" policy —
-- a block is only ever visible to the person who made it.
create policy "maintler_blocks: blocker can read"
  on public.maintler_blocks for select
  using (auth.uid() = blocker_id);

create policy "maintler_blocks: blocker can insert"
  on public.maintler_blocks for insert
  with check (auth.uid() = blocker_id);

create policy "maintler_blocks: blocker can delete"
  on public.maintler_blocks for delete
  using (auth.uid() = blocker_id);


create table public.mechanic_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.mechanics(id) on delete cascade,
  reported_id uuid not null references public.mechanics(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  constraint mechanic_reports_no_self check (reporter_id <> reported_id)
);

create index if not exists mechanic_reports_reported_idx on public.mechanic_reports (reported_id);

alter table public.mechanic_reports enable row level security;

create policy "mechanic_reports: reporter can insert"
  on public.mechanic_reports for insert
  with check (auth.uid() = reporter_id);

create policy "mechanic_reports: reporter can read own"
  on public.mechanic_reports for select
  using (auth.uid() = reporter_id);

-- No admin-read RLS policy needed here: the Control Center reads through
-- the service-role key (getSupabaseAdmin()), which bypasses RLS entirely
-- — same pattern every other admin API route in this app already uses.


-- ============================================================
-- Enforce blocking where it actually matters: at the point a message row
-- gets created, not just in the UI. Drops and recreates the insert policy
-- from 019_add_mechanic_messaging.sql with one added condition.
--
-- Bidirectional on purpose: once EITHER side has blocked the other,
-- neither can send new messages to the other. A one-directional block
-- (only stops the blocked person from writing to the blocker, but lets
-- the blocker keep writing to them) is a more "mute" than "block" and
-- isn't what "bloquearlo y listo" implies — once you block someone here,
-- that relationship is done in both directions.
-- ============================================================

drop policy if exists "mechanic_messages: insert only as yourself" on public.mechanic_messages;
drop policy if exists "mechanic_messages: insert only as yourself, unless blocked" on public.mechanic_messages;

create policy "mechanic_messages: insert only as yourself, unless blocked"
  on public.mechanic_messages for insert
  with check (
    auth.uid() = sender_id
    and not exists (
      select 1 from public.maintler_blocks
      where (blocker_id = sender_id and blocked_id = recipient_id)
         or (blocker_id = recipient_id and blocked_id = sender_id)
    )
  );


-- ============================================================
-- Live delivery: Facu's feedback was that Team Chat feels dead ("siento
-- que tengo que hacer refresh todo el tiempo") — new messages only show
-- up after a manual page reload. Fixing that on the frontend means
-- subscribing to Supabase Realtime on mechanic_messages, which needs two
-- things set up on the table itself:
--
--   1. REPLICA IDENTITY FULL — by default Postgres only includes primary
--      key columns in the "old row" data Realtime sends for UPDATE
--      events. The unread-badge hook needs to know a message's previous
--      `read` value (was it false before this update?) to correctly
--      decrement the count, so the old row needs to carry that column too.
--   2. Explicit membership in the `supabase_realtime` publication — some
--      Supabase projects have this on by default for every table, others
--      don't, and there's no harmless "add if not already a member"
--      syntax, so this checks pg_publication_tables first and only adds
--      it if it's missing.
-- ============================================================

alter table public.mechanic_messages replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mechanic_messages'
  ) then
    alter publication supabase_realtime add table public.mechanic_messages;
  end if;
end $$;
