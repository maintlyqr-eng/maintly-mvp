-- Storage bucket "asset-photos" has RLS enabled on storage.objects with no policies,
-- which silently blocks every upload ("new row violates row-level security policy").
-- Same fix philosophy as 003 (service_records UPDATE policy): logged-in mechanics can
-- write, and reads are public since asset photos also show up on the public QR report page.

create policy "asset-photos: lectura pública"
on storage.objects for select
using (bucket_id = 'asset-photos');

create policy "asset-photos: logueados suben"
on storage.objects for insert
with check (bucket_id = 'asset-photos' and auth.uid() is not null);

create policy "asset-photos: logueados actualizan"
on storage.objects for update
using (bucket_id = 'asset-photos' and auth.uid() is not null)
with check (bucket_id = 'asset-photos' and auth.uid() is not null);
