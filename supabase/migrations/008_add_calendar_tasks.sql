-- "Calendar" page: lets a mechanic plan future work (tasks not tied to an
-- existing service reminder) and see it alongside services already logged
-- and reminders already due, day by day.

create table if not exists calendar_tasks (
  id uuid primary key default gen_random_uuid(),
  mechanic_id uuid not null references mechanics(id) on delete cascade,
  asset_id uuid references assets(id) on delete set null,
  title text not null,
  notes text,
  task_date date not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists calendar_tasks_mechanic_date_idx on calendar_tasks (mechanic_id, task_date);

alter table calendar_tasks enable row level security;

drop policy if exists "calendar_tasks: mecanico dueño administra sus tareas" on calendar_tasks;
create policy "calendar_tasks: mecanico dueño administra sus tareas"
on calendar_tasks for all
using (auth.uid() = mechanic_id)
with check (auth.uid() = mechanic_id);
