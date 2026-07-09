-- ============================================================
-- Maintler public card, round 4 — Facu: "no veo datos de contacto."
-- Answered via AskUserQuestion: he wants email, phone/WhatsApp, and
-- social links visible on the public card, always shown (no per-field
-- privacy toggle) — simplest, matches how the rest of the public card
-- already works (everything on it is public by design).
--
-- Two things worth noting:
-- 1. contact_email is a NEW, separate column from the mechanic's login
--    email. The login email lives in Supabase Auth (auth.users), which
--    isn't safely exposable to anonymous visitors — a mechanic should
--    choose what to publish here, and it can differ from their account
--    email (e.g. a shop email vs. a personal one).
-- 2. instagram_url / facebook_url / website_url are stored as plain
--    optional links, not because "social media" needs three separate
--    concepts, but so each renders with its own label on the public
--    page without guessing which platform a single URL belongs to.
-- ============================================================

alter table public.mechanics
  add column if not exists phone text,
  add column if not exists contact_email text,
  add column if not exists instagram_url text,
  add column if not exists facebook_url text,
  add column if not exists website_url text;

-- Same pattern as migration 024's extension of this view: Postgres only
-- allows appending columns via create or replace view, not reordering
-- or removing existing ones.
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
  website_url
from public.mechanics;
