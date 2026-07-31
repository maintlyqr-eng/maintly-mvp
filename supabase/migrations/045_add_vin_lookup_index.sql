-- ============================================================
-- Facu (Incremento 29, escaneo de VIN): "no importa q alguien le saque el
-- qr al auto, total cuando alguien escanea el vin se va a dar cuenta q ya
-- tiene historial de mantenimiento maintlyqr, q es justamente la idea".
--
-- Para que "buscar un equipo por VIN" (en vez de por código QR) sea rápido
-- y para el chequeo de duplicados al crear un equipo nuevo ("este VIN ya
-- existe, ¿querés ir a su historial?"), esto agrega un índice sobre
-- lower(vin_serial) -- las búsquedas se hacen case-insensitive (ilike sin
-- comodines) porque un VIN escaneado con OCR o tipeado a mano puede venir
-- en mayúsculas/minúsculas mezcladas.
--
-- Parcial (where vin_serial is not null and deleted_at is null) a
-- propósito: la enorme mayoría de las filas de assets NO son vehículos
-- (generadores, maquinaria, embarcaciones, aviación) y no van a tener VIN
-- nunca -- indexar esas filas sería puro desperdicio de espacio. Mismo
-- criterio que ya usa content_reports_status_idx (migración 032) de tener
-- índices angostos y a medida en vez de uno genérico sobre toda la tabla.
-- ============================================================

create index if not exists assets_vin_serial_lower_idx
  on public.assets (lower(vin_serial))
  where vin_serial is not null and deleted_at is null;
