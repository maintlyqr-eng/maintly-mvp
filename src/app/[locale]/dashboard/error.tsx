"use client";

import ErrorFallback from "@/components/ErrorFallback";

// Facu (26 jul 2026): "en caso de q falle no quiero q se vea como q no
// existe" — catches any uncaught render error anywhere under
// /dashboard/* (this page, Mis Activos, Mis Servicios, Códigos QR,
// Calendario, etc. — Next.js applies one error.tsx to its whole segment
// and all nested routes below it that don't have a more specific one of
// their own) and shows the on-brand fallback instead of the browser's
// blank "This page couldn't load" screen.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} />;
}
