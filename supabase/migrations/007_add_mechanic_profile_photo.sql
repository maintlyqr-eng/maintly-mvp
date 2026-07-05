-- Profile photo for mechanic accounts (shown in the dashboard header/sidebar,
-- clickable through to Settings).
--
-- IMPORTANT — manual step required before this works: create a Storage bucket
-- named "mechanic-photos" in the Supabase dashboard (Storage → New bucket →
-- name it exactly "mechanic-photos" → toggle "Public bucket" ON), the same
-- way "asset-photos" was created for asset photos. This migration only adds
-- the column and the RLS policies for that bucket — it can't create the
-- bucket itself.

alter table mechanics add column if not exists photo_url text;

create policy "mechanic-photos: lectura pública"
on storage.objects for select
using (bucket_id = 'mechanic-photos');

create policy "mechanic-photos: logueados suben"
on storage.objects for insert
with check (bucket_id = 'mechanic-photos' and auth.uid() is not null);

create policy "mechanic-photos: logueados actualizan"
on storage.objects for update
using (bucket_id = 'mechanic-photos' and auth.uid() is not null)
with check (bucket_id = 'mechanic-photos' and auth.uid() is not null);
