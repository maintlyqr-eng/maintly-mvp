-- Facu, 21/10/2026: rol "Marketing" (Social Media y Marketing: ve
-- estadísticas para armar contenido, nada de datos personales de
-- clientes) y chat interno del equipo con adjuntos.

-- 1) Rol marketing en el check de admin_users (el constraint se creó
--    inline en la 035, Postgres le puso nombre admin_users_role_check).
alter table public.admin_users drop constraint if exists admin_users_role_check;
alter table public.admin_users
  add constraint admin_users_role_check
  check (role in ('super_admin', 'support_admin', 'content_moderator', 'analytics_viewer', 'marketing'));

-- 2) Chat interno entre personas del equipo. Se identifica por username
--    (texto) y no por id porque el Super Admin fundador entra por la vía
--    legada (env vars) y no tiene fila en admin_users.
create table if not exists public.admin_chat_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  from_username text not null,
  to_username text not null,
  body text not null default '' check (char_length(body) <= 4000),
  attachment_path text,      -- ruta en el bucket admin-chat
  attachment_name text,
  attachment_type text,      -- mime
  attachment_size integer,
  read_at timestamptz,
  constraint admin_chat_has_content check (body <> '' or attachment_path is not null)
);

create index if not exists admin_chat_pair_idx on public.admin_chat_messages (least(from_username, to_username), greatest(from_username, to_username), created_at desc);
create index if not exists admin_chat_unread_idx on public.admin_chat_messages (to_username) where read_at is null;

alter table public.admin_chat_messages enable row level security;
-- Sin policies a propósito: solo service_role desde /api/admin/chat.

-- 3) Bucket privado para los adjuntos (fotos, PDFs). Solo service_role.
insert into storage.buckets (id, name, public, file_size_limit)
values ('admin-chat', 'admin-chat', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;
