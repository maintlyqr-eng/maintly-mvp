"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { LearnedPair } from "@/lib/vehicleCatalog";

// Pares marca/modelo ya cargados en activos reales (RPC learned_vehicle_catalog,
// migración 051). Se piden una vez por tipo de equipo mientras el formulario
// está abierto; si falla, se sigue solo con el catálogo fijo.
export function useLearnedCatalog(assetType: string | undefined, enabled: boolean): LearnedPair[] {
  const [pairs, setPairs] = useState<LearnedPair[]>([]);
  useEffect(() => {
    if (!enabled || !assetType) return;
    let cancelled = false;
    supabase.rpc("learned_vehicle_catalog", { p_asset_type: assetType }).then(({ data, error }) => {
      if (cancelled || error || !Array.isArray(data)) return;
      setPairs(data as LearnedPair[]);
    });
    return () => { cancelled = true; };
  }, [assetType, enabled]);
  return pairs;
}
