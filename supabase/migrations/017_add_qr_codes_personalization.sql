-- QR Codes feature: lets a mechanic see their own QR codes (assigned and
-- blank/unassigned), request new blank ones to print, and personalize each
-- one with a color/shape "theme" (see src/lib/qrThemes.ts). Purely additive
-- — no existing column is changed, nothing here can affect the public
-- asset-lookup path (src/app/asset/[code]/page.tsx) other than adding the
-- two new nullable/defaulted columns below.

alter table qr_codes add column if not exists theme text not null default 'classic';
alter table qr_codes add column if not exists label text;

-- Speeds up "give me all the codes this mechanic created" (the new
-- /api/qr-codes route, and the mechanic-scoped part of the "my codes" query
-- there also checks mechanic_assets for codes tied to shared/linked assets).
create index if not exists qr_codes_created_by_idx on qr_codes (created_by);
