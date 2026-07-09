-- ============================================================
-- Maintler public card, round 6 — Facu shared a full desktop mockup of
-- the Settings page ("algo asi te muestro de ejemplo para la web"): a
-- wide LANDSCAPE card (photo + name + status + profession + location on
-- the left, the QR/gear on the right, all in one horizontal card) plus
-- a location line ("Emerald, QLD, Australia") that has no home anywhere
-- in the schema yet — explicitly called out as deferred back in round 2
-- ("location field (no such column exists yet on mechanics, would need
-- its own migration + Settings UI)"). This is that migration.
--
-- Optional, like every other profile-flavor field added so far (phone,
-- contact_email, socials in 026) — a Maintler can leave it blank and
-- nothing that reads mechanic_public_profile breaks.
-- ============================================================

alter table public.mechanics
  add column if not exists location text;

create or replace view public.mechanic_public_profile as
select
  id,
  name,
  verified,
  profession,
  workshop_name,
  photo_url,
  created_at,
  maintler_code,
  phone,
  contact_email,
  instagram_url,
  facebook_url,
  website_url,
  location
from public.mechanics;
