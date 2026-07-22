-- ============================================================
-- Facu (21 jul 2026): "quiero dar la opción de borrar un service mal
-- cargado... me pasé un service en un generador erróneamente xq me
-- equivoqué de generador... deberíamos tener la opción de tener un
-- tiempito para borrarlo antes de que quede fijo y bloqueado" — followed
-- by "y una vez pasado ese tiempo debería tener la opción de pedirle al
-- administrador que borre ese service".
--
-- Two pieces, both scoped to ONLY the mechanic who logged the record
-- (never anyone else — that part of migration 040/041's philosophy
-- doesn't change, this is strictly a narrow safety net for your own
-- honest mistake, not a reopening of "anyone can delete"):
--
-- 1. Self-delete within 1 hour of logging it. Migration 040's existing
--    UPDATE policy ("service_records: logueados actualizan sin borrar")
--    stays exactly as-is (its `with check` still forbids deleted_at from
--    ever becoming non-null) — this migration ADDS a second, narrower
--    permissive policy on top of it. Postgres OR's permissive policies
--    together, so a row update is allowed if EITHER policy's checks
--    pass: the old one (any authenticated user, but deleted_at must stay
--    null) or this new one (only the record's own mechanic_id, only
--    within 1 hour of created_at, and it's allowed to set deleted_at).
--    After the hour passes, this policy's USING clause stops matching
--    and the row falls back to being exactly as locked as migration 040
--    already made it.
--
-- 2. Once that hour is gone, a formal request queue instead of a raw
--    delete — service_delete_requests. The mechanic who logged the
--    record can file one (with an optional reason), and only the admin
--    Control Center (via getSupabaseAdmin(), which bypasses RLS
--    entirely, same as every other admin mutation) can approve
--    (soft-deletes the service_records row, same effect as the existing
--    admin Papelera flow) or reject it. This keeps "solo el superadmin
--    puede eliminar algo de una máquina" fully intact — the mechanic is
--    never the one actually deleting anything past the 1-hour window,
--    only asking.
-- ============================================================

create policy "service_records: dueño autoelimina en la primera hora"
on service_records
for update
using (auth.uid() is not null and mechanic_id = auth.uid() and created_at > now() - interval '1 hour')
with check (auth.uid() is not null and mechanic_id = auth.uid() and created_at > now() - interval '1 hour');

create table if not exists public.service_delete_requests (
  id uuid primary key default gen_random_uuid(),
  service_record_id uuid not null references public.service_records(id) on delete cascade,
  requested_by uuid not null references public.mechanics(id) on delete cascade,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text -- admin username (string, not a mechanics.id — admins aren't rows in `mechanics`, same pattern admin_audit_logs.admin_username already uses)
);

create index if not exists service_delete_requests_service_record_id_idx on public.service_delete_requests (service_record_id);
create index if not exists service_delete_requests_status_idx on public.service_delete_requests (status);

alter table public.service_delete_requests enable row level security;

-- A mechanic can file a request only for a service_records row that's
-- actually theirs (mechanic_id = auth.uid()) and only as themselves
-- (requested_by = auth.uid()) — enforced here at the DB level, not just
-- hidden behind a UI button, same defensive posture as migration 041's
-- comment about direct API calls bypassing the app.
create policy "service_delete_requests: dueño solicita para lo suyo"
on service_delete_requests
for insert
with check (
  auth.uid() is not null
  and requested_by = auth.uid()
  and exists (
    select 1 from service_records sr
    where sr.id = service_record_id and sr.mechanic_id = auth.uid()
  )
);

-- A mechanic can see their own requests (to show "pendiente de revisión"
-- in their own Mis Servicios), but not anyone else's, and can't update or
-- delete them once filed — only the admin (service-role client, bypasses
-- RLS) resolves a request.
create policy "service_delete_requests: dueño ve las suyas"
on service_delete_requests
for select
using (auth.uid() is not null and requested_by = auth.uid());
