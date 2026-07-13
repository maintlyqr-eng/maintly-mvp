// Shared, transparent scoring logic for a Maintler's public card — used
// by both the public /maintler/[code] profile page and the "My Maintler
// Card" / "Maintly Stats" section in Settings (round 6: Facu's desktop
// mockup put a stats grid in Settings too, so the exact same formula
// needs to be computable in both places instead of drifting apart).
//
// Every input here is a real number already shown elsewhere on the page
// it's used on — never a self-reported or hidden figure. See migration
// 025's comment for the fuller rationale (keeping this consistent with
// the "verified, tamper-proof" positioning the rest of the app has).

import { ShieldCheck, CalendarDays, Wrench, Box } from "lucide-react";

export type MaintlerStats = {
  services_count: number;
  assets_count: number;
  customers_count: number;
  repeat_customers_count: number;
};

export function yearsSince(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (365.25 * 24 * 3600 * 1000)));
}

export function computeScore(
  verified: boolean | null,
  stats: MaintlerStats,
  specialtyCount: number,
  years: number
) {
  let score = 1;
  if (verified) score += 1;
  if (stats.services_count >= 25) score += 1;
  if (stats.services_count >= 100) score += 1;
  if (years >= 2) score += 1;
  if (specialtyCount >= 2) score += 1;
  return Math.min(5, score);
}

export type Badge = { label: string; icon: typeof ShieldCheck; className: string };

// Optional translated labels — the badge text used to be hardcoded English
// literals baked directly into this function, which is shared by the public
// /maintler/[code] page (now localized under src/app/[locale]/) and the
// still-English "My Maintler Card" section in Settings. Rather than fork the
// scoring logic, this takes an optional `labels` override: pass translated
// strings from a localized caller (see the [locale] maintler page for the
// pattern), or omit it entirely and the English defaults below are used —
// exactly the previous behavior, so the not-yet-migrated Settings call site
// needs zero changes.
export type BadgeLabels = {
  verified: string;
  services100: string;
  services25: string;
  yearsActive: (years: number) => string;
  multiAssetSpecialist: string;
};

const DEFAULT_BADGE_LABELS: BadgeLabels = {
  verified: "Verified",
  services100: "100+ Services",
  services25: "25+ Services",
  yearsActive: (years) => `${years}+ Years Active`,
  multiAssetSpecialist: "Multi-Asset Specialist",
};

export function computeBadges(
  verified: boolean | null,
  stats: MaintlerStats,
  specialtyCount: number,
  years: number,
  labels: BadgeLabels = DEFAULT_BADGE_LABELS
): Badge[] {
  const badges: Badge[] = [];
  if (verified) badges.push({ label: labels.verified, icon: ShieldCheck, className: "bg-emerald-50 text-emerald-700 border-emerald-200" });
  if (stats.services_count >= 100) badges.push({ label: labels.services100, icon: Wrench, className: "bg-blue-50 text-blue-700 border-blue-200" });
  else if (stats.services_count >= 25) badges.push({ label: labels.services25, icon: Wrench, className: "bg-blue-50 text-blue-700 border-blue-200" });
  if (years >= 5) badges.push({ label: labels.yearsActive(years), icon: CalendarDays, className: "bg-amber-50 text-amber-700 border-amber-200" });
  if (specialtyCount >= 3) badges.push({ label: labels.multiAssetSpecialist, icon: Box, className: "bg-purple-50 text-purple-700 border-purple-200" });
  return badges;
}
