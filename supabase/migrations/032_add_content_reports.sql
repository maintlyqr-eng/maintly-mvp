-- ============================================================
-- Reportes y moderación (item 6 del pedido de admin de Facu, ver
-- claude/MAINTLYQR_FEATURE_BACKLOG.md, Item 6). El único "reporte" que
-- existía hasta ahora era mechanic_reports (migración 022): un Maintler
-- reportando a OTRO Maintler desde Team Chat. Este es un caso distinto —
-- acá el sujeto del reporte es un asset, un registro de servicio, un QR, o
-- un problema general de la plataforma, y quien reporta no necesariamente
-- tiene cuenta (cualquiera que escanee un QR público, con o sin login,
-- puede reportar algo).
-- ============================================================

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  report_type text not null check (report_type in (
    'incorrect_info', 'fake_record', 'inappropriate_content', 'wrong_asset',
    'qr_issue', 'technical_issue', 'deletion_request', 'general_inquiry'
  )),
  status text not null default 'new' check (status in ('new', 'in_review', 'resolved', 'closed')),

  -- Todos nullable a propósito: un reporte no siempre apunta a las 3 cosas
  -- a la vez (una "consulta general" puede no referirse a ningún asset en
  -- particular), y un asset ya eliminado no debería impedir guardar el
  -- reporte igual (por eso "on delete set null", no "cascade" — si el
  -- asset se borra de verdad, el reporte se conserva como historial).
  asset_id uuid references public.assets(id) on delete set null,
  service_record_id uuid references public.service_records(id) on delete set null,
  mechanic_id uuid references public.mechanics(id) on delete set null,
  qr_code text,

  -- Quien reporta no siempre tiene cuenta ni quiere identificarse —
  -- ambos campos son opcionales, a diferencia de "messages" (contactar al
  -- mecánico, migración 009) donde sí son obligatorios porque ahí se
  -- espera una respuesta directa del mecánico.
  reporter_name text,
  reporter_contact text,

  message text not null,

  -- Estos 3 los llena únicamente el admin desde el panel — nunca el
  -- formulario público.
  internal_notes text,
  resolved_at timestamptz,
  resolved_by text,

  constraint content_reports_message_not_blank check (length(trim(message)) > 0)
);

create index if not exists content_reports_status_idx on public.content_reports (status);
create index if not exists content_reports_created_idx on public.content_reports (created_at desc);
create index if not exists content_reports_asset_idx on public.content_reports (asset_id);
create index if not exists content_reports_type_idx on public.content_reports (report_type);

alter table public.content_reports enable row level security;

-- Cualquiera puede reportar, logueado o no — mismo patrón que "messages"
-- (migración 009: "messages: cualquiera puede enviar"). Deliberadamente
-- SOLO insert: nadie, ni siquiera quien lo creó, puede leerlo de vuelta
-- con la anon key. La única lectura es desde el panel de admin, a través
-- del service-role client (getSupabaseAdmin()), que bypasea RLS por
-- completo — mismo patrón que admin_audit_logs (migración 030).
create policy "content_reports: cualquiera puede reportar"
  on public.content_reports for insert
  with check (true);

-- Mantiene updated_at al día en cada cambio de estado / nota interna que
-- haga el admin (la columna, si no, quedaría congelada en el valor de
-- creación para siempre).
create or replace function public.content_reports_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists content_reports_updated_at on public.content_reports;
create trigger content_reports_updated_at
  before update on public.content_reports
  for each row execute function public.content_reports_set_updated_at();
