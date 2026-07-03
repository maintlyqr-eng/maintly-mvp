-- ============================================================
-- MAINTLY — Esquema de base de datos (limpio, desde cero)
-- ============================================================

-- Limpiar tablas viejas (datos de prueba)
drop table if exists public.service_records cascade;
drop table if exists public.qr_codes cascade;
drop table if exists public.assets cascade;
drop table if exists public.mechanics cascade;
drop table if exists public.users cascade;

-- ============================================================
-- MECHANICS: perfil de cada "Mecánico Maintly", 1:1 con auth.users
-- La contraseña NUNCA se guarda acá: la maneja Supabase Auth (encriptada).
-- ============================================================
create table public.mechanics (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  workshop_name text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ASSETS: activos físicos (autos, motos, generadores, etc.)
-- ============================================================
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.mechanics(id) on delete set null,
  asset_type text not null,        -- 'automotive' | 'motorcycle' | 'generator' | 'machinery' | 'marine' | 'aviation'
  brand text,
  model text,
  nickname text,
  vin_serial text,
  year int,
  plate text,
  fuel_type text,
  location text,
  photo_url text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- QR_CODES: cada QR físico/digital. asset_id null = QR vacío sin asignar.
-- ============================================================
create table public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,        -- ej: MTLY-AB12-CD34
  asset_id uuid references public.assets(id) on delete set null,
  created_by uuid references public.mechanics(id) on delete set null,
  first_scan_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SERVICE_RECORDS: historial de mantenimiento de cada activo
-- ============================================================
create table public.service_records (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  mechanic_id uuid references public.mechanics(id) on delete set null,
  service_date date not null default current_date,
  service_type text not null,       -- 'Service' | 'Repair' | 'Inspection' | etc.
  km_hours numeric,
  notes text,
  tags text[],
  photo_url text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Trigger: al registrarse un usuario nuevo en auth.users,
-- crear automáticamente su perfil en mechanics.
-- ============================================================
create or replace function public.handle_new_mechanic()
returns trigger as $$
begin
  insert into public.mechanics (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_mechanic();

-- ============================================================
-- RLS (Row Level Security)
-- Filosofía: el historial de un activo es PÚBLICO (se ve sin login).
-- Solo mecánicos logueados pueden crear/editar.
-- ============================================================
alter table public.mechanics enable row level security;
alter table public.assets enable row level security;
alter table public.qr_codes enable row level security;
alter table public.service_records enable row level security;

-- mechanics: cualquiera puede ver datos básicos (ej. "Diego Ramírez - TecniMotor"
-- en el historial público), pero solo el propio mecánico edita su perfil.
create policy "mechanics: lectura pública" on public.mechanics
  for select using (true);
create policy "mechanics: solo el dueño actualiza su perfil" on public.mechanics
  for update using (auth.uid() = id);

-- assets: lectura pública total. Inserción/edición solo logueados.
create policy "assets: lectura pública" on public.assets
  for select using (true);
create policy "assets: solo logueados crean" on public.assets
  for insert with check (auth.uid() is not null);
create policy "assets: solo logueados actualizan" on public.assets
  for update using (auth.uid() is not null);

-- qr_codes: lectura pública (para poder resolver el código al escanear).
-- Inserción/asignación solo logueados.
create policy "qr_codes: lectura pública" on public.qr_codes
  for select using (true);
create policy "qr_codes: solo logueados crean" on public.qr_codes
  for insert with check (auth.uid() is not null);
create policy "qr_codes: solo logueados actualizan" on public.qr_codes
  for update using (auth.uid() is not null);

-- service_records: lectura pública (historial visible para cualquiera).
-- Inserción solo logueados.
create policy "service_records: lectura pública" on public.service_records
  for select using (true);
create policy "service_records: solo logueados crean" on public.service_records
  for insert with check (auth.uid() is not null);

-- ============================================================
-- MECHANIC_ASSETS: activos que un mecánico tiene en su taller
-- (relación M:N entre mechanics y assets)
-- ============================================================
create table if not exists public.mechanic_assets (
  id          uuid primary key default gen_random_uuid(),
  mechanic_id uuid not null references public.mechanics(id) on delete cascade,
  asset_id    uuid not null references public.assets(id) on delete cascade,
  qr_code     text,
  added_at    timestamptz not null default now(),
  unique (mechanic_id, asset_id)
);

alter table public.mechanic_assets enable row level security;

-- Solo el mecánico dueño puede ver sus activos de taller
create policy "mechanic_assets: solo el dueño ve sus activos" on public.mechanic_assets
  for select using (auth.uid() = mechanic_id);

-- Solo el mecánico logueado puede agregar activos a su taller
create policy "mechanic_assets: solo logueados insertan" on public.mechanic_assets
  for insert with check (auth.uid() = mechanic_id);

-- Solo el mecánico dueño puede quitar activos de su taller
create policy "mechanic_assets: solo el dueño elimina" on public.mechanic_assets
  for delete using (auth.uid() = mechanic_id);
