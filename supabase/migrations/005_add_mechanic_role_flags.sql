-- Roles for the "mechanics" table (which is, in practice, MaintlyQR's single
-- user/account table — every registered account lands here, whether they end
-- up acting as an asset owner, a mechanic, or both).
--
-- is_mechanic: whether this account is allowed to log service records
--   ("Add Service"). Existing accounts are grandfathered in as mechanics
--   since they were already adding services before this flag existed.
--   New accounts default to false and get activated on demand, the first
--   time they try to add a service ("Become a Mechanic" gate in the app).
--
-- NOTE: verification already has a column — "verified" on mechanics, already
-- used by the admin panel ("Verified"/"Pending" status). The app now shows
-- that same flag to end users as "Verified Mechanic" vs "Community Mechanic"
-- on service history / reports. No new column needed for that.

alter table mechanics add column if not exists is_mechanic boolean not null default true;
alter table mechanics alter column is_mechanic set default false;
