-- One-time cleanup: before the Support conversation redesign, admin replies
-- to mechanics were inserted into "messages" (marked from_admin = true).
-- Those old rows are stuck there, invisible to the new "Contact Support"
-- thread and to the "clear conversation" feature (which only manages
-- "support_messages") — that's why a couple of legacy Maintly Team messages
-- kept showing up in the main inquiries list even after clearing the
-- conversation. This moves them into support_messages (preserving the
-- original timestamp and read state) and removes them from "messages", so
-- every piece of admin<->mechanic history lives in exactly one place.

insert into support_messages (mechanic_id, body, from_admin, read, created_at)
select mechanic_id, body, true, read, created_at
from messages
where from_admin = true;

delete from messages where from_admin = true;
