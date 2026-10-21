-- Ficha del empleado (Facu, 21/10/2026: "son mis empleados y tengo que
-- tener datos de ellos para escribirles para su cumpleaños o darles
-- regalos"). Solo la ve/edita Super Admin (capacidad admin_management).
-- salutation: 'f' (bienvenida) / 'm' (bienvenido) / 'n' (neutro), elegido
-- por quien invita; nunca se adivina por el nombre.
alter table public.admin_users
  add column if not exists display_name text,
  add column if not exists salutation text check (salutation in ('f','m','n')),
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists birth_date date,
  add column if not exists notes text;
