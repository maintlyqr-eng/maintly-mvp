import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware drop-in replacements for next/link and next/navigation.
// Any internal link that points at a page which HAS been migrated under
// src/app/[locale]/ should use these (so the link keeps whatever locale the
// visitor is currently reading in). Links that point at pages which have
// NOT been migrated yet should keep using plain <a href="..."> / next/link —
// those targets don't have a localized version to link to yet.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
