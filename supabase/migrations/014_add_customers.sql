-- Customers: whoever is responsible for the maintenance of a piece of
-- equipment (as opposed to the mechanic, who performs it). Both are just
-- attributes of each individual service — the equipment itself is the only
-- thing that stays fixed. So customer_id lives on service_records (and on
-- calendar_tasks, for scheduling future work before a service exists), not
-- as a permanent "owner" on the asset. assets.customer_id is only a cache of
-- "whoever was the customer on the most recently logged service" for quick
-- display — it updates itself automatically whenever a new service is
-- logged with a different customer, no manual "transfer" step needed.

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  mechanic_id uuid not null references mechanics(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists customers_mechanic_idx on customers (mechanic_id);

alter table customers enable row level security;

drop policy if exists "customers: el mecanico administra los suyos" on customers;
create policy "customers: el mecanico administra los suyos"
on customers for all
using (auth.uid() = mechanic_id)
with check (auth.uid() = mechanic_id);

alter table service_records add column if not exists customer_id uuid references customers(id) on delete set null;
create index if not exists service_records_customer_idx on service_records (customer_id);

alter table assets add column if not exists customer_id uuid references customers(id) on delete set null;
create index if not exists assets_customer_idx on assets (customer_id);

alter table calendar_tasks add column if not exists customer_id uuid references customers(id) on delete set null;
