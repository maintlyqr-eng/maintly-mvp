// Shared specialty-category key map — used to translate a Maintler's
// asset_type specialties (from get_maintler_specialty_breakdown) via the
// MaintlerPage.specialtyTypes i18n namespace.
//
// 26 jul 2026: pulled out of src/app/[locale]/maintler/[code]/page.tsx into
// its own lib file so MaintlerCardCanvas.tsx (a shared component also used
// by Settings and NewAssetModalIntl) could reuse the exact same mapping
// without creating a circular import between a page.tsx and a component it
// itself renders.
//
// Deliberately its own key set, not the shared AssetTypes namespace used by
// the Asset/Report pages — the original English here used plural forms for
// some specialties ("Motorcycles", "Generators") since it reads as a
// specialty category, not a single asset's type. Keeping that distinction
// instead of silently flattening it to the singular AssetTypes wording.
export const SPECIALTY_TYPE_KEYS: Record<string, string> = {
  automotive: "automotive", motorcycle: "motorcycle", generator: "generator",
  machinery: "machinery", marine: "marine", aviation: "aviation",
};
