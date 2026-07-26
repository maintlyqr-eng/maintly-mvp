"use client";

import ErrorFallback from "@/components/ErrorFallback";

// Facu (26 jul 2026): same as src/app/[locale]/dashboard/error.tsx, but
// scoped to the admin Control Center — this is the boundary that would've
// caught the "Minified React error #310" crash from earlier today.
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} />;
}
