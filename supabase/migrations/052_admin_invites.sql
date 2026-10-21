-- Invitaciones de admin por link (Facu, 21/10/2026): "al crear roles quiero
-- poder enviarle a la persona un link para que pueda entrar en su rol".
--
-- Flujo: el Super Admin crea el admin SIN contraseña → la plataforma genera
-- un token de un solo uso (se guarda solo su hash SHA-256, el token en
-- claro va en el link) con vencimiento a 7 días → la persona abre
-- /admin/invite?t=<token>, elige su contraseña y entra con su rol.
-- Mientras la invitación está pendiente, password_hash es null y el login
-- la ignora (src/app/api/admin/login/route.ts).

alter table public.admin_users
  alter column password_hash drop not null,
  add column if not exists invite_token_hash text,
  add column if not exists invite_expires_at timestamptz,
  add column if not exists invite_accepted_at timestamptz;

create unique index if not exists admin_users_invite_token_hash_idx
  on public.admin_users (invite_token_hash)
  where invite_token_hash is not null;

comment on column public.admin_users.invite_token_hash is 'SHA-256 del token del link de invitación; null cuando no hay invitación pendiente.';
comment on column public.admin_users.invite_expires_at is 'Vencimiento del link de invitación (7 días).';
comment on column public.admin_users.invite_accepted_at is 'Cuándo la persona eligió su contraseña por el link.';
