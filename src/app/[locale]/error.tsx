"use client";

import ErrorFallback from "@/components/ErrorFallback";

// Facu (26 jul 2026): catch-all for everything else under a locale
// segment that doesn't already have its own more specific error.tsx
// (marketing pages, login, register, etc.) — dashboard/ and admin/ each
// have their own copy of this same boundary so a crash there resets just
// that section instead of this outer one.
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} />;
}
