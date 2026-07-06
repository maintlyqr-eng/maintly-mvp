-- Public stats for the logged-out homepage: real, live counts (machines
-- tracked, services logged, mechanics on the platform) instead of made-up
-- marketing numbers. Deliberately a SECURITY DEFINER function, not a public
-- SELECT policy on the underlying tables — those tables (mechanics,
-- service_records) have owner-scoped RLS and contain real names/PII, so
-- opening them up for public reads (even "just to count") would leak rows.
-- A security definer function runs with the function owner's privileges,
-- bypassing each table's RLS internally, but only ever returns three plain
-- integers — never any row-level data — so it's safe to expose to anyone.

create or replace function public.get_public_stats()
returns table (machines_count bigint, services_count bigint, mechanics_count bigint)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from assets) as machines_count,
    (select count(*) from service_records) as services_count,
    (select count(*) from mechanics where is_mechanic = true) as mechanics_count;
$$;

grant execute on function public.get_public_stats() to anon;
grant execute on function public.get_public_stats() to authenticated;
