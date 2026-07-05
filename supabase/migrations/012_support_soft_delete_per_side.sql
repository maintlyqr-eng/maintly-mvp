-- "Delete conversation" needs to be independent per side. If an admin
-- deletes a support thread, mechanics should still have their own copy
-- (so if someone on the team clears conversations, there's no way to hide
-- a complaint from the other side) — and vice versa. A thread only truly
-- disappears once BOTH sides have cleared it.
--
-- Modeled as two "hidden" flags per message row rather than deleting rows,
-- so nothing is ever destroyed by a one-sided action. New messages sent
-- after a clear default to visible again on both sides.

alter table support_messages add column if not exists hidden_for_admin boolean not null default false;
alter table support_messages add column if not exists hidden_for_mechanic boolean not null default false;
