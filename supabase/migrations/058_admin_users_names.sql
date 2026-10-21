-- Nombre, apellido y apodo separados (Facu, 21/10/2026: "decir nombre y
-- apellido queda raro"). Los mensajes de bienvenida usan apodo > nombre.
-- display_name (056) queda como dato viejo: se copia a first_name.
alter table public.admin_users
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists nickname text;
update public.admin_users set first_name = display_name where first_name is null and display_name is not null;
