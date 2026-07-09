// Centralizes what was previously the same one-liner copy-pasted inline in
// ~15 places across the dashboard (sidebar footer, header avatar, various
// list rows) — computing a 2-letter fallback avatar label from a name.
export function getInitials(name: string, fallback = "ME"): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || fallback
  );
}
