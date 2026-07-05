// Shared helper for the "km vs horas" distinction.
// Which unit makes sense depends on the kind of machine: vehicles that move
// around (cars, motorcycles) are tracked by distance (km); equipment that
// runs in place or by flight/engine time (generators, heavy machinery,
// boats, aircraft) is tracked by hours of use. The mechanic never has to
// pick — it's derived automatically from the asset's type.

export type UnitKind = "km" | "horas";

const HOUR_BASED_ASSET_TYPES = new Set(["generator", "machinery", "marine", "aviation"]);

export function getUnitKind(assetType: string | null | undefined): UnitKind {
  if (assetType && HOUR_BASED_ASSET_TYPES.has(assetType)) return "horas";
  return "km";
}

// "Km" or "Horas" — for labels, table headers, hints.
export function getUnitLabel(assetType: string | null | undefined): string {
  return getUnitKind(assetType) === "horas" ? "Horas" : "Km";
}

// "km" or "hrs" — compact form for inline stats (e.g. "1,200 km").
export function getUnitShort(assetType: string | null | undefined): string {
  return getUnitKind(assetType) === "horas" ? "hrs" : "km";
}

// Formats a numeric reading with the right unit for the given asset type.
// Returns "—" for null/undefined so callers don't need their own fallback.
export function formatUnitValue(
  value: number | null | undefined,
  assetType: string | null | undefined
): string {
  if (value == null) return "—";
  return `${value.toLocaleString()} ${getUnitShort(assetType)}`;
}
