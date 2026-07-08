-- ============================================================
-- Maintler public card, round 2 — Facu shared a fuller design concept for
-- the card (stats panel, specialties, "experience & skills" bars, a
-- "Maintly Score") and asked to build it, factoring in the concerns raised
-- about it first: self-reported skill percentages and an unexplained star
-- rating would undercut the "verified, tamper-proof" positioning the rest
-- of the app already has. So every number this migration exposes is a
-- real, computed count — never something the mechanic just typed in.
--
-- service_records, customers, and assets all carry owner-scoped RLS (a
-- mechanic can only read their OWN rows) — the same reason migration 016's
-- get_public_stats() and this file's mechanic_public_profile extension
-- exist: a stranger (or a different logged-in Maintler) viewing someone
-- else's public card can't query those tables directly. Both functions
-- below are SECURITY DEFINER, same trust boundary as get_public_stats() —
-- they run with the function owner's privileges internally, but only ever
-- return plain aggregate numbers for the ONE mechanic_id passed in, never
-- any row-level data (no customer names, no service notes, no asset
-- details) — safe to expose to anyone.
-- ============================================================

create or replace function public.get_maintler_stats(target_mechanic_id uuid)
returns table (
  services_count bigint,
  assets_count bigint,
  customers_count bigint,
  repeat_customers_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from service_records where mechanic_id = target_mechanic_id) as services_count,
    (select count(distinct asset_id) from service_records where mechanic_id = target_mechanic_id) as assets_count,
    (select count(*) from customers where mechanic_id = target_mechanic_id) as customers_count,
    (select count(*) from (
      select customer_id from service_records
      where mechanic_id = target_mechanic_id and customer_id is not null
      group by customer_id
      having count(*) > 1
    ) repeat_custs) as repeat_customers_count;
$$;

grant execute on function public.get_maintler_stats(uuid) to anon;
grant execute on function public.get_maintler_stats(uuid) to authenticated;

-- How many services this Maintler has logged per asset type (automotive,
-- generator, machinery, etc.) — powers both the "Specialties" icon row and
-- the "Experience & Skills" bars on the public card. Each bar's percentage
-- is this count divided by the mechanic's own total services, computed
-- client-side — grounded in what they've actually logged, not a
-- self-assigned skill level.
create or replace function public.get_maintler_specialty_breakdown(target_mechanic_id uuid)
returns table (
  asset_type text,
  services_count bigint
)
language sql
security definer
set search_path = public
as $$
  select a.asset_type, count(*) as services_count
  from service_records sr
  join assets a on a.id = sr.asset_id
  where sr.mechanic_id = target_mechanic_id
  group by a.asset_type
  order by services_count desc;
$$;

grant execute on function public.get_maintler_specialty_breakdown(uuid) to anon;
grant execute on function public.get_maintler_specialty_breakdown(uuid) to authenticated;
