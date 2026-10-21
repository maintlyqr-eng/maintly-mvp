-- Catálogo "aprendido": marcas y modelos que ya existen en activos reales,
-- para sumarlos a las sugerencias del catálogo fijo (src/lib/vehicleCatalog.ts).
-- Ej.: alguien carga un generador Aggreko 1000 kVA que no está en la lista;
-- a partir de ahí se sugiere.
--
-- Anti-ruido: un par marca/modelo ajeno solo se sugiere si lo cargaron al
-- menos 2 cuentas distintas (un error de tipeo de una sola persona no se
-- propaga). Los pares cargados por la propia cuenta se devuelven siempre.
-- Solo activos sin borrar. No expone nada más que marca/modelo/tipo.

create or replace function public.learned_vehicle_catalog(p_asset_type text)
returns table (brand text, model text)
language sql
security definer
set search_path = public
stable
as $$
  select brand, model
  from (
    select min(trim(a.brand)) as brand, min(trim(a.model)) as model,
           count(distinct a.created_by) as owners,
           bool_or(a.created_by = auth.uid()) as mine
    from public.assets a
    where a.asset_type = p_asset_type
      and a.deleted_at is null
      and a.merged_into is null
      and coalesce(trim(a.brand), '') <> ''
      and coalesce(trim(a.model), '') <> ''
    group by lower(trim(a.brand)), lower(trim(a.model))
  ) s
  where owners >= 2 or mine
  order by owners desc, brand, model
  limit 2000;
$$;

revoke all on function public.learned_vehicle_catalog(text) from public;
grant execute on function public.learned_vehicle_catalog(text) to authenticated;
