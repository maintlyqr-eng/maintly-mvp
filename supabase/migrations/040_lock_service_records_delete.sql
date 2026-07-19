-- Facu (19 jul 2026): "nuestro sistema le da prioridad a la máquina, de la
-- cual nadie es dueño... los diferentes maintlers le pueden cargar
-- información pero nunca borrar algo ya cargado en ella" / "obvio que el
-- único que pueda eliminar algo de una máquina es el superadmin".
--
-- The dashboard/services page already stopped offering a Delete action to
-- mechanics (see MAINTLYQR_DEV_LOG), but that alone is only a UI-level
-- restriction — migration 003 gave every logged-in user a blanket UPDATE
-- policy on service_records ("solo logueados actualizan"), which technically
-- still lets any authenticated mechanic soft-delete (or restore) ANY
-- service_records row with a direct API call, bypassing the app entirely.
--
-- This tightens that policy so a normal authenticated user can keep
-- updating a service_records row (needed for the maintenance-reminder
-- fields, next_due_date / next_due_km_hours) but can never make deleted_at
-- non-null, i.e. can never soft-delete a service. It also can't be used to
-- restore an already-trashed row back to deleted_at = null, since that
-- path is reserved for the admin Papelera flow.
--
-- This does NOT affect the admin panel: src/app/api/admin/services/route.ts
-- uses getSupabaseAdmin() (the Supabase service-role client), which bypasses
-- RLS entirely, so soft-delete / restore / permanent-delete from the admin
-- Papelera keep working exactly as before, still gated by admin capability
-- checks (critical_actions for permanent delete = Super Admin only).

drop policy if exists "service_records: solo logueados actualizan" on service_records;

create policy "service_records: logueados actualizan sin borrar"
on service_records
for update
using (auth.uid() is not null)
with check (auth.uid() is not null and deleted_at is null);
