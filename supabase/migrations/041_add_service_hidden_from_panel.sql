-- ============================================================
-- Facu (19 jul 2026): "una cosa es lo que el mecánico hace en su panel...
-- eso sí debería poder hacer, borrar lo que él quiera porque es su panel.
-- pero nunca se borra de la máquina." Con el ejemplo del asset: un
-- mecánico crea un asset, le carga un service, y después decide sacar ese
-- service de sus registros y sacar el asset de su panel — pero ni el
-- asset ni el service se borran jamás de MaintlyQR. Si alguien escanea
-- ese QR después, tiene que poder ver todo lo que se cargó ahí.
--
-- Para `assets` esto YA existe: la tabla `mechanic_assets` (migración de
-- asset sharing) es el "panel" de cada mecánico — "sacar un asset del
-- panel" borra la fila de `mechanic_assets`, nunca la de `assets`. Ver
-- handleRemoveFromWorkshop en dashboard/assets/page.tsx.
--
-- `service_records` no tiene ese mismo patrón many-to-many (cada fila ya
-- pertenece a un solo mechanic_id — el que cargó el service), así que acá
-- alcanza con una columna nueva en vez de una tabla intermedia:
-- `hidden_from_panel_at`. Deliberadamente NO es lo mismo que `deleted_at`
-- (que la migración 040 dejó bloqueado para mecánicos — reservado a
-- Super Admin): esta columna solo controla si el service aparece en el
-- "Mis Servicios" del mecánico que lo cargó. No la lee ni la respeta
-- ninguna otra vista (ni la página pública del QR, ni el historial del
-- asset que puede ver otro mecánico) — para todos los demás, el service
-- sigue estando ahí siempre, exactamente como antes.
-- ============================================================

alter table public.service_records add column if not exists hidden_from_panel_at timestamptz;

create index if not exists service_records_hidden_from_panel_at_idx on public.service_records (hidden_from_panel_at);

-- Nota: no hace falta tocar la policy de UPDATE de la migración 040
-- ("service_records: logueados actualizan sin borrar") — su `with check`
-- solo exige que `deleted_at` quede en null, así que ya permite que
-- cualquier mecánico logueado actualice esta columna nueva sin abrir de
-- nuevo la puerta al borrado real.
