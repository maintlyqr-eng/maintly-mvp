-- Maintenance reminders — additive migration, safe to run on the live database.
-- Adds two nullable columns to service_records; does NOT drop or alter anything existing.
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query > paste > Run).
-- Do NOT run supabase/schema.sql again — it starts with destructive "drop table" statements.

alter table service_records
  add column if not exists next_due_date date,
  add column if not exists next_due_km_hours numeric;

comment on column service_records.next_due_date is 'Optional: date the mechanic expects the next service to be due, set manually per service record.';
comment on column service_records.next_due_km_hours is 'Optional: km/hours reading the mechanic expects the next service to be due, set manually per service record.';
