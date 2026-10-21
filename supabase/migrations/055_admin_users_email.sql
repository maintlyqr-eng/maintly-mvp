-- Email del admin (Facu, 21/10/2026): para mandarle el mail de bienvenida
-- al equipo con el link de invitación y el rol. Opcional.
alter table public.admin_users add column if not exists email text;
