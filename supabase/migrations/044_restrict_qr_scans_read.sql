-- ============================================================
-- Facu (26 jul 2026, revisión de seguridad, continuación de la 043):
-- confirmó que /admin usa un usuario y contraseña TOTALMENTE aparte de
-- una cuenta de mecánico — no es una sesión "authenticated" real de
-- Supabase (ver src/lib/adminAuth.ts, token propio firmado con HMAC).
-- Eso deja dos cosas claras:
--
--   1. La policy "anyone can read scan counts" de qr_scans (migración
--      006) es pública de verdad: cualquiera con la clave anon (pública
--      en el bundle del sitio) puede leer CADA escaneo de CADA QR de la
--      plataforma sin loguearse. El código tenía un comentario
--      (ahora corregido en admin/page.tsx) que asumía que esta RLS ya
--      era "angosta" -- no lo era.
--   2. El panel de admin, al no tener una sesión de Supabase real, NO
--      puede depender de una policy scoped a "authenticated" para seguir
--      leyendo esta tabla desde el navegador -- por eso primero se movió
--      esa lectura a /api/admin/qr-scan-stats (clave de service-role,
--      ignora RLS por completo, ver ese archivo).
--
-- Con esa lectura ya migrada, esta migración puede angostar la policy sin
-- romper nada: de "cualquiera, sin login" pasa a "cualquier mecánico
-- logueado" -- todavía no separa por dueño del asset (un mecánico
-- logueado puede en teoría leer los escaneos de OTRO mecánico armando un
-- pedido a mano contra la REST API), pero cierra el agujero principal
-- (acceso totalmente anónimo). Angostar más, por dueño de asset, queda
-- como posible ronda futura si hace falta -- separado a propósito de
-- esta migración para no combinar dos cambios de riesgo distinto.
--
-- El insert sigue público (using/with check true) sin cambios: un
-- escaneo tiene que poder registrarse aunque quien escanea el sticker
-- físico no tenga cuenta ni haya iniciado sesión — ese es el punto del
-- flujo "MaintlyQR World".
-- ============================================================

drop policy if exists "anyone can read scan counts" on qr_scans;

create policy "authenticated mechanics can read scan counts"
  on qr_scans for select
  to authenticated
  using (true);
