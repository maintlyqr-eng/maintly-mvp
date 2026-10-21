-- ============================================================
-- Migración 046: Fusión de historiales (activos duplicados por VIN)
--
-- Planteo de Facu (21/10/2026): "yo hago un QR de un Honda Accord y le
-- cargo servicios, pero después ese Honda Accord va a un taller y agregan
-- un QR pero desde el VIN y le cargan servicios también... el sistema
-- debería detectar que hay un auto que tiene dos QR y servicios en cada
-- QR, y hay que buscar la manera de que todo eso se combine para que el
-- historial siga prolijo". Y: "deberíamos poder ver quién fusionó qué cosa
-- desde el panel del administrador. En caso de que alguien haga cagadas le
-- podemos dar soporte y acomodar las cosas".
--
-- Qué agrega:
--   1. assets.merged_into: si un activo fue fusionado dentro de otro,
--      apunta al principal (además de deleted_at, que lo manda a la
--      Papelera como siempre).
--   2. Tabla asset_merges: el registro de cada fusión (quién, cuándo, qué
--      activos, qué VIN, cuánto se movió) más un snapshot jsonb con TODO lo
--      necesario para deshacerla.
--   3. merge_assets(primary, duplicate, vin): la fusión en sí, en una sola
--      transacción, callable por un Maintler logueado que esté vinculado a
--      al menos uno de los dos activos.
--   4. unmerge_assets(merge_id): la reversión, SOLO para el service role
--      (panel Admin).
--
-- Qué hace la fusión (regla fija "el principal gana, lo vacío se completa"):
--   - service_records, qr_codes, calendar_tasks, documents, messages,
--     qr_scans y content_reports del duplicado pasan al principal.
--     Clave: los QR del duplicado SIGUEN FUNCIONANDO -- el sticker físico
--     ya está pegado en el auto; ahora apunta al historial unificado.
--   - mechanic_assets: todos los mecánicos vinculados al duplicado quedan
--     vinculados al principal (nadie pierde acceso).
--   - Campos vacíos del principal (apodo, marca, modelo, año, patente,
--     combustible, ubicación, foto, cliente, VIN) se completan con los del
--     duplicado. Nunca se pisa un campo ya cargado del principal.
--   - El duplicado queda con deleted_at = now() y merged_into = principal.
--   - Se avisa por mensaje in-app (tabla messages, from_admin = true, igual
--     que el mensaje de bienvenida) a cada mecánico vinculado que NO hizo
--     la fusión, en su idioma (misma técnica que la migración 039).
--
-- Seguridad: security definer + search_path = public (misma convención
-- que la migración 043). merge_assets valida auth.uid() y la vinculación;
-- unmerge_assets no tiene policy para anon/authenticated (revoke) -- solo
-- el service role del panel Admin puede llamarla.
-- ============================================================

alter table public.assets
  add column if not exists merged_into uuid references public.assets(id) on delete set null;

create index if not exists assets_merged_into_idx on public.assets (merged_into) where merged_into is not null;

create table if not exists public.asset_merges (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  primary_asset_id uuid not null references public.assets(id) on delete cascade,
  duplicate_asset_id uuid not null references public.assets(id) on delete cascade,
  merged_by uuid references public.mechanics(id) on delete set null,
  vin text,
  services_moved integer not null default 0,
  qr_codes_moved integer not null default 0,
  snapshot jsonb not null default '{}'::jsonb,
  undone_at timestamptz,
  undone_by text,
  constraint asset_merges_distinct check (primary_asset_id <> duplicate_asset_id)
);

create index if not exists asset_merges_created_at_idx on public.asset_merges (created_at desc);
create index if not exists asset_merges_primary_idx on public.asset_merges (primary_asset_id);
create index if not exists asset_merges_duplicate_idx on public.asset_merges (duplicate_asset_id);
create index if not exists asset_merges_merged_by_idx on public.asset_merges (merged_by);

-- RLS activado SIN policies: igual que admin_audit_logs / platform_error_logs,
-- solo el service role (panel Admin) lee esta tabla. Las funciones de abajo
-- escriben acá como security definer.
alter table public.asset_merges enable row level security;

