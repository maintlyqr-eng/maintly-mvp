-- ============================================================
-- Migración retroactiva (incremento 15 de Item 6, 15 jul 2026).
--
-- Las columnas `profession`, `certificate_path`, `verification_status`,
-- `verification_requested_at`, `verification_reviewed_at` y
-- `verification_note` de `mechanics` ya existen y están en uso en
-- producción desde hace tiempo (alimentan `/register/profession`, el
-- formulario de verificación de profesión del Dashboard, y la pestaña
-- "Verificaciones pendientes" del panel Admin) — pero se agregaron en
-- algún momento directo desde el SQL Editor de Supabase, sin que
-- quedara un archivo de migración correspondiente en este repo. Esta
-- migración documenta retroactivamente ese estado ya existente, no
-- introduce ningún cambio de comportamiento nuevo.
--
-- Es 100% segura de correr aunque las columnas ya existan: todo usa
-- `if not exists`, así que si ya están en tu base, este archivo no hace
-- nada. Sirve para que el historial de migraciones del repo quede
-- completo y coincida con lo que realmente hay en producción — algo que
-- va a importar el día que alguien audite el proyecto a fondo (ej. una
-- due diligence técnica de cara a una venta).
-- ============================================================

alter table public.mechanics
  add column if not exists profession text,
  add column if not exists certificate_path text,
  add column if not exists verification_status text,
  add column if not exists verification_requested_at timestamptz,
  add column if not exists verification_reviewed_at timestamptz,
  add column if not exists verification_note text;

-- Índices para los dos campos que ya se usan para filtrar/agrupar desde
-- el panel Admin (pestaña "Por profesión" y "Verificaciones pendientes"
-- de Maintlers, agregadas en el incremento 15) y desde Analytics (el
-- desglose de Maintlers por profesión, mismo incremento).
create index if not exists mechanics_profession_idx on public.mechanics (profession);
create index if not exists mechanics_verification_status_idx on public.mechanics (verification_status);

-- Nota deliberada: NO se agrega un `check` constraint sobre los valores
-- permitidos de `profession` (los 7 valores de `MAINTLER_ROLES` en
-- ProfessionVerificationForm.tsx) ni de `verification_status` (los 4
-- valores de `VERIFICATION_STATUSES` en accounts/route.ts). Esa
-- validación hoy vive solo en la app — agregar un `check` acá sin poder
-- confirmar primero que ninguna fila existente en producción tiene un
-- valor fuera de esa lista podría hacer fallar esta migración. Si en el
-- futuro se quiere blindar esto también a nivel de base de datos, hay
-- que auditar los valores reales en producción primero.

-- ============================================================
-- Segundo hallazgo del mismo incremento: el bucket de Storage
-- "certificates" (donde `certificate_path` apunta) tampoco tiene
-- ninguna migración en este repo — a diferencia de "documents"
-- (migración 015) y "asset-photos" (migraciones 004/028), que sí están
-- documentados acá. Se asume que el bucket ya existe en producción
-- (si no existiera, la subida de certificados en
-- ProfessionVerificationForm.tsx ya estaría fallando). Este bloque solo
-- documenta/asegura las RLS policies de ese bucket, con el mismo
-- criterio de "privado, prefijo de carpeta = dueño" que ya usa
-- "documents" — nunca público, porque un certificado es un documento
-- personal del Maintler, no algo pensado para la página pública del QR.
--
-- IMPORTANTE — si el bucket "certificates" NO existe todavía en tu
-- proyecto de Supabase, creá uno nuevo (Storage → New bucket) con ese
-- nombre exacto y dejá "Public bucket" DESMARCADO antes de correr este
-- bloque. Si ya existe (lo más probable, dado que la app ya lo usa),
-- no hace falta hacer nada más — las policies de abajo son
-- `drop policy if exists` + `create policy`, así que es seguro
-- volver a correrlas.
-- ============================================================

drop policy if exists "certificates: el mecanico sube el suyo" on storage.objects;
create policy "certificates: el mecanico sube el suyo"
on storage.objects for insert
with check (bucket_id = 'certificates' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "certificates: el mecanico lee el suyo" on storage.objects;
create policy "certificates: el mecanico lee el suyo"
on storage.objects for select
using (bucket_id = 'certificates' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "certificates: el mecanico borra el suyo" on storage.objects;
create policy "certificates: el mecanico borra el suyo"
on storage.objects for delete
using (bucket_id = 'certificates' and auth.uid()::text = (storage.foldername(name))[1]);

-- Nota: el panel Admin lee certificados con el service-role client
-- (`/api/admin/certificate-url`, `createSignedUrl`), que ignora RLS por
-- diseño de Supabase — estas policies no afectan esa ruta, solo
-- gobiernan el acceso directo de un mecánico con su propia sesión.
