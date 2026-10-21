-- Sesiones de trabajo de los admins (Facu, 21/10/2026): "ver la actividad
-- en cada rol como para poder pagarle a la persona por su tiempo de
-- trabajo". El panel manda un latido cada 2 minutos mientras está abierto
-- (/api/admin/presence); una sesión es el tramo entre el primer latido y
-- el último. Si pasan más de 10 minutos sin latido, el siguiente abre una
-- sesión nueva. "Horas activas" = suma de (last_seen_at - started_at).
--
-- Solo service_role (los admins no son usuarios de Supabase Auth).

create table if not exists public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_username text not null,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ip_address text,
  user_agent text
);

create index if not exists admin_sessions_user_started_idx on public.admin_sessions (admin_username, started_at desc);

alter table public.admin_sessions enable row level security;
-- Sin policies a propósito: solo service_role.
