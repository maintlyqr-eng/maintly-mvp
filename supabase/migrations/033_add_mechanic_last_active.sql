-- ============================================================
-- "Último acceso" (item 2 del pedido de admin de Facu, columna que la
-- spec pide mostrar en Gestión de Maintlers pero que nunca se había
-- construido) + la base de datos para "Analytics avanzados" (item 8):
-- usuarios activos diarios/semanales/mensuales, Maintlers que regresan, y
-- Maintlers sin actividad son todos derivables de esta única columna.
-- ============================================================

alter table public.mechanics
  add column if not exists last_active_at timestamptz;

-- Backfill: sin esto, todas las cuentas existentes arrancarían en null y
-- se verían como "sin actividad nunca" el día que se prenda esta métrica,
-- lo cual sería engañoso para cuentas que sí vienen usando la app desde
-- antes de esta migración. `created_at` es la mejor aproximación
-- disponible retroactivamente (no hay ningún registro de logins pasados
-- para usar en su lugar) — a partir de acá, cada visita real al Dashboard
-- actualiza el valor real (ver DashboardSidebarIntl.tsx).
update public.mechanics
  set last_active_at = created_at
  where last_active_at is null;

create index if not exists mechanics_last_active_idx on public.mechanics (last_active_at);
