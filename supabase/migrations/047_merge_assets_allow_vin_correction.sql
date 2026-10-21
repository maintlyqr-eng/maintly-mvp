-- ============================================================
-- Migración 047: merge_assets permite corregir el VIN del duplicado
--
-- Caso real encontrado por Facu al probar la 046 (21/10/2026): el activo
-- que estaba editando ("Cachirula") YA tenía otro VIN guardado -- mal
-- cargado en su momento -- y al escanearle el VIN correcto, que coincidía
-- con otro activo, la fusión fallaba con "VIN mismatch (duplicate)".
--
-- Regla nueva: el VIN que la persona acaba de escribir/escanear (p_vin)
-- manda sobre lo que el DUPLICADO tuviera guardado. Es exactamente la
-- intención de quien edita: "este es el VIN de verdad". El VIN viejo
-- queda en snapshot->duplicate_row->vin_serial, así unmerge_assets lo
-- restaura tal cual. El PRINCIPAL, en cambio, sigue teniendo que
-- coincidir siempre: ahí no hay intención de corregir nada.
--
-- Solo reemplaza el cuerpo de la función; la tabla, los índices y
-- unmerge_assets de la 046 quedan intactos.
-- ============================================================

create or replace function public.merge_assets(
  p_primary uuid,
  p_duplicate uuid,
  p_vin text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_primary public.assets%rowtype;
  v_duplicate public.assets%rowtype;
  v_vin text;
  v_param_vin text;
  v_merge_id uuid;
  v_service_ids uuid[];
  v_qr_ids uuid[];
  v_task_ids uuid[];
  v_doc_ids uuid[];
  v_msg_ids uuid[];
  v_scan_ids uuid[];
  v_report_ids uuid[];
  v_links jsonb;
  v_links_added uuid[];
  v_primary_before jsonb;
  v_actor_name text;
  v_primary_name text;
  v_duplicate_name text;
  r record;
  v_locale text;
  v_body text;
begin
  if v_actor is null then
    raise exception 'merge_assets: not authenticated' using errcode = '42501';
  end if;
  if p_primary is null or p_duplicate is null or p_primary = p_duplicate then
    raise exception 'merge_assets: invalid asset ids' using errcode = '22023';
  end if;

  select * into v_primary from public.assets where id = p_primary and deleted_at is null for update;
  if not found then
    raise exception 'merge_assets: primary asset not found or deleted' using errcode = 'P0002';
  end if;
  select * into v_duplicate from public.assets where id = p_duplicate and deleted_at is null for update;
  if not found then
    raise exception 'merge_assets: duplicate asset not found or deleted' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.mechanic_assets ma
    where ma.mechanic_id = v_actor and ma.asset_id in (p_primary, p_duplicate)
  ) and v_primary.created_by is distinct from v_actor
    and v_duplicate.created_by is distinct from v_actor then
    raise exception 'merge_assets: not linked to either asset' using errcode = '42501';
  end if;

  -- VIN de referencia: (1) el que la persona acaba de dar, (2) el del
  -- principal, (3) el del duplicado. Normalizado igual que normalizeVin().
  v_param_vin := upper(regexp_replace(coalesce(p_vin, ''), '[^A-Z0-9]', '', 'gi'));
  v_vin := coalesce(
    nullif(v_param_vin, ''),
    nullif(upper(regexp_replace(coalesce(v_primary.vin_serial, ''), '[^A-Z0-9]', '', 'gi')), ''),
    nullif(upper(regexp_replace(coalesce(v_duplicate.vin_serial, ''), '[^A-Z0-9]', '', 'gi')), '')
  );
  if v_vin is null then
    raise exception 'merge_assets: no VIN to match on' using errcode = '22023';
  end if;

  -- El principal siempre tiene que coincidir (si tiene VIN).
  if coalesce(v_primary.vin_serial, '') <> ''
     and upper(regexp_replace(v_primary.vin_serial, '[^A-Z0-9]', '', 'gi')) <> v_vin then
    raise exception 'merge_assets: VIN mismatch (primary)' using errcode = '22023';
  end if;

  -- El duplicado: si la persona NO dio un VIN explícito, también tiene que
  -- coincidir. Si lo dio, se acepta corregirlo (queda el viejo en snapshot).
  if v_param_vin = ''
     and coalesce(v_duplicate.vin_serial, '') <> ''
     and upper(regexp_replace(v_duplicate.vin_serial, '[^A-Z0-9]', '', 'gi')) <> v_vin then
    raise exception 'merge_assets: VIN mismatch (duplicate)' using errcode = '22023';
  end if;

  select coalesce(array_agg(id), '{}') into v_service_ids from public.service_records where asset_id = p_duplicate;
  select coalesce(array_agg(id), '{}') into v_qr_ids      from public.qr_codes        where asset_id = p_duplicate;
  select coalesce(array_agg(id), '{}') into v_task_ids    from public.calendar_tasks  where asset_id = p_duplicate;
  select coalesce(array_agg(id), '{}') into v_doc_ids     from public.documents       where asset_id = p_duplicate;
  select coalesce(array_agg(id), '{}') into v_msg_ids     from public.messages        where asset_id = p_duplicate;
  select coalesce(array_agg(id), '{}') into v_scan_ids    from public.qr_scans        where asset_id = p_duplicate;
  select coalesce(array_agg(id), '{}') into v_report_ids  from public.content_reports where asset_id = p_duplicate;

  select coalesce(jsonb_agg(jsonb_build_object(
           'mechanic_id', ma.mechanic_id, 'qr_code', ma.qr_code,
           'shared_by', ma.shared_by, 'added_at', ma.added_at)), '[]'::jsonb)
    into v_links
  from public.mechanic_assets ma where ma.asset_id = p_duplicate;

  v_primary_before := jsonb_build_object(
    'nickname', v_primary.nickname, 'brand', v_primary.brand, 'model', v_primary.model,
    'year', v_primary.year, 'plate', v_primary.plate, 'fuel_type', v_primary.fuel_type,
    'location', v_primary.location, 'photo_url', v_primary.photo_url,
    'customer_id', v_primary.customer_id, 'vin_serial', v_primary.vin_serial
  );

  update public.service_records set asset_id = p_primary where asset_id = p_duplicate;
  update public.qr_codes        set asset_id = p_primary where asset_id = p_duplicate;
  update public.calendar_tasks  set asset_id = p_primary where asset_id = p_duplicate;
  update public.documents       set asset_id = p_primary where asset_id = p_duplicate;
  update public.messages        set asset_id = p_primary where asset_id = p_duplicate;
  update public.qr_scans        set asset_id = p_primary where asset_id = p_duplicate;
  update public.content_reports set asset_id = p_primary where asset_id = p_duplicate;

  select coalesce(array_agg(ma.mechanic_id), '{}') into v_links_added
  from public.mechanic_assets ma
  where ma.asset_id = p_duplicate
    and not exists (select 1 from public.mechanic_assets x where x.asset_id = p_primary and x.mechanic_id = ma.mechanic_id);

  insert into public.mechanic_assets (mechanic_id, asset_id, qr_code, shared_by, added_at)
  select ma.mechanic_id, p_primary, ma.qr_code, ma.shared_by, ma.added_at
  from public.mechanic_assets ma
  where ma.asset_id = p_duplicate
  on conflict (mechanic_id, asset_id) do nothing;
  delete from public.mechanic_assets where asset_id = p_duplicate;

  update public.assets set
    nickname    = coalesce(nullif(nickname, ''),  nullif(v_duplicate.nickname, '')),
    brand       = coalesce(nullif(brand, ''),     nullif(v_duplicate.brand, '')),
    model       = coalesce(nullif(model, ''),     nullif(v_duplicate.model, '')),
    year        = coalesce(year,                  v_duplicate.year),
    plate       = coalesce(nullif(plate, ''),     nullif(v_duplicate.plate, '')),
    fuel_type   = coalesce(nullif(fuel_type, ''), nullif(v_duplicate.fuel_type, '')),
    location    = coalesce(nullif(location, ''),  nullif(v_duplicate.location, '')),
    photo_url   = coalesce(nullif(photo_url, ''), nullif(v_duplicate.photo_url, '')),
    customer_id = coalesce(customer_id,           v_duplicate.customer_id),
    vin_serial  = v_vin
  where id = p_primary;

  update public.assets set deleted_at = now(), merged_into = p_primary where id = p_duplicate;

  insert into public.asset_merges (
    primary_asset_id, duplicate_asset_id, merged_by, vin, services_moved, qr_codes_moved, snapshot
  ) values (
    p_primary, p_duplicate, v_actor, v_vin,
    coalesce(array_length(v_service_ids, 1), 0),
    coalesce(array_length(v_qr_ids, 1), 0),
    jsonb_build_object(
      'service_record_ids', to_jsonb(v_service_ids),
      'qr_code_ids',        to_jsonb(v_qr_ids),
      'calendar_task_ids',  to_jsonb(v_task_ids),
      'document_ids',       to_jsonb(v_doc_ids),
      'message_ids',        to_jsonb(v_msg_ids),
      'qr_scan_ids',        to_jsonb(v_scan_ids),
      'content_report_ids', to_jsonb(v_report_ids),
      'mechanic_links',     v_links,
      'primary_links_added', to_jsonb(v_links_added),
      'primary_before',     v_primary_before,
      'duplicate_row',      to_jsonb(v_duplicate)
    )
  ) returning id into v_merge_id;

  select coalesce(nullif(name, ''), 'A Maintler') into v_actor_name from public.mechanics where id = v_actor;
  v_primary_name   := coalesce(nullif(v_primary.nickname, ''),   nullif(trim(concat_ws(' ', v_primary.brand, v_primary.model)), ''),   v_primary.asset_type);
  v_duplicate_name := coalesce(nullif(v_duplicate.nickname, ''), nullif(trim(concat_ws(' ', v_duplicate.brand, v_duplicate.model)), ''), v_duplicate.asset_type);

  for r in
    select distinct ma.mechanic_id
    from public.mechanic_assets ma
    where ma.asset_id = p_primary and ma.mechanic_id <> v_actor
  loop
    select lower(left(coalesce(u.raw_user_meta_data->>'locale', 'en'), 2)) into v_locale
    from auth.users u where u.id = r.mechanic_id;
    if v_locale not in ('es', 'pt') then v_locale := 'en'; end if;

    v_body := case v_locale
      when 'es' then
        v_actor_name || ' fusionó el historial de "' || v_duplicate_name || '" con "' || v_primary_name ||
        '" (VIN ' || v_vin || '). Los dos códigos QR siguen funcionando y ahora muestran un único historial. ' ||
        'Si creés que esto no corresponde, respondé a este mensaje y lo revisamos.'
      when 'pt' then
        v_actor_name || ' uniu o histórico de "' || v_duplicate_name || '" com "' || v_primary_name ||
        '" (VIN ' || v_vin || '). Os dois códigos QR continuam funcionando e agora mostram um único histórico. ' ||
        'Se você acha que isso não está certo, responda a esta mensagem e nós revisamos.'
      else
        v_actor_name || ' merged the history of "' || v_duplicate_name || '" into "' || v_primary_name ||
        '" (VIN ' || v_vin || '). Both QR codes keep working and now show a single history. ' ||
        'If you think this is wrong, reply to this message and we will review it.'
    end;

    insert into public.messages (mechanic_id, asset_id, from_admin, sender_name, sender_contact, body, read)
    values (r.mechanic_id, p_primary, true, 'MaintlyQR Team', 'support@maintlyqr.com', v_body, false);
  end loop;

  return v_merge_id;
end;
$$;
