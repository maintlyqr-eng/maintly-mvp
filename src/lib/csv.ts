// Shared CSV helpers for admin export endpoints (Item 6 / Fase 2 punto 5 del
// pedido de Facu: "Exportación de reportes", y item 15: "tablas con ...
// exportación"). Plain string-building — no csv library — since this sandbox
// can't verify a new npm dependency installs cleanly on Facu's machine.

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvField).join(","));
  // Leading BOM so Excel opens the UTF-8 file without mangling accented es/pt text.
  return "\uFEFF" + lines.join("\r\n");
}

export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
