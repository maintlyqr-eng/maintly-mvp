-- ============================================================
-- Compartir equipos entre Maintlers guardados.
--
-- Facu's ask: NOT an ownership transfer — a mechanic who can't get to
-- the physical QR right now (forgot their phone, whatever the reason)
-- should be able to have another Maintler push the equipment straight
-- into their own account instead. "es lo mismo que si hubiese escaneado
-- el qr el mismo, solo que en este caso otro mecanico se lo envia para
-- que lo agregue en su propio sistema" — full access, same as the
-- existing scan-and-add flow (LinkExistingAssetModal.tsx), not a
-- read-only view.
--
-- mechanic_assets (schema.sql) is already exactly "which equipment does
-- this mechanic have in their own workshop list" — scanning a QR just
-- upserts a row there. So "sharing" is: mechanic A, who already has the
-- asset in their own mechanic_assets, inserts a row for mechanic B
-- instead of (or in addition to) themselves. Two additions needed:
--
--   1. A `shared_by` column, so a shared-in row is distinguishable from
--      one the recipient added themselves (for a "Shared by X" badge in
--      the UI, and so the original sharer can revoke it later).
--   2. New RLS policies letting A insert into B's row set — the existing
--      insert policy only allows `auth.uid() = mechanic_id` (adding to
--      your OWN list). Added as new, additional permissive policies
--      (same pattern as 021_fix_mechanics_public_read.sql) rather than
--      replacing the existing ones — Postgres ORs same-command permissive
--      policies together, so this only opens access, never narrows it.
--
-- Trust boundary (assumption, flagged to Facu — easy to loosen later if
-- he wants "share with anyone"): restricted to Maintlers already in the
-- sharer's maintler_saved_contacts, same circle already used for
-- messaging/connections. Since this grants full read+write on the asset
-- (same as a real scan), keeping it to trusted saved contacts avoids a
-- stranger being able to dump equipment into someone's workshop list.
-- ============================================================

alter table public.mechanic_assets
  add column if not exists shared_by uuid references public.mechanics(id) on delete set null;

create index if not exists mechanic_assets_shared_by_idx on public.mechanic_assets (shared_by);

-- Let A insert a row for B (the recipient), only when:
--   - A is honestly recording themselves as the sharer (shared_by = auth.uid())
--   - A already has this exact asset in their own workshop list (can't
--     share equipment you don't yourself have access to)
--   - B is someone A has saved as a Maintler (the trust boundary above)
create policy "mechanic_assets: compartir con un maintler guardado"
  on public.mechanic_assets for insert
  with check (
    shared_by = auth.uid()
    and exists (
      select 1 from public.mechanic_assets ma
      where ma.mechanic_id = auth.uid() and ma.asset_id = mechanic_assets.asset_id
    )
    and exists (
      select 1 from public.maintler_saved_contacts msc
      where msc.owner_id = auth.uid() and msc.saved_id = mechanic_assets.mechanic_id
    )
  );

-- Let the original sharer see the rows they've granted (their own SELECT
-- policy only covers auth.uid() = mechanic_id, i.e. their own workshop —
-- this is the separate "shares I've handed out" view, needed for any
-- future "manage who I shared this with" UI).
create policy "mechanic_assets: quien comparte ve lo que compartio"
  on public.mechanic_assets for select
  using (auth.uid() = shared_by);

-- Let the original sharer revoke access they granted, in addition to the
-- existing "recipient can remove it from their own list" delete policy.
create policy "mechanic_assets: quien comparte puede revocar"
  on public.mechanic_assets for delete
  using (auth.uid() = shared_by);
