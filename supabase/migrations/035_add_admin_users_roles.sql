-- ============================================================
-- Roles y permisos del panel Admin (incremento 11, 14 jul 2026 — item 12
-- del pedido original de Facu, ver claude/MAINTLYQR_FEATURE_BACKLOG.md:
-- "Super Admin: acceso completo; Support Admin: usuarios/mensajes/reportes/
-- soporte sin config crítica; Content Moderator: assets/registros/
-- reportes; Analytics Viewer: solo estadísticas/reportes").
--
-- Hasta ahora el panel admin era un solo usuario/contraseña hardcodeado en
-- variables de entorno (ADMIN_USERNAME/ADMIN_PASSWORD, ver
-- src/app/api/admin/login/route.ts) — esta tabla es la base para poder
-- tener varios admins, cada uno con su propio login y un rol que limita lo
-- que puede ver/tocar (ver src/lib/adminRoles.ts para el mapeo rol →
-- capacidades).
--
-- Facu pidió esto explícitamente como "dejar la base lista" — hoy sigue
-- siendo el único que entra al panel (con el usuario/contraseña de las
-- variables de entorno, que el login sigue aceptando como fallback — ver
-- comentario en route.ts) y todavía no hay ningún admin creado en esta
-- tabla. El primer uso real es desde la sección "Administradores" del
-- panel (solo visible para Super Admin), que crea filas acá.
--
-- password_hash: scrypt vía el módulo nativo `crypto` de Node (ver
-- src/lib/adminPassword.ts) — no bcrypt/argon2, para no sumar una
-- dependencia nueva solo para esto. El hasheo pasa siempre por la app
-- (nunca en SQL), así que esta tabla nunca ve una contraseña en texto
-- plano, ni siquiera durante la migración: arranca vacía.
--
-- Mismo patrón de RLS que admin_audit_logs (migración 030) y
-- support_thread_state (migración 034): activado, sin ninguna policy —
-- solo el service role (getSupabaseAdmin(), que ya exige isAdminRequest()
-- antes de cada llamada) puede leer o escribir. Si un Maintler pudiera
-- leer esta tabla, expondría qué otros admins existen y su rol.
-- ============================================================

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  username text not null,
  password_hash text not null,
  role text not null check (role in ('super_admin', 'support_admin', 'content_moderator', 'analytics_viewer')),

  -- Desactivar en vez de borrar (mismo criterio de soft-delete que el
  -- resto de la plataforma, migración 031) — así un admin desactivado no
  -- rompe el historial de admin_audit_logs, que referencia el username en
  -- texto libre y no una foreign key.
  active boolean not null default true,

  created_by text, -- username del Super Admin que lo creó, para auditoría
  last_login_at timestamptz,

  constraint admin_users_username_not_blank check (length(trim(username)) > 0)
);

-- Único username entre los admins ACTIVOS solamente (no un unique
-- constraint global): permite reactivar el mismo username más adelante
-- sin chocar con una fila desactivada vieja, mismo espíritu que el resto
-- de la plataforma nunca reutiliza un email de una cuenta borrada por acá
-- — pero acá sí puede pasar (ej. alguien deja el equipo y vuelve).
create unique index if not exists admin_users_username_active_idx
  on public.admin_users (lower(username))
  where active;

create index if not exists admin_users_role_idx on public.admin_users (role);

alter table public.admin_users enable row level security;
-- Deliberadamente sin policies — ver el comment block de arriba. Solo el
-- service-role client puede leer o escribir esta tabla.
