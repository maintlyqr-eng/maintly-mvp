-- ============================================================
-- Endurecimiento de seguridad, ronda 1 (Facu, 26 jul 2026: "deberiamos
-- arreglar todo" tras el repaso general del proyecto). Cubre 3 de los
-- puntos marcados como riesgo en MAINTLYQR_CODE_AUDIT_2026-07-09.md que
-- se pueden cerrar sin tocar ninguna funcionalidad existente ni pedirle
-- nada nuevo a ningún archivo de cliente. Los otros 2 puntos del audit
-- (la policy pública de "mechanics" más allá de email, y la lectura
-- pública de "qr_scans") quedan deliberadamente afuera de esta migración
-- — ver el mensaje en el chat del mismo día para el motivo.
-- ============================================================

-- 1) Las dos funciones SECURITY DEFINER que corren en triggers de
--    "mechanics" (el alta automática de la fila al registrarse, y el
--    mensaje de bienvenida) no tenían `search_path` fijado. Una función
--    SECURITY DEFINER corre con los privilegios de quien la CREÓ, pero
--    por default resuelve nombres de tabla/función según el search_path
--    de quien la LLAMA -- si alguien lograra que ese search_path
--    apuntara primero a un schema con una tabla/función de mismo nombre,
--    la función definer podría terminar operando sobre datos ajenos con
--    privilegios elevados ("search_path hijacking", el mismo vector que
--    ya se evitó correctamente en las funciones de 016/025/039). Fijar
--    `search_path = public` de forma explícita cierra esto sin cambiar
--    ningún comportamiento — ambas funciones ya asumían implícitamente
--    que "public" es el schema correcto.
alter function public.handle_new_mechanic() set search_path = public;
alter function public.handle_new_mechanic_welcome() set search_path = public;

-- 2) mechanics.email quedaba legible por cualquiera con la clave anon
--    (pública en el bundle del cliente, sin necesidad de login) a través
--    de la policy "mechanics: public read (team chat fix)" (migración
--    021, `for select using (true)`) — necesaria para que "Buscar
--    Maintler" y las tarjetas públicas de perfil sigan funcionando, pero
--    una policy de RLS no puede distinguir columnas, así que de paso
--    dejaba pasar el email de cualquiera. Ningún código de cliente lee
--    el email de OTRO mecánico (los únicos usos de mechanics.email están
--    en rutas /api/admin/*, que ya usan el cliente de service-role y por
--    lo tanto ignoran esta revocación igual) — revocar la columna acá no
--    rompe nada existente, solo cierra la fuga.
revoke select (email) on public.mechanics from anon, authenticated;

-- 3) support_messages / mechanic_messages: la policy de UPDATE de estas
--    dos tablas (migraciones 011 y 019/022) restringe QUÉ FILA se puede
--    tocar (la propia conversación), pero no QUÉ COLUMNA — RLS no tiene
--    ese concepto. En la práctica, con una llamada UPDATE armada a mano
--    contra la REST API de Supabase (no algo que la propia UI ofrezca,
--    pero sí algo que cualquiera con la anon key y la sesión de un
--    mecánico puede construir), cualquiera de las dos partes de una
--    conversación podía reescribir el texto de un mensaje YA ENVIADO, o
--    en mechanic_messages incluso flippear el hidden_for_* de LA OTRA
--    persona. Un trigger BEFORE UPDATE es la forma estándar de lograr
--    control a nivel de columna que RLS no ofrece: fuerza los campos
--    protegidos a quedarse como estaban pase lo que pase en el UPDATE, y
--    solo deja pasar los campos que la UI realmente necesita cambiar
--    (read, hidden_for_admin/hidden_for_mechanic, hidden_for_sender/
--    hidden_for_recipient).
create or replace function public.guard_support_message_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.mechanic_id := old.mechanic_id;
  new.body := old.body;
  new.from_admin := old.from_admin;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists guard_support_message_update_trg on public.support_messages;
create trigger guard_support_message_update_trg
  before update on public.support_messages
  for each row execute function public.guard_support_message_update();

create or replace function public.guard_mechanic_message_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.sender_id := old.sender_id;
  new.recipient_id := old.recipient_id;
  new.body := old.body;
  new.created_at := old.created_at;
  -- Cada lado solo puede tocar su propio flag de "ocultar para mí" — el
  -- remitente no debería poder hacer reaparecer (o esconder) el hilo del
  -- lado del destinatario, y viceversa.
  if auth.uid() is distinct from old.sender_id then
    new.hidden_for_sender := old.hidden_for_sender;
  end if;
  if auth.uid() is distinct from old.recipient_id then
    new.hidden_for_recipient := old.hidden_for_recipient;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_mechanic_message_update_trg on public.mechanic_messages;
create trigger guard_mechanic_message_update_trg
  before update on public.mechanic_messages
  for each row execute function public.guard_mechanic_message_update();
