-- ============================================================
-- Migración 049: constancia de envío del mail de bienvenida
--
-- Cierra el hallazgo del 21/09: /api/send-welcome-email era un endpoint
-- público sin auth ni rate limit -- cualquiera podía hacer que MaintlyQR
-- mandara un mail con su marca a cualquier dirección. Y de paso cierra
-- "los que entran con Google nunca reciben el mail".
--
-- Nueva regla del endpoint (ver route.ts): solo manda si en `mechanics`
-- existe una cuenta con ese email, creada hace menos de 15 minutos, que
-- todavía no recibió el mail. Y lo marca acá al mandarlo, así es una sola
-- vez por cuenta. Con eso no hace falta sesión (sirve para el alta con
-- confirmación por mail, que no la tiene) y no sirve para spam.
-- ============================================================

alter table public.mechanics add column if not exists welcome_email_sent_at timestamptz;
comment on column public.mechanics.welcome_email_sent_at is 'Cuándo se mandó el mail de bienvenida vía Resend (migración 049). Null = nunca.';