-- ------------------------------------------------------------
-- merge_assets
-- ------------------------------------------------------------
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

  -- Bloqueo de las dos filas para que dos fusiones simultáneas no se pisen.
  select * into v_primary from public.assets where id = p_primary and deleted_at is null for update;
  if not found then
    raise exception 'merge_assets: primary asset not found or deleted' using errcode = 'P0002';
  end if;
  select * into v_duplicate from public.assets where id = p_duplicate and deleted_at is null for update;
  if not found then
    raise exception 'merge_assets: duplicate asset not found or deleted' using errcode = 'P0002';
  end if;

  -- Quién puede fusionar: un Maintler vinculado (mechanic_assets) o creador
  -- de AL MENOS UNO de los dos activos. Decisión consciente (ver spec):
  -- es lo práctico para un taller; el historial ya es público por QR, y
  -- queda registro + aviso + reversión desde el Admin.
  if not exists (
    select 1 from public.mechanic_assets ma
    where ma.mechanic_id = v_actor and ma.asset_id in (p_primary, p_duplicate)
  ) and v_primary.created_by is distinct from v_actor
    and v_duplicate.created_by is distinct from v_actor then
    raise exception 'merge_assets: not linked to either asset' using errcode = '42501';
  end if;

  -- VIN: tiene que ser el mismo auto. Se acepta que uno de los dos todavía
  -- no tenga el VIN guardado (el caso típico: el usuario lo acaba de
  -- escanear en "Editar" y no lo guardó porque la app bloqueó el duplicado),
  -- y en ese caso se usa p_vin. Si los dos lo tienen, tienen que coincidir.
  v_vin := upper(regexp_replace(coalesce(nullif(v_primary.vin_serial, ''), nullif(v_duplicate.vin_serial, ''), p_vin, ''), '[^A-Z0-9]', '', 'gi'));
  if v_vin = '' then
    raise exception 'merge_assets: no VIN to match on' using errcode = '22023';
  end if;
  if v_primary.vin_serial is not null and v_primary.vin_serial <> ''
     and upper(regexp_replace(v_primary.vin_serial, '[^A-Z0-9]', '', 'gi')) <> v_vin then
    raise exception 'merge_assets: VIN mismatch (primary)' using errcode = '22023';
  end if;
  if v_duplicate.vin_serial is not null and v_duplicate.vin_serial <> ''
     and upper(regexp_replace(v_duplicate.vin_serial, '[^A-Z0-9]', '', 'gi')) <> v_vin then
    raise exception 'merge_assets: VIN mismatch (duplicate)' using errcode = '22023';
  end if;
  if p_vin is not null and p_vin <> ''
     and upper(regexp_replace(p_vin, '[^A-Z0-9]', '', 'gi')) <> v_vin then
    raise exception 'merge_assets: VIN mismatch (param)' using errcode = '22023';
  end if;

  -- ---- Snapshot: ids que se mueven + vínculos + estado previo ----------
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

  -- ---- Mover todo al principal -----------------------------------------
  update public.service_records set asset_id = p_primary where asset_id = p_duplicate;
  update public.qr_codes        set asset_id = p_primary where asset_id = p_duplicate;
  update public.calendar_tasks  set asset_id = p_primary where asset_id = p_duplicate;
  update public.documents       set asset_id = p_primary where asset_id = p_duplicate;
  update public.messages        set asset_id = p_primary where asset_id = p_duplicate;
  update public.qr_scans        set asset_id = p_primary where asset_id = p_duplicate;
  update public.content_reports set asset_id = p_primary where asset_id = p_duplicate;

  -- Vínculos: los mecánicos del duplicado pasan al principal (sin duplicar
  -- pares ya existentes) y después se sueltan del duplicado. Se anota qué
  -- vínculos son NUEVOS en el principal, para que deshacer los quite.
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

  -- Completar vacíos del principal con lo del duplicado (nunca pisar).
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

  -- El duplicado a la Papelera, marcado como fusionado.
  update public.assets set deleted_at = now(), merged_into = p_primary where id = p_duplicate;

  -- ---- Registro -------------------------------------------------------
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

  -- ---- Aviso in-app a los otros mecánicos vinculados -------------------
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

revoke all on function public.merge_assets(uuid, uuid, text) from public;
revoke all on function public.merge_assets(uuid, uuid, text) from anon;
grant execute on function public.merge_assets(uuid, uuid, text) to authenticated;
grant execute on function public.merge_assets(uuid, uuid, text) to service_role;

