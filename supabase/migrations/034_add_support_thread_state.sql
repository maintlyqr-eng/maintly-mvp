-- Herramientas de soporte (item 7 del pedido de Facu: "Mensajes y soporte"
-- — cambiar estado, asignar prioridad, notas internas, cerrar caso — y
-- Fase 2 punto 6 de su propia priorización: "herramientas de soporte").
--
-- support_messages (migraciones 010/011) ya guarda la conversación en sí,
-- pero no tiene ningún concepto de "thread" como entidad propia — es una
-- fila por mensaje, agrupada del lado del cliente por mechanic_id. Esta
-- tabla nueva agrega justamente esa metadata a nivel de thread (una fila
-- por mechanic_id, no por mensaje), sin tocar support_messages para nada.
create table if not exists support_thread_state (
  mechanic_id uuid primary key references mechanics(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  internal_notes text,
  closed_at timestamptz,
  closed_by text,
  updated_at timestamptz not null default now()
);

create index if not exists support_thread_state_status_idx on support_thread_state (status);
create index if not exists support_thread_state_priority_idx on support_thread_state (priority);

-- RLS activado con cero policies, mismo patrón que admin_audit_logs
-- (migración 030): solo el service-role client (las rutas /api/admin/*)
-- puede leer o escribir acá. Un mecánico nunca necesita ver ni tocar esto
-- — es información interna del admin sobre su propio caso, no algo que se
-- le muestra al usuario.
alter table support_thread_state enable row level security;

create or replace function public.support_thread_state_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists support_thread_state_updated_at on public.support_thread_state;
create trigger support_thread_state_updated_at
  before update on public.support_thread_state
  for each row execute function public.support_thread_state_set_updated_at();
