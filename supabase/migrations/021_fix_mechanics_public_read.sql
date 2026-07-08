-- ============================================================
-- Fix: "Find a Maintler" in Team Chat found nobody at all — not even with
-- the unfiltered "browse" list added as a diagnostic, and not even typing
-- a real other Maintler's name ("mavi" -> should have shown Virginia
-- Ledesma). That rules out the search filter itself (already fixed the
-- % vs * wildcard bug earlier) and points at RLS: whatever SELECT policy
-- is actually live on public.mechanics right now does not let a logged-in
-- Maintler read anyone else's row.
--
-- schema.sql (the copy on file) describes a "mechanics: lectura pública"
-- policy — `for select using (true)` — that should already allow this.
-- But that file is a snapshot from earlier in the project and may not
-- match what's actually deployed on Supabase today. Rather than guess at
-- exactly what's live and risk dropping/editing the wrong thing, this
-- just adds ONE MORE permissive SELECT policy under a new name.
--
-- Why that's safe: Postgres RLS combines multiple PERMISSIVE policies for
-- the same command (SELECT here) with OR. So this can only ever open up
-- read access further — it cannot make anything more restrictive than it
-- already is, and it cannot conflict with or break any other existing
-- policy (insert/update/delete on mechanics are untouched).
-- ============================================================

drop policy if exists "mechanics: public read (team chat fix)" on public.mechanics;

create policy "mechanics: public read (team chat fix)"
  on public.mechanics for select
  using (true);
