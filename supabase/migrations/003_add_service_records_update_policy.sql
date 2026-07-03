-- Fix: service_records had SELECT and INSERT policies but no UPDATE policy,
-- so RLS silently blocked all updates (including setting maintenance reminders) —
-- Supabase returns success with 0 rows affected instead of an error in this case.
-- This adds an UPDATE policy consistent with the existing INSERT policy
-- ("service_records: solo logueados crean" — any logged-in mechanic, not owner-restricted).
-- Purely additive: does not touch or replace any existing policy.

create policy "service_records: solo logueados actualizan"
on service_records
for update
using (auth.uid() is not null)
with check (auth.uid() is not null);
