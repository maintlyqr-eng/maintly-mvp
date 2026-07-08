-- ============================================================
-- The new dashboard notification bell (src/components/NotificationBell.tsx)
-- needs to hear about new customer inquiries live, the same way Team Chat
-- already hears about new mechanic-to-mechanic messages (see migration
-- 022). mechanic_messages was added to the supabase_realtime publication
-- there; public.messages (customer inquiries) never has been, so without
-- this the bell's customer-message half would silently never fire and
-- Facu would only see it update on a manual refresh — exactly the "siento
-- que tengo que hacer refresh todo el tiempo" complaint this whole batch
-- of work is meant to fix.
--
-- No "replica identity full" needed here — the bell only listens for
-- INSERT events (a new message arriving), and Postgres always includes the
-- full new row on INSERT regardless of replica identity; that setting only
-- changes what's included in the *old* row on UPDATE/DELETE, which the
-- bell doesn't care about for this table.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
