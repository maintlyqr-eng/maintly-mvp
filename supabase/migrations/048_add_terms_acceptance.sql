-- ============================================================
-- Migración 048: aceptación de Términos y Privacidad en el registro
--
-- Pendiente desde el diagnóstico del 21/09: "el registro no tiene checkbox
-- de aceptación de Términos y Privacidad. Hay 10 documentos legales
-- publicados y nadie los acepta al registrarse."
--
-- Qué agrega: dos columnas en mechanics para dejar constancia de CUÁNDO
-- aceptó cada Maintler y QUÉ versión de los documentos (hoy "2026-07-02",
-- la fecha de vigencia de Terms/Privacy). Si algún día cambian los
-- Términos, se sube la versión en src/lib/legal.ts y la app puede pedir
-- re-aceptación a quien tenga una versión vieja.
--
-- La escritura la hace el propio usuario desde el cliente (policy
-- existente "mechanics: solo el dueño actualiza su perfil"). Para el alta
-- con email+contraseña, además, la aceptación viaja en los metadatos de
-- auth.users (raw_user_meta_data.terms_accepted_at) como segundo registro
-- que no depende de la app.
-- ============================================================

alter table public.mechanics add column if not exists terms_accepted_at timestamptz;
alter table public.mechanics add column if not exists terms_version text;

comment on column public.mechanics.terms_accepted_at is 'Cuándo aceptó los Términos de Servicio y la Política de Privacidad (checkbox del registro, migración 048).';
comment on column public.mechanics.terms_version is 'Versión de los documentos aceptados (fecha de vigencia, ver src/lib/legal.ts).';
