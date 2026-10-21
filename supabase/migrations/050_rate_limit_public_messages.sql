-- ============================================================
-- Migración 050: freno anti-spam en las consultas públicas (tabla messages)
--
-- La página pública del QR (/asset/[code]) permite que cualquiera, sin
-- cuenta, le mande una consulta al mecánico del equipo. Eso es a propósito
-- (policy "messages: cualquiera puede enviar", from_admin = false) y es
-- parte del producto. Pero sin ningún límite, un script puede llenar el
-- inbox de un Maintler en segundos.
--
-- Como el insert va directo desde el navegador a Supabase (sin pasar por
-- una ruta de la app), el único lugar confiable para frenar es la base:
-- un trigger BEFORE INSERT que cuenta las consultas públicas recientes y
-- rechaza si se pasa. Límites de sentido común, ajustables:
--   - por destinatario: máx. 20 consultas públicas en 10 minutos
--   - por remitente (sender_contact, normalizado): máx. 5 en 10 minutos
--   - por equipo: máx. 10 en 10 minutos
-- Los mensajes del sistema/admin (from_admin = true) no cuentan ni se
-- limitan. El error que recibe el cliente es claro (errcode P0001 con
-- mensaje "rate_limited") para que la UI pueda mostrar un texto amable.
-- ============================================================

create index if not exists messages_rate_limit_idx
  on public.messages (mechanic_id, created_at desc)
  where from_admin = false;

create or replace function public.guard_public_message_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window interval := interval '10 minutes';
  v_to_mechanic integer;
  v_from_sender integer;
  v_to_asset integer;
  v_sender text := lower(trim(coalesce(new.sender_contact, '')));
begin
  if new.from_admin then
    return new;
  end if;

  select count(*) into v_to_mechanic
  from public.messages
  where mechanic_id = new.mechanic_id and from_admin = false and created_at > now() - v_window;
  if v_to_mechanic >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001', hint = 'too many messages to this mechanic';
  end if;

  if v_sender <> '' then
    select count(*) into v_from_sender
    from public.messages
    where from_admin = false and created_at > now() - v_window
      and lower(trim(sender_contact)) = v_sender;
    if v_from_sender >= 5 then
      raise exception 'rate_limited' using errcode = 'P0001', hint = 'too many messages from this sender';
    end if;
  end if;

  if new.asset_id is not null then
    select count(*) into v_to_asset
    from public.messages
    where asset_id = new.asset_id and from_admin = false and created_at > now() - v_window;
    if v_to_asset >= 10 then
      raise exception 'rate_limited' using errcode = 'P0001', hint = 'too many messages about this asset';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_public_message_rate_trg on public.messages;
create trigger guard_public_message_rate_trg
  before insert on public.messages
  for each row execute function public.guard_public_message_rate();
