-- ============================================================
-- Soft delete + restauración — segundo incremento de la plataforma de
-- administración ampliada que pidió Facu (ver claude/MAINTLYQR_FEATURE_
-- BACKLOG.md, sección "Plataforma de Administración y Gestión", item 14 —
-- "Eliminación y restauración"). Sigue a los Logs de Auditoría (migración
-- 030), que ya dejaron la base para poder registrar quién restauró/eliminó
-- qué.
--
-- Qué agrega: una columna `deleted_at` en las tres tablas donde el admin
-- puede eliminar contenido (Maintlers, assets, registros de servicio).
-- `deleted_at is null` = fila activa (comportamiento actual, sin cambios).
-- `deleted_at` con timestamp = fila "en la papelera": sigue existiendo en
-- la base para poder restaurarla, pero el resto de la app la trata como si
-- no existiera (páginas públicas del asset, login, y el propio panel de
-- admin fuera de la sección Papelera).
--
-- Por qué una columna y no simplemente borrar la fila: eliminar de verdad
-- (`DELETE FROM ...`) es irreversible. El pedido de Facu es explícito en
-- esto (item 14: "soft delete para Maintlers/assets/registros restaurables;
-- eliminación permanente limitada a Super Admin + confirmación especial") —
-- la eliminación real sigue existiendo como acción aparte, pero solo
-- alcanzable después de que la fila ya esté en la papelera.
--
-- Nota sobre RLS: esta migración NO toca las policies de RLS existentes en
-- `mechanics`, `assets` ni `service_records` (no fueron creadas por una
-- migración de este repo, así que no tenemos el texto exacto acá para
-- editarlas con seguridad — ver el comentario en el Item 6 del backlog).
-- Esto significa que el filtro de "no mostrar filas en la papelera" se
-- aplica del lado de la app (en cada query), no a nivel de base de datos.
-- Documentado como limitación conocida, no como bug.
-- ============================================================

alter table public.mechanics add column if not exists deleted_at timestamptz;
alter table public.assets add column if not exists deleted_at timestamptz;
alter table public.service_records add column if not exists deleted_at timestamptz;

create index if not exists mechanics_deleted_at_idx on public.mechanics (deleted_at);
create index if not exists assets_deleted_at_idx on public.assets (deleted_at);
create index if not exists service_records_deleted_at_idx on public.service_records (deleted_at);
