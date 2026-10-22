-- Departamento de Marketing (Facu, 22/10/2026). Especificación completa en
-- claude/MAINTLYQR_MARKETING_DEPARTAMENTO_SPEC.md (proyecto). Etapa 1:
-- departamento + permisos por persona, cuentas con responsable/autorizados/
-- conexión/recuperación, campañas, tareas, comentarios, publicaciones con
-- circuito de aprobación y resultado por red, medios, biblioteca de marca
-- con versiones, transferencia del departamento. Todo solo service_role
-- vía /api/admin/marketing/*; los permisos se verifican en el servidor.

-- 1) Miembros del departamento y sus permisos (el Super Admin tiene todo
--    implícito y no necesita fila). permissions: {stats, content, approve,
--    publish, connections, vault} → boolean.
create table if not exists public.department_members (
  id uuid primary key default gen_random_uuid(),
  department text not null default 'marketing',
  username text not null,
  title text,                                  -- cargo: "Social Media & Marketing Manager"
  is_lead boolean not null default false,      -- responsable del departamento
  permissions jsonb not null default '{}'::jsonb,
  granted_by text,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by text,
  unique (department, username)
);

-- 2) Ajustes del departamento (fila única).
create table if not exists public.marketing_settings (
  id int primary key default 1 check (id = 1),
  require_approval boolean not null default true,
  default_timezone text not null default 'Australia/Brisbane',
  monthly_goals text,
  updated_by text,
  updated_at timestamptz not null default now()
);
insert into public.marketing_settings (id) values (1) on conflict (id) do nothing;

-- 3) Cuentas: responsable, autorizados, correo empresarial, conexión,
--    recuperación y 2FA cifrados (solo permiso "vault").
alter table public.marketing_accounts
  add column if not exists owner_username text,
  add column if not exists authorized_usernames text[] not null default '{}',
  add column if not exists business_email text,
  add column if not exists connection_status text not null default 'none' check (connection_status in ('none','connected','needs_reconnect')),
  add column if not exists connection_note text,
  add column if not exists two_factor_enc text,
  add column if not exists recovery_enc text;
-- El 2FA que antes era texto plano pasa a cifrado en la app al próximo
-- guardado; mientras tanto se deja de exponer en la lista.

-- 4) Campañas.
create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  objective text,
  starts_on date,
  ends_on date,
  status text not null default 'active' check (status in ('active','closed')),
  budget_proposed numeric(12,2),
  budget_currency text not null default 'AUD',
  budget_approved_by text,
  budget_approved_at timestamptz,
  budget_note text,
  created_by text,
  updated_by text
);

-- 5) Tareas.
create table if not exists public.marketing_tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  description text,
  assignee_username text,
  due_on date,
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  status text not null default 'todo' check (status in ('todo','doing','done')),
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  post_id uuid,                                -- se enlaza abajo (FK diferida por orden de creación)
  created_by text,
  updated_by text,
  done_at timestamptz
);
create index if not exists marketing_tasks_status_idx on public.marketing_tasks (status, due_on);

-- 6) Publicaciones y destinos.
create table if not exists public.marketing_posts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  body text not null default '',
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  scheduled_at timestamptz,
  timezone text not null default 'Australia/Brisbane',
  status text not null default 'draft' check (status in ('draft','review','approved','scheduled','published','cancelled')),
  created_by text,
  updated_by text,
  submitted_at timestamptz,
  submitted_by text,
  approved_at timestamptz,
  approved_by text,
  approved_hash text,                          -- sha256 del contenido aprobado; si cambia → vuelve a review
  change_request_note text,
  change_requested_by text,
  cancelled_reason text,
  cancelled_by text
);
create index if not exists marketing_posts_sched_idx on public.marketing_posts (scheduled_at);
create index if not exists marketing_posts_status_idx on public.marketing_posts (status);

alter table public.marketing_tasks
  drop constraint if exists marketing_tasks_post_id_fkey,
  add constraint marketing_tasks_post_id_fkey foreign key (post_id) references public.marketing_posts(id) on delete set null;

create table if not exists public.marketing_post_targets (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.marketing_posts(id) on delete cascade,
  account_id uuid not null references public.marketing_accounts(id) on delete cascade,
  adapted_body text,                           -- texto adaptado a esa red (null = usa el del post)
  result_status text not null default 'pending' check (result_status in ('pending','published','failed','manual')),
  result_url text,
  result_error text,
  published_at timestamptz,
  published_by text,
  unique (post_id, account_id)
);

-- 7) Medios de publicaciones y campañas (bucket privado marketing-media).
create table if not exists public.marketing_media (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  post_id uuid references public.marketing_posts(id) on delete cascade,
  campaign_id uuid references public.marketing_campaigns(id) on delete cascade,
  storage_path text not null,
  name text not null,
  mime text,
  size integer,
  uploaded_by text
);

-- 8) Comentarios dentro de tareas, campañas y publicaciones.
create table if not exists public.marketing_comments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  entity_type text not null check (entity_type in ('task','campaign','post')),
  entity_id uuid not null,
  author_username text not null,
  body text not null check (char_length(body) between 1 and 4000)
);
create index if not exists marketing_comments_entity_idx on public.marketing_comments (entity_type, entity_id, created_at);

-- 9) Biblioteca de marca con versiones (bucket privado marketing-library;
--    colores/tipografías/textos van en value).
create table if not exists public.marketing_library (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  kind text not null check (kind in ('logo','color','font','photo','video','template','doc','text')),
  is_official boolean not null default false,
  version integer not null default 1,
  replaces_id uuid references public.marketing_library(id) on delete set null,
  is_current boolean not null default true,    -- false cuando una versión nueva la reemplaza
  storage_path text,
  mime text,
  size integer,
  value text,                                  -- "#E0242B", "Inter 800", texto aprobado…
  notes text,
  created_by text
);
create index if not exists marketing_library_kind_idx on public.marketing_library (kind, is_current);

-- 10) Transferencia del departamento.
create table if not exists public.marketing_handovers (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  started_by text not null,
  from_username text not null,
  to_username text,
  completed_at timestamptz,
  checklist jsonb not null default '[]'::jsonb -- [{key, label, done, done_by, done_at, note}]
);

-- 11) Buckets privados.
insert into storage.buckets (id, name, public, file_size_limit)
values ('marketing-media', 'marketing-media', false, 104857600),
       ('marketing-library', 'marketing-library', false, 104857600)
on conflict (id) do update set public = false, file_size_limit = 104857600;

alter table public.department_members enable row level security;
alter table public.marketing_settings enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.marketing_tasks enable row level security;
alter table public.marketing_posts enable row level security;
alter table public.marketing_post_targets enable row level security;
alter table public.marketing_media enable row level security;
alter table public.marketing_comments enable row level security;
alter table public.marketing_library enable row level security;
alter table public.marketing_handovers enable row level security;
-- Sin policies a propósito: solo service_role.
