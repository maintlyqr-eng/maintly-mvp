-- ============================================================
-- Maintler Connections — "add as a trusted Maintler" (Facu's own word for
-- it: guardar a los Maintlers que quiera como amigos).
--
-- This is the foundation piece for the bigger Item 4 vision (see the
-- feature backlog doc): identity, belonging, community — and a network you
-- actually trust enough to hand equipment to. A connection here is NOT the
-- same thing as being able to message someone (any Maintler can message
-- any other Maintler already, via mechanic_messages/Team Chat, no gate).
-- A connection is a mutual, accepted relationship — closer to a real
-- professional contact than a chat thread — and it's the gate that will
-- decide who you're even allowed to offer an asset transfer to once that
-- ships (so a transfer always happens inside a trusted relationship, never
-- to a stranger).
--
-- request/accept, not instant-add, same reasoning as the recommended
-- asset-transfer flow in the backlog: two parties need to agree before a
-- relationship (and later, real equipment) changes hands.
-- ============================================================

create table if not exists public.maintler_connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.mechanics(id) on delete cascade,
  addressee_id uuid not null references public.mechanics(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint maintler_connections_no_self_connection check (requester_id <> addressee_id)
);

-- Not enforcing a DB-level uniqueness constraint on the (requester,
-- addressee) pair here — Postgres would need an expression index on
-- least()/greatest() to catch both directions, and this app's existing
-- tables (support_messages, mechanic_messages) all lean on simple
-- app-level checks rather than DB constraints for this kind of thing.
-- The UI checks existing connection status before offering "Connect"
-- again, which is enough for a first version.

create index if not exists maintler_connections_requester_idx on public.maintler_connections (requester_id, status);
create index if not exists maintler_connections_addressee_idx on public.maintler_connections (addressee_id, status);

alter table public.maintler_connections enable row level security;

create policy "maintler_connections: either side can read"
  on public.maintler_connections for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "maintler_connections: insert only as yourself"
  on public.maintler_connections for insert
  with check (auth.uid() = requester_id);

-- Update is used for one thing: the addressee accepting or declining.
-- The requester doesn't get to flip their own request to "accepted".
create policy "maintler_connections: addressee can respond"
  on public.maintler_connections for update
  using (auth.uid() = addressee_id)
  with check (auth.uid() = addressee_id);

-- Delete covers both "cancel a request I sent" (requester, while pending)
-- and "remove a Maintler from my network" (either side, once accepted).
create policy "maintler_connections: either side can delete"
  on public.maintler_connections for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
