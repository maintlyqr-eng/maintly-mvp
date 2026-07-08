-- ============================================================
-- Maintler QR business card — Item 4 from the feature backlog.
-- Facu's ask (July 8): "cada mecánico podría tener su propio QR como una
-- especie de tarjeta de presentación", framed around a bigger idea —
-- "lo que buscamos es crear identidad, sentido de pertenencia, comunidad."
--
-- Gives every mechanic a permanent, unique code (separate namespace from
-- the asset `qr_codes` table — this one lives to advertise a PERSON, not a
-- piece of equipment) that resolves to a public profile page at
-- /maintler/<code>: name/workshop, verified badge, member-since date, and
-- Save/Message buttons for a logged-in visitor. Reuses the same
-- QrCodeCanvas rendering component Item 1 built for asset codes (see the
-- new `linkPath` prop added there) rather than building a second QR
-- renderer from scratch.
-- ============================================================

-- One permanent code per mechanic. Nullable at the column level only so
-- the backfill below can run in two steps (add column, then fill it) —
-- every row ends up with one, and the trigger guarantees every future
-- mechanic gets one automatically at signup, the same way each of them
-- already gets a welcome message (migration 018).
alter table public.mechanics
  add column if not exists maintler_code text;

-- Generates a random 10-character code the same shape as the asset QR
-- codes' own genCode() (crypto.randomUUID().slice(0,10) in
-- src/app/api/qr-codes/route.ts) — md5() instead of gen_random_uuid()
-- deliberately, so this doesn't depend on the pgcrypto extension being
-- enabled. Loops (bounded to 5 tries) checking for an existing collision
-- first — astronomically unlikely at this scale (16^10 possibilities) but
-- cheap insurance against a signup ever failing on a unique-constraint
-- violation instead of just quietly retrying.
create or replace function public.set_maintler_code()
returns trigger
language plpgsql
as $$
declare
  candidate text;
  attempt int := 0;
begin
  if new.maintler_code is not null then
    return new;
  end if;

  loop
    candidate := substr(md5(random()::text || clock_timestamp()::text || coalesce(new.id::text, '')), 1, 10);
    attempt := attempt + 1;
    exit when attempt >= 5 or not exists (
      select 1 from public.mechanics where maintler_code = candidate
    );
  end loop;

  new.maintler_code := candidate;
  return new;
end;
$$;

drop trigger if exists on_mechanic_created_maintler_code on public.mechanics;
create trigger on_mechanic_created_maintler_code
  before insert on public.mechanics
  for each row
  execute function public.set_maintler_code();

-- Backfill every mechanic who signed up before this migration ran — same
-- collision-avoidance logic as the trigger, just looped per-row instead of
-- relying on a single INSERT firing it.
do $$
declare
  r record;
  candidate text;
  attempt int;
begin
  for r in select id from public.mechanics where maintler_code is null loop
    attempt := 0;
    loop
      candidate := substr(md5(random()::text || clock_timestamp()::text || r.id::text), 1, 10);
      attempt := attempt + 1;
      exit when attempt >= 5 or not exists (
        select 1 from public.mechanics where maintler_code = candidate
      );
    end loop;
    update public.mechanics set maintler_code = candidate where id = r.id;
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'mechanics_maintler_code_key'
  ) then
    alter table public.mechanics add constraint mechanics_maintler_code_key unique (maintler_code);
  end if;
end $$;

-- The `mechanic_public_profile` view (created directly in the Supabase SQL
-- editor in an earlier session — there's no migration file for its
-- original definition, only src/lib/mechanicPublicProfile.ts's comment
-- documenting its columns: id, name, verified, profession) is how the app
-- already shows one mechanic's name to a DIFFERENT logged-in mechanic
-- despite `mechanics` itself being locked to "read your own row only" —
-- see the public asset page's service history. The Maintler card's public
-- profile page needs four more public-safe fields from the same table
-- (workshop_name, photo_url, created_at, and now maintler_code itself, to
-- look the row up by). `create or replace view` only allows APPENDING
-- columns, not reordering or removing existing ones — id/name/verified/
-- profession stay first, in the same order, so every existing caller of
-- this view keeps working unchanged.
create or replace view public.mechanic_public_profile as
  select id, name, verified, profession, workshop_name, photo_url, created_at, maintler_code
  from public.mechanics;

grant select on public.mechanic_public_profile to anon;
grant select on public.mechanic_public_profile to authenticated;
