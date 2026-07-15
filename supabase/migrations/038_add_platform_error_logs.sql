-- ============================================================
-- Panel técnico de errores y rendimiento (incremento 19 de Item 6, Fase 3
-- "Escalabilidad", ítem elegido por Facu de los 3 que quedaban en esa fase
-- — ver claude/MAINTLYQR_FEATURE_BACKLOG.md).
--
-- Registro central de errores de JavaScript en el navegador (Dashboard +
-- Admin) y de errores de servidor puntuales en las rutas de API más
-- centrales (bulk-data, analytics) — pensado para que un crash como el del
-- incremento 7 (React error #310 en producción) hubiera quedado visible
-- acá en vez de depender de que Facu lo notara y mandara una captura.
--
-- Mismo modelo de confianza que admin_audit_logs (migración 030) y
-- platform_changelog (migración 037): RLS activado, CERO policies. Nadie
-- inserta acá directo con la anon key — los errores del navegador se
-- mandan a POST /api/log-error, que valida/trunca el body y recién ahí
-- inserta con el service-role client. Esto evita tener que abrir una
-- policy pública de insert (como sí tiene content_reports, migración 032,
-- porque ahí el formulario es genuinamente público) para algo que no
-- necesita serlo — pasar por una ruta de API propia da lugar a validar
-- forma y tamaño antes de tocar la base.
-- ============================================================

create table if not exists public.platform_error_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- 'client': capturado en el navegador (window.onerror /
  -- unhandledrejection, ver src/components/ErrorLogger.tsx). 'server':
  -- capturado dentro de una ruta de API (ver src/lib/errorLog.ts).
  source text not null check (source in ('client', 'server')),

  -- 'error': excepción real / rechazo de promesa sin catch. 'warning': hoy
  -- solo se usa para "carga de página lenta" (ver ErrorLogger.tsx) — no es
  -- un error, es la mitad "rendimiento" de este panel.
  severity text not null default 'error' check (severity in ('error', 'warning')),

  message text not null,
  stack text,
  -- Ruta del navegador (window.location.pathname) para errores de cliente,
  -- o el path de la ruta de API (ej. "/api/admin/bulk-data") para errores
  -- de servidor.
  route text,
  user_agent text,
  ip_address text,
  -- Contexto libre adicional (ej. { durationMs: 6200 } para una entrada de
  -- carga lenta) — jsonb por el mismo motivo que old_value/new_value en
  -- admin_audit_logs: cada tipo de entrada trae datos distintos.
  context jsonb,

  resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by text,

  constraint platform_error_logs_message_not_blank check (length(trim(message)) > 0)
);

create index if not exists platform_error_logs_created_idx on public.platform_error_logs (created_at desc);
create index if not exists platform_error_logs_source_idx on public.platform_error_logs (source);
create index if not exists platform_error_logs_severity_idx on public.platform_error_logs (severity);
create index if not exists platform_error_logs_resolved_idx on public.platform_error_logs (resolved);

alter table public.platform_error_logs enable row level security;
-- Sin policies a propósito — ver el comentario de arriba. Todo acceso pasa
-- por rutas de API que usan getSupabaseAdmin() (service role).
