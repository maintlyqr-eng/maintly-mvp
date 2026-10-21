-- Mensajes internos entre admins (Facu, 21/10/2026): "dejarle mensajes" a
-- cada persona del equipo desde Administradores. Quien lo recibe los ve
-- arriba de todo al entrar al panel hasta que los marca como leídos; el
-- remitente ve si fueron leídos y cuándo.
--
-- Solo se accede con service_role desde /api/admin/* (sin policies de
-- RLS para usuarios normales: los admins no son usuarios de Supabase Auth).

create table if not exists public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  from_username text not null,                 -- quien escribe (username de admin)
  to_admin_id uuid not null references public.admin_users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  read_at timestamptz
);

create index if not exists admin_notes_to_admin_idx on public.admin_notes (to_admin_id, created_at desc);

alter table public.admin_notes enable row level security;
-- Sin policies a propósito: nadie salvo service_role puede leer o escribir.
