-- ============================================================
-- Logs de auditoría del panel de Admin (Control Center).
--
-- Primer paso de la plataforma de administración ampliada que pidió Facu
-- (ver claude/MAINTLYQR_FEATURE_BACKLOG.md, sección "Plataforma de
-- Administración y Gestión" — item 11, Logs y auditoría). Se hace primero
-- porque es la base para lo que viene después (soft delete, roles): sin
-- poder registrar "quién hizo qué y cuándo", ninguna de esas otras piezas
-- tiene forma de rendir cuentas.
--
-- Quién puede escribir/leer: SOLO el service role key (getSupabaseAdmin()
-- en src/lib/supabaseAdmin.ts), que ya es el único cliente que toca datos
-- de administración en este proyecto y que además ya verifica
-- isAdminRequest() antes de cada llamada. Por eso esta tabla tiene RLS
-- activado pero CERO policies: nadie autenticado como Maintler (ni siquiera
-- vía auth.uid()) puede leer o escribir acá directamente — el service role
-- bypassea RLS por completo, que es como debe ser para un log de auditoría
-- (si un Maintler pudiera editarlo, dejaría de servir como auditoría).
--
-- admin_username: por ahora hay un solo admin (usuario/contraseña en
-- variables de entorno, ver /api/admin/login), pero se guarda el username
-- igual — así el log ya queda listo para cuando se agregue el sistema de
-- roles (Super Admin / Support Admin / etc., item 12 del pedido de Facu)
-- sin tener que migrar datos históricos.
--
-- old_value / new_value en jsonb en vez de columnas separadas por campo:
-- cada tipo de acción cambia campos distintos (suspender toca `suspended`,
-- editar nombre toca `name`, etc.) — jsonb evita una tabla con decenas de
-- columnas nullable, la mayoría vacías en cualquier fila dada.
-- ============================================================

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  admin_username text not null,
  action text not null,
  entity_type text,
  entity_id text,
  old_value jsonb,
  new_value jsonb,
  reason text,
  ip_address text
);

create index if not exists admin_audit_logs_created_at_idx on public.admin_audit_logs (created_at desc);
create index if not exists admin_audit_logs_action_idx on public.admin_audit_logs (action);
create index if not exists admin_audit_logs_entity_idx on public.admin_audit_logs (entity_type, entity_id);
create index if not exists admin_audit_logs_admin_username_idx on public.admin_audit_logs (admin_username);

alter table public.admin_audit_logs enable row level security;
-- Deliberately no policies — see the comment block above. Only the
-- service-role client (which bypasses RLS) can read or write this table.
