-- Espacio de trabajo de Marketing (Facu, 21/10/2026: "hay que armarle un
-- dashboard en el que ella pueda trabajar y ser productiva para Maintly").
-- Lo ven el rol marketing y el Super Admin (capacidad "marketing").
-- Solo service_role desde /api/admin/marketing/*.

-- 1) Bóveda de cuentas de redes sociales. La contraseña se guarda cifrada
--    en la app (AES-256-GCM con ADMIN_VAULT_KEY, src/lib/vault.ts): la
--    base nunca ve texto plano.
create table if not exists public.marketing_accounts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  platform text not null,            -- instagram, facebook, tiktok, linkedin, x, youtube, google, other
  label text not null,               -- "Instagram @maintlyqr"
  username text,
  password_enc text,                 -- cifrado, nunca en claro
  recovery_email text,
  two_factor text,                   -- cómo se hace el 2FA (celu de Facu, app, etc.)
  url text,
  notes text,
  created_by text,
  updated_by text
);

-- 2) Contactos / leads de marketing (mini CRM).
create table if not exists public.marketing_contacts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  company text,
  source text,                       -- instagram, facebook, linkedin, whatsapp, web, email, event, other
  handle text,                       -- @usuario / teléfono / email de contacto
  status text not null default 'new' check (status in ('new','contacted','interested','customer','discarded')),
  next_action text,
  next_action_at date,
  notes text,
  created_by text,
  updated_by text
);
create index if not exists marketing_contacts_status_idx on public.marketing_contacts (status, next_action_at);

-- 3) Consultas y feedback que llegan por redes / mensajes.
create table if not exists public.marketing_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text,                       -- instagram, facebook, tiktok, whatsapp, email, other
  author text,                       -- quién lo dijo (handle / nombre)
  kind text not null default 'question' check (kind in ('question','praise','complaint','idea')),
  body text not null check (char_length(body) between 1 and 4000),
  status text not null default 'pending' check (status in ('pending','answered','escalated')),
  answer text,
  created_by text,
  updated_by text
);
create index if not exists marketing_feedback_status_idx on public.marketing_feedback (status, created_at desc);

alter table public.marketing_accounts enable row level security;
alter table public.marketing_contacts enable row level security;
alter table public.marketing_feedback enable row level security;
-- Sin policies a propósito: solo service_role.