-- ------------------------------------------------------------
-- unmerge_assets (solo panel Admin, vía service role)
-- ------------------------------------------------------------
create or replace function public.unmerge_assets(
  p_merge_id uuid,
  p_undone_by text default 'admin'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.asset_merges%rowtype;
  s jsonb;
  pb jsonb;
  ids uuid[];
  r jsonb;
begin
  select * into m from public.asset_merges where id = p_merge_id for update;
  if not found then
    raise exception 'unmerge_assets: merge not found' using errcode = 'P0002';
  end if;
  if m.undone_at is not null then
    raise exception 'unmerge_assets: already undone' using errcode = '22023';
  end if;
  s := m.snapshot;

  -- Devolver al duplicado exactamente lo que se le sacó (por id, no "todo
  -- lo del principal" -- lo que ya era del principal se queda ahí).
  select coalesce(array_agg(x::uuid), '{}') into ids from jsonb_array_elements_text(coalesce(s->'service_record_ids', '[]')) x;
  update public.service_records set asset_id = m.duplicate_asset_id where id = any(ids);
  select coalesce(array_agg(x::uuid), '{}') into ids from jsonb_array_elements_text(coalesce(s->'qr_code_ids', '[]')) x;
  update public.qr_codes set asset_id = m.duplicate_asset_id where id = any(ids);
  select coalesce(array_agg(x::uuid), '{}') into ids from jsonb_array_elements_text(coalesce(s->'calendar_task_ids', '[]')) x;
  update public.calendar_tasks set asset_id = m.duplicate_asset_id where id = any(ids);
  select coalesce(array_agg(x::uuid), '{}') into ids from jsonb_array_elements_text(coalesce(s->'document_ids', '[]')) x;
  update public.documents set asset_id = m.duplicate_asset_id where id = any(ids);
  select coalesce(array_agg(x::uuid), '{}') into ids from jsonb_array_elements_text(coalesce(s->'message_ids', '[]')) x;
  update public.messages set asset_id = m.duplicate_asset_id where id = any(ids);
  select coalesce(array_agg(x::uuid), '{}') into ids from jsonb_array_elements_text(coalesce(s->'qr_scan_ids', '[]')) x;
  update public.qr_scans set asset_id = m.duplicate_asset_id where id = any(ids);
  select coalesce(array_agg(x::uuid), '{}') into ids from jsonb_array_elements_text(coalesce(s->'content_report_ids', '[]')) x;
  update public.content_reports set asset_id = m.duplicate_asset_id where id = any(ids);

  -- Vínculos del duplicado, tal como estaban.
  for r in select * from jsonb_array_elements(coalesce(s->'mechanic_links', '[]'))
  loop
    insert into public.mechanic_assets (mechanic_id, asset_id, qr_code, shared_by, added_at)
    values (
      (r->>'mechanic_id')::uuid, m.duplicate_asset_id, r->>'qr_code',
      nullif(r->>'shared_by', '')::uuid,
      coalesce((r->>'added_at')::timestamptz, now())
    )
    on conflict (mechanic_id, asset_id) do nothing;
  end loop;

  -- Vínculos que la fusión agregó al principal: se quitan.
  select coalesce(array_agg(x::uuid), '{}') into ids from jsonb_array_elements_text(coalesce(s->'primary_links_added', '[]')) x;
  delete from public.mechanic_assets where asset_id = m.primary_asset_id and mechanic_id = any(ids);

  -- Campos del principal: volver a lo que tenía antes de la fusión.
  pb := coalesce(s->'primary_before', '{}'::jsonb);
  update public.assets set
    nickname    = pb->>'nickname',
    brand       = pb->>'brand',
    model       = pb->>'model',
    year        = nullif(pb->>'year', '')::integer,
    plate       = pb->>'plate',
    fuel_type   = pb->>'fuel_type',
    location    = pb->>'location',
    photo_url   = pb->>'photo_url',
    customer_id = nullif(pb->>'customer_id', '')::uuid,
    vin_serial  = pb->>'vin_serial'
  where id = m.primary_asset_id;

  -- El duplicado vuelve a la vida.
  update public.assets set deleted_at = null, merged_into = null where id = m.duplicate_asset_id;

  update public.asset_merges set undone_at = now(), undone_by = p_undone_by where id = p_merge_id;
end;
$$;

revoke all on function public.unmerge_assets(uuid, text) from public;
revoke all on function public.unmerge_assets(uuid, text) from anon;
revoke all on function public.unmerge_assets(uuid, text) from authenticated;
grant execute on function public.unmerge_assets(uuid, text) to service_role;
