-- Support for the redesigned Admin panel:
--
-- 1. mechanics.suspended — lets the admin temporarily lock an account out of
--    the app without deleting it. Enforced at login (src/app/login/page.tsx).
--
-- 2. qr_scans — a lightweight log of every time a QR code's public page is
--    opened. Powers "Scans Today" on the admin Dashboard and, later, "Most
--    Scanned QR" style insights. Anyone can insert (a scan can happen before
--    login, from a QR sticker in the wild) and anyone can read counts, same
--    permissive philosophy as the rest of this schema.

alter table mechanics add column if not exists suspended boolean not null default false;

create table if not exists qr_scans (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  asset_id uuid references assets(id) on delete set null,
  scanned_at timestamptz not null default now()
);

create index if not exists qr_scans_scanned_at_idx on qr_scans (scanned_at);
create index if not exists qr_scans_code_idx on qr_scans (code);

alter table qr_scans enable row level security;

drop policy if exists "anyone can log a scan" on qr_scans;
create policy "anyone can log a scan" on qr_scans for insert with check (true);

drop policy if exists "anyone can read scan counts" on qr_scans;
create policy "anyone can read scan counts" on qr_scans for select using (true);
