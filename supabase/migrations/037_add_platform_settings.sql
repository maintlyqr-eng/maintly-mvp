-- ============================================================
-- Configuraciones globales del sistema (incremento 17 de Item 6,
-- primer ítem de la Fase 3: "Configuraciones globales avanzadas").
-- Cubre modo mantenimiento, banner/anuncio global, límites de tamaño
-- de archivo configurables, y un changelog interno de versiones.
--
-- Deliberadamente NO se incluye acá: categorías de assets/mantenimiento
-- editables, ni países/unidades/formatos — convertir esos enums
-- hardcodeados a un modelo dinámico es un cambio de mayor alcance
-- (toca múltiples archivos + necesita mapeo i18n) que amerita su
-- propio incremento futuro. Ver claude/MAINTLYQR_FEATURE_BACKLOG.md.
-- ============================================================

create table if not exists platform_settings (
  id boolean primary key default true,
  constraint platform_settings_single_row check (id),
  maintenance_mode boolean not null default false,
  maintenance_message text,
  banner_enabled boolean not null default false,
  banner_text text,
  banner_severity text not null default 'info',
  banner_link_url text,
  max_asset_photo_mb integer not null default 8,
  max_document_mb integer not null default 25,
  max_certificate_mb integer not null default 10,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Fila única, sembrada con los mismos valores que hoy están
-- hardcodeados en el código (MAX_PHOTO_BYTES=8MB, MAX_FILE_BYTES=25MB
-- para documentos, MAX_FILE_BYTES=10MB para certificados) — así el
-- comportamiento no cambia hasta que un admin edite algo desde el panel.
insert into platform_settings (id) values (true) on conflict (id) do nothing;

alter table platform_settings enable row level security;

drop policy if exists "platform_settings: lectura publica" on platform_settings;
create policy "platform_settings: lectura publica"
on platform_settings for select
using (true);

-- Sin policies de insert/update/delete: solo el service-role client
-- (la ruta /api/admin/system-settings) puede escribir. La lectura es
-- pública a propósito — el banner/modo mantenimiento se muestra en el
-- Dashboard del mecánico, y los 3 puntos de carga de archivos leen los
-- límites configurables, todos corriendo con la anon key del lado del
-- cliente. Ningún dato acá es sensible (no hay credenciales ni datos
-- personales).

create table if not exists platform_changelog (
  id uuid primary key default gen_random_uuid(),
  version_label text not null,
  notes text not null,
  published_at timestamptz not null default now(),
  created_by text
);

create index if not exists platform_changelog_published_idx on platform_changelog (published_at desc);

alter table platform_changelog enable row level security;

-- Sin ninguna policy: el changelog es interno del panel de Admin por
-- ahora (no hubo pedido explícito de mostrarlo a los Maintlers) — solo
-- el service-role client lo lee/escribe. Si en el futuro Facu quiere
-- mostrarlo públicamente, hace falta agregar una policy de select.
