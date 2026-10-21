-- Dónde pesa Maintly (Facu, 21/10/2026: "me gustaría saber desde dónde se
-- conecta la gente o desde dónde se registran los activos o usuarios").
-- País / región / ciudad aproximados por IP (los pone Vercel en cada
-- pedido; sin GPS ni permiso del usuario). Se guardan al registrarse, al
-- crear un activo, en cada escaneo de QR, y la última entrada al dashboard.

alter table public.mechanics
  add column if not exists signup_country text,
  add column if not exists signup_region text,
  add column if not exists signup_city text,
  add column if not exists last_seen_country text,
  add column if not exists last_seen_region text,
  add column if not exists last_seen_city text,
  add column if not exists last_seen_at timestamptz;

alter table public.assets
  add column if not exists created_country text,
  add column if not exists created_region text,
  add column if not exists created_city text;

alter table public.qr_scans
  add column if not exists country text,
  add column if not exists region text,
  add column if not exists city text;

create index if not exists mechanics_signup_country_idx on public.mechanics (signup_country);
create index if not exists assets_created_country_idx on public.assets (created_country);
create index if not exists qr_scans_country_idx on public.qr_scans (country);
