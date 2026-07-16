-- ============================================================
-- Incremento 20: el mensaje de bienvenida automático (migración 018)
-- siempre se mandaba en inglés, sin importar en qué idioma el Maintler
-- se registró/usa la app -- reportado por Facu tras probar el login con
-- Google en español.
--
-- Reemplaza la función del trigger (mismo trigger, mismo disparador --
-- no hace falta tocar "on_mechanic_created_welcome") para que resuelva
-- el idioma antes de armar el texto:
--
--   1. Lee auth.users.raw_user_meta_data->>'locale' para esta misma fila
--      (mismo id que mechanics.id). Esa función ya corre con
--      "security definer", así que puede leer auth.users aunque el
--      caller no tenga permiso directo -- mismo patrón ya usado en el
--      resto del proyecto para leer datos de sistema desde triggers.
--   2. Para altas con email/contraseña, "locale" lo manda el cliente
--      (ver options.data en signUp(), Register/Login pages) con el
--      idioma que next-intl tiene activo en ese momento (en/es/pt).
--   3. Para altas con Google, Supabase copia automáticamente el perfil
--      que devuelve Google a raw_user_meta_data -- y Google casi
--      siempre incluye un campo "locale" con el idioma de la cuenta de
--      Google del usuario (ej. "es-419", "pt-BR", "en"). No hace falta
--      pedirle nada especial a Google para esto, ya viene solo.
--   4. Se normaliza a los primeros 2 caracteres en minúscula y solo se
--      reconocen "es"/"pt" -- cualquier otro valor (null, "en", "fr",
--      etc.) cae a inglés, el default de toda la app.
--
-- Explícitamente fuera de alcance: el welcome EMAIL (ver comentario de
-- la migración 018) sigue en inglés por ahora -- ese es un fetch aparte
-- del lado del cliente (src/app/api/send-welcome-email/route.ts), no
-- toca esta función. Si Facu lo pide, es un incremento separado.
-- ============================================================

create or replace function public.handle_new_mechanic_welcome()
returns trigger as $$
declare
  v_locale text;
  v_first_name text;
  v_body text;
begin
  select coalesce(u.raw_user_meta_data->>'locale', 'en') into v_locale
  from auth.users u
  where u.id = new.id;

  v_locale := lower(left(coalesce(v_locale, 'en'), 2));
  if v_locale not in ('es', 'pt') then
    v_locale := 'en';
  end if;

  v_first_name := split_part(new.name, ' ', 1);

  v_body := case v_locale
    when 'es' then
      '¡Bienvenido a MaintlyQR, ' || v_first_name || '! ' ||
      'MaintlyQR es un sistema de historial de servicio vía QR, de alcance mundial: cada equipo que registrás obtiene su propio código QR, y cualquiera que lo escanee puede ver al instante todo su historial de mantenimiento, sin necesitar ninguna app ni cuenta de su lado. ' ||
      'Un par de cosas para probar primero: agregá tu primer equipo desde la pestaña Assets, o andá a QR Codes para imprimir un lote de stickers en blanco que podés asignar más adelante. ' ||
      'Si tenés dudas, respondé directamente acá: esta bandeja llega a nuestro equipo.'
    when 'pt' then
      'Bem-vindo à MaintlyQR, ' || v_first_name || '! ' ||
      'A MaintlyQR é um sistema de histórico de manutenção via QR, de alcance mundial: cada equipamento que você registra ganha seu próprio código QR, e qualquer pessoa que o escaneie pode ver instantaneamente todo o histórico de manutenção, sem precisar de nenhum app ou conta. ' ||
      'Algumas coisas para experimentar primeiro: adicione seu primeiro equipamento na aba Assets, ou vá em QR Codes para imprimir um lote de adesivos em branco que você pode atribuir depois. ' ||
      'Se tiver dúvidas, é só responder por aqui: essa caixa de entrada chega até nossa equipe.'
    else
      'Welcome to MaintlyQR, ' || v_first_name || '! ' ||
      'MaintlyQR is a worldwide, QR-based service history system: every asset you register gets its own QR code, and anyone who scans it can instantly see its full maintenance history -- no app or account needed on their end. ' ||
      'A couple of things to try first: add your first asset from the Assets tab, or head to QR Codes to print a batch of blank stickers you can assign later. ' ||
      'If you ever have questions, just reply right here -- this inbox reaches our team.'
  end;

  insert into public.messages (mechanic_id, asset_id, from_admin, sender_name, sender_contact, body, read)
  values (new.id, null, true, 'MaintlyQR Team', 'support@maintlyqr.com', v_body, false);

  return new;
end;
$$ language plpgsql security definer;
