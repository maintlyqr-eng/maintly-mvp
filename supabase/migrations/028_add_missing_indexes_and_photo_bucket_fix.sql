-- ============================================================
-- Cleanup pass (July 9, 2026), from a full codebase audit Facu asked for
-- before adding new features — two unrelated but both purely additive/
-- tightening fixes bundled into one migration since neither touches
-- existing data or behavior for a mechanic using the app normally.
-- ============================================================

-- ------------------------------------------------------------
-- PART 1 — missing indexes on foreign-key / RLS-filter columns.
-- Postgres does NOT auto-index plain foreign keys, and each of these is
-- hit on a real, already-shipped query path. All safe to run anytime —
-- CREATE INDEX IF NOT EXISTS is a no-op if it somehow already exists,
-- and none of these change query results, only how fast they come back.
-- ------------------------------------------------------------

create index if not exists support_messages_mechanic_idx
  on public.support_messages (mechanic_id, created_at desc);

create index if not exists mechanic_reports_reporter_idx
  on public.mechanic_reports (reporter_id);

create index if not exists documents_service_record_idx
  on public.documents (service_record_id);

create index if not exists calendar_tasks_customer_idx
  on public.calendar_tasks (customer_id);

create index if not exists calendar_tasks_asset_idx
  on public.calendar_tasks (asset_id);

create index if not exists messages_asset_idx
  on public.messages (asset_id);

create index if not exists qr_scans_asset_id_idx
  on public.qr_scans (asset_id);

create index if not exists maintler_saved_contacts_saved_idx
  on public.maintler_saved_contacts (saved_id);

create index if not exists maintler_blocks_pair_idx
  on public.maintler_blocks (blocker_id, blocked_id);

-- ------------------------------------------------------------
-- PART 2 — scope the "mechanic-photos" storage bucket to its actual
-- owner. Migration 007 copy-pasted the "asset-photos" bucket's write
-- policies (004) verbatim — but that openness is deliberate for asset
-- photos (any mechanic servicing that asset may legitimately update its
-- photo, same "the history belongs to the equipment" philosophy as
-- service_records), while a mechanic's own PERSONAL profile photo has no
-- such shared-ownership rationale. As shipped, any logged-in mechanic
-- could overwrite any other mechanic's profile photo, since the write
-- policies only checked "is someone logged in" with no check that the
-- path being written (`${mechanicId}.jpg`, see src/app/dashboard/
-- settings/page.tsx's uploadPhoto()) actually belongs to the uploader.
--
-- Read access and the asset-photos bucket are untouched — this only
-- tightens who may INSERT/UPDATE inside mechanic-photos.
-- ------------------------------------------------------------

drop policy if exists "mechanic-photos: logueados suben" on storage.objects;
drop policy if exists "mechanic-photos: logueados actualizan" on storage.objects;

create policy "mechanic-photos: el dueño sube su foto"
on storage.objects for insert
with check (bucket_id = 'mechanic-photos' and auth.uid()::text || '.jpg' = name);

create policy "mechanic-photos: el dueño actualiza su foto"
on storage.objects for update
using (bucket_id = 'mechanic-photos' and auth.uid()::text || '.jpg' = name)
with check (bucket_id = 'mechanic-photos' and auth.uid()::text || '.jpg' = name);
