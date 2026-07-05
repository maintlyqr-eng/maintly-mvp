-- Document Library: lets a mechanic attach real files (invoices, manuals,
-- certificates, extra photos, warranty PDFs) to an asset, a service, or a
-- customer — or leave it unlinked ("General"). Unlike asset photos, these
-- are private by design: only the owning mechanic can ever read them, and
-- they never appear on the public QR page. That's a deliberate product
-- decision (confirmed with Facu) since documents like invoices carry
-- prices and customer details that shouldn't be public by default.
--
-- IMPORTANT — do this BEFORE running this migration:
-- create a new Storage bucket named exactly "documents" in the Supabase
-- dashboard (Storage → New bucket), and leave "Public bucket" UNCHECKED.
-- The policies below assume the bucket already exists but is not public.

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  mechanic_id uuid not null references mechanics(id) on delete cascade,
  asset_id uuid references assets(id) on delete set null,
  service_record_id uuid references service_records(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size bigint,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists documents_mechanic_idx on documents (mechanic_id);
create index if not exists documents_asset_idx on documents (asset_id);
create index if not exists documents_customer_idx on documents (customer_id);

alter table documents enable row level security;

drop policy if exists "documents: el mecanico administra los suyos" on documents;
create policy "documents: el mecanico administra los suyos"
on documents for all
using (auth.uid() = mechanic_id)
with check (auth.uid() = mechanic_id);

-- Storage RLS for the "documents" bucket: every file is uploaded under a
-- path prefixed with the owning mechanic's UID (e.g.
-- "<mechanic_id>/<random>.pdf"), and these policies only allow a mechanic
-- to insert/read/delete objects under their own prefix. There is no
-- public-read policy here — that's what keeps these private, unlike the
-- "asset-photos" bucket which is intentionally public.
drop policy if exists "documents: el mecanico sube los suyos" on storage.objects;
create policy "documents: el mecanico sube los suyos"
on storage.objects for insert
with check (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "documents: el mecanico lee los suyos" on storage.objects;
create policy "documents: el mecanico lee los suyos"
on storage.objects for select
using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "documents: el mecanico borra los suyos" on storage.objects;
create policy "documents: el mecanico borra los suyos"
on storage.objects for delete
using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
